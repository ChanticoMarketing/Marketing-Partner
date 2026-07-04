// ===== IMPORTACIONES =====
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Extender el tipo Request de Express para incluir user (seteado por isAuthenticated)
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string };
    }
  }
}

// Cliente Supabase con service role para operaciones de servidor
const supabaseService = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const userRoleValues = [
  "admin",
  "project_manager",
  "content_creator",
  "designer",
  "developer",
  "stakeholder",
] as const;

const adminUserSchema = z.object({
  fullName: z.string().min(3, "El nombre completo debe tener al menos 3 caracteres"),
  username: z
    .string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(20, "El nombre de usuario debe tener máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "El nombre de usuario solo puede contener letras, números y guiones bajos"),
  email: z.string().email("Correo electrónico inválido").optional().or(z.literal("")),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  isPrimary: z.boolean().optional().default(false),
  role: z.enum(userRoleValues).optional().default("content_creator"),
});

const adminUserUpdateSchema = adminUserSchema
  .omit({ password: true, email: true })
  .partial();

// Middleware de autenticación: verifica el JWT de Supabase
// Acepta token del header Authorization o del query param ?token= (para window.open downloads)
const isAuthenticated = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '')
    : queryToken;

  if (!token) {
    return res.status(401).json({ message: "No autorizado" });
  }
  const { data, error } = await supabaseService.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ message: "No autorizado" });
  }
  req.user = { id: data.user.id, email: data.user.email };
  next();
};

// Middleware que restringe el acceso a usuarios primarios/administradores
const isPrimaryUser = async (req: any, res: Response, next: NextFunction) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: "No autorizado" });
  }
  const { data } = await supabaseService.from('users').select('is_primary, role').eq('id', req.user.id).single();
  if (!data?.is_primary && data?.role !== 'admin') {
    return res.status(403).json({ message: "Acceso denegado. Solo administradores." });
  }
  next();
};

// Convierte claves camelCase a snake_case (el cliente enviaba camelCase; Supabase usa snake_case)
const toSnakeCase = (obj: Record<string, any>): Record<string, any> =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      value,
    ])
  );

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

export async function registerRoutes(app: Express): Promise<Server> {
  // ===== ARCHIVOS ESTÁTICOS =====
  app.use('/static', express.static(path.join(currentDirPath, 'public')));

  app.get('/privacy-policy', (req, res) => {
    res.sendFile(path.join(currentDirPath, 'public', 'privacy-policy.html'));
  });

  app.get('/terms-of-service', (req, res) => {
    res.sendFile(path.join(currentDirPath, 'public', 'terms-of-service.html'));
  });

  // ===== CREACIÓN DE CUENTA PRIMARIA =====
  const PRIMARY_ACCOUNT_SECRET = process.env.PRIMARY_ACCOUNT_SECRET?.trim();

  app.post("/api/create-primary-account", async (req: Request, res: Response) => {
    try {
      if (!PRIMARY_ACCOUNT_SECRET) {
        return res.status(503).json({
          message: "PRIMARY_ACCOUNT_SECRET no está configurado. Endpoint deshabilitado por seguridad."
        });
      }

      const { fullName, username, password, secretKey } = req.body;

      if (!fullName || !username || !password || !secretKey) {
        return res.status(400).json({ message: "Todos los campos son requeridos" });
      }

      if (secretKey !== PRIMARY_ACCOUNT_SECRET) {
        return res.status(403).json({ message: "Clave secreta incorrecta" });
      }

      const { data: existingUsers } = await supabaseService
        .from("users")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (existingUsers) {
        return res.status(400).json({ message: "El nombre de usuario ya existe" });
      }

      const { data: authData, error: authError } = await supabaseService.auth.admin.createUser({
        email: req.body.email || `${username}@placeholder.local`,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, username },
      });

      if (authError || !authData.user) {
        return res.status(500).json({ message: authError?.message || "Error al crear usuario en auth" });
      }

      const { error: updateError } = await supabaseService
        .from("users")
        .update({ is_primary: true, role: "admin" })
        .eq("id", authData.user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
      }

      res.status(201).json({
        id: authData.user.id,
        fullName,
        username,
        email: authData.user.email,
        isPrimary: true,
        role: "admin",
      });
    } catch (error) {
      console.error("Error creating primary account:", error);
      res.status(500).json({ message: "Error al crear cuenta primaria" });
    }
  });

  // ===== ADMINISTRACIÓN DE USUARIOS =====
  app.get("/api/admin/users", isAuthenticated, isPrimaryUser, async (req: Request, res: Response) => {
    try {
      const { data: users, error } = await supabaseService
        .from('users')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) {
        return res.status(500).json({ message: "Error al listar usuarios" });
      }

      const sanitizedUsers = (users || []).map((user: any) => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error listing users:", error);
      res.status(500).json({ message: "Error al listar usuarios" });
    }
  });

  app.post("/api/admin/users", isAuthenticated, isPrimaryUser, async (req: Request, res: Response) => {
    try {
      const userData = adminUserSchema.parse(req.body);

      const { data: existingUser } = await supabaseService
        .from('users')
        .select('id')
        .eq('username', userData.username)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ message: "El nombre de usuario ya existe" });
      }

      const { data: authData, error: authError } = await supabaseService.auth.admin.createUser({
        email: userData.email || `${userData.username}@placeholder.local`,
        password: userData.password,
        email_confirm: true,
        user_metadata: { full_name: userData.fullName, username: userData.username },
      });

      if (authError || !authData.user) {
        return res.status(500).json({ message: authError?.message || "Error al crear usuario" });
      }

      if (userData.isPrimary || userData.role) {
        await supabaseService
          .from("users")
          .update({
            is_primary: userData.isPrimary || false,
            role: userData.role || "content_creator",
          })
          .eq("id", authData.user.id);
      }

      res.status(201).json({
        id: authData.user.id,
        fullName: userData.fullName,
        username: userData.username,
        email: authData.user.email,
        isPrimary: userData.isPrimary || false,
        role: userData.role || "content_creator",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Error al crear usuario" });
    }
  });

  app.patch("/api/admin/users/:id", isAuthenticated, isPrimaryUser, async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      if (!userId) {
        return res.status(400).json({ message: "ID de usuario requerido" });
      }

      const { data: user } = await supabaseService
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const updateData = adminUserUpdateSchema.parse(req.body);

      if (userId === req.user.id && Object.prototype.hasOwnProperty.call(updateData, 'isPrimary')) {
        return res.status(400).json({ message: "No puedes modificar tus propios permisos de administrador" });
      }

      if (updateData.isPrimary === false && user.is_primary) {
        const { count } = await supabaseService
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('is_primary', true)
          .neq('id', userId);

        if (count === 0) {
          return res.status(400).json({ message: "No se puede remover permisos al último usuario administrador" });
        }
      }

      const { isPrimary, ...restUpdates } = updateData;
      const snakeUpdates: Record<string, any> = {
        ...toSnakeCase(restUpdates),
        updated_at: new Date().toISOString(),
      };
      if (Object.prototype.hasOwnProperty.call(updateData, 'isPrimary')) {
        snakeUpdates.is_primary = isPrimary;
      }

      const { data: updatedUser, error: updateError } = await supabaseService
        .from('users')
        .update(snakeUpdates)
        .eq('id', userId)
        .select('*')
        .single();

      if (updateError || !updatedUser) {
        return res.status(404).json({ message: "Error al actualizar usuario" });
      }

      const { password: _pw, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Error al actualizar usuario" });
    }
  });

  app.delete("/api/admin/users/:id", isAuthenticated, isPrimaryUser, async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      if (!userId) {
        return res.status(400).json({ message: "ID de usuario requerido" });
      }

      if (userId === req.user.id) {
        return res.status(400).json({ message: "No puedes eliminar tu propia cuenta" });
      }

      const { data: user } = await supabaseService
        .from('users')
        .select('is_primary')
        .eq('id', userId)
        .single();

      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      if (user.is_primary) {
        const { count } = await supabaseService
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('is_primary', true);

        if (count !== null && count <= 1) {
          return res.status(400).json({ message: "No se puede eliminar el último usuario administrador" });
        }
      }

      const { error: deleteError } = await supabaseService
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteError) {
        return res.status(500).json({ message: "Error al eliminar usuario" });
      }

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Error al eliminar usuario" });
    }
  });

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

      const { error: updateError } = await supabaseService.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (updateError) {
        return res.status(500).json({ message: updateError.message });
      }

      res.json({ message: "Contraseña actualizada correctamente" });
    } catch (error) {
      console.error("Error changing user password:", error);
      res.status(500).json({ message: "Error al cambiar la contraseña del usuario" });
    }
  });

  // ===== ESTADÍSTICAS Y ACTIVIDAD DEL USUARIO =====
  app.get("/api/user/stats", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;

      const { data: me } = await supabaseService
        .from('users')
        .select('is_primary, role')
        .eq('id', userId)
        .single();

      let projects: any[] = [];
      if (me?.is_primary || me?.role === 'admin') {
        const { data } = await supabaseService.from('projects').select('id, name, created_at');
        projects = data || [];
      } else {
        const { data } = await supabaseService.from('projects').select('id, name, created_at').eq('created_by', userId);
        projects = data || [];
      }

      const { data: tasks } = await supabaseService
        .from('tasks')
        .select('status')
        .eq('assigned_to_id', userId);

      const projectIds = projects.map((p: any) => p.id);
      let totalSchedules = 0;
      if (projectIds.length > 0) {
        const { count } = await supabaseService
          .from('schedules')
          .select('id', { count: 'exact', head: true })
          .in('project_id', projectIds);
        totalSchedules = count || 0;
      }

      const { data: user } = await supabaseService
        .from('users')
        .select('full_name, email, bio, profile_image, job_title, department, phone_number')
        .eq('id', userId)
        .single();

      const fields = [
        user?.full_name,
        user?.email,
        user?.bio,
        user?.profile_image,
        user?.job_title,
        user?.department,
        user?.phone_number,
      ];
      const completedFields = fields.filter((field) => field && String(field).trim() !== '').length;
      const profileCompleteness = Math.round((completedFields / fields.length) * 100);

      res.json({
        projectsCreated: projects.length,
        tasksCompleted: (tasks || []).filter((t: any) => t.status === 'completed').length,
        totalSchedules,
        totalCollaborations: 0,
        profileCompleteness,
      });
    } catch (error) {
      console.error("Error getting user stats:", error);
      res.status(500).json({ message: "Error al obtener las estadísticas del usuario" });
    }
  });

  app.get("/api/user/activity", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit as string) || 10;

      const { data: me } = await supabaseService
        .from('users')
        .select('is_primary, role')
        .eq('id', userId)
        .single();

      let recentProjects: any[] = [];
      if (me?.is_primary || me?.role === 'admin') {
        const { data } = await supabaseService.from('projects').select('id, name, created_at').order('created_at', { ascending: false }).limit(3);
        recentProjects = data || [];
      } else {
        const { data } = await supabaseService.from('projects').select('id, name, created_at').eq('created_by', userId).order('created_at', { ascending: false }).limit(3);
        recentProjects = data || [];
      }

      const { data: recentTasks } = await supabaseService
        .from('tasks')
        .select('id, title, status, created_at, updated_at')
        .eq('assigned_to_id', userId)
        .order('updated_at', { ascending: false })
        .limit(3);

      const projectIds = recentProjects.map((p: any) => p.id);
      let recentSchedules: any[] = [];
      if (projectIds.length > 0) {
        const { data } = await supabaseService
          .from('schedules')
          .select('id, name, created_at')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })
          .limit(2);
        recentSchedules = data || [];
      }

      const activities: any[] = [];

      recentProjects.forEach((project: any) => {
        activities.push({
          id: `project-${project.id}`,
          type: 'project',
          description: `Creaste el proyecto "${project.name}"`,
          timestamp: project.created_at,
          icon: 'briefcase',
        });
      });

      (recentTasks || []).forEach((task: any) => {
        activities.push({
          id: `task-${task.id}`,
          type: 'task',
          description: `${task.status === 'completed' ? 'Completaste' : 'Trabajaste en'} la tarea "${task.title}"`,
          timestamp: task.updated_at || task.created_at,
          icon: 'check-circle',
        });
      });

      recentSchedules.forEach((schedule: any) => {
        activities.push({
          id: `schedule-${schedule.id}`,
          type: 'schedule',
          description: `Creaste el cronograma "${schedule.name}"`,
          timestamp: schedule.created_at,
          icon: 'calendar',
        });
      });

      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      res.json(sortedActivities);
    } catch (error) {
      console.error("Error getting user activity:", error);
      res.status(500).json({ message: "Error al obtener la actividad del usuario" });
    }
  });

  // ===== DESCARGA DE CRONOGRAMAS (Excel/PDF) =====
  app.get("/api/schedules/:id/download", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const scheduleId = parseInt(req.params.id);
      const format = req.query.format || 'excel';

      if (isNaN(scheduleId)) {
        return res.status(400).json({ message: "Invalid schedule ID" });
      }

      const { data: rawSchedule, error: scheduleError } = await supabaseService
        .from('schedules')
        .select('*, schedule_entries(*)')
        .eq('id', scheduleId)
        .single();

      if (scheduleError || !rawSchedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      const { data: project } = await supabaseService
        .from('projects')
        .select('name, client')
        .eq('id', rawSchedule.project_id)
        .single();

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const schedule = {
        ...rawSchedule,
        projectId: rawSchedule.project_id,
        startDate: rawSchedule.start_date,
        name: rawSchedule.name,
        entries: (rawSchedule.schedule_entries || []).map((e: any) => ({
          ...e,
          postDate: e.post_date,
          postTime: e.post_time,
          copyIn: e.copy_in,
          copyOut: e.copy_out,
          designInstructions: e.design_instructions,
        })),
      };

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
            tabColor: { argb: '4F46E5' },
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
          res.status(500).json({ message: "Error al generar el PDF", details: (error as Error).message });
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

  const httpServer = createServer(app);
  return httpServer;
}
