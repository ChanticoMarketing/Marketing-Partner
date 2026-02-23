import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import connectPgSimple from "connect-pg-simple";
import { DatabaseStorage } from "./storage";
import { User as SchemaUser, InsertUser, loginSchema, insertUserSchema } from "../shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { getSessionSecret } from "./runtime-config";

// This will be set in routes.ts
declare global {
  var storage: DatabaseStorage;
}

// Define our own type for Express.User
type AppUser = {
  id: string; // Changed to string to match database VARCHAR
  username: string;
  password: string;
  fullName: string;
  isPrimary: boolean;
  createdAt: Date;
};

// Extend Express namespace with our user type
declare global {
  namespace Express {
    interface User extends AppUser { }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSecret = getSessionSecret();
  const PgSession = connectPgSimple(session);
  const sessionStore = new PgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    createTableIfMissing: true,
  });

  const sessionSettings: session.SessionOptions = {
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configuramos passport para que acepte tanto username como email
  passport.use(
    new LocalStrategy(
      {
        // Cambiamos el campo por defecto 'username' por 'identifier'
        usernameField: 'identifier',
        passwordField: 'password'
      },
      async (identifier, password, done) => {
        try {
          // Buscar usuario por identificador (username o email)
          const user = await storage.getUserByIdentifier(identifier);

          if (!user || !(await comparePasswords(password, user.password || ""))) {
            return done(null, false, { message: "Credenciales inválidas" });
          } else {
            return done(null, user as unknown as Express.User);
          }
        } catch (error) {
          return done(error);
        }
      }
    ),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user as unknown as Express.User);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);

      // Verificamos tanto el nombre de usuario como el correo electrónico
      const existingUsername = await storage.getUserByUsername(validatedData.username);
      if (existingUsername) {
        return res.status(400).json({ message: "El nombre de usuario ya existe" });
      }

      // Verificar si el correo electrónico ya existe (si se proporciona)
      if (validatedData.email) {
        const existingEmail = await storage.getUserByEmail(validatedData.email);
        if (existingEmail) {
          return res.status(400).json({ message: "El correo electrónico ya está registrado" });
        }
      }

      const hashedPassword = await hashPassword(validatedData.password || "");
      const newUser = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });

      // Remove password from response
      const { password, ...userWithoutPassword } = newUser;

      req.login(newUser as unknown as Express.User, (err) => {
        if (err) return next(err);
        return res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    try {
      // Modificamos el esquema de validación para usar 'identifier' en lugar de 'username'
      const loginData = req.body;

      // Verificamos que el campo identifier esté presente
      if (!loginData.identifier) {
        return res.status(400).json({ message: "Se requiere nombre de usuario o correo electrónico" });
      }

      // Verificamos que el campo password esté presente
      if (!loginData.password) {
        return res.status(400).json({ message: "Se requiere contraseña" });
      }

      passport.authenticate("local", (err: Error, user: Express.User) => {
        if (err) return next(err);
        if (!user) {
          return res.status(401).json({ message: "Credenciales inválidas" });
        }

        req.login(user, (loginErr) => {
          if (loginErr) return next(loginErr);

          // Remove password from response
          const { password, ...userWithoutPassword } = user;
          return res.status(200).json(userWithoutPassword);
        });
      })(req, res, next);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      next(error);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Remove password from response
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Endpoints para recuperación de contraseña

  // 1. Solicitar restablecimiento de contraseña
  app.post("/api/request-password-reset", async (req, res, next) => {
    try {
      const { identifier } = req.body;

      if (!identifier) {
        return res.status(400).json({ message: "Se requiere nombre de usuario" });
      }

      // Buscar usuario
      const user = await global.storage.getUserByIdentifier(identifier);

      if (!user) {
        // Por seguridad, no revelamos si el usuario existe o no
        return res.status(200).json({
          message: "Si el usuario existe, se ha enviado un correo con instrucciones para restablecer la contraseña"
        });
      }

      // Generar token
      const token = await global.storage.createPasswordResetToken(user.id);

      // En un entorno real, enviaríamos un correo electrónico
      // Para nuestro caso de prueba, devolvemos el token en la respuesta
      console.log(`Token de restablecimiento para ${identifier}: ${token.token}`);

      return res.status(200).json({
        message: "Si el usuario existe, se ha enviado un correo con instrucciones para restablecer la contraseña",
        // Solo para pruebas, en un entorno real no enviaríamos esto en la respuesta
        debugToken: token.token
      });

    } catch (error) {
      console.error("Error requesting password reset:", error);
      next(error);
    }
  });

  // 2. Verificar token de restablecimiento
  app.get("/api/verify-reset-token/:token", async (req, res, next) => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({ message: "Token requerido" });
      }

      // Verificar token
      const tokenData = await global.storage.getPasswordResetToken(token);

      if (!tokenData) {
        return res.status(400).json({ message: "Token inválido o expirado" });
      }

      return res.status(200).json({ valid: true });

    } catch (error) {
      console.error("Error verifying reset token:", error);
      next(error);
    }
  });

  // 3. Restablecer contraseña
  app.post("/api/reset-password", async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token y nueva contraseña son requeridos" });
      }

      // Verificar token
      const tokenData = await global.storage.getPasswordResetToken(token);

      if (!tokenData) {
        return res.status(400).json({ message: "Token inválido o expirado" });
      }

      // Obtener usuario
      const user = await global.storage.getUser(tokenData.userId.toString());

      if (!user) {
        return res.status(400).json({ message: "Usuario no encontrado" });
      }

      // Hashear nueva contraseña
      const hashedPassword = await hashPassword(newPassword);

      // Actualizar contraseña
      await global.storage.updateUser(user.id, { password: hashedPassword });

      // Eliminar token
      await global.storage.deletePasswordResetToken(token);

      return res.status(200).json({ message: "Contraseña restablecida con éxito" });

    } catch (error) {
      console.error("Error resetting password:", error);
      next(error);
    }
  });

  // Middleware to check if user is authenticated
  function isAuthenticated(req: Request, res: any, next: any) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized: Please login" });
  }

  // Middleware to check if user is primary
  function isPrimaryUser(req: Request, res: any, next: any) {
    if (req.isAuthenticated() && req.user.isPrimary) {
      return next();
    }
    res.status(403).json({ message: "Forbidden: Requires primary user access" });
  }

  return { isAuthenticated, isPrimaryUser, sessionStore };
}
