import 'dotenv/config';
// ===== IMPORTACIONES =====
// Express: Framework web para Node.js
import express, { type Request, Response, NextFunction } from "express";
// Módulo para registrar todas las rutas de la API
import { registerRoutes } from "./routes";
// Módulo para configurar Vite en desarrollo y servir archivos estáticos
import { setupVite, serveStatic, log } from "./vite";
// Servicio de integración con Gemini para generación de contenido
// CORS: Middleware para manejar políticas de mismo origen
import cors from 'cors';
// Utilitarios para manejo de rutas de archivos
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// Sistema de archivos de Node.js
import fs from 'fs';
// Replit optimizations
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// ===== CONFIGURACIÓN DE DIRECTORIO =====
// Resolver el directorio actual de forma segura para todas las plataformas
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===== VARIABLES GLOBALES =====
// Hacer disponibles fs y path globalmente para compatibilidad con módulos
if (typeof global !== 'undefined') {
  (global as any).fs = fs;
  (global as any).path = path;
}

// ===== CONFIGURACIÓN DE EXPRESS =====
// Crear instancia de la aplicación Express
const app = express();

// ===== CONFIGURACIÓN DE PUERTO PARA REPLIT =====
// CRÍTICO: Replit workspace siempre usa puerto 5000 según docs.replit.com
// Deployment usa variable PORT dinámicamente

const isReplitEnvironment = !!(process.env.REPL_SLUG || process.env.REPL_OWNER || process.env.REPL_ID);
const resolvedNodeEnv = process.env.NODE_ENV ?? (isReplitEnvironment ? 'production' : 'development');
process.env.NODE_ENV = resolvedNodeEnv;
const isProduction = resolvedNodeEnv === 'production';
const DEFAULT_PORT = 5000;
const requestedPort = parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10);
const port = Number.isNaN(requestedPort) ? DEFAULT_PORT : requestedPort;

console.log('🔍 Environment detection:');
console.log('  NODE_ENV:', resolvedNodeEnv);
console.log('  PORT:', port);
console.log('  REPL_ID:', process.env.REPL_ID ? 'present' : 'undefined');

// ===== CONFIGURACIÓN CORS =====
// CORS (Cross-Origin Resource Sharing) permite que el frontend acceda al backend
// Lista de orígenes permitidos para hacer peticiones al servidor
const allowedOrigins = new Set<string>();

// Configuración específica para producción en Replit
if (isProduction) {
  // Agregar dominios de Replit para deployment
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    allowedOrigins.add(`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
  }
  // Agregar dominios alternativos de Replit
  allowedOrigins.add(`https://${process.env.REPL_SLUG || 'localhost'}.replit.dev`);
  allowedOrigins.add(`https://${process.env.REPL_ID || 'localhost'}.replit.app`);
} else {
  // Configuración para desarrollo local
  ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://0.0.0.0:5173'].forEach(origin => allowedOrigins.add(origin));
}

// Agregar variantes adicionales de localhost para desarrollo
[
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
  `http://0.0.0.0:${port}`
].forEach(origin => allowedOrigins.add(origin));

// ===== REPLIT OPTIMIZATIONS =====
// Detectar entorno Replit
const isReplit = isReplitEnvironment;

console.log(`[REPLIT] Detected environment: ${isReplit ? 'Replit' : 'Local'}`);
if (isReplit) {
  console.log(`[REPLIT] Repl: ${process.env.REPL_SLUG || 'unknown'}`);
  console.log(`[REPLIT] Owner: ${process.env.REPL_OWNER || 'unknown'}`);
}

// Trust proxy for Replit deployment
app.set('trust proxy', 1);

// Security headers optimizados para entorno
if (isProduction) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.x.ai"]
      }
    }
  }));
} else {
  // Development: headers relajados para Vite
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
}

// Compresión optimizada
app.use(compression());

// Rate limiting para producción
if (isProduction) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { error: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || req.path === '/api/health'
  });
  app.use('/api/', limiter);
}

// ===== MIDDLEWARE CORS =====
// Configurar CORS con validación de orígenes
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (aplicaciones móviles, Postman, etc.)
    if (!origin) return callback(null, true);

    // Permitir siempre en desarrollo o si el origen está en la lista permitida
    if (!isProduction || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Permitir cookies y credenciales
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Métodos HTTP permitidos
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'] // Headers permitidos
}));

// ===== MIDDLEWARE DE PARSEO =====
// Parsear JSON en el body de las peticiones
app.use(express.json());
// Parsear datos de formularios URL-encoded
app.use(express.urlencoded({ extended: false }));

// ===== MIDDLEWARE DE DEBUGGING =====
// Agregar debugging para identificar rutas problemáticas
app.use((req, res, next) => {
  try {
    next();
  } catch (error) {
    console.error('Route error:', {
      method: req.method,
      path: req.path,
      url: req.url,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
});

// ===== HEALTH CHECK ENDPOINTS - PRIORITY ROUTES =====
// CRÍTICO: Health checks DEBEN estar ANTES de otros middleware según docs.replit.com
// Estos endpoints deben responder inmediatamente para deployment verification

// ROOT HEALTH CHECK - SMART DETECTION for Development vs Production
app.get('/', (req, res, next) => {
  // Detectar si estamos en deployment (production) o en Replit
  const isDeployment = isProduction || isReplit;

  // Solo responder con el HTML del health check cuando se solicite explícitamente.
  const healthQuery = req.query.health;
  const requestedHealthQuery = Array.isArray(healthQuery) ? healthQuery[0] : healthQuery;
  const wantsHealthViaQuery =
    requestedHealthQuery === '1' ||
    requestedHealthQuery === 'true';
  const healthHeader = req.header('x-health-check');
  const wantsHealthViaHeader = healthHeader === '1' || healthHeader === 'true';
  const isExplicitHealthCheck = wantsHealthViaQuery || wantsHealthViaHeader;

  if (isDeployment && isExplicitHealthCheck) {
    // EN DEPLOYMENT: Respuesta rápida para health checks solicitados explícitamente
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    const healthResponse = `<!DOCTYPE html>
<html>
<head>
    <title>Cohete Workflow</title>
    <meta charset="UTF-8">
</head>
<body>
    <h1>🚀 Cohete Workflow</h1>
    <div style="color: #4CAF50;">✅ Sistema Activo</div>
    <p><strong>Status:</strong> Running Successfully</p>
    <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
</body>
</html>`;

    return res.status(200).send(healthResponse);
  }

  // Para navegación normal, continuar al middleware de Vite/React
  next();
});

// Health check endpoint adicional - FAST RESPONSE
app.get('/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');

  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'cohete-workflow',
    version: '1.0.0'
  });
});

// API health check 
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    api: 'cohete-workflow'
  });
});

// ===== MIDDLEWARE DE LOGGING =====
// Interceptar y loggear todas las peticiones a la API
app.use((req, res, next) => {
  // Marcar tiempo de inicio para medir duración
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Interceptar el método res.json para capturar la respuesta
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Cuando la respuesta termina, generar el log
  res.on("finish", () => {
    const duration = Date.now() - start;
    // Solo loggear rutas de la API
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // Agregar la respuesta JSON si existe
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      // Truncar líneas muy largas para mantener logs legibles
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Wrap route registration in additional error handling
    const server = await registerRoutes(app).catch((routeError) => {
      console.error('❌ Error registering routes:', routeError);
      throw new Error(`Route registration failed: ${routeError.message}`);
    });

    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log detallado del error
      console.error('Server Error:', {
        error: err,
        stack: err.stack,
        path: req.path,
        method: req.method,
        headers: req.headers,
        body: req.body,
        timestamp: new Date().toISOString()
      });

      // No exponer detalles del error en producción
      const response = {
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
        status: 'ERROR',
        path: req.path,
        timestamp: new Date().toISOString()
      };

      res.status(status).json(response);
    });

    // Trust proxy configuration already set above

    // Health checks ya definidos arriba - no duplicar

    // Detailed status endpoint for debugging (separate from health checks)
    app.get('/api/status', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Cohete Workflow',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        replit: {
          slug: process.env.REPL_SLUG || 'unknown',
          owner: process.env.REPL_OWNER || 'unknown',
          id: process.env.REPL_ID || 'unknown'
        },
        database: {
          connected: !!process.env.DATABASE_URL,
          url_configured: !!process.env.DATABASE_URL,
          provider: process.env.DATABASE_URL?.includes('supabase')
            ? 'supabase'
            : process.env.DATABASE_URL?.includes('neon')
              ? 'neon'
              : 'postgres'
        },
        features: {
          ai: !!process.env.XAI_API_KEY,
          oauth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
          email: !!process.env.SENDGRID_API_KEY
        },
        startup: {
          timestamp: new Date().toISOString(),
          directory: __dirname,
          isReplit: isReplit
        }
      });
    });

    // ===== STATIC FILE SERVING - OPTIMIZADO PARA REPLIT =====
    if (isProduction) {
      console.log('🏭 Setting up production static file serving...');

      // Rutas corregidas para deployment desde dist/
      const possiblePaths = [
        path.join(__dirname, 'public'),              // dist/public/ (build output)
        path.join(__dirname, '../client/dist'),      // client/dist/ (vite build)
        path.join(process.cwd(), 'dist/public'),     // absolute from project root
        path.join(process.cwd(), 'client/dist')      // absolute client build
      ];

      let staticPath = null;
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath) && fs.existsSync(path.join(testPath, 'index.html'))) {
          staticPath = testPath;
          break;
        }
      }

      if (staticPath) {
        console.log('✅ Static files found at:', staticPath);

        // Optimizado para Replit deployment speed
        app.use(express.static(staticPath, {
          maxAge: '1h', // Reducido para deployment
          etag: false,  // Simplificado
          lastModified: false
        }));

        // Catch-all handler optimizado para React routes
        app.get('*', (req, res, next) => {
          // Skip API routes
          if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
            return next();
          }

          // Servir index.html rápidamente
          const indexPath = path.join(staticPath, 'index.html');
          res.sendFile(indexPath);
        });
      } else {
        console.error('❌ No static files found in any location');
        // Fallback básico para deployment
        app.get('*', (req, res, next) => {
          if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
            return next();
          }
          res.status(200).send(`
            <!DOCTYPE html>
            <html><head><title>Cohete Workflow</title></head>
            <body><h1>Cohete Workflow</h1><p>Application starting...</p></body>
            </html>
          `);
        });
      }
    } else {
      // Configuración para desarrollo con Vite  
      console.log("🔧 Setting up Vite development server...");
      await setupVite(app, server);
    }

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client.
    // It is the only port that is not firewalled.

    const serverInstance = server.listen(port, "0.0.0.0", () => {
      log(`🚀 Server is running on http://0.0.0.0:${port}`);
      log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      log(`🔗 API endpoints available at /api/*`);
    });

    // Handle server errors
    serverInstance.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });

    // Process-level error handlers
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit in production, just log the error
      if (process.env.NODE_ENV !== 'production') {
        console.error('Stack trace:', reason?.stack);
      }
    });

    process.on('uncaughtException', (error: Error) => {
      console.error('❌ Uncaught Exception:', error);
      console.error('Stack trace:', error.stack);
      // In production, attempt graceful shutdown
      if (process.env.NODE_ENV === 'production') {
        console.error('🔄 Attempting graceful shutdown due to uncaught exception...');
        serverInstance.close(() => {
          console.log('✅ Server closed due to uncaught exception');
          process.exit(1);
        });
        // Force exit after 5 seconds if graceful shutdown fails
        setTimeout(() => {
          console.error('⚠️ Forced shutdown due to timeout');
          process.exit(1);
        }, 5000);
      } else {
        process.exit(1);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🔄 SIGTERM received, shutting down gracefully');
      serverInstance.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🔄 SIGINT received, shutting down gracefully');
      serverInstance.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();