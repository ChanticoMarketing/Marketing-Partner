// ===== IMPORTACIONES DE EXPRESS Y TIPOS =====
// Tipos de Express para tipado TypeScript
import type { Express, Request, Response, NextFunction } from "express";
// Servidor HTTP de Node.js
import { createServer, type Server } from "http";

// ===== IMPORTACIONES DE AUTENTICACIÓN =====
// Sistema de autenticación con Google OAuth
import { setupSimpleGoogleAuth, isAuthenticated } from "./simple-oauth";

// ===== IMPORTACIONES DE BASE DE DATOS =====
// Capa de abstracción para almacenamiento de datos
import { storage } from "./storage";

// ===== IMPORTACIONES DE LIBRERÍAS =====
// Express framework
import express from "express";
// Librería para hash de contraseñas
import bcrypt from "bcryptjs";
// Middleware para manejo de archivos subidos
import multer from "multer";
import { logger } from "./logger";
import { filterOutputLeakage } from "./ai-sanitizer";

// Helper function for password hashing
const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

// Helper function for password comparison
const comparePasswords = async (supplied: string, stored: string): Promise<boolean> => {
  return await bcrypt.compare(supplied, stored);
};

// Helper middleware for authentication check
const requireAuth = (req: any, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Acceso denegado. Usuario no autenticado." });
  }
  next();
};

// Helper middleware for primary user check
const isPrimaryUser = (req: any, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.isPrimary) {
    return res.status(403).json({ message: "Acceso denegado. Solo usuarios primarios." });
  }
  next();
};

const ensureProjectAccess = async (req: any, res: Response, projectId: number): Promise<boolean> => {
  if (!req.user?.id) {
    res.status(401).json({ message: "Usuario no autenticado" });
    return false;
  }

  const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);
  if (!hasAccess) {
    res.status(403).json({ message: "You don't have access to this project" });
    return false;
  }

  return true;
};
import fs from "fs";
import path from "path";
// Dynamic import for pdf-parse to handle deployment issues
let pdfParse: any = null;

async function initializePdfParse() {
  if (!pdfParse) {
    try {
      const module = await import("pdf-parse");
      pdfParse = module.default;
    } catch (error) {
      console.warn("pdf-parse not available, using fallback");
      pdfParse = () => ({ text: "PDF parsing not available in this environment" });
    }
  }
  return pdfParse;
}
import { analyzeDocument, analyzeMarketingImage, processChatMessage } from "./ai-analyzer";
import { generateSchedule } from "./ai-scheduler";
import { generateConcepts } from "./ai-scheduler-concepts";
import { geminiService } from "./gemini-integration";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import ExcelJS from 'exceljs';
import { db } from "./db";
import { eq, asc, desc, and, or, sql, like, inArray } from "drizzle-orm";
import * as htmlPdf from 'html-pdf-node';
import { jsPDF } from 'jspdf';
import { AIModel } from "../shared/schema";
import * as schema from "../shared/schema";
import { format } from "date-fns";
import {
  insertProjectSchema,
  insertAnalysisResultsSchema,
  insertScheduleSchema,
  insertChatMessageSchema,
  insertTaskSchema,
  insertUserSchema,
  insertProductSchema,
  insertProjectViewSchema,
  insertAutomationRuleSchema,
  insertTimeEntrySchema,
  insertTagSchema,
  insertCollaborativeDocSchema,
  updateProfileSchema,
  scheduleEntries,
  Product
} from "../shared/schema";
import { WebSocketServer } from "ws";

// Global declaration for storage
declare global {
  var storage: any;
}

// Initialize global storage
global.storage = storage as any;

// Obtener directorio actual compatible con ESM
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Definir ruta base para uploads
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);
const baseUploadDir = path.join(currentDirPath, '..', 'uploads');

// Set up storage for file uploads
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Usar la ruta base definida arriba
    if (!fs.existsSync(baseUploadDir)) {
      fs.mkdirSync(baseUploadDir, { recursive: true });
    }
    cb(null, baseUploadDir);
  },
  filename: (req, file, cb) => {
    // Create a unique filename
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Configuración de multer para documentos (PDF, DOCX, TXT)
const documentUpload = multer({
  storage: multerStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept PDF, DOCX, and TXT files
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.') as any);
    }
  }
});

// Configuración de multer para imágenes (JPG, PNG, GIF, WEBP)
const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit para imágenes
  fileFilter: (req, file, cb) => {
    // Aceptar solo imágenes
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no válido. Solo se permiten imágenes JPG, PNG, GIF o WEBP.') as any);
    }
  }
});

// Configuración específica para análisis de imágenes de marketing con IA
const marketingImageUpload = multer({
  storage: multerStorage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB limit para imágenes de marketing (algunas pueden ser de mayor calidad)
  fileFilter: (req, file, cb) => {
    // Aceptar solo formatos de imagen que funcionen bien con Gemini Vision
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no válido para análisis de IA. Solo se permiten imágenes JPG, PNG o WEBP.') as any);
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Agregar middleware para capturar errores de rutas
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Route registration error:', err);
    next(err);
  });

  // Setup Google OAuth authentication
  await setupSimpleGoogleAuth(app);

  // Prevent ambiguous behavior by keeping only the first registration per method+path.
  const routeMethods = ["get", "post", "put", "patch", "delete"] as const;
  const registeredRouteSignatures = new Set<string>();

  for (const method of routeMethods) {
    const originalMethod = (app as any)[method].bind(app);

    (app as any)[method] = (routePath: any, ...handlers: any[]) => {
      // Prevent intercepting Express settings lookups
      if (method === "get" && handlers.length === 0) {
        return originalMethod(routePath);
      }
      const normalizedPath =
        typeof routePath === "string"
          ? routePath
          : Array.isArray(routePath)
            ? routePath.map((pathPart: any) => String(pathPart)).join("|")
            : String(routePath);

      const signature = `${method.toUpperCase()} ${normalizedPath}`;
      if (registeredRouteSignatures.has(signature)) {
        logger.warn("[ROUTES]", `Skipping duplicate route registration: ${signature}`);
        return app;
      }

      registeredRouteSignatures.add(signature);
      return originalMethod(routePath, ...handlers);
    };
  }

  // Enforce project-level authorization across every /api/projects/:projectId/* endpoint.
  app.use("/api/projects/:projectId", isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    const projectId = Number.parseInt(req.params.projectId, 10);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    if (!await ensureProjectAccess(req, res, projectId)) {
      return;
    }

    next();
  });

  // Serve static files for privacy policy
  app.use('/static', express.static(path.join(currentDirPath, 'public')));

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(currentDirPath, '..', 'uploads')));

  // Privacy policy route
  app.get('/privacy-policy', (req, res) => {
    res.sendFile(path.join(currentDirPath, 'public', 'privacy-policy.html'));
  });

  // Terms of service route
  app.get('/terms-of-service', (req, res) => {
    res.sendFile(path.join(currentDirPath, 'public', 'terms-of-service.html'));
  });

  // ===== LOCAL AUTH ROUTES (Username/Password) =====
  // POST /api/login — authenticate with identifier (username or email) + password
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { identifier, password } = req.body;

      if (!identifier) {
        return res.status(400).json({ message: "Se requiere nombre de usuario o correo electr\u00F3nico" });
      }
      if (!password) {
        return res.status(400).json({ message: "Se requiere contrase\u00F1a" });
      }

      // Look up user by username OR email
      const user = await global.storage.getUserByIdentifier(identifier);

      if (!user || !user.password) {
        return res.status(401).json({ message: "Credenciales inv\u00E1lidas" });
      }

      const isValid = await comparePasswords(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Credenciales inv\u00E1lidas" });
      }

      // Log the user in via express-session / passport
      req.login(user, (err: any) => {
        if (err) {
          console.error("Login session error:", err);
          return res.status(500).json({ message: "Error al iniciar sesi\u00F3n" });
        }

        const { password: _, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Error interno al iniciar sesi\u00F3n" });
    }
  });

  // POST /api/register — create a new local account
  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      const { fullName, username, email, password } = req.body;

      if (!username || !password || !fullName) {
        return res.status(400).json({ message: "Nombre completo, usuario y contrase\u00F1a son requeridos" });
      }

      const existingUser = await global.storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "El nombre de usuario ya existe" });
      }

      if (email) {
        const existingEmail = await global.storage.getUserByEmail(email);
        if (existingEmail) {
          return res.status(400).json({ message: "El correo electr\u00F3nico ya est\u00E1 registrado" });
        }
      }

      const hashedPw = await hashPassword(password);
      const newUser = await global.storage.createUser({
        fullName,
        username,
        email: email || null,
        password: hashedPw,
        isPrimary: false,
        role: 'content_creator',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      req.login(newUser, (err: any) => {
        if (err) {
          console.error("Register session error:", err);
          return res.status(500).json({ message: "Error al registrar sesi\u00F3n" });
        }
        const { password: _, ...userWithoutPassword } = newUser;
        return res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Error interno al registrar usuario" });
    }
  });

  // POST /api/logout — destroy session
  app.post("/api/logout", (req: Request, res: Response) => {
    req.logout((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesi\u00F3n" });
      }
      res.sendStatus(200);
    });
  });

  // ===== BLOQUE 2: GESTIÓN DE USUARIOS =====
  // User Management API

  // Endpoint para la ruta secreta de creación de cuenta de administrador principal
  const PRIMARY_ACCOUNT_SECRET = process.env.PRIMARY_ACCOUNT_SECRET?.trim();

  app.post("/api/create-primary-account", async (req: Request, res: Response) => {
    try {
      if (!PRIMARY_ACCOUNT_SECRET) {
        return res.status(503).json({
          message: "PRIMARY_ACCOUNT_SECRET no está configurado. Endpoint deshabilitado por seguridad."
        });
      }

      console.log("Creating primary account request:", {
        body: { ...req.body, password: '[REDACTED]', secretKey: '[REDACTED]' }
      });

      const { fullName, username, password, secretKey } = req.body;

      // Validar datos
      if (!fullName || !username || !password || !secretKey) {
        console.log("Missing required fields");
        return res.status(400).json({ message: "Todos los campos son requeridos" });
      }

      // Verificar clave secreta
      if (secretKey !== PRIMARY_ACCOUNT_SECRET) {
        console.log("Incorrect secret key");
        return res.status(403).json({ message: "Clave secreta incorrecta" });
      }

      // Verificar si el usuario ya existe
      const existingUser = await global.storage.getUserByUsername(username);
      if (existingUser) {
        console.log("User already exists:", username);
        return res.status(400).json({ message: "El nombre de usuario ya existe" });
      }

      // Crear usuario primario
      const hashedPassword = await hashPassword(password);
      const newUser = await global.storage.createUser({
        fullName,
        username,
        password: hashedPassword,
        isPrimary: true,
        role: 'admin',
        preferredLanguage: 'es',
        theme: 'light',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log("Primary user created successfully:", newUser.username);

      // Eliminar password del response
      const { password: _, ...userWithoutPassword } = newUser;

      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating primary account:", error);
      res.status(500).json({ message: "Error al crear cuenta primaria" });
    }
  });

  // Endpoint para listar usuarios (solo para usuarios primarios)
  app.get("/api/admin/users", isAuthenticated, isPrimaryUser, async (req: Request, res: Response) => {
    try {
      const users = await global.storage.getAllUsers();

      // Eliminar contraseñas del resultado
      const sanitizedUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error listing users:", error);
      res.status(500).json({ message: "Error al listar usuarios" });
    }
  });

  // Endpoint para crear usuarios (solo para usuarios primarios)
  app.post("/api/admin/users", isAuthenticated, isPrimaryUser, async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      // Verificar si el usuario ya existe
      const existingUser = await global.storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "El nombre de usuario ya existe" });
      }

      // Los usuarios primarios solo pueden ser creados por otros usuarios primarios
      // El valor de isPrimary vendrá directamente desde el frontend

      // Crear usuario
      const hashedPassword = await hashPassword(userData.password);
      const newUser = await global.storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // Eliminar password del response
      const { password, ...userWithoutPassword } = newUser;

      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Error al crear usuario" });
    }
  });

  // Endpoint para actualizar usuarios (solo para usuarios primarios)
  app.patch("/api/admin/users/:id", isAuthenticated, isPrimaryUser, async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;

      if (!userId) {
        return res.status(400).json({ message: "ID de usuario requerido" });
      }

      // Verificar que el usuario existe (ahora maneja tanto IDs numéricos como strings)
      const user = await global.storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const updateData = req.body;

      // No permitir modificar isPrimary del propio usuario
      if (userId === req.user.id && updateData.hasOwnProperty('isPrimary')) {
        return res.status(400).json({ message: "No puedes modificar tus propios permisos de administrador" });
      }

      // Si se está removiendo permisos de administrador, verificar que no sea el último admin
      if (updateData.isPrimary === false && user.isPrimary) {
        const allUsers = await global.storage.getAllUsers();
        const primaryUsers = allUsers.filter(u => u.isPrimary && u.id !== userId);

        if (primaryUsers.length === 0) {
          return res.status(400).json({ message: "No se puede remover permisos al último usuario administrador" });
        }
      }

      // Actualizar usuario
      const updatedUser = await global.storage.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: "Error al actualizar usuario" });
      }

      // Eliminar password del response
      const { password, ...userWithoutPassword } = updatedUser;

      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Error al actualizar usuario" });
    }
  });

  // Endpoint para eliminar usuarios (solo para usuarios primarios)
  app.delete("/api/admin/users/:id", isAuthenticated, isPrimaryUser, async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;

      if (!userId) {
        return res.status(400).json({ message: "ID de usuario requerido" });
      }

      // No permitir eliminar el propio usuario
      if (userId === req.user.id) {
        return res.status(400).json({ message: "No puedes eliminar tu propia cuenta" });
      }

      // Verificar que el usuario existe
      const user = await global.storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Si es un usuario primario, verificar que no sea el último
      if (user.isPrimary) {
        const allUsers = await global.storage.getAllUsers();
        const primaryUsers = allUsers.filter(u => u.isPrimary);

        if (primaryUsers.length <= 1) {
          return res.status(400).json({ message: "No se puede eliminar el último usuario administrador" });
        }
      }

      // Eliminar usuario
      await global.storage.deleteUser(userId);

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Error al eliminar usuario" });
    }
  });


  // Endpoint para obtener las estadísticas del usuario
  app.get("/api/user/stats", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;

      // Obtener estadísticas del usuario
      const [projects, tasks] = await Promise.all([
        storage.getProjectsByUser(userId),
        storage.getTasksByUser(userId)
      ]);

      // Obtener cronogramas de todos los proyectos del usuario
      const allSchedules = [];
      for (const project of projects) {
        const schedules = await storage.getSchedules(project.id);
        allSchedules.push(...schedules);
      }

      // Calcular estadísticas
      const projectsCreated = projects.length;
      const tasksCompleted = tasks.filter(task => task.status === 'completed').length;
      const totalSchedules = allSchedules.length;
      const totalCollaborations = projects.reduce((count, project) => {
        return count + (project.members?.length || 0);
      }, 0);

      // Calcular completitud del perfil
      const user = await storage.getUser(userId);
      const fields = [
        user?.fullName,
        user?.email,
        user?.bio,
        user?.profileImage,
        user?.jobTitle,
        user?.department,
        user?.phoneNumber,
      ];
      const completedFields = fields.filter(field => field && field.trim() !== '').length;
      const profileCompleteness = Math.round((completedFields / fields.length) * 100);

      const stats = {
        projectsCreated,
        tasksCompleted,
        totalSchedules,
        totalCollaborations,
        profileCompleteness
      };

      res.json(stats);
    } catch (error) {
      console.error("Error getting user stats:", error);
      res.status(500).json({ message: "Error al obtener las estadísticas del usuario" });
    }
  });

  // Endpoint para obtener la actividad reciente del usuario
  app.get("/api/user/activity", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit as string) || 10;

      // Obtener actividad reciente (últimos proyectos, tareas, etc.)
      const [recentProjects, recentTasks] = await Promise.all([
        storage.getProjectsByUser(userId),
        storage.getTasksByUser(userId)
      ]);

      // Obtener cronogramas de todos los proyectos del usuario
      const allRecentSchedules = [];
      for (const project of recentProjects) {
        const schedules = await storage.getSchedules(project.id);
        allRecentSchedules.push(...schedules);
      }

      // Crear lista de actividades
      const activities = [];

      // Agregar proyectos recientes
      recentProjects.slice(0, 3).forEach(project => {
        activities.push({
          id: `project-${project.id}`,
          type: 'project',
          description: `Creaste el proyecto "${project.name}"`,
          timestamp: project.createdAt,
          icon: 'briefcase'
        });
      });

      // Agregar tareas recientes
      recentTasks.slice(0, 3).forEach(task => {
        activities.push({
          id: `task-${task.id}`,
          type: 'task',
          description: `${task.status === 'completed' ? 'Completaste' : 'Trabajaste en'} la tarea "${task.title}"`,
          timestamp: task.updatedAt || task.createdAt,
          icon: 'check-circle'
        });
      });

      // Agregar cronogramas recientes
      allRecentSchedules.slice(0, 2).forEach(schedule => {
        activities.push({
          id: `schedule-${schedule.id}`,
          type: 'schedule',
          description: `Creaste el cronograma "${schedule.name}"`,
          timestamp: schedule.createdAt,
          icon: 'calendar'
        });
      });

      // Ordenar por fecha más reciente y limitar
      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      res.json(sortedActivities);
    } catch (error) {
      console.error("Error getting user activity:", error);
      res.status(500).json({ message: "Error al obtener la actividad del usuario" });
    }
  });

  // Endpoint para actualizar el perfil del usuario actual
  app.patch("/api/user/profile", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      logger.debug("[PROFILE]", "Datos recibidos para actualizar perfil", { fields: Object.keys(updateData) });
      logger.debug("[PROFILE]", `User ID: ${userId}`);

      // Actualizar el perfil del usuario usando Drizzle
      const [updatedUser] = await db.update(schema.users)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(schema.users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Eliminar contraseña del resultado
      const { password, ...userWithoutPassword } = updatedUser;

      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Error al actualizar el perfil" });
    }
  });

  // Endpoint para subir imagen de portada
  app.post("/api/user/cover-image", isAuthenticated, upload.single('coverImage'), async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No se proporcionó ningún archivo" });
      }

      // En un entorno real, aquí subirías el archivo a un servicio de almacenamiento
      // Por ahora, guardaremos la ruta local del archivo
      const imagePath = `/uploads/${file.filename}`;

      // Actualizar la imagen de portada del usuario
      const [updatedUser] = await db.update(schema.users)
        .set({
          coverImage: imagePath,
          updatedAt: new Date()
        })
        .where(eq(schema.users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      res.json({ coverImage: imagePath });
    } catch (error) {
      console.error("Error uploading cover image:", error);
      res.status(500).json({ message: "Error al subir la imagen de portada" });
    }
  });

  // Endpoint para subir imagen de perfil
  app.post("/api/user/profile-image", isAuthenticated, upload.single('profileImage'), async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No se proporcionó ningún archivo" });
      }

      // Validar que sea una imagen
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: "Solo se permiten archivos de imagen" });
      }

      // En un entorno real, aquí subirías el archivo a un servicio de almacenamiento
      // Por ahora, guardaremos la ruta local del archivo
      const imagePath = `/uploads/${file.filename}`;

      // Actualizar la imagen de perfil del usuario
      const [updatedUser] = await db.update(schema.users)
        .set({
          profileImage: imagePath,
          updatedAt: new Date()
        })
        .where(eq(schema.users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      res.json({ profileImage: imagePath });
    } catch (error) {
      console.error("Error uploading profile image:", error);
      res.status(500).json({ message: "Error al subir la imagen de perfil" });
    }
  });

  // Endpoint para cambiar la contraseña del usuario actual
  app.post("/api/profile/change-password", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Se requiere la contraseña actual y la nueva contraseña" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "La nueva contraseña debe tener al menos 6 caracteres" });
      }

      // Obtener usuario actual
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Verificar contraseña actual
      if (!user.password) {
        return res.status(400).json({ message: "Este usuario no tiene contraseña configurada" });
      }

      const isPasswordValid = await comparePasswords(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "La contraseña actual es incorrecta" });
      }

      // Actualizar contraseña
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(req.user.id, { password: hashedPassword });

      res.json({ message: "Contraseña actualizada correctamente" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Error al cambiar la contraseña" });
    }
  });

  // Endpoint para cambiar contraseña de cualquier usuario (solo para usuarios primarios)
  app.post("/api/admin/users/:id/change-password", isAuthenticated, isPrimaryUser, async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const { newPassword } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "ID de usuario requerido" });
      }

      if (!newPassword) {
        return res.status(400).json({ message: "Se requiere la nueva contraseña" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "La nueva contraseña debe tener al menos 6 caracteres" });
      }

      // Verificar que el usuario existe
      const user = await global.storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Hash de la nueva contraseña
      const hashedPassword = await hashPassword(newPassword);

      // Actualizar contraseña
      await global.storage.updateUser(userId, { password: hashedPassword });

      res.json({
        message: "Contraseña actualizada correctamente",
        targetUser: user.fullName
      });
    } catch (error) {
      console.error("Error changing user password:", error);
      res.status(500).json({ message: "Error al cambiar la contraseña del usuario" });
    }
  });

  app.get("/api/users", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const users = await global.storage.getAllUsers();

      // Incluir solo información básica de usuario para seguridad
      const safeUsers = users.map(user => ({
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        isPrimary: user.isPrimary,
        role: user.role,
        jobTitle: user.jobTitle,
        department: user.department,
        profileImage: user.profileImage
      }));

      res.json(safeUsers);
    } catch (error) {
      console.error("Error listing users:", error);
      res.status(500).json({ message: "Error al listar usuarios" });
    }
  });

  // ===== BLOQUE 3: PROYECTOS API =====
  // Projects API
  app.post("/api/projects", isAuthenticated, isPrimaryUser, async (req: Request, res: Response) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);

      // Set created by to current user
      projectData.createdBy = req.user.id;

      const newProject = await global.storage.createProject(projectData);

      // If analysis data is provided, create analysis result
      if (req.body.analysisResults) {
        // Map new frontend fields to DB columns if legacy ones aren't provided
        const analysisPayload = { ...req.body.analysisResults };

        // Map contentPillars -> contentThemes
        if (analysisPayload.contentPillars && !analysisPayload.contentThemes) {
          analysisPayload.contentThemes = analysisPayload.contentPillars;
        }

        // Map competitors -> competitorAnalysis
        if (analysisPayload.competitors && !analysisPayload.competitorAnalysis) {
          analysisPayload.competitorAnalysis = analysisPayload.competitors;
        }

        const analysisData = {
          projectId: newProject.id,
          ...analysisPayload
        };

        await global.storage.createAnalysisResult(analysisData);
      }

      // Initial products will be created in a separate API call from the frontend
      // using FormData to handle the image uploads

      res.status(201).json(newProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.get("/api/projects", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projects = await global.storage.getProjectsByUser(req.user.id);
      res.json(projects);
    } catch (error) {
      console.error("Error listing projects:", error);
      res.status(500).json({ message: "Failed to list projects" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.id);
      console.log(`Fetching project details for ID: ${projectId}`);

      if (isNaN(projectId)) {
        console.error("Invalid project ID:", req.params.id);
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Check if user has access to project
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      logger.debug("[ACCESS]", `User ${req.user.id} access to project ${projectId}: ${hasAccess}`);

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      const project = await global.storage.getProjectWithAnalysis(projectId);
      console.log(`Project ${projectId} found:`, !!project);

      if (!project) {
        return res.status(404).json({ message: "Proyecto no encontrado" });
      }

      // Ensure project has required fields with defaults
      const safeProject = {
        id: project.id,
        name: project.name || 'Proyecto sin nombre',
        client: project.client || 'Cliente no definido',
        description: project.description || '',
        startDate: project.startDate,
        endDate: project.endDate,
        status: project.status || 'planning',
        createdBy: project.createdBy,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        analysis: project.analysis
      };

      res.json(safeProject);
    } catch (error) {
      console.error("Error detallado al obtener proyecto:", error);
      res.status(500).json({
        message: "Error al cargar el proyecto",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Primary users can update any project, secondary users cannot update project details
      if (!req.user.isPrimary) {
        return res.status(403).json({ message: "Only primary users can update project details" });
      }

      const project = await global.storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const updatedProject = await global.storage.updateProject(projectId, req.body);
      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, isPrimaryUser, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = await global.storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      await global.storage.deleteProject(projectId);
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Project Analysis API
  app.patch("/api/projects/:id/analysis", isAuthenticated, isPrimaryUser, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Map new frontend fields to DB columns for PATCH request
      const requestBody = { ...req.body };

      // Map contentPillars -> contentThemes
      if (requestBody.contentPillars && !requestBody.contentThemes) {
        requestBody.contentThemes = requestBody.contentPillars;
      }

      // Map competitors -> competitorAnalysis
      if (requestBody.competitors && !requestBody.competitorAnalysis) {
        requestBody.competitorAnalysis = requestBody.competitors;
      }

      const analysisData = insertAnalysisResultsSchema.parse({
        projectId,
        ...requestBody
      });

      // Check if analysis exists for this project
      const existingAnalysis = await global.storage.getAnalysisResult(projectId);

      let result;
      if (existingAnalysis) {
        // Update existing analysis
        result = await global.storage.updateAnalysisResult(projectId, analysisData);
      } else {
        // Create new analysis
        result = await global.storage.createAnalysisResult(analysisData);
      }

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error updating project analysis:", error);
      res.status(500).json({ message: "Failed to update project analysis" });
    }
  });

  // Análisis de Imágenes de Marketing con Gemini Vision
  app.post("/api/projects/:projectId/analyze-image", isAuthenticated, marketingImageUpload.single('image'), async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user!.id,
        projectId,
        req.user!.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      // Verificar que se haya subido una imagen
      if (!req.file) {
        return res.status(400).json({ message: "No se ha subido ninguna imagen" });
      }

      // Validar el tipo de análisis solicitado
      const analysisType = (req.body.analysisType || 'content') as 'brand' | 'content' | 'audience';
      if (!['brand', 'content', 'audience'].includes(analysisType)) {
        return res.status(400).json({ message: "Tipo de análisis inválido. Debe ser 'brand', 'content' o 'audience'" });
      }

      // Realizar análisis de la imagen con Gemini Vision
      const analysisResult = await analyzeMarketingImage(req.file.path, analysisType);

      // Devolver el resultado del análisis
      res.json({
        success: true,
        analysisType,
        result: analysisResult,
        imageInfo: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });

    } catch (error) {
      console.error("Error analizando imagen de marketing:", error);
      res.status(500).json({
        message: "Error al analizar la imagen",
        error: (error as Error).message
      });
    }
  });

  // ===== BLOQUE 4: DOCUMENTOS API =====
  // Documents API
  app.post("/api/projects/:projectId/documents", isAuthenticated, documentUpload.single('file'), async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Check if user has access to project
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this project" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Document data
      const documentData = {
        projectId,
        uploadedBy: req.user.id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype
      };

      // Create document record
      const document = await global.storage.createDocument(documentData);

      // Extract text from document (currently only PDF supported)
      let extractedText = "";
      if (req.file.mimetype === 'application/pdf') {
        try {
          const parser = await initializePdfParse();
          const dataBuffer = fs.readFileSync(req.file.path);
          const pdfData = await parser(dataBuffer);
          extractedText = pdfData.text;
        } catch (error) {
          console.warn("PDF parsing failed, using filename as fallback:", error.message);
          extractedText = `PDF document: ${req.file.originalname}`;
        }
      } else if (req.file.mimetype === 'text/plain') {
        extractedText = fs.readFileSync(req.file.path, 'utf8');
      } else {
        // For DOCX files or other formats, we'd need additional libraries
        extractedText = "Text extraction not supported for this file type yet.";
      }

      // Update document with extracted text
      let updatedDocument = await global.storage.updateDocument(document.id, {
        extractedText,
        analysisStatus: 'processing'
      });

      // Process with AI in the background
      console.log(`Starting AI analysis for document ${document.id}`);
      analyzeDocument(extractedText)
        .then(async (analysis) => {
          console.log(`AI analysis completed successfully for document ${document.id}`);
          await global.storage.updateDocument(document.id, {
            analysisResults: analysis,
            analysisStatus: 'completed'
          });
        })
        .catch(async (error) => {
          console.error(`AI analysis failed for document ${document.id}:`, error);
          await global.storage.updateDocument(document.id, {
            analysisStatus: 'failed',
            analysisError: error.message
          });
        });

      res.status(201).json(updatedDocument);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.get("/api/projects/:projectId/documents", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Check if user has access to project
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this project" });
      }

      const documents = await global.storage.getDocuments(projectId);
      res.json(documents);
    } catch (error) {
      console.error("Error listing documents:", error);
      res.status(500).json({ message: "Failed to list documents" });
    }
  });

  app.post("/api/projects/:projectId/documents/:documentId/use-analysis", isAuthenticated, isPrimaryUser, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const documentId = parseInt(req.params.documentId);

      if (isNaN(projectId) || isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      if (!await ensureProjectAccess(req, res, projectId)) {
        return;
      }

      // Get document
      const document = await global.storage.getDocument(documentId);
      if (!document || document.projectId !== projectId) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.analysisStatus !== 'completed' || !document.analysisResults) {
        return res.status(400).json({ message: "Document analysis not available" });
      }

      // Extract analysis results
      const analysis = document.analysisResults;

      // Check if analysis exists for this project
      const existingAnalysis = await global.storage.getAnalysisResult(projectId);

      // Update or create project analysis
      if (existingAnalysis) {
        await global.storage.updateAnalysisResult(projectId, analysis);
      } else {
        await global.storage.createAnalysisResult({
          projectId,
          ...analysis
        });
      }

      res.json({ message: "Analysis applied to project" });
    } catch (error) {
      console.error("Error applying document analysis:", error);
      res.status(500).json({ message: "Failed to apply document analysis" });
    }
  });

  // Endpoint para generar ideas/conceptos previos al cronograma
  app.post("/api/projects/:projectId/schedule/concepts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      if (!await ensureProjectAccess(req, res, projectId)) {
        return;
      }

      const { amount, additionalInstructions } = req.body;

      const project = await global.storage.getProjectWithAnalysis(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const concepts = await generateConcepts(
        project.name,
        {
          client: project.client,
          ...project.analysis
        },
        amount || 10,
        additionalInstructions
      );

      res.json(concepts);
    } catch (error) {
      console.error("Error generating concepts:", error);
      res.status(500).json({ message: "Failed to generate concepts" });
    }
  });

  // ===== BLOQUE 5: CRONOGRAMAS API =====
  // Schedules API
  app.post("/api/projects/:projectId/schedule", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId) || !projectId) {
        return res.status(400).json({ error: "El ID del proyecto es obligatorio." });
      }

      // Validate distribution preferences
      const { distributionPreferences, ...otherData } = req.body;
      if (distributionPreferences?.type === 'custom' && (!distributionPreferences.frequency || !distributionPreferences.preferredTimes || !distributionPreferences.preferredDays)) {
        return res.status(400).json({ message: "Custom distribution requires frequency, preferred times and days" });
      }

      // Check if user has access to project
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this project" });
      }

      // Validate required data
      const { startDate, specifications, periodType, additionalInstructions, durationDays } = req.body;
      if (!startDate) {
        return res.status(400).json({ message: "Start date is required" });
      }

      // Forzamos el uso de Gemini como único modelo de IA disponible

      // Determinar el número de días según el tipo de periodo o duración específica
      let periodDays = 15; // Valor predeterminado: quincenal (15 días)

      if (durationDays) {
        periodDays = parseInt(durationDays);
      } else if (periodType === "mensual") {
        periodDays = 31; // Periodo mensual: 31 días
      }

      // Get project with analysis
      const project = await global.storage.getProjectWithAnalysis(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get content history for this project to avoid repetition
      const contentHistory = await global.storage.getContentHistory(projectId);
      const previousContent = contentHistory.map(entry => entry.content);

      // Get products for this project
      const products = await global.storage.listProductsByProject(projectId);
      console.log(`[CALENDAR] Productos encontrados para el proyecto: ${products.length}`);

      // Generate schedule using Gemini, passing previous content
      console.log("[CALENDAR] Iniciando generación de cronograma");
      console.log("[CALENDAR] Instrucciones adicionales: ", additionalInstructions || "Ninguna");

      // Intentamos generar el cronograma
      const generatedSchedule = await generateSchedule(
        project.name,
        {
          client: project.client,
          description: project.description,
          ...project.analysis,
          // Incluir productos en formato esperado por el AI scheduler
          initialProducts: products.map(p => ({
            name: p.name,
            description: p.description || ""
          }))
        },
        startDate,
        specifications,
        periodDays, // Usar el número de días según el tipo de periodo seleccionado
        previousContent,
        additionalInstructions // Pasamos las instrucciones adicionales a la función
      );

      // Save schedule to database
      const scheduleData: any = {
        projectId,
        name: generatedSchedule.name,
        startDate: new Date(startDate),
        specifications,
        additionalInstructions, // Guardar instrucciones adicionales en la base de datos
        createdBy: req.user.id
        // Omitimos los campos aiModel y periodType que ya no existen en la base de datos
      };

      const schedule = await global.storage.createSchedule(scheduleData);

      // Save schedule entries without generating images automatically
      const entryPromises = generatedSchedule.entries.map(async (entry) => {
        // 1. Crear la entrada en la base de datos
        const savedEntry = await global.storage.createScheduleEntry({
          scheduleId: schedule.id,
          title: entry.title,
          description: entry.description,
          content: entry.content,
          copyIn: entry.copyIn,
          copyOut: entry.copyOut,
          designInstructions: entry.designInstructions,
          platform: entry.platform,
          postDate: new Date(entry.postDate),
          postTime: entry.postTime,
          hashtags: entry.hashtags
        });

        // 2. Guardar el contenido en el historial para evitar repeticiones
        try {
          await global.storage.createContentHistory({
            projectId,
            scheduleEntryId: savedEntry.id,
            content: entry.content,
            changeDescription: "Initial content generation",
            changedBy: req.user.id
          });
        } catch (historyError) {
          console.error(`Error saving content history for entry ${savedEntry.id}:`, historyError);
          // Continuamos aunque no se pueda guardar el historial
        }

        // Ya no generamos imágenes automáticamente para evitar problemas con las APIs
        // El usuario podrá generar las imágenes manualmente desde la interfaz cuando sea necesario

        return savedEntry;
      });

      // Wait for all entries to be processed
      await Promise.all(entryPromises);

      // Get the schedule with all its entries
      const scheduleWithEntries = await global.storage.getScheduleWithEntries(schedule.id);

      res.status(201).json(scheduleWithEntries);
    } catch (error: any) {
      console.error("Error creating schedule:", error);

      // Extraer tipo de error si está disponible
      const errorType = error.errorType || "UNKNOWN";
      const errorMessage = error.message || "Error desconocido";

      // Log detallado para diagnóstico
      console.log(`[CALENDAR ROUTE] Error tipo: ${errorType}, Mensaje: ${errorMessage}`);

      // Mensajes de error específicos basados en el tipo de error
      if (errorType === "NETWORK" || errorMessage.includes("connect") || errorMessage.includes("Servicio de IA temporalmente no disponible")) {
        // Error de conexión o disponibilidad de Gemini
        return res.status(503).json({
          message: "Servicio de IA temporalmente no disponible. Por favor intenta nuevamente en unos minutos.",
          error: errorMessage,
          errorType: "SERVICIO_NO_DISPONIBLE"
        });
      } else if (errorType === "RATE_LIMIT" || errorMessage.includes("límite de peticiones")) {
        // Error de límite de peticiones
        return res.status(429).json({
          message: "Hemos alcanzado el límite de generaciones. Por favor espera unos minutos antes de intentar crear otro calendario.",
          error: errorMessage,
          errorType: "LIMITE_EXCEDIDO"
        });
      } else if (errorType === "AUTH" || errorMessage.includes("autenticación") || errorMessage.includes("authentication")) {
        // Error de autenticación con la API
        return res.status(401).json({
          message: "Error en la configuración del servicio de IA. Por favor contacta al administrador.",
          error: errorMessage,
          errorType: "ERROR_AUTENTICACION"
        });
      } else if (errorType === "JSON_PARSING" || errorMessage.includes("JSON") || errorMessage.includes("parse")) {
        // Error de procesamiento de la respuesta JSON
        return res.status(422).json({
          message: "Error al procesar la respuesta del servicio de IA. Intenta con menos contenido o diferentes configuraciones.",
          error: errorMessage,
          errorType: "ERROR_FORMATO_RESPUESTA"
        });
      } else if (errorType === "JSON_PROCESSING" || errorMessage.includes("ERROR_JSON_PROCESSING")) {
        // Error en el procesamiento de datos JSON
        return res.status(422).json({
          message: "No pudimos procesar correctamente el calendario generado. Intenta con diferentes ajustes o menos plataformas.",
          error: errorMessage,
          errorType: "ERROR_DATOS"
        });
      }

      // Errores generales
      res.status(500).json({
        message: "Ocurrió un error al crear el calendario. Por favor intenta con menos plataformas o en otro momento.",
        error: errorMessage,
        errorType: "ERROR_GENERAL"
      });
    }
  });

  app.get("/api/projects/:projectId/schedules", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Check if user has access to project
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this project" });
      }

      const schedules = await global.storage.getSchedules(projectId);
      res.json(schedules);
    } catch (error) {
      console.error("Error listing schedules:", error);
      res.status(500).json({ message: "Failed to list schedules" });
    }
  });

  // Get all recent schedules - IMPORTANT: esta ruta debe ir ANTES de las rutas con parámetros como :id
  app.get("/api/schedules/recent", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Si no hay usuario autenticado, devolvemos array vacío
      if (!req.user) {
        return res.json([]);
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

      // Obtener todos los proyectos del usuario
      const userProjects = await global.storage.getProjectsByUser(req.user.id);

      // Obtener schedules de todos los proyectos del usuario
      const recentSchedules = [];
      for (const project of userProjects) {
        const schedules = await global.storage.getSchedules(project.id);
        recentSchedules.push(...schedules);
      }

      // Ordenar por fecha de creación y limitar
      recentSchedules.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const limitedSchedules = recentSchedules.slice(0, limit);

      if (!limitedSchedules || limitedSchedules.length === 0) {
        return res.json([]); // Retornar array vacío si no hay schedules
      }

      // Verificar que el usuario tenga acceso a los proyectos de los schedules
      const accessibleSchedules = [];
      for (const schedule of limitedSchedules) {
        try {
          if (!schedule || !schedule.projectId) {
            console.warn("Schedule incompleto encontrado en el endpoint:", schedule);
            continue; // Saltamos schedules incorrectos
          }

          const hasAccess = await global.storage.checkUserProjectAccess(
            req.user.id,
            schedule.projectId
          );

          if (hasAccess) {
            accessibleSchedules.push(schedule);
          }
        } catch (err) {
          console.error(`Error procesando schedule ID ${schedule?.id}:`, err);
          // Continuamos con el siguiente schedule
        }
      }

      res.json(accessibleSchedules);
    } catch (error) {
      console.error("Error getting recent schedules:", error);
      // Devolver array vacío en lugar de error para mejorar la experiencia del usuario
      return res.json([]);
    }
  });

  app.get("/api/schedules/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const scheduleId = parseInt(req.params.id);
      if (isNaN(scheduleId)) {
        return res.status(400).json({ message: "Invalid schedule ID" });
      }

      const schedule = await global.storage.getScheduleWithEntries(scheduleId);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      // Check if user has access to the project this schedule belongs to
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        schedule.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this schedule" });
      }

      res.json(schedule);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  // Endpoint para actualizar las instrucciones adicionales de un cronograma
  app.patch("/api/schedules/:id/additional-instructions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const scheduleId = parseInt(req.params.id);
      if (isNaN(scheduleId)) {
        return res.status(400).json({ message: "ID de cronograma inválido" });
      }

      const { additionalInstructions } = req.body;

      // Verificar que el cronograma exista
      const schedule = await global.storage.getSchedule(scheduleId);
      if (!schedule) {
        return res.status(404).json({ message: "Cronograma no encontrado" });
      }

      // Verificar que el usuario tenga acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        schedule.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este cronograma" });
      }

      // Actualizar el cronograma con las nuevas instrucciones adicionales
      const updatedSchedule = await global.storage.updateSchedule(scheduleId, {
        additionalInstructions: additionalInstructions || null
      });

      res.json(updatedSchedule);
    } catch (error) {
      console.error("Error updating schedule additional instructions:", error);
      res.status(500).json({ message: "Error al actualizar las instrucciones adicionales del cronograma" });
    }
  });

  // Endpoint para regenerar contenido basado en instrucciones adicionales
  app.post("/api/schedules/:id/regenerate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const scheduleId = parseInt(req.params.id);
      const { additionalInstructions: newInstructions, selectedAreas, specificInstructions } = req.body;

      if (isNaN(scheduleId)) {
        return res.status(400).json({ message: "ID de cronograma inválido" });
      }

      logger.info("[REGENERATE]", `Iniciando regeneración para schedule: ${scheduleId}`);
      logger.debug("[REGENERATE]", `Instrucciones generales: ${newInstructions || "Ninguna"}`);
      logger.debug("[REGENERATE]", `Áreas seleccionadas: ${selectedAreas || "Todas"}`);
      logger.debug("[REGENERATE]", `Instrucciones específicas: ${specificInstructions || "Ninguna"}`);

      // Obtener el cronograma actual con sus entradas
      const schedule = await global.storage.getScheduleWithEntries(scheduleId);
      if (!schedule) {
        return res.status(404).json({ message: "Cronograma no encontrado" });
      }

      // Verificar que el usuario tenga acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        schedule.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este cronograma" });
      }

      // Obtener el proyecto asociado
      const project = await global.storage.getProjectWithAnalysis(schedule.projectId);
      if (!project) {
        return res.status(404).json({ message: "Proyecto no encontrado" });
      }

      // Obtener historial de contenido para evitar repeticiones
      const contentHistory = await global.storage.getContentHistory(schedule.projectId);
      const previousContent = contentHistory.map(entry => entry.content);

      // Extraer fecha de inicio
      const startDate = schedule.startDate ? format(new Date(schedule.startDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

      // Construir instrucciones estructuradas y específicas
      let enhancedInstructions = newInstructions || schedule.additionalInstructions || "";

      if (selectedAreas && Object.values(selectedAreas).some(Boolean)) {
        const selectedAreasList = Object.entries(selectedAreas)
          .filter(([_, selected]) => selected)
          .map(([area, _]) => {
            const areaNames = {
              titles: "títulos",
              descriptions: "descripciones",
              content: "contenido",
              copyIn: "texto integrado (copyIn)",
              copyOut: "texto descripción (copyOut)",
              designInstructions: "instrucciones de diseño",
              platforms: "plataformas",
              hashtags: "hashtags"
            };
            return areaNames[area as keyof typeof areaNames] || area;
          });

        enhancedInstructions += `\n\n=== MODIFICACIONES ESPECÍFICAS REQUERIDAS ===\n`;
        enhancedInstructions += `Modifica ÚNICAMENTE estos elementos: ${selectedAreasList.join(", ")}\n`;
        enhancedInstructions += `MANTÉN sin cambios todos los demás elementos del cronograma.\n`;

        // Agregar instrucciones específicas con formato claro
        if (specificInstructions) {
          enhancedInstructions += `\n=== INSTRUCCIONES DETALLADAS POR ÁREA ===\n`;
          Object.entries(selectedAreas).forEach(([area, selected]) => {
            if (selected && specificInstructions[area] && specificInstructions[area].trim()) {
              const areaNames = {
                titles: "TÍTULOS",
                descriptions: "DESCRIPCIONES",
                content: "CONTENIDO",
                copyIn: "TEXTO INTEGRADO (copyIn)",
                copyOut: "TEXTO DESCRIPCIÓN (copyOut)",
                designInstructions: "INSTRUCCIONES DE DISEÑO",
                platforms: "PLATAFORMAS",
                hashtags: "HASHTAGS"
              };
              const areaName = areaNames[area as keyof typeof areaNames] || area.toUpperCase();
              enhancedInstructions += `\n${areaName}: ${specificInstructions[area]}\n`;
            }
          });
        }

        enhancedInstructions += `\n=== FORMATO DE RESPUESTA CRÍTICO ===\n`;
        enhancedInstructions += `Responde ÚNICAMENTE con JSON válido. NO agregues texto explicativo antes o después del JSON.\n`;
        enhancedInstructions += `Asegúrate de que todas las comillas estén correctamente escapadas.\n`;
        enhancedInstructions += `Verifica que no haya caracteres especiales que rompan el formato JSON.\n`;

        console.log("[REGENERATE] Instrucciones estructuradas con áreas específicas:", enhancedInstructions);
      }

      // Nueva funcionalidad: Edición selectiva en lugar de regeneración completa
      console.log("[REGENERATE] Iniciando edición selectiva de entradas específicas");

      // Obtener todas las entradas existentes
      const existingEntries = schedule.entries || [];
      console.log(`[REGENERATE] Encontradas ${existingEntries.length} entradas existentes para editar`);

      if (existingEntries.length === 0) {
        return res.status(400).json({ message: "No hay entradas para editar en este cronograma" });
      }

      // Procesar cada entrada existente para aplicar modificaciones selectivas
      for (let i = 0; i < existingEntries.length; i++) {
        const entry = existingEntries[i];
        console.log(`[REGENERATE] Procesando entrada ${i + 1}/${existingEntries.length}: "${entry.title}"`);

        // Construir prompt específico para editar solo las áreas seleccionadas
        const editPrompt = `
Eres un experto en marketing de contenidos. Tu tarea es EDITAR ÚNICAMENTE las áreas específicas de esta publicación según las instrucciones del usuario.

PUBLICACIÓN ACTUAL:
- Título: "${entry.title}"
- Descripción: "${entry.description}"
- Contenido: "${entry.content}"
- Texto Integrado (copyIn): "${entry.copyIn}"
- Texto Descripción (copyOut): "${entry.copyOut}"
- Instrucciones de Diseño: "${entry.designInstructions}"
- Plataforma: "${entry.platform}"
- Hashtags: "${entry.hashtags}"

${enhancedInstructions}

RESPONDE ÚNICAMENTE CON UN JSON VÁLIDO con esta estructura exacta:
{
  "title": "título editado o el mismo si no se modifica",
  "description": "descripción editada o la misma si no se modifica",
  "content": "contenido editado o el mismo si no se modifica",
  "copyIn": "copyIn editado o el mismo si no se modifica",
  "copyOut": "copyOut editado o el mismo si no se modifica",
  "designInstructions": "instrucciones editadas o las mismas si no se modifican",
  "platform": "plataforma editada o la misma si no se modifica",
  "hashtags": "hashtags editados o los mismos si no se modifican"
}

IMPORTANTE: Si un área NO está seleccionada para modificación, mantén el valor original EXACTAMENTE como está.`;

        try {
          const editedContentText = await geminiService.generateText(editPrompt, {
            temperature: 0.7,
            maxTokens: 2000,
            model: 'grok-3-mini'
          });

          const {
            content: filteredEditedContentText,
            leakageDetected: regenerateLeakageDetected,
            flags: regenerateLeakageFlags
          } = filterOutputLeakage(editedContentText);

          if (regenerateLeakageDetected) {
            logger.warn("[REGENERATE]", `Output leakage detectado en entrada ${i + 1}: ${regenerateLeakageFlags.join(", ")}`);
          }

          console.log(`[REGENERATE] Respuesta de edición para entrada ${i + 1}:`, filteredEditedContentText.substring(0, 200));

          // Parsear la respuesta JSON
          let editedContent;
          try {
            // Limpiar la respuesta para extraer solo el JSON
            const jsonMatch = filteredEditedContentText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              editedContent = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error("No se encontró JSON válido en la respuesta");
            }
          } catch (parseError) {
            console.error(`[REGENERATE] Error parseando JSON para entrada ${i + 1}:`, parseError);
            // Si falla el parsing, mantener la entrada original
            editedContent = {
              title: entry.title,
              description: entry.description,
              content: entry.content,
              copyIn: entry.copyIn,
              copyOut: entry.copyOut,
              designInstructions: entry.designInstructions,
              platform: entry.platform,
              hashtags: entry.hashtags
            };
          }

          // Actualizar la entrada en la base de datos
          await global.storage.updateScheduleEntry(entry.id, {
            title: editedContent.title || entry.title,
            description: editedContent.description || entry.description,
            content: editedContent.content || entry.content,
            copyIn: editedContent.copyIn || entry.copyIn,
            copyOut: editedContent.copyOut || entry.copyOut,
            designInstructions: editedContent.designInstructions || entry.designInstructions,
            platform: editedContent.platform || entry.platform,
            hashtags: editedContent.hashtags || entry.hashtags,
          });

          console.log(`[REGENERATE] Entrada ${i + 1} actualizada exitosamente`);

        } catch (error) {
          console.error(`[REGENERATE] Error editando entrada ${i + 1}:`, error);
          // Continuar con la siguiente entrada si una falla
        }
      }

      // Actualizar las instrucciones adicionales si se proporcionaron
      if (newInstructions && newInstructions.trim()) {
        await global.storage.updateSchedule(scheduleId, {
          additionalInstructions: newInstructions
        });
      }

      // Obtener el cronograma actualizado con sus entradas
      const updatedSchedule = await global.storage.getScheduleWithEntries(scheduleId);

      console.log("[REGENERATE] Edición selectiva completada exitosamente");
      res.json(updatedSchedule);
    } catch (error) {
      console.error("Error al regenerar cronograma:", error);
      res.status(500).json({
        message: "Error al regenerar cronograma",
        error: (error as Error).message
      });
    }
  });

  app.get("/api/schedules/:id/download", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const scheduleId = parseInt(req.params.id);
      const format = req.query.format || 'excel';

      if (isNaN(scheduleId)) {
        return res.status(400).json({ message: "Invalid schedule ID" });
      }

      const schedule = await global.storage.getScheduleWithEntries(scheduleId);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      // Check if user has access to the project this schedule belongs to
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        schedule.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this schedule" });
      }

      // Get project info for headers
      const project = await global.storage.getProject(schedule.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Sort entries by date
      const sortedEntries = [...schedule.entries].sort((a, b) => {
        const dateA = a.postDate ? new Date(a.postDate) : new Date(0);
        const dateB = b.postDate ? new Date(b.postDate) : new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

      if (format === 'excel') {
        // Obtener el formato según la plataforma para incluirlo en el Excel
        const getFormatByPlatform = (platform: string): string => {
          const formats: Record<string, string> = {
            'Instagram': 'Carrusel/Reels • 9:16 o 1:1',
            'Facebook': 'Imagen/Video • 16:9 o 1:1',
            'Twitter': 'Imagen/GIF • 16:9',
            'LinkedIn': 'Imagen/Artículo • 16:9 o 1:1',
            'TikTok': 'Video • 9:16 vertical',
            'YouTube': 'Video • 16:9 horizontal',
            'Pinterest': 'Pin • 2:3 vertical',
            'WhatsApp': 'Imagen/Video • 1:1 o 9:16'
          };

          return formats[platform] || 'Formato estándar';
        };

        // Generate Excel file
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Cohete Workflow';
        workbook.created = new Date();

        // Limpiar caracteres no permitidos en nombres de hojas de Excel: * ? : \ / [ ]
        const safeWorksheetName = schedule.name.replace(/[\*\?\:\\/\[\]]/g, '-');

        const worksheet = workbook.addWorksheet(safeWorksheetName, {
          properties: {
            tabColor: { argb: '4F46E5' }, // Color primario (indigo)
            defaultRowHeight: 22
          }
        });

        // Agregar encabezado con información del cronograma
        worksheet.mergeCells('A1:J1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = schedule.name;
        titleCell.font = { size: 16, bold: true, color: { argb: '4F46E5' } };
        titleCell.alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:J2');
        const subtitleCell = worksheet.getCell('A2');
        subtitleCell.value = 'Cohete Workflow - Cronograma de Contenido';
        subtitleCell.font = { size: 12, color: { argb: '6B7280' } };
        subtitleCell.alignment = { horizontal: 'center' };

        // Agregar información del proyecto y detalles del cronograma
        worksheet.mergeCells('A3:B3');
        worksheet.getCell('A3').value = 'Proyecto:';
        worksheet.getCell('A3').font = { bold: true };
        worksheet.getCell('A3').alignment = { horizontal: 'right' };

        worksheet.mergeCells('C3:D3');
        worksheet.getCell('C3').value = project.name;
        worksheet.getCell('C3').font = { bold: true, color: { argb: '4F46E5' } };

        worksheet.mergeCells('E3:F3');
        worksheet.getCell('E3').value = 'Cliente:';
        worksheet.getCell('E3').font = { bold: true };
        worksheet.getCell('E3').alignment = { horizontal: 'right' };

        worksheet.mergeCells('G3:H3');
        worksheet.getCell('G3').value = project.client;

        worksheet.mergeCells('I3:J3');
        worksheet.getCell('I3').value = `Total de publicaciones: ${sortedEntries.length}`;
        worksheet.getCell('I3').font = { bold: true };
        worksheet.getCell('I3').alignment = { horizontal: 'right' };

        // Agregar fecha de generación y notas
        worksheet.mergeCells('A4:B4');
        worksheet.getCell('A4').value = 'Fecha de inicio:';
        worksheet.getCell('A4').font = { bold: true };
        worksheet.getCell('A4').alignment = { horizontal: 'right' };

        worksheet.mergeCells('C4:D4');
        worksheet.getCell('C4').value = new Date(schedule.startDate || new Date()).toLocaleDateString('es-ES', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });

        worksheet.mergeCells('E4:F4');
        worksheet.getCell('E4').value = 'Generado el:';
        worksheet.getCell('E4').font = { bold: true };
        worksheet.getCell('E4').alignment = { horizontal: 'right' };

        worksheet.mergeCells('G4:J4');
        worksheet.getCell('G4').value = new Date().toLocaleDateString('es-ES', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        // Espaciado
        worksheet.mergeCells('A5:J5');

        // Fila de encabezados empieza en la fila 6
        const headerRowIndex = 6;

        // Define columns with their properties but without adding headers yet
        // (we'll manually add the headers to the specific row)
        worksheet.columns = [
          { key: 'postDate', width: 15 },
          { key: 'postTime', width: 12 },
          { key: 'platform', width: 20 },
          { key: 'format', width: 30 },
          { key: 'title', width: 35 },
          { key: 'copyIn', width: 60 },
          { key: 'copyOut', width: 60 },
          { key: 'hashtags', width: 40 },
          { key: 'designInstructions', width: 60 },
          { key: 'referenceImageUrl', width: 20 }
        ];

        // Agregar encabezados manualmente a la fila correspondiente
        const headerRow = worksheet.getRow(headerRowIndex);
        headerRow.values = [
          'Fecha', 'Hora', 'Plataforma', 'Formato', 'Título',
          'Copy In (texto en diseño)', 'Copy Out (descripción)',
          'Hashtags', 'Instrucciones de Diseño', 'URL de Imagen'
        ];

        // Estilo para los encabezados
        headerRow.height = 24;
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4F46E5' }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });

        // Add rows
        sortedEntries.forEach((entry, index) => {
          const rowIndex = headerRowIndex + index + 1;
          const row = worksheet.addRow({
            postDate: entry.postDate ? new Date(entry.postDate).toLocaleDateString('es-ES', {
              day: '2-digit', month: '2-digit', year: 'numeric'
            }) : 'Sin fecha',
            postTime: entry.postTime || 'Sin hora',
            platform: entry.platform,
            format: getFormatByPlatform(entry.platform),
            title: entry.title,
            copyIn: entry.copyIn,
            copyOut: entry.copyOut,
            hashtags: entry.hashtags,
            designInstructions: entry.designInstructions,
            referenceImageUrl: entry.referenceImageUrl ? 'Ver en plataforma' : 'Sin imagen'
          });

          // Aplicar estilos alternando colores para facilitar la lectura
          const fillColor = index % 2 === 0 ? 'F9FAFB' : 'F3F4F6';
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: fillColor }
            };
            cell.border = {
              top: { style: 'thin', color: { argb: 'E5E7EB' } },
              left: { style: 'thin', color: { argb: 'E5E7EB' } },
              bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
              right: { style: 'thin', color: { argb: 'E5E7EB' } }
            };

            // Ajustar texto para celdas con mucho contenido
            cell.alignment = {
              vertical: 'top',
              wrapText: true,
              shrinkToFit: false // Deshabilitar la reducción del tamaño de texto
            };
          });

          // Destacar la celda de plataforma con un color según el tipo
          const platformCell = row.getCell(3);
          let platformColor = '4F46E5'; // Color por defecto (indigo)

          switch (entry.platform) {
            case 'Instagram':
              platformColor = 'E1306C'; // Rosa Instagram
              break;
            case 'Facebook':
              platformColor = '1877F2'; // Azul Facebook
              break;
            case 'Twitter':
              platformColor = '1DA1F2'; // Azul Twitter
              break;
            case 'LinkedIn':
              platformColor = '0A66C2'; // Azul LinkedIn
              break;
            case 'TikTok':
              platformColor = '000000'; // Negro TikTok
              break;
            case 'YouTube':
              platformColor = 'FF0000'; // Rojo YouTube
              break;
            case 'Pinterest':
              platformColor = 'BD081C'; // Rojo Pinterest
              break;
            case 'WhatsApp':
              platformColor = '25D366'; // Verde WhatsApp
              break;
          }

          platformCell.font = { color: { argb: 'FFFFFF' }, bold: true };
          platformCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: platformColor }
          };
          platformCell.alignment = { horizontal: 'center', vertical: 'middle' };

          // Ajustar altura según el contenido
          const maxContentLength = Math.max(
            entry.copyIn?.length || 0,
            entry.copyOut?.length || 0,
            entry.designInstructions?.length || 0
          );

          // Fórmula que calcula la altura de fila basada en la longitud del contenido 
          // y ancho disponible para asegurar visibilidad completa
          const contentWidth = 60; // Ancho de las columnas más largas (copyIn, copyOut, designInstructions)
          const charsPerLine = contentWidth * 1.5; // Aproximadamente 1.5 caracteres por unidad de ancho
          const estimatedLines = Math.max(1, Math.ceil(maxContentLength / charsPerLine));
          const lineHeight = 15; // Altura aproximada por línea en puntos
          const minHeight = 40; // Altura mínima de fila
          const padding = 20; // Espacio extra para padding y bordes

          // Calcular altura final (con un tope máximo razonable)
          const calculatedHeight = Math.min(300, (estimatedLines * lineHeight) + padding);
          row.height = Math.max(minHeight, calculatedHeight);

          // Ajuste fino para contenido muy largo
          if (maxContentLength > 1000) {
            // Para contenido excepcionalmente largo, aumentar aún más
            row.height = Math.max(row.height, 200);
          }
        });

        // Agregar autofilters
        worksheet.autoFilter = {
          from: { row: headerRowIndex, column: 1 },
          to: { row: headerRowIndex + sortedEntries.length, column: 10 }
        };

        // Congelar paneles
        worksheet.views = [
          { state: 'frozen', xSplit: 4, ySplit: headerRowIndex }
        ];

        // Generate file and send
        const buffer = await workbook.xlsx.writeBuffer();
        const safeFileName = schedule.name.replace(/[^a-z0-9]/gi, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.xlsx"`);
        res.send(buffer);
      } else if (format === 'pdf') {
        // Generar archivo PDF mejorado usando jsPDF (método alternativo sin puppeteer)

        // Obtener el formato según la plataforma
        const getFormatByPlatform = (platform: string): string => {
          const formats: Record<string, string> = {
            'Instagram': 'Carrusel/Reels • 9:16 o 1:1',
            'Facebook': 'Imagen/Video • 16:9 o 1:1',
            'Twitter': 'Imagen/GIF • 16:9',
            'LinkedIn': 'Imagen/Artículo • 16:9 o 1:1',
            'TikTok': 'Video • 9:16 vertical',
            'YouTube': 'Video • 16:9 horizontal',
            'Pinterest': 'Pin • 2:3 vertical',
            'WhatsApp': 'Imagen/Video • 1:1 o 9:16'
          };

          return formats[platform] || 'Formato estándar';
        };

        // Obtener color según la plataforma
        const getPlatformColor = (platform: string): string => {
          const colors: Record<string, string> = {
            'Instagram': '#E1306C',
            'Facebook': '#1877F2',
            'Twitter': '#1DA1F2',
            'LinkedIn': '#0A66C2',
            'TikTok': '#000000',
            'YouTube': '#FF0000',
            'Pinterest': '#BD081C',
            'WhatsApp': '#25D366'
          };

          return colors[platform] || '#4F46E5';
        };

        try {
          // Crear nuevo documento PDF con jsPDF
          const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
          });

          // Definir colores mejorados
          const primaryColor = [79 / 255, 70 / 255, 229 / 255]; // #4F46E5 en RGB
          const primaryLightColor = [224 / 255, 231 / 255, 255 / 255]; // #E0E7FF en RGB
          const grayColor = [107 / 255, 114 / 255, 128 / 255]; // #6B7280 en RGB
          const accentColor = [245 / 255, 158 / 255, 11 / 255]; // #F59E0B en RGB - Amber

          // Añadir imágenes y diseños

          // Fondo encabezado simplificado (sin bordes redondeados)
          doc.setFillColor(primaryLightColor[0], primaryLightColor[1], primaryLightColor[2]);
          doc.rect(10, 10, 277, 35, 'F');

          // Borde decorativo
          doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.setLineWidth(1.5);
          doc.line(10, 10, 287, 10);

          // Eliminamos el fondo decorativo lateral que podría estar causando los cuadros negros

          // Título con estilo mejorado
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.setFontSize(22);
          doc.text(schedule.name, 20, 25);

          // Eliminamos el logo circular que podría estar causando problemas

          // Subtítulo
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
          doc.setFontSize(12);
          doc.text('Cohete Workflow - Cronograma de Contenido', 20, 33);

          // Información del proyecto - Diseño en tarjetas
          const infoCards = [
            { title: 'PROYECTO', value: project.name },
            { title: 'CLIENTE', value: project.client },
            { title: 'TOTAL PUBLICACIONES', value: sortedEntries.length.toString() },
            {
              title: 'FECHA DE INICIO',
              value: schedule.startDate
                ? new Date(schedule.startDate).toLocaleDateString('es-ES', {
                  day: '2-digit', month: '2-digit', year: 'numeric'
                })
                : 'No definida'
            }
          ];

          const cardWidth = 65;
          const cardGap = 4;
          const cardsStartX = 20;
          let cardX = cardsStartX;

          // Añadir tarjetas de información
          infoCards.forEach(card => {
            // Fondo de tarjeta - usando rect simple en lugar de roundedRect para evitar problemas
            doc.setFillColor(0.98, 0.98, 0.98); // #fafafa
            doc.rect(cardX, 50, cardWidth, 20, 'F');

            // Borde superior de color
            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.rect(cardX, 50, cardWidth, 1, 'F');

            // Título de tarjeta
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
            doc.text(card.title, cardX + 5, 55);

            // Valor de tarjeta
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(0.1, 0.1, 0.1); // Casi negro para mejor contraste
            doc.text(card.value, cardX + 5, 62);

            // Avanzar a la siguiente tarjeta
            cardX += cardWidth + cardGap;
          });

          // Añadir fecha actual
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
          const currentDate = new Date().toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
          doc.text(`Generado el: ${currentDate}`, 260, 55, { align: 'right' });

          // Configuración de la tabla mejorada
          const tableStartY = 78;
          let currentY = tableStartY;

          // Simplificamos el área de tabla para eliminar posibles problemas con los cuadros negros
          // En lugar de usar fondos con bordes redondeados, usamos líneas simples
          doc.setDrawColor(0.9, 0.9, 0.9); // #e6e6e6 
          doc.setLineWidth(0.5);
          doc.rect(10, currentY - 3, 277, 112);

          // Títulos de columna
          const headers = [
            { name: 'FECHA', width: 20 },
            { name: 'HORA', width: 15 },
            { name: 'PLATAFORMA', width: 25 },
            { name: 'TÍTULO', width: 35 },
            { name: 'COPY IN', width: 50 },
            { name: 'COPY OUT', width: 50 },
            { name: 'INSTRUCCIONES', width: 50 },
            { name: 'HASHTAGS', width: 30 }
          ];

          // Header de tabla con diseño mejorado
          let colX = 15;

          // Encabezados con estilo
          headers.forEach(header => {
            // Título de columna
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.setFontSize(7);
            doc.text(header.name, colX, currentY);

            // Línea decorativa bajo el título
            doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.setLineWidth(0.5);
            doc.line(colX, currentY + 1, colX + header.width - 5, currentY + 1);

            colX += header.width;
          });

          currentY += 8;

          // Función para truncar texto
          const truncateText = (text: string | null, maxLength: number = 45) => {
            if (!text) return '';
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
          };

          // Añadir filas de datos con diseño mejorado
          sortedEntries.forEach((entry, index) => {
            // Verificar si necesitamos una nueva página
            if (currentY > 178) { // Dejar espacio para el pie de página
              doc.addPage();

              // Simplificado diseño de cabecera en nueva página para evitar problemas con cuadros negros
              doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
              doc.setLineWidth(1);
              doc.line(10, 10, 287, 10);

              doc.setFont('helvetica', 'bold');
              doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
              doc.setFontSize(14);
              doc.text(schedule.name + ' (continuación)', 20, 22);

              // Área de tabla con líneas simples
              currentY = 40;
              doc.setDrawColor(0.9, 0.9, 0.9);
              doc.setLineWidth(0.5);
              doc.rect(10, currentY - 3, 277, 150);

              // Repetir encabezados
              colX = 15;
              headers.forEach(header => {
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                doc.setFontSize(7);
                doc.text(header.name, colX, currentY);
                doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                doc.setLineWidth(0.5);
                doc.line(colX, currentY + 1, colX + header.width - 5, currentY + 1);
                colX += header.width;
              });

              currentY += 8;
            }

            // Línea de separación sutil entre filas
            if (index > 0) {
              doc.setDrawColor(0.9, 0.9, 0.9); // #e5e5e5
              doc.setLineWidth(0.2);
              doc.line(15, currentY - 4, 280, currentY - 4);
            }

            // Formatear fecha
            const dateFormatted = entry.postDate
              ? new Date(entry.postDate).toLocaleDateString('es-ES', {
                day: '2-digit', month: '2-digit', year: 'numeric'
              })
              : 'Sin fecha';

            // Convertir color de plataforma
            const platformColor = getPlatformColor(entry.platform || '');
            const r = parseInt(platformColor.slice(1, 3), 16) / 255;
            const g = parseInt(platformColor.slice(3, 5), 16) / 255;
            const b = parseInt(platformColor.slice(5, 7), 16) / 255;

            colX = 15;

            // Columna: Fecha
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(0.2, 0.2, 0.2);
            doc.text(dateFormatted, colX, currentY);
            colX += headers[0].width;

            // Columna: Hora 
            doc.text(entry.postTime || '-', colX, currentY);
            colX += headers[1].width;

            // Columna: Plataforma (con etiqueta normal en lugar de redondeada)
            if (entry.platform) {
              doc.setFillColor(r, g, b);
              doc.rect(colX, currentY - 3.5, 20, 5, 'F');
              doc.setTextColor(1, 1, 1);
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(7.5);
              doc.text(entry.platform, colX + 10, currentY, { align: 'center' });
            }
            colX += headers[2].width;

            // Columna: Título
            doc.setTextColor(0.1, 0.1, 0.1);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(truncateText(entry.title, 30), colX, currentY);
            colX += headers[3].width;

            // Resto de columnas con texto formateado
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(0.2, 0.2, 0.2);

            // Copy In con formato adecuado, usando splitTextToSize para ajustar largas líneas
            const copyInLines = doc.splitTextToSize(truncateText(entry.copyIn, 80), headers[4].width - 5);
            doc.text(copyInLines, colX, currentY);
            colX += headers[4].width;

            // Copy Out
            const copyOutLines = doc.splitTextToSize(truncateText(entry.copyOut, 80), headers[5].width - 5);
            doc.text(copyOutLines, colX, currentY);
            colX += headers[5].width;

            // Instrucciones
            const instructionsLines = doc.splitTextToSize(truncateText(entry.designInstructions, 80), headers[6].width - 5);
            doc.text(instructionsLines, colX, currentY);
            colX += headers[6].width;

            // Hashtags con formato especial
            if (entry.hashtags) {
              const hashtagsArr = entry.hashtags.split(' ');
              const formattedHashtags = hashtagsArr.map(tag => {
                return tag.startsWith('#') ? tag : '#' + tag;
              }).join(' ');

              doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
              doc.setFont('helvetica', 'bold');
              const hashtagLines = doc.splitTextToSize(truncateText(formattedHashtags, 50), headers[7].width - 5);
              doc.text(hashtagLines, colX, currentY);
            }

            currentY += 10; // Espacio entre filas
          });

          // Añadir pie de página elegante
          const footerY = 192;

          // Línea decorativa
          doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.setLineWidth(0.5);
          doc.line(10, footerY - 2, 287, footerY - 2);

          // Texto de pie de página
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
          doc.setFontSize(7);
          doc.text('Generado por Cohete Workflow © 2024-2025', 15, footerY);

          // Añadir número de página en el lado derecho
          doc.text('Página 1 de 1', 280, footerY, { align: 'right' });

          // Obtener el PDF como buffer
          const pdfBuffer = doc.output('arraybuffer');

          // Enviar el archivo al cliente
          const safeFileName = schedule.name.replace(/[^a-z0-9]/gi, '_');
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.pdf"`);
          res.send(Buffer.from(pdfBuffer));
        } catch (error) {
          console.error("Error generando PDF:", error);
          res.status(500).json({ message: "Error al generar el PDF", details: error.message });
        }
      } else {
        // Format not supported
        return res.status(400).json({ message: "Format not supported. Use 'excel' or 'pdf'." });
      }
    } catch (error) {
      console.error("Error downloading schedule:", error);
      res.status(500).json({ message: "Failed to download schedule" });
    }
  });

  // Endpoint para generar imágenes eliminado (ya no se generan imágenes)

  // ===== BLOQUE 6: CHAT Y TAREAS API =====
  // Chat API
  app.post("/api/chat", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { message, projectId } = req.body;

      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      if (projectId) {
        // Check if user has access to project
        const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
        }

        // Get project with analysis
        const project = await global.storage.getProjectWithAnalysis(projectId);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        // Get context from previous messages
        const previousMessages = await global.storage.getChatMessages(projectId);

        // Convertir los mensajes anteriores al formato requerido por Gemini
        const formattedMessages = previousMessages.map(msg => {
          // En el schema tenemos 'role' pero la API necesita 'user' o 'assistant'
          return {
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          };
        });

        // Use AI to process message with project context
        const response = await processChatMessage(
          message,
          {
            name: project.name,
            client: project.client,
            description: project.description,
            ...(project.analysis || {})
          },
          formattedMessages
        );

        // Save user message
        await global.storage.createChatMessage({
          projectId,
          userId: req.user.id,
          content: message,
          role: 'user'
        });

        // Save AI response
        const savedResponse = await global.storage.createChatMessage({
          projectId,
          content: response,
          role: 'assistant'
        });

        res.json(savedResponse);
      } else {
        // General chat without project context
        // Use AI to process message
        const response = await processChatMessage(message, {}, []);

        res.json({
          content: response,
          role: 'assistant',
          createdAt: new Date()
        });
      }
    } catch (error) {
      console.error("Error processing chat message:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  app.get("/api/projects/:projectId/chat", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Check if user has access to project
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this project" });
      }

      const messages = await global.storage.getChatMessages(projectId);
      res.json(messages);
    } catch (error) {
      console.error("Error listing chat messages:", error);
      res.status(500).json({ message: "Failed to list chat messages" });
    }
  });

  // Tasks API
  app.get("/api/projects/:projectId/tasks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Check if user has access to project
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this project" });
      }

      const tasks = await global.storage.getTasks(projectId);
      res.json(tasks);
    } catch (error) {
      console.error("Error listing tasks:", error);
      res.status(500).json({ message: "Failed to list tasks" });
    }
  });

  app.post("/api/projects/:projectId/tasks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Check if user has access to project
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this project" });
      }

      const taskData = insertTaskSchema.parse({
        projectId,
        ...req.body,
        createdById: req.user.id
      });

      const task = await global.storage.createTask(taskData);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.get("/api/tasks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const task = await global.storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check if user has access to the project this task belongs to
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        task.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this task" });
      }

      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  app.patch("/api/tasks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const task = await global.storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check if user has access to the project this task belongs to
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        task.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this task" });
      }

      // Update task (only certain fields can be updated)
      const updatedTask = await global.storage.updateTask(taskId, req.body);

      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const task = await global.storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check if user has access to the project this task belongs to
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        task.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this task" });
      }

      // Delete task
      await global.storage.deleteTask(taskId);

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Subtasks API
  app.get("/api/tasks/:taskId/subtasks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      // Get parent task to check permissions
      const task = await global.storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check if user has access to project
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        task.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this task" });
      }

      const subtasks = await global.storage.getTasks(taskId);
      res.json(subtasks);
    } catch (error) {
      console.error("Error listing subtasks:", error);
      res.status(500).json({ message: "Failed to list subtasks" });
    }
  });

  app.post("/api/tasks/:taskId/subtasks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      // Get parent task to check permissions and set project
      const parentTask = await global.storage.getTask(taskId);
      if (!parentTask) {
        return res.status(404).json({ message: "Parent task not found" });
      }

      // Check if user has access to project
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        parentTask.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this task" });
      }

      // Create subtask with parent task reference
      const subtaskData = {
        ...req.body,
        projectId: parentTask.projectId,
        parentTaskId: taskId,
        createdById: req.user.id
      };

      const newSubtask = await global.storage.createTask(subtaskData);
      res.status(201).json(newSubtask);
    } catch (error) {
      console.error("Error creating subtask:", error);
      res.status(500).json({ message: "Failed to create subtask" });
    }
  });

  // Task Comments API
  app.get("/api/tasks/:taskId/comments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      // Get task to check permissions
      const task = await global.storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check if user has access to project
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        task.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this task" });
      }

      const comments = await global.storage.getTaskComments(taskId);
      res.json(comments);
    } catch (error) {
      console.error("Error listing task comments:", error);
      res.status(500).json({ message: "Failed to list task comments" });
    }
  });

  app.post("/api/tasks/:taskId/comments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      // Get task to check permissions
      const task = await global.storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check if user has access to project
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        task.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this task" });
      }

      const commentData = {
        ...req.body,
        taskId,
        userId: req.user.id
      };

      const newComment = await global.storage.createTaskComment(commentData);
      res.status(201).json(newComment);
    } catch (error) {
      console.error("Error creating task comment:", error);
      res.status(500).json({ message: "Failed to create task comment" });
    }
  });

  app.delete("/api/tasks/comments/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "Invalid comment ID" });
      }

      // Get comment to check permissions
      const comment = await global.storage.getTaskComment(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      // Get task to check project access
      const task = await global.storage.getTask(comment.taskId);
      if (!task) {
        return res.status(404).json({ message: "Associated task not found" });
      }

      // Check if user has access to project or is comment author
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        task.projectId,
        req.user.isPrimary
      );

      const isAuthor = comment.userId === req.user.id;

      if (!hasAccess && !isAuthor) {
        return res.status(403).json({ message: "You don't have permission to delete this comment" });
      }

      await global.storage.deleteTaskComment(commentId);
      res.status(200).json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error deleting task comment:", error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  app.post("/api/projects/:projectId/generate-tasks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Check if user has access to project
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this project" });
      }

      // Get project with analysis
      const project = await global.storage.getProjectWithAnalysis(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get all users who can be assigned to tasks
      const users = await global.storage.getAllUsers();

      // Use AI to generate tasks (to be implemented in another file)
      // For now, create a few sample tasks
      const sampleTasks = [
        {
          title: "Crear contenido para Instagram",
          description: "Desarrollar contenido visual y textual para la próxima campaña en Instagram",
          priority: "high",
          status: "pending",
          tags: ["contenido", "instagram", "marketing"],
          taskGroup: "content",
          aiGenerated: true
        },
        {
          title: "Diseñar publicaciones para Facebook",
          description: "Crear diseños para las próximas publicaciones en Facebook siguiendo la guía de estilo",
          priority: "medium",
          status: "pending",
          tags: ["diseño", "facebook", "marketing"],
          taskGroup: "design",
          aiGenerated: true
        },
        {
          title: "Revisar métricas de campaña anterior",
          description: "Analizar el rendimiento de la campaña anterior y preparar informe",
          priority: "low",
          status: "pending",
          tags: ["análisis", "métricas", "informe"],
          taskGroup: "analysis",
          aiGenerated: true
        }
      ];

      // Save tasks to database
      const createdTasks = await Promise.all(
        sampleTasks.map(async (taskData) => {
          return await global.storage.createTask({
            ...taskData,
            projectId,
            createdById: req.user.id
          });
        })
      );

      res.status(201).json(createdTasks);
    } catch (error) {
      console.error("Error generating tasks:", error);
      res.status(500).json({ message: "Failed to generate tasks" });
    }
  });

  app.get("/api/users/me/tasks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tasks = await global.storage.listTasksByAssignee(req.user.id);
      res.json(tasks);
    } catch (error) {
      console.error("Error listing user tasks:", error);
      res.status(500).json({ message: "Failed to list user tasks" });
    }
  });

  // ===== BLOQUE 7: PRODUCTOS Y SISTEMA MONDAY =====
  // Products API
  app.post("/api/projects/:projectId/products", isAuthenticated, upload.single('image'), async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      // Verificar si el proyecto existe
      const project = await global.storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Proyecto no encontrado" });
      }

      // Verificar datos del producto
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ message: "El nombre del producto es requerido" });
      }

      // Datos del producto
      const productData = {
        projectId,
        createdBy: req.user?.id,
        name,
        description: description || null,
        sku: null,
        price: null,
        imageUrl: req.file ? req.file.filename : null
      };

      // Validar con Zod
      const validatedData = insertProductSchema.parse(productData);

      // Crear producto
      const newProduct = await global.storage.createProduct(validatedData);

      res.status(201).json(newProduct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Error al crear el producto" });
    }
  });

  app.get("/api/projects/:projectId/products", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      const products = await global.storage.listProductsByProject(projectId);
      res.json(products);
    } catch (error) {
      console.error("Error listing products:", error);
      res.status(500).json({ message: "Error al listar productos" });
    }
  });

  app.get("/api/products/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "ID de producto inválido" });
      }

      const product = await global.storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        product.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este producto" });
      }

      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Error al obtener el producto" });
    }
  });

  app.patch("/api/products/:id", isAuthenticated, upload.single('image'), async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "ID de producto inválido" });
      }

      // Obtener el producto actual
      const product = await global.storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        product.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este producto" });
      }

      // Preparar datos actualizados
      const updateData: Partial<Product> = {};

      if (req.body.name) updateData.name = req.body.name;
      if (req.body.description !== undefined) updateData.description = req.body.description || null;
      if (req.body.sku !== undefined) updateData.sku = req.body.sku || null;
      if (req.body.price !== undefined) updateData.price = req.body.price ? parseFloat(req.body.price) : null;

      // Si hay una nueva imagen
      if (req.file) {
        updateData.imageUrl = req.file.filename;

        // Eliminar la imagen anterior si existe
        if (product.imageUrl) {
          const oldImagePath = path.join(__dirname, '..', 'uploads', product.imageUrl);
          try {
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
            }
          } catch (err) {
            console.error("Error removing old product image:", err);
          }
        }
      }

      const updatedProduct = await global.storage.updateProduct(productId, updateData);
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Error al actualizar el producto" });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "ID de producto inválido" });
      }

      // Obtener el producto
      const product = await global.storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }

      // Verificar acceso al proyecto (solo usuarios primarios pueden eliminar)
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        product.projectId,
        req.user.isPrimary
      );

      if (!hasAccess || !req.user.isPrimary) {
        return res.status(403).json({ message: "No tienes permisos para eliminar este producto" });
      }

      // Eliminar la imagen asociada si existe
      if (product.imageUrl) {
        const imagePath = path.join(__dirname, '..', 'uploads', product.imageUrl);
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (err) {
          console.error("Error removing product image:", err);
        }
      }

      // Eliminar el producto
      await global.storage.deleteProduct(productId);
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Error al eliminar el producto" });
    }
  });

  // Actualizar comentarios de una entrada del cronograma
  app.patch("/api/schedule-entries/:id/comments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const entryId = parseInt(req.params.id);
      const { comments } = req.body;

      if (isNaN(entryId)) {
        return res.status(400).json({ message: "ID de entrada inválido" });
      }

      // Verificar si la entrada existe
      const entry = await global.storage.getScheduleEntry(entryId);
      if (!entry) {
        return res.status(404).json({ message: "Entrada no encontrada" });
      }

      // Verificar que el usuario tenga acceso al proyecto (entry → schedule → project)
      const entrySchedule = await global.storage.getSchedule(entry.scheduleId);
      if (!entrySchedule) {
        return res.status(404).json({ message: "Cronograma asociado no encontrado" });
      }

      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        entrySchedule.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este cronograma" });
      }

      // Actualizar los comentarios
      await global.storage.updateScheduleEntry(entryId, { comments });

      res.status(200).json({
        message: "Comentarios actualizados correctamente",
        entryId
      });

    } catch (error) {
      console.error("Error al actualizar comentarios:", error);
      res.status(500).json({ message: "Error al actualizar comentarios", error: String(error) });
    }
  });

  // Set up WebSocket for real-time task updates
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Handle different message types
        if (data.type === 'subscribe') {
          // Could store subscription info to know which clients to notify
          console.log(`Client subscribed to ${data.entity} updates`);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  // Function to broadcast updates to all connected clients
  const broadcastUpdate = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // Project Views API - Para los distintos tipos de vistas (lista, kanban, gantt, calendario)
  app.get("/api/projects/:projectId/views", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      const views = await global.storage.listProjectViews(projectId);
      res.json(views);
    } catch (error) {
      console.error("Error al obtener vistas de proyecto:", error);
      res.status(500).json({ message: "Error al obtener vistas de proyecto" });
    }
  });

  app.post("/api/projects/:projectId/views", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      const viewData = insertProjectViewSchema.parse({
        ...req.body,
        projectId,
        createdBy: req.user.id
      });

      const newView = await global.storage.createProjectView(viewData);

      // Si esta vista es la predeterminada, actualizar otras vistas
      if (viewData.isDefault) {
        await global.storage.updateOtherViewsDefaultStatus(projectId, newView.id);
      }

      res.status(201).json(newView);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error al crear vista de proyecto:", error);
      res.status(500).json({ message: "Error al crear vista de proyecto" });
    }
  });

  app.patch("/api/project-views/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const viewId = parseInt(req.params.id);
      if (isNaN(viewId)) {
        return res.status(400).json({ message: "ID de vista inválido" });
      }

      // Obtener la vista para verificar acceso
      const view = await global.storage.getProjectView(viewId);
      if (!view) {
        return res.status(404).json({ message: "Vista no encontrada" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        view.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      // Actualizar vista
      const updatedView = await global.storage.updateProjectView(viewId, req.body);

      // Si esta vista se establece como predeterminada, actualizar otras vistas
      if (req.body.isDefault === true) {
        await global.storage.updateOtherViewsDefaultStatus(view.projectId, viewId);
      }

      res.json(updatedView);
    } catch (error) {
      console.error("Error al actualizar vista de proyecto:", error);
      res.status(500).json({ message: "Error al actualizar vista de proyecto" });
    }
  });

  app.delete("/api/project-views/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const viewId = parseInt(req.params.id);
      if (isNaN(viewId)) {
        return res.status(400).json({ message: "ID de vista inválido" });
      }

      // Obtener la vista para verificar acceso
      const view = await global.storage.getProjectView(viewId);
      if (!view) {
        return res.status(404).json({ message: "Vista no encontrada" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        view.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      // No permitir eliminar la vista predeterminada si es la única
      if (view.isDefault) {
        const projectViews = await global.storage.listProjectViews(view.projectId);
        if (projectViews.length <= 1) {
          return res.status(400).json({ message: "No puedes eliminar la única vista del proyecto" });
        }
      }

      // Eliminar vista
      await global.storage.deleteProjectView(viewId);

      // Si la vista eliminada era la predeterminada, establecer otra como predeterminada
      if (view.isDefault) {
        const remainingViews = await global.storage.listProjectViews(view.projectId);
        if (remainingViews.length > 0) {
          await global.storage.updateProjectView(remainingViews[0].id, { isDefault: true });
        }
      }

      res.status(204).end();
    } catch (error) {
      console.error("Error al eliminar vista de proyecto:", error);
      res.status(500).json({ message: "Error al eliminar vista de proyecto" });
    }
  });

  // Automation Rules API
  app.get("/api/projects/:projectId/automation-rules", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      const rules = await global.storage.listAutomationRules(projectId);
      res.json(rules);
    } catch (error) {
      console.error("Error al obtener reglas de automatización:", error);
      res.status(500).json({ message: "Error al obtener reglas de automatización" });
    }
  });

  app.post("/api/projects/:projectId/automation-rules", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      const ruleData = insertAutomationRuleSchema.parse({
        ...req.body,
        projectId,
        createdBy: req.user.id
      });

      const newRule = await global.storage.createAutomationRule(ruleData);
      res.status(201).json(newRule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error al crear regla de automatización:", error);
      res.status(500).json({ message: "Error al crear regla de automatización" });
    }
  });

  app.patch("/api/automation-rules/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const ruleId = parseInt(req.params.id);
      if (isNaN(ruleId)) {
        return res.status(400).json({ message: "ID de regla inválido" });
      }

      // Obtener la regla para verificar acceso
      const rule = await global.storage.getAutomationRule(ruleId);
      if (!rule) {
        return res.status(404).json({ message: "Regla no encontrada" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        rule.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      // Actualizar regla
      const updatedRule = await global.storage.updateAutomationRule(ruleId, req.body);
      res.json(updatedRule);
    } catch (error) {
      console.error("Error al actualizar regla de automatización:", error);
      res.status(500).json({ message: "Error al actualizar regla de automatización" });
    }
  });

  app.delete("/api/automation-rules/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const ruleId = parseInt(req.params.id);
      if (isNaN(ruleId)) {
        return res.status(400).json({ message: "ID de regla inválido" });
      }

      // Obtener la regla para verificar acceso
      const rule = await global.storage.getAutomationRule(ruleId);
      if (!rule) {
        return res.status(404).json({ message: "Regla no encontrada" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        rule.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      // Eliminar regla
      await global.storage.deleteAutomationRule(ruleId);
      res.status(204).end();
    } catch (error) {
      console.error("Error al eliminar regla de automatización:", error);
      res.status(500).json({ message: "Error al eliminar regla de automatización" });
    }
  });

  // Time Entries API
  app.get("/api/tasks/:taskId/time-entries", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "ID de tarea inválido" });
      }

      // Obtener la tarea para verificar acceso al proyecto
      const task = await global.storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Tarea no encontrada" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        task.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      const timeEntries = await global.storage.listTimeEntriesByTask(taskId);
      res.json(timeEntries);
    } catch (error) {
      console.error("Error al obtener registros de tiempo:", error);
      res.status(500).json({ message: "Error al obtener registros de tiempo" });
    }
  });

  app.post("/api/tasks/:taskId/time-entries", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "ID de tarea inválido" });
      }

      // Obtener la tarea para verificar acceso al proyecto
      const task = await global.storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Tarea no encontrada" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        task.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      const timeEntryData = insertTimeEntrySchema.parse({
        ...req.body,
        taskId,
        userId: req.user.id
      });

      const newTimeEntry = await global.storage.createTimeEntry(timeEntryData);
      res.status(201).json(newTimeEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error al crear registro de tiempo:", error);
      res.status(500).json({ message: "Error al crear registro de tiempo" });
    }
  });

  app.patch("/api/time-entries/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const entryId = parseInt(req.params.id);
      if (isNaN(entryId)) {
        return res.status(400).json({ message: "ID de registro inválido" });
      }

      // Obtener el registro para verificar acceso
      const timeEntry = await global.storage.getTimeEntry(entryId);
      if (!timeEntry) {
        return res.status(404).json({ message: "Registro de tiempo no encontrado" });
      }

      // Solo permitir editar registros propios a menos que sea usuario primario
      if (timeEntry.userId !== req.user.id && !req.user.isPrimary) {
        return res.status(403).json({ message: "No puedes editar registros de tiempo de otros usuarios" });
      }

      // Actualizar registro
      const updatedEntry = await global.storage.updateTimeEntry(entryId, req.body);
      res.json(updatedEntry);
    } catch (error) {
      console.error("Error al actualizar registro de tiempo:", error);
      res.status(500).json({ message: "Error al actualizar registro de tiempo" });
    }
  });

  app.delete("/api/time-entries/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const entryId = parseInt(req.params.id);
      if (isNaN(entryId)) {
        return res.status(400).json({ message: "ID de registro inválido" });
      }

      // Obtener el registro para verificar acceso
      const timeEntry = await global.storage.getTimeEntry(entryId);
      if (!timeEntry) {
        return res.status(404).json({ message: "Registro de tiempo no encontrado" });
      }

      // Solo permitir eliminar registros propios a menos que sea usuario primario
      if (timeEntry.userId !== req.user.id && !req.user.isPrimary) {
        return res.status(403).json({ message: "No puedes eliminar registros de tiempo de otros usuarios" });
      }

      // Eliminar registro
      await global.storage.deleteTimeEntry(entryId);
      res.status(204).end();
    } catch (error) {
      console.error("Error al eliminar registro de tiempo:", error);
      res.status(500).json({ message: "Error al eliminar registro de tiempo" });
    }
  });

  // Tags API
  app.get("/api/projects/:projectId/tags", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      const tags = await global.storage.listTags(projectId);
      res.json(tags);
    } catch (error) {
      console.error("Error al obtener etiquetas:", error);
      res.status(500).json({ message: "Error al obtener etiquetas" });
    }
  });

  app.post("/api/projects/:projectId/tags", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      const tagData = insertTagSchema.parse({
        ...req.body,
        projectId,
        createdBy: req.user.id
      });

      const newTag = await global.storage.createTag(tagData);
      res.status(201).json(newTag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error al crear etiqueta:", error);
      res.status(500).json({ message: "Error al crear etiqueta" });
    }
  });

  app.patch("/api/tags/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tagId = parseInt(req.params.id);
      if (isNaN(tagId)) {
        return res.status(400).json({ message: "ID de etiqueta inválido" });
      }

      // Obtener la etiqueta para verificar acceso
      const tag = await global.storage.getTag(tagId);
      if (!tag) {
        return res.status(404).json({ message: "Etiqueta no encontrada" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        tag.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      // Actualizar etiqueta
      const updatedTag = await global.storage.updateTag(tagId, req.body);
      res.json(updatedTag);
    } catch (error) {
      console.error("Error al actualizar etiqueta:", error);
      res.status(500).json({ message: "Error al actualizar etiqueta" });
    }
  });

  app.delete("/api/tags/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tagId = parseInt(req.params.id);
      if (isNaN(tagId)) {
        return res.status(400).json({ message: "ID de etiqueta inválido" });
      }

      // Obtener la etiqueta para verificar acceso
      const tag = await global.storage.getTag(tagId);
      if (!tag) {
        return res.status(404).json({ message: "Etiqueta no encontrada" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        tag.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      // Eliminar etiqueta
      await global.storage.deleteTag(tagId);
      res.status(204).end();
    } catch (error) {
      console.error("Error al eliminar etiqueta:", error);
      res.status(500).json({ message: "Error al eliminar etiqueta" });
    }
  });

  // Collaborative Docs API
  app.get("/api/projects/:projectId/collaborative-docs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      const docs = await global.storage.listCollaborativeDocs(projectId);
      res.json(docs);
    } catch (error) {
      console.error("Error al obtener documentos colaborativos:", error);
      res.status(500).json({ message: "Error al obtener documentos colaborativos" });
    }
  });

  app.post("/api/projects/:projectId/collaborative-docs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(req.user.id, projectId);

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      const docData = insertCollaborativeDocSchema.parse({
        ...req.body,
        projectId,
        createdBy: req.user.id,
        lastEditedBy: req.user.id
      });

      const newDoc = await global.storage.createCollaborativeDoc(docData);
      res.status(201).json(newDoc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error al crear documento colaborativo:", error);
      res.status(500).json({ message: "Error al crear documento colaborativo" });
    }
  });

  app.get("/api/collaborative-docs/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const docId = parseInt(req.params.id);
      if (isNaN(docId)) {
        return res.status(400).json({ message: "ID de documento inválido" });
      }

      // Obtener el documento
      const doc = await global.storage.getCollaborativeDoc(docId);
      if (!doc) {
        return res.status(404).json({ message: "Documento no encontrado" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        doc.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      res.json(doc);
    } catch (error) {
      console.error("Error al obtener documento colaborativo:", error);
      res.status(500).json({ message: "Error al obtener documento colaborativo" });
    }
  });

  app.patch("/api/collaborative-docs/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const docId = parseInt(req.params.id);
      if (isNaN(docId)) {
        return res.status(400).json({ message: "ID de documento inválido" });
      }

      // Obtener el documento para verificar acceso
      const doc = await global.storage.getCollaborativeDoc(docId);
      if (!doc) {
        return res.status(404).json({ message: "Documento no encontrado" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        doc.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      // Actualizar documento con el usuario que lo editó por última vez
      const updatedDoc = await global.storage.updateCollaborativeDoc(docId, {
        ...req.body,
        lastEditedBy: req.user.id
      });

      // Notificar a todos los clientes conectados sobre la actualización
      broadcastUpdate({
        type: 'doc_updated',
        docId,
        projectId: doc.projectId,
        editor: {
          id: req.user.id,
          fullName: req.user.fullName
        }
      });

      res.json(updatedDoc);
    } catch (error) {
      console.error("Error al actualizar documento colaborativo:", error);
      res.status(500).json({ message: "Error al actualizar documento colaborativo" });
    }
  });

  app.delete("/api/collaborative-docs/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const docId = parseInt(req.params.id);
      if (isNaN(docId)) {
        return res.status(400).json({ message: "ID de documento inválido" });
      }

      // Obtener el documento para verificar acceso
      const doc = await global.storage.getCollaborativeDoc(docId);
      if (!doc) {
        return res.status(404).json({ message: "Documento no encontrado" });
      }

      // Verificar acceso al proyecto
      const hasAccess = await global.storage.checkUserProjectAccess(
        req.user.id,
        doc.projectId,
        req.user.isPrimary
      );

      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }

      // Eliminar documento
      await global.storage.deleteCollaborativeDoc(docId);
      res.status(204).end();
    } catch (error) {
      console.error("Error al eliminar documento colaborativo:", error);
      res.status(500).json({ message: "Error al eliminar documento colaborativo" });
    }
  });

  // ============ NUEVOS ENDPOINTS PARA SISTEMA DE COLABORACIÓN ============

  // Obtener comentarios de una tarea
  app.get('/api/tasks/:taskId/comments', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);

      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const comments = await global.storage.getTaskComments(taskId);
      res.json(comments);
    } catch (error) {
      console.error('Error obteniendo comentarios:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Crear comentario en una tarea
  app.post('/api/tasks/:taskId/comments', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);

      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const { content, mentionedUsers = [] } = req.body;

      const comment = await global.storage.createTaskComment({
        taskId,
        userId: req.user.id,
        content,
        mentionedUsers
      });

      // Crear notificaciones para usuarios mencionados
      if (mentionedUsers && mentionedUsers.length > 0) {
        for (const userId of mentionedUsers) {
          await global.storage.createNotification({
            userId,
            type: 'mentioned_in_comment',
            title: 'Te mencionaron en un comentario',
            message: `${req.user.fullName} te mencionó en un comentario`,
            relatedTaskId: taskId,
            relatedCommentId: comment.id
          });
        }
      }

      res.status(201).json(comment);
    } catch (error) {
      console.error('Error creando comentario:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Obtener notificaciones del usuario
  app.get('/api/notifications', isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const notifications = await global.storage.getUserNotifications(req.user.id);
      res.json(notifications);
    } catch (error) {
      console.error('Error obteniendo notificaciones:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Marcar notificación como leída
  app.patch('/api/notifications/:id/read', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const notificationId = parseInt(req.params.id);

      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      await global.storage.markNotificationAsRead(notificationId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marcando notificación:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Obtener miembros de un proyecto
  app.get('/api/projects/:projectId/members', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);

      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const members = await global.storage.getProjectMembers(projectId);
      res.json(members);
    } catch (error) {
      console.error('Error obteniendo miembros:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Agregar miembro a un proyecto
  app.post('/api/projects/:projectId/members', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);

      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const { userId, role = 'member' } = req.body;

      const member = await global.storage.addProjectMember({
        projectId,
        userId,
        role
      });

      res.status(201).json(member);
    } catch (error) {
      console.error('Error agregando miembro:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Obtener dependencias de una tarea
  app.get('/api/tasks/:taskId/dependencies', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);

      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const dependencies = await global.storage.getTaskDependencies(taskId);
      res.json(dependencies);
    } catch (error) {
      console.error('Error obteniendo dependencias:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Crear dependencia entre tareas
  app.post('/api/tasks/:taskId/dependencies', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);

      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const { dependsOnTaskId } = req.body;

      const dependency = await global.storage.createTaskDependency({
        taskId,
        dependsOnTaskId
      });

      res.status(201).json(dependency);
    } catch (error) {
      console.error('Error creando dependencia:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // ============ ENDPOINTS PARA GESTIÓN DE EQUIPOS ============

  // Obtener equipos del usuario
  app.get('/api/teams', isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const userTeams = await db.select({
        team: teams,
        membership: teamMembers
      })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(eq(teamMembers.userId, req.user.id));

      res.json(userTeams);
    } catch (error) {
      console.error('Error obteniendo equipos:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Obtener miembros de un equipo
  app.get('/api/teams/:teamId/members', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const teamId = parseInt(req.params.teamId);

      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      // Verificar que el usuario pertenece al equipo
      const [membership] = await db.select()
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, req.user.id)
        ));

      if (!membership) {
        return res.status(403).json({ message: "No tienes acceso a este equipo" });
      }

      const members = await db.select({
        user: {
          id: users.id,
          fullName: users.fullName,
          username: users.username,
          email: users.email,
          profileImage: users.profileImage,
          role: users.role
        },
        membership: {
          role: teamMembers.role,
          joinedAt: teamMembers.joinedAt
        }
      })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.id))
        .where(eq(teamMembers.teamId, teamId));

      res.json(members);
    } catch (error) {
      console.error('Error obteniendo miembros del equipo:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Crear nuevo equipo (solo admins)
  app.post('/api/teams', isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Solo los administradores pueden crear equipos" });
      }

      const { name, domain, description } = req.body;

      const [newTeam] = await db.insert(teams)
        .values({
          name,
          domain,
          description,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Agregar al creador como owner del equipo
      await db.insert(teamMembers)
        .values({
          teamId: newTeam.id,
          userId: req.user.id,
          role: 'owner',
          joinedAt: new Date(),
        });

      res.status(201).json(newTeam);
    } catch (error) {
      console.error('Error creando equipo:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Update a specific task
  app.patch('/api/tasks/:taskId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);

      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const updates = req.body;

      // Update task in database
      const updatedTask = await db.update(schema.tasks)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(schema.tasks.id, taskId))
        .returning();

      if (updatedTask.length === 0) {
        return res.status(404).json({ message: "Tarea no encontrada" });
      }

      // Log activity
      if (req.user && req.user.id) {
        await db.insert(schema.activityLog).values({
          description: `Tarea actualizada: ${updatedTask[0].title}`,
          taskId: taskId,
          projectId: updatedTask[0].projectId,
          userId: req.user.id
        });
      }

      res.json(updatedTask[0]);
    } catch (error) {
      console.error('Error actualizando tarea:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Get task attachments
  app.get('/api/tasks/:taskId/attachments', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);

      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const attachments = await db.select()
        .from(schema.taskAttachments)
        .where(eq(schema.taskAttachments.taskId, taskId))
        .orderBy(desc(schema.taskAttachments.uploadedAt));

      res.json(attachments);
    } catch (error) {
      console.error('Error obteniendo archivos adjuntos:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Upload task attachment
  app.post('/api/tasks/:taskId/attachments', isAuthenticated, upload.single('file'), async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);

      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó archivo" });
      }

      // Save attachment to database
      const attachment = await db.insert(schema.taskAttachments).values({
        fileName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
        taskId: taskId
      }).returning();

      // Log activity
      if (req.user && req.user.id) {
        const task = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
        if (task.length > 0) {
          await db.insert(schema.activityLog).values({
            description: `Archivo adjunto añadido: ${req.file.originalname}`,
            taskId: taskId,
            projectId: task[0].projectId,
            userId: req.user.id
          });
        }
      }

      res.status(201).json(attachment[0]);
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Get single task with details
  app.get('/api/tasks/:taskId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);

      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const taskWithDetails = await db.select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        description: schema.tasks.description,
        status: schema.tasks.status,
        priority: schema.tasks.priority,
        assignedToId: schema.tasks.assignedToId,
        dueDate: schema.tasks.dueDate,
        createdAt: schema.tasks.createdAt,
        updatedAt: schema.tasks.updatedAt,
        assignedTo: {
          id: schema.users.id,
          fullName: schema.users.fullName,
          username: schema.users.username
        }
      })
        .from(schema.tasks)
        .leftJoin(schema.users, eq(schema.tasks.assignedToId, schema.users.id))
        .where(eq(schema.tasks.id, taskId))
        .limit(1);

      if (taskWithDetails.length === 0) {
        return res.status(404).json({ message: "Tarea no encontrada" });
      }

      res.json(taskWithDetails[0]);
    } catch (error) {
      console.error('Error obteniendo tarea:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // ============ NUEVOS ENDPOINTS PARA SISTEMA MONDAY.COM ============

  app.patch("/api/tasks/:taskId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);

      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      const [updatedTask] = await db.update(schema.tasks)
        .set(updateData)
        .where(eq(schema.tasks.id, taskId))
        .returning();

      if (!updatedTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(updatedTask);
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Task Groups CRUD
  app.get("/api/projects/:projectId/task-groups", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const taskGroups = await db.select().from(schema.taskGroups)
        .where(eq(schema.taskGroups.projectId, projectId))
        .orderBy(schema.taskGroups.position);

      res.json(taskGroups);
    } catch (error) {
      console.error('Error fetching task groups:', error);
      res.status(500).json({ error: 'Failed to fetch task groups' });
    }
  });

  app.post("/api/projects/:projectId/task-groups", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const taskGroupData = schema.insertTaskGroupSchema.parse({
        ...req.body,
        projectId,
        createdBy: req.user?.id,
      });

      const [taskGroup] = await db.insert(schema.taskGroups)
        .values(taskGroupData)
        .returning();

      res.status(201).json(taskGroup);
    } catch (error) {
      console.error('Error creating task group:', error);
      res.status(500).json({ error: 'Failed to create task group' });
    }
  });

  app.patch("/api/task-groups/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const groupId = parseInt(req.params.id);
      const updates = req.body;

      const [updatedGroup] = await db.update(schema.taskGroups)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.taskGroups.id, groupId))
        .returning();

      if (!updatedGroup) {
        return res.status(404).json({ error: 'Task group not found' });
      }

      res.json(updatedGroup);
    } catch (error) {
      console.error('Error updating task group:', error);
      res.status(500).json({ error: 'Failed to update task group' });
    }
  });

  app.delete("/api/task-groups/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const groupId = parseInt(req.params.id);

      await db.delete(schema.taskGroups)
        .where(eq(schema.taskGroups.id, groupId));

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting task group:', error);
      res.status(500).json({ error: 'Failed to delete task group' });
    }
  });

  // Project Column Settings CRUD
  app.get("/api/projects/:projectId/columns", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const columns = await db.select().from(schema.projectColumnSettings)
        .where(eq(schema.projectColumnSettings.projectId, projectId))
        .orderBy(schema.projectColumnSettings.position);

      res.json(columns);
    } catch (error) {
      console.error('Error fetching project columns:', error);
      res.status(500).json({ error: 'Failed to fetch project columns' });
    }
  });

  app.post("/api/projects/:projectId/columns", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const columnData = schema.insertProjectColumnSettingSchema.parse({
        ...req.body,
        projectId,
        createdBy: req.user?.id,
      });

      const [column] = await db.insert(schema.projectColumnSettings)
        .values(columnData)
        .returning();

      res.status(201).json(column);
    } catch (error) {
      console.error('Error creating project column:', error);
      res.status(500).json({ error: 'Failed to create project column' });
    }
  });

  app.patch("/api/project-columns/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const columnId = parseInt(req.params.id);
      const updates = req.body;

      const [updatedColumn] = await db.update(schema.projectColumnSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.projectColumnSettings.id, columnId))
        .returning();

      if (!updatedColumn) {
        return res.status(404).json({ error: 'Project column not found' });
      }

      res.json(updatedColumn);
    } catch (error) {
      console.error('Error updating project column:', error);
      res.status(500).json({ error: 'Failed to update project column' });
    }
  });

  app.delete("/api/project-columns/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const columnId = parseInt(req.params.id);

      await db.delete(schema.projectColumnSettings)
        .where(eq(schema.projectColumnSettings.id, columnId));

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting project column:', error);
      res.status(500).json({ error: 'Failed to delete project column' });
    }
  });

  // Task Column Values CRUD
  app.get("/api/tasks/:taskId/column-values", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const columnValues = await db.select().from(schema.taskColumnValues)
        .where(eq(schema.taskColumnValues.taskId, taskId));

      res.json(columnValues);
    } catch (error) {
      console.error('Error fetching task column values:', error);
      res.status(500).json({ error: 'Failed to fetch task column values' });
    }
  });

  app.post("/api/tasks/:taskId/column-values", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const valueData = schema.insertTaskColumnValueSchema.parse({
        ...req.body,
        taskId,
      });

      const [columnValue] = await db.insert(schema.taskColumnValues)
        .values(valueData)
        .returning();

      res.status(201).json(columnValue);
    } catch (error) {
      console.error('Error creating task column value:', error);
      res.status(500).json({ error: 'Failed to create task column value' });
    }
  });

  app.patch("/api/task-column-values/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const valueId = parseInt(req.params.id);
      const updates = req.body;

      const [updatedValue] = await db.update(schema.taskColumnValues)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.taskColumnValues.id, valueId))
        .returning();

      if (!updatedValue) {
        return res.status(404).json({ error: 'Task column value not found' });
      }

      res.json(updatedValue);
    } catch (error) {
      console.error('Error updating task column value:', error);
      res.status(500).json({ error: 'Failed to update task column value' });
    }
  });

  // Task Assignees CRUD
  app.get("/api/tasks/:taskId/assignees", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const assignees = await db.select({
        id: schema.taskAssignees.id,
        taskId: schema.taskAssignees.taskId,
        userId: schema.taskAssignees.userId,
        assignedBy: schema.taskAssignees.assignedBy,
        assignedAt: schema.taskAssignees.assignedAt,
        user: {
          id: schema.users.id,
          fullName: schema.users.fullName,
          username: schema.users.username,
          profileImage: schema.users.profileImage,
          role: schema.users.role,
        }
      })
        .from(schema.taskAssignees)
        .innerJoin(schema.users, eq(schema.taskAssignees.userId, schema.users.id))
        .where(eq(schema.taskAssignees.taskId, taskId));

      res.json(assignees);
    } catch (error) {
      console.error('Error fetching task assignees:', error);
      res.status(500).json({ error: 'Failed to fetch task assignees' });
    }
  });

  app.post("/api/tasks/:taskId/assignees", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { userId } = req.body;

      const assigneeData = {
        taskId,
        userId,
        assignedBy: req.user?.id,
      };

      const [assignee] = await db.insert(schema.taskAssignees)
        .values(assigneeData)
        .returning();

      res.status(201).json(assignee);
    } catch (error) {
      console.error('Error assigning task:', error);
      res.status(500).json({ error: 'Failed to assign task' });
    }
  });

  app.delete("/api/task-assignees/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const assigneeId = parseInt(req.params.id);

      await db.delete(schema.taskAssignees)
        .where(eq(schema.taskAssignees.id, assigneeId));

      res.status(204).send();
    } catch (error) {
      console.error('Error removing task assignee:', error);
      res.status(500).json({ error: 'Failed to remove task assignee' });
    }
  });

  // Enhanced Tasks endpoint with groups and assignees
  app.get("/api/tasks-with-groups", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Get tasks from all projects with safe column selection
      const tasks = await db.select().from(schema.tasks).orderBy(asc(schema.tasks.id));

      // Get task groups separately - handle missing table gracefully
      let taskGroups = [];
      try {
        taskGroups = await db.select().from(schema.taskGroups);
      } catch (error) {
        console.warn('Task groups table not found, continuing without groups');
      }

      // Get projects separately
      const projects = await db.select().from(schema.projects);

      // Get users separately
      const users = await db.select().from(schema.users);

      // Combine data in JavaScript to avoid SQL type conflicts
      const tasksWithDetails = tasks.map(task => {
        // Crear grupos por defecto basados en el enum task.group
        const defaultGroups = {
          'todo': { id: 'todo', name: 'Por hacer', color: '#6b7280', position: 0 },
          'in_progress': { id: 'in_progress', name: 'En progreso', color: '#3b82f6', position: 1 },
          'completed': { id: 'completed', name: 'Completadas', color: '#10b981', position: 2 }
        };

        const group = taskGroups.find(g => g.id === task.groupId) ||
          defaultGroups[task.group] ||
          defaultGroups['todo'];

        const project = projects.find(p => p.id === task.projectId);
        const assignee = users.find(u => u.id === task.assignedToId) ||
          users.find(u => u.id === task.createdById);

        return {
          task: {
            id: task.id,
            projectId: task.projectId,
            title: task.title || 'Sin título',
            description: task.description || '',
            status: task.status || 'pending',
            priority: task.priority || 'medium',
            progress: task.progress || 0,
            dueDate: task.dueDate,
            tags: task.tags || [],
            group: task.group,
            groupId: task.groupId || task.group,
            createdById: task.createdById,
            assignedToId: task.assignedToId,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
          },
          group: group,
          project: project ? {
            id: project.id,
            name: project.name,
            client: project.client,
          } : null,
          assignee: assignee ? {
            id: assignee.id,
            fullName: assignee.fullName,
            username: assignee.username,
            profileImage: assignee.profileImage,
          } : null
        };
      });

      // Group tasks by task group
      const groupedTasks = tasksWithDetails.reduce((acc, item) => {
        const groupId = item.group?.id || 'ungrouped';
        if (!acc[groupId]) {
          acc[groupId] = {
            group: item.group,
            tasks: []
          };
        }

        const task = {
          ...item.task,
          assignee: item.assignee,
          additionalAssignees: []
        };

        acc[groupId].tasks.push(task);
        return acc;
      }, {} as any);

      res.json(Object.values(groupedTasks));
    } catch (error) {
      console.error('Error fetching tasks with groups:', error);
      res.status(500).json({ error: 'Failed to fetch tasks with groups' });
    }
  });

  return httpServer;
}
