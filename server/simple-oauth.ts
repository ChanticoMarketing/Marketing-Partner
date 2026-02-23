import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import { getSessionSecret, isProductionEnv } from "./runtime-config";

function getPgConnectionOptions() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set for session handling");
  }

  const isLocalHost = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
  const disableSSL = process.env.SUPABASE_USE_SSL === "false" || isLocalHost;

  const connection: Record<string, unknown> = {
    connectionString: databaseUrl,
  };

  if (!disableSSL) {
    connection.ssl = {
      rejectUnauthorized: false,
    };
  }

  return connection;
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const sessionSecret = getSessionSecret();
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conObject: getPgConnectionOptions(),
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      maxAge: sessionTtl,
    },
  });
}

export async function setupSimpleGoogleAuth(app: Express) {
  app.set("trust proxy", 1);
  const sessionSecret = getSessionSecret();
  const isProduction = isProductionEnv();

  // Configure session middleware with controlled fallback
  try {
    const PgSession = connectPg(session);

    app.use(session({
      store: new PgSession({
        tableName: 'sessions',
        conObject: getPgConnectionOptions(),
        errorLog: () => { } // Suppress error logs
      }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      }
    }));
  } catch (error) {
    if (isProduction) {
      throw new Error("PostgreSQL session store initialization failed in production.");
    }

    console.warn('PostgreSQL session store failed, using memory store fallback in development.');
    app.use(session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      }
    }));
  }
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Google OAuth strategy with dynamic callback URL
  const getCallbackURL = (req: any) => {
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('host');
    return `${protocol}://${host}/api/auth/google/callback`;
  };

  // Dynamic callback URL based on current host
  const port = process.env.PORT || '5080';
  const currentHost = process.env.REPLIT_DOMAINS || `localhost:${port}`;
  const callbackURL = currentHost.includes('localhost')
    ? `http://${currentHost}/api/auth/google/callback`
    : `https://${currentHost}/api/auth/google/callback`;

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn("⚠️ Google OAuth credentials missing. Google Auth will not work.");
  } else {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: callbackURL
    },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Generate user data from Google profile
          const email = profile.emails?.[0]?.value || '';
          const firstName = profile.name?.givenName || '';
          const lastName = profile.name?.familyName || '';
          const fullName = `${firstName} ${lastName}`.trim() || email;

          // Generate username from email or name
          let username = email.split('@')[0] || firstName.toLowerCase();
          if (!username) {
            username = `user_${profile.id}`;
          }

          // Try to find existing user first
          const [existingUser] = await db.select().from(users).where(eq(users.id, profile.id));

          if (existingUser) {
            // Update existing user with latest profile data
            const [updatedUser] = await db.update(users)
              .set({
                email: email,
                firstName: firstName,
                lastName: lastName,
                fullName: fullName,
                profileImageUrl: profile.photos?.[0]?.value || '',
                updatedAt: new Date(),
              })
              .where(eq(users.id, profile.id))
              .returning();

            // Verificar si el usuario ya está en el equipo de Cohete Brands
            await ensureUserInTeam(updatedUser.id, email);

            return done(null, updatedUser as any);
          } else {
            // Create new user
            const [newUser] = await db.insert(users)
              .values({
                id: profile.id,
                email: email,
                firstName: firstName,
                lastName: lastName,
                fullName: fullName,
                username: username,
                profileImageUrl: profile.photos?.[0]?.value || '',
                isPrimary: false,
                role: 'content_creator',
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();

            // Asignar automáticamente al equipo de Cohete Brands
            await ensureUserInTeam(newUser.id, email);

            return done(null, newUser as any);
          }
        } catch (error) {
          console.error('Error in Google Auth strategy:', error);
          return done(error, false);
        }
      }));
  }

  passport.serializeUser((user: any, cb) => cb(null, user.id));

  passport.deserializeUser(async (id: string, cb) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return cb(null, (user as any) || false);
    } catch (error) {
      return cb(error);
    }
  });

  // Auth routes
  app.get("/api/auth/google", (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({
        message: "Google Login is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment variables.",
        code: "GOOGLE_AUTH_NOT_CONFIGURED"
      });
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  app.get("/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/auth" }),
    (req, res) => {
      // Successful authentication, redirect home
      res.redirect("/");
    }
  );

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Error logging out" });
      }
      res.redirect("/auth");
    });
  });

  // Auth user endpoint
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      res.json(req.user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Legacy user endpoint for compatibility 
  app.get('/api/user', isAuthenticated, async (req: any, res) => {
    try {
      res.json(req.user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

async function ensureUserInTeam(userId: string, email: string) {
  if (email.endsWith('@cohetebrands.com')) {
    try {
      // Verificar que el usuario existe en la base de datos
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        console.error(`Usuario ${userId} no encontrado en la base de datos`);
        return;
      }

      // Actualizar el usuario para marcarlo como parte del equipo de Cohete Brands
      await db.update(users)
        .set({
          department: 'Cohete Brands',
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      console.log(`✅ Usuario ${userId} (${email}) marcado como miembro del equipo de Cohete Brands`);
      console.log(`📊 Departamento actualizado a: Cohete Brands`);

    } catch (error) {
      console.error('Error al procesar usuario de Cohete Brands:', error);
    }
  } else {
    console.log(`Usuario ${userId} (${email}) no pertenece al dominio de Cohete Brands`);
  }
}
