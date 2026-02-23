import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { getSessionSecret } from "./runtime-config";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const sessionSecret = getSessionSecret();
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
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

export async function setupGoogleAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Google OAuth strategy
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: `${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}/api/auth/google/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Generate username from email or name
      const email = profile.emails?.[0]?.value || '';
      const firstName = profile.name?.givenName || '';
      const lastName = profile.name?.familyName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      
      // Generate username from email (before @) or from name
      let username = email.split('@')[0] || firstName.toLowerCase();
      if (!username) {
        username = `user_${profile.id}`;
      }
      
      // Create or update user based on Google profile
      const user = await storage.upsertUser({
        id: profile.id,
        email: email,
        fullName: fullName,
        username: username,
        firstName: firstName,
        lastName: lastName,
        profileImageUrl: profile.photos?.[0]?.value || '',
        isPrimary: false,
        role: 'content_creator'
      });
      
      return done(null, user);
    } catch (error) {
      console.error('Error in Google Auth strategy:', error);
      return done(error, false);
    }
  }));

  passport.serializeUser((user: any, cb) => cb(null, user.id));
  
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await storage.getUser(id);
      return cb(null, user || false);
    } catch (error) {
      return cb(error);
    }
  });

  // Auth routes
  app.get("/api/auth/google", 
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get("/api/auth/google/callback",
    passport.authenticate("google", { 
      failureRedirect: "/auth?error=google_auth_failed",
      failureMessage: true 
    }),
    (req, res) => {
      // Successful authentication, redirect home
      console.log("Google OAuth successful for user:", req.user);
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
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
