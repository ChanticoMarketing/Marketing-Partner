// ===== DATABASE STORAGE IMPLEMENTATION =====
// This file provides the database storage layer using Drizzle ORM
// It interfaces with PostgreSQL through the configured database connection

import { db, isOffline } from "./db";
import { MemStorage } from "./mem-storage";
import { isOfflineModeAllowed } from "./runtime-config";
import { eq, asc, desc, and, or, sql, like, inArray, gt } from "drizzle-orm";
import * as schema from "./schema";
import type {
  User,
  Project,
  Task,
  AnalysisResult,
  Document,
  Schedule,
  ScheduleEntry,
  ChatMessage,
  Product,
  ProjectView,
  AutomationRule,
  TimeEntry,
  Tag,
  CollaborativeDoc,
  Notification,
  TaskComment
} from "./schema";

// Type definitions for insert operations
type InsertUser = typeof schema.users.$inferInsert;
type InsertProject = typeof schema.projects.$inferInsert;
type InsertTask = typeof schema.tasks.$inferInsert;
type InsertAnalysisResult = typeof schema.analysisResults.$inferInsert;
type InsertDocument = typeof schema.documents.$inferInsert;
type InsertSchedule = typeof schema.schedules.$inferInsert;
type InsertScheduleEntry = typeof schema.scheduleEntries.$inferInsert;
type InsertChatMessage = typeof schema.chatMessages.$inferInsert;
type InsertProduct = typeof schema.products.$inferInsert;
type InsertProjectView = typeof schema.projectViews.$inferInsert;
type InsertAutomationRule = typeof schema.automationRules.$inferInsert;
type InsertTimeEntry = typeof schema.timeEntries.$inferInsert;
type InsertTag = typeof schema.tags.$inferInsert;
type InsertCollaborativeDoc = typeof schema.collaborativeDocs.$inferInsert;
type InsertNotification = typeof schema.notifications.$inferInsert;
type InsertTaskComment = typeof schema.taskComments.$inferInsert;

// Storage interface definition
export interface IStorage {
  // User management
  getUser(id: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | null>;
  upsertUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<void>;

  // Project management
  getProject(id: number): Promise<Project | null>;
  getProjectWithAnalysis(id: number): Promise<(Project & { analysis: AnalysisResult | null }) | null>;
  getProjects(): Promise<Project[]>;
  getProjectsByUser(userId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | null>;
  deleteProject(id: number): Promise<void>;
  checkUserProjectAccess(userId: string, projectId: number): Promise<boolean>;

  // Task management
  getTask(id: number): Promise<Task | null>;
  getTasks(projectId: number): Promise<Task[]>;
  getTasksByUser(userId: string): Promise<Task[]>;
  listTasksByAssignee(userId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | null>;
  deleteTask(id: number): Promise<void>;
  getTasksWithComments(projectId: number): Promise<(Task & { comments: TaskComment[] })[]>;

  // Analysis results
  getAnalysisResult(projectId: number): Promise<AnalysisResult | null>;
  createAnalysisResult(analysis: InsertAnalysisResult): Promise<AnalysisResult>;
  updateAnalysisResult(projectId: number, updates: Partial<InsertAnalysisResult>): Promise<AnalysisResult | null>;

  // Document management
  getDocument(id: number): Promise<Document | null>;
  getDocuments(projectId: number): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document | null>;
  deleteDocument(id: number): Promise<void>;

  // Schedule management
  getSchedule(id: number): Promise<Schedule | null>;
  getSchedules(projectId: number): Promise<Schedule[]>;
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  updateSchedule(id: number, updates: Partial<InsertSchedule>): Promise<Schedule | null>;
  deleteSchedule(id: number): Promise<void>;

  // Schedule entries
  getScheduleEntry(id: number): Promise<ScheduleEntry | null>;
  getScheduleEntries(scheduleId: number): Promise<ScheduleEntry[]>;
  getScheduleWithEntries(scheduleId: number): Promise<Schedule & { entries: ScheduleEntry[] } | null>;
  createScheduleEntry(entry: InsertScheduleEntry): Promise<ScheduleEntry>;
  updateScheduleEntry(id: number, updates: Partial<InsertScheduleEntry>): Promise<ScheduleEntry | null>;
  deleteScheduleEntry(id: number): Promise<void>;

  // Chat messages
  getChatMessages(projectId: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Product management
  getProduct(id: number): Promise<Product | null>;
  getProducts(projectId: number): Promise<Product[]>;
  listProductsByProject(projectId: number): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | null>;
  deleteProduct(id: number): Promise<void>;

  // Project views
  getProjectView(id: number): Promise<ProjectView | null>;
  getProjectViews(projectId: number): Promise<ProjectView[]>;
  listProjectViews(projectId: number): Promise<ProjectView[]>;
  createProjectView(view: InsertProjectView): Promise<ProjectView>;
  updateProjectView(id: number, updates: Partial<InsertProjectView>): Promise<ProjectView | null>;
  deleteProjectView(id: number): Promise<void>;
  updateOtherViewsDefaultStatus(projectId: number, excludeId: number): Promise<void>;

  // Automation rules
  getAutomationRule(id: number): Promise<AutomationRule | null>;
  getAutomationRules(projectId: number): Promise<AutomationRule[]>;
  listAutomationRules(projectId: number): Promise<AutomationRule[]>;
  createAutomationRule(rule: InsertAutomationRule): Promise<AutomationRule>;
  updateAutomationRule(id: number, updates: Partial<InsertAutomationRule>): Promise<AutomationRule | null>;
  deleteAutomationRule(id: number): Promise<void>;

  // Time tracking
  getTimeEntry(id: number): Promise<TimeEntry | null>;
  getTimeEntries(taskId: number): Promise<TimeEntry[]>;
  getTimeEntriesByUser(userId: string): Promise<TimeEntry[]>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: number, updates: Partial<InsertTimeEntry>): Promise<TimeEntry | null>;
  deleteTimeEntry(id: number): Promise<void>;

  // Tags
  getTag(id: number): Promise<Tag | null>;
  getTags(projectId: number): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: number, updates: Partial<InsertTag>): Promise<Tag | null>;
  deleteTag(id: number): Promise<void>;

  // Collaborative documents
  getCollaborativeDoc(id: number): Promise<CollaborativeDoc | null>;
  getCollaborativeDocs(projectId: number): Promise<CollaborativeDoc[]>;
  createCollaborativeDoc(doc: InsertCollaborativeDoc): Promise<CollaborativeDoc>;
  updateCollaborativeDoc(id: number, updates: Partial<InsertCollaborativeDoc>): Promise<CollaborativeDoc | null>;
  deleteCollaborativeDoc(id: number): Promise<void>;

  // Notifications
  getNotification(id: number): Promise<Notification | null>;
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: number, updates: Partial<InsertNotification>): Promise<Notification | null>;
  deleteNotification(id: number): Promise<void>;

  // Task comments
  getTaskComment(id: number): Promise<TaskComment | null>;
  getTaskComments(taskId: number): Promise<TaskComment[]>;
  createTaskComment(comment: InsertTaskComment): Promise<TaskComment>;
  updateTaskComment(id: number, updates: Partial<InsertTaskComment>): Promise<TaskComment | null>;
  deleteTaskComment(id: number): Promise<void>;

  // Content history
  getContentHistory(projectId: number): Promise<any[]>;
  createContentHistory(data: any): Promise<any>;

  // Password reset
  getUserByIdentifier(identifier: string): Promise<User | null>;
  createPasswordResetToken(userId: number | string): Promise<{ token: string; expiresAt: Date }>;
  getPasswordResetToken(token: string): Promise<{ userId: number; expiresAt: Date } | null>;
  deletePasswordResetToken(token: string): Promise<void>;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // User management methods
  async getUser(id: string): Promise<User | null> {
    try {
      const result = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    try {
      const result = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  // ============ FUNCIONES AUXILIARES ============

  async getUserByIdentifier(identifier: string): Promise<User | null> {
    try {
      // Primero buscar por username
      const userByUsername = await this.getUserByUsername(identifier);
      if (userByUsername) {
        return userByUsername;
      }

      // Si no se encuentra por username, buscar por email (si incluye @)
      if (identifier.includes('@')) {
        return await this.getUserByEmail(identifier);
      }

      return null;
    } catch (error) {
      console.error("Error getting user by identifier:", error);
      throw error;
    }
  }

  async createPasswordResetToken(userId: number | string): Promise<{ token: string; expiresAt: Date }> {
    try {
      // Generar token aleatorio
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      // For now, just return the token since passwordResetTokens table doesn't exist
      // In the future, implement proper password reset token storage
      return { token, expiresAt };
    } catch (error) {
      console.error("Error creating password reset token:", error);
      throw error;
    }
  }

  async getPasswordResetToken(token: string): Promise<{ userId: number; expiresAt: Date } | null> {
    try {
      // For now, return null since passwordResetTokens table doesn't exist
      // In the future, implement proper password reset token retrieval
      return null;
    } catch (error) {
      console.error("Error getting password reset token:", error);
      throw error;
    }
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    try {
      // For now, do nothing since passwordResetTokens table doesn't exist
      // In the future, implement proper password reset token deletion
    } catch (error) {
      console.error("Error deleting password reset token:", error);
      throw error;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    // Ensure ID is generated if not provided
    const userData = {
      ...user,
      id: user.id || crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await db.insert(schema.users).values(userData).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | null> {
    try {
      const result = await db.update(schema.users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.users.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }

  async upsertUser(user: InsertUser): Promise<User> {
    try {
      // Try to find existing user
      const existingUser = await this.getUser(user.id!);

      if (existingUser) {
        // Update existing user
        const updated = await this.updateUser(user.id!, user);
        return updated || existingUser;
      } else {
        // Create new user
        return await this.createUser(user);
      }
    } catch (error) {
      console.error('Error upserting user:', error);
      throw error;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(schema.users).orderBy(asc(schema.users.fullName));
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  // Project management methods
  async getProject(id: number): Promise<Project | null> {
    try {
      const result = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting project:', error);
      return null;
    }
  }

  async getProjectWithAnalysis(id: number): Promise<(Project & { analysis: AnalysisResult | null }) | null> {
    try {
      const project = await this.getProject(id);
      if (!project) return null;

      const analysis = await this.getAnalysisResult(id);
      return { ...project, analysis };
    } catch (error) {
      console.error('Error getting project with analysis:', error);
      return null;
    }
  }

  async getProjects(): Promise<Project[]> {
    try {
      return await db.select().from(schema.projects).orderBy(desc(schema.projects.createdAt));
    } catch (error) {
      console.error('Error getting projects:', error);
      return [];
    }
  }

  async getProjectsByUser(userId: string): Promise<Project[]> {
    try {
      const user = await this.getUser(userId);
      if (!user) {
        return [];
      }

      if (user.isPrimary || user.role === "admin") {
        return await this.getProjects();
      }

      let memberProjects: Array<{ projectId: number }> = [];
      let assignedProjects: Array<{ projectId: number }> = [];
      try {
        [memberProjects, assignedProjects] = await Promise.all([
          db.select({ projectId: schema.projectMembers.projectId })
            .from(schema.projectMembers)
            .where(eq(schema.projectMembers.userId, userId)),
          db.select({ projectId: schema.projectAssignments.projectId })
            .from(schema.projectAssignments)
            .where(eq(schema.projectAssignments.userId, userId)),
        ]);
      } catch (membershipError) {
        console.warn("Project membership tables unavailable; falling back to project ownership only.", membershipError);
      }

      const relatedProjectIds = Array.from(
        new Set([...memberProjects, ...assignedProjects].map((entry) => entry.projectId))
      );

      const accessFilter = relatedProjectIds.length > 0
        ? or(
          eq(schema.projects.createdBy, userId),
          inArray(schema.projects.id, relatedProjectIds)
        )
        : eq(schema.projects.createdBy, userId);

      return await db.select().from(schema.projects)
        .where(accessFilter)
        .orderBy(desc(schema.projects.createdAt));
    } catch (error) {
      console.error('Error getting projects by user:', error);
      return [];
    }
  }

  async createProject(project: InsertProject): Promise<Project> {
    const result = await db.insert(schema.projects).values(project).returning();
    return result[0];
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | null> {
    try {
      const result = await db.update(schema.projects)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.projects.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating project:', error);
      return null;
    }
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(schema.projects).where(eq(schema.projects.id, id));
  }

  async checkUserProjectAccess(userId: string, projectId: number): Promise<boolean> {
    try {
      const [project, user] = await Promise.all([
        this.getProject(projectId),
        this.getUser(userId)
      ]);

      if (!project || !user) return false;

      // Primary/admin users have global visibility.
      if (user.isPrimary || user.role === "admin") {
        return true;
      }

      // Project creator always has access.
      if (project.createdBy === userId) {
        return true;
      }

      const [membership] = await db.select({ id: schema.projectMembers.id })
        .from(schema.projectMembers)
        .where(and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, userId)
        ))
        .limit(1);

      if (membership) {
        return true;
      }

      const [assignment] = await db.select({ id: schema.projectAssignments.id })
        .from(schema.projectAssignments)
        .where(and(
          eq(schema.projectAssignments.projectId, projectId),
          eq(schema.projectAssignments.userId, userId)
        ))
        .limit(1);

      return !!assignment;
    } catch (error) {
      console.error('Error checking user project access:', error);
      return false;
    }
  }

  // Task management methods
  async getTask(id: number): Promise<Task | null> {
    try {
      const result = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting task:', error);
      return null;
    }
  }

  async getTasks(projectId: number): Promise<Task[]> {
    try {
      return await db.select().from(schema.tasks)
        .where(eq(schema.tasks.projectId, projectId))
        .orderBy(asc(schema.tasks.position), desc(schema.tasks.createdAt));
    } catch (error) {
      console.error('Error getting tasks:', error);
      return [];
    }
  }

  async getTasksByUser(userId: string): Promise<Task[]> {
    try {
      return await db.select().from(schema.tasks)
        .where(eq(schema.tasks.assignedToId, userId))
        .orderBy(desc(schema.tasks.createdAt));
    } catch (error) {
      console.error('Error getting tasks by user:', error);
      return [];
    }
  }

  async createTask(task: InsertTask): Promise<Task> {
    const result = await db.insert(schema.tasks).values(task).returning();
    return result[0];
  }

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | null> {
    try {
      const result = await db.update(schema.tasks)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.tasks.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating task:', error);
      return null;
    }
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
  }

  async getTasksWithComments(projectId: number): Promise<(Task & { comments: TaskComment[] })[]> {
    try {
      const tasks = await this.getTasks(projectId);
      const tasksWithComments = await Promise.all(
        tasks.map(async (task) => {
          const comments = await this.getTaskComments(task.id);
          return { ...task, comments };
        })
      );
      return tasksWithComments;
    } catch (error) {
      console.error('Error getting tasks with comments:', error);
      return [];
    }
  }

  // Analysis results methods
  async getAnalysisResult(projectId: number): Promise<AnalysisResult | null> {
    try {
      const result = await db.select().from(schema.analysisResults)
        .where(eq(schema.analysisResults.projectId, projectId))
        .limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting analysis result:', error);
      return null;
    }
  }

  async createAnalysisResult(analysis: InsertAnalysisResult): Promise<AnalysisResult> {
    const result = await db.insert(schema.analysisResults).values(analysis).returning();
    return result[0];
  }

  async updateAnalysisResult(projectId: number, updates: Partial<InsertAnalysisResult>): Promise<AnalysisResult | null> {
    try {
      const result = await db.update(schema.analysisResults)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.analysisResults.projectId, projectId))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating analysis result:', error);
      return null;
    }
  }

  // Document management methods
  async getDocument(id: number): Promise<Document | null> {
    try {
      const result = await db.select().from(schema.documents).where(eq(schema.documents.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting document:', error);
      return null;
    }
  }

  async getDocuments(projectId: number): Promise<Document[]> {
    try {
      return await db.select().from(schema.documents)
        .where(eq(schema.documents.projectId, projectId))
        .orderBy(desc(schema.documents.createdAt));
    } catch (error) {
      console.error('Error getting documents:', error);
      return [];
    }
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const result = await db.insert(schema.documents).values(document).returning();
    return result[0];
  }

  async updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document | null> {
    try {
      const result = await db.update(schema.documents)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.documents.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating document:', error);
      return null;
    }
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(schema.documents).where(eq(schema.documents.id, id));
  }

  // Schedule management methods
  async getSchedule(id: number): Promise<Schedule | null> {
    try {
      const result = await db.select().from(schema.schedules).where(eq(schema.schedules.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting schedule:', error);
      return null;
    }
  }

  async getSchedules(projectId: number): Promise<Schedule[]> {
    try {
      return await db.select().from(schema.schedules)
        .where(eq(schema.schedules.projectId, projectId))
        .orderBy(desc(schema.schedules.createdAt));
    } catch (error) {
      console.error('Error getting schedules:', error);
      return [];
    }
  }

  async createSchedule(schedule: InsertSchedule): Promise<Schedule> {
    const result = await db.insert(schema.schedules).values(schedule).returning();
    return result[0];
  }

  async updateSchedule(id: number, updates: Partial<InsertSchedule>): Promise<Schedule | null> {
    try {
      const result = await db.update(schema.schedules)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.schedules.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating schedule:', error);
      return null;
    }
  }

  async deleteSchedule(id: number): Promise<void> {
    await db.delete(schema.schedules).where(eq(schema.schedules.id, id));
  }

  // Schedule entries methods
  async getScheduleEntry(id: number): Promise<ScheduleEntry | null> {
    try {
      const result = await db.select().from(schema.scheduleEntries).where(eq(schema.scheduleEntries.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting schedule entry:', error);
      return null;
    }
  }

  async getScheduleEntries(scheduleId: number): Promise<ScheduleEntry[]> {
    try {
      return await db.select().from(schema.scheduleEntries)
        .where(eq(schema.scheduleEntries.scheduleId, scheduleId))
        .orderBy(asc(schema.scheduleEntries.postDate));
    } catch (error) {
      console.error('Error getting schedule entries:', error);
      return [];
    }
  }

  async createScheduleEntry(entry: InsertScheduleEntry): Promise<ScheduleEntry> {
    const result = await db.insert(schema.scheduleEntries).values(entry).returning();
    return result[0];
  }

  async updateScheduleEntry(id: number, updates: Partial<InsertScheduleEntry>): Promise<ScheduleEntry | null> {
    try {
      const result = await db.update(schema.scheduleEntries)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.scheduleEntries.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating schedule entry:', error);
      return null;
    }
  }

  async deleteScheduleEntry(id: number): Promise<void> {
    await db.delete(schema.scheduleEntries).where(eq(schema.scheduleEntries.id, id));
  }

  // Chat messages methods
  async getChatMessages(projectId: number): Promise<ChatMessage[]> {
    try {
      return await db.select().from(schema.chatMessages)
        .where(eq(schema.chatMessages.projectId, projectId))
        .orderBy(asc(schema.chatMessages.createdAt));
    } catch (error) {
      console.error('Error getting chat messages:', error);
      return [];
    }
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(schema.chatMessages).values(message).returning();
    return result[0];
  }

  // Product management methods
  async getProduct(id: number): Promise<Product | null> {
    try {
      const result = await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting product:', error);
      return null;
    }
  }

  async getProducts(projectId: number): Promise<Product[]> {
    try {
      return await db.select().from(schema.products)
        .where(eq(schema.products.projectId, projectId))
        .orderBy(desc(schema.products.createdAt));
    } catch (error) {
      console.error('Error getting products:', error);
      return [];
    }
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.insert(schema.products).values(product).returning();
    return result[0];
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | null> {
    try {
      const result = await db.update(schema.products)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.products.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating product:', error);
      return null;
    }
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(schema.products).where(eq(schema.products.id, id));
  }

  // Project views methods
  async getProjectView(id: number): Promise<ProjectView | null> {
    try {
      const result = await db.select().from(schema.projectViews).where(eq(schema.projectViews.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting project view:', error);
      return null;
    }
  }

  async getProjectViews(projectId: number): Promise<ProjectView[]> {
    try {
      return await db.select().from(schema.projectViews)
        .where(eq(schema.projectViews.projectId, projectId))
        .orderBy(desc(schema.projectViews.createdAt));
    } catch (error) {
      console.error('Error getting project views:', error);
      return [];
    }
  }

  async createProjectView(view: InsertProjectView): Promise<ProjectView> {
    const result = await db.insert(schema.projectViews).values(view).returning();
    return result[0];
  }

  async updateProjectView(id: number, updates: Partial<InsertProjectView>): Promise<ProjectView | null> {
    try {
      const result = await db.update(schema.projectViews)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.projectViews.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating project view:', error);
      return null;
    }
  }

  async deleteProjectView(id: number): Promise<void> {
    await db.delete(schema.projectViews).where(eq(schema.projectViews.id, id));
  }

  // Automation rules methods
  async getAutomationRule(id: number): Promise<AutomationRule | null> {
    try {
      const result = await db.select().from(schema.automationRules).where(eq(schema.automationRules.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting automation rule:', error);
      return null;
    }
  }

  async getAutomationRules(projectId: number): Promise<AutomationRule[]> {
    try {
      return await db.select().from(schema.automationRules)
        .where(eq(schema.automationRules.projectId, projectId))
        .orderBy(desc(schema.automationRules.createdAt));
    } catch (error) {
      console.error('Error getting automation rules:', error);
      return [];
    }
  }

  async createAutomationRule(rule: InsertAutomationRule): Promise<AutomationRule> {
    const result = await db.insert(schema.automationRules).values(rule).returning();
    return result[0];
  }

  async updateAutomationRule(id: number, updates: Partial<InsertAutomationRule>): Promise<AutomationRule | null> {
    try {
      const result = await db.update(schema.automationRules)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.automationRules.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating automation rule:', error);
      return null;
    }
  }

  async deleteAutomationRule(id: number): Promise<void> {
    await db.delete(schema.automationRules).where(eq(schema.automationRules.id, id));
  }

  // Time tracking methods
  async getTimeEntry(id: number): Promise<TimeEntry | null> {
    try {
      const result = await db.select().from(schema.timeEntries).where(eq(schema.timeEntries.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting time entry:', error);
      return null;
    }
  }

  async getTimeEntries(taskId: number): Promise<TimeEntry[]> {
    try {
      return await db.select().from(schema.timeEntries)
        .where(eq(schema.timeEntries.taskId, taskId))
        .orderBy(desc(schema.timeEntries.createdAt));
    } catch (error) {
      console.error('Error getting time entries:', error);
      return [];
    }
  }

  async getTimeEntriesByUser(userId: string): Promise<TimeEntry[]> {
    try {
      return await db.select().from(schema.timeEntries)
        .where(eq(schema.timeEntries.userId, userId))
        .orderBy(desc(schema.timeEntries.createdAt));
    } catch (error) {
      console.error('Error getting time entries by user:', error);
      return [];
    }
  }

  async createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry> {
    const result = await db.insert(schema.timeEntries).values(entry).returning();
    return result[0];
  }

  async updateTimeEntry(id: number, updates: Partial<InsertTimeEntry>): Promise<TimeEntry | null> {
    try {
      const result = await db.update(schema.timeEntries)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.timeEntries.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating time entry:', error);
      return null;
    }
  }

  async deleteTimeEntry(id: number): Promise<void> {
    await db.delete(schema.timeEntries).where(eq(schema.timeEntries.id, id));
  }

  // Tags methods
  async getTag(id: number): Promise<Tag | null> {
    try {
      const result = await db.select().from(schema.tags).where(eq(schema.tags.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting tag:', error);
      return null;
    }
  }

  async getTags(projectId: number): Promise<Tag[]> {
    try {
      return await db.select().from(schema.tags).where(eq(schema.tags.projectId, projectId))
        .orderBy(asc(schema.tags.name));
    } catch (error) {
      console.error('Error getting tags:', error);
      return [];
    }
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const result = await db.insert(schema.tags).values(tag).returning();
    return result[0];
  }

  async updateTag(id: number, updates: Partial<InsertTag>): Promise<Tag | null> {
    try {
      const result = await db.update(schema.tags)
        .set(updates)
        .where(eq(schema.tags.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating tag:', error);
      return null;
    }
  }

  async deleteTag(id: number): Promise<void> {
    await db.delete(schema.tags).where(eq(schema.tags.id, id));
  }

  // Collaborative documents methods
  async getCollaborativeDoc(id: number): Promise<CollaborativeDoc | null> {
    try {
      const result = await db.select().from(schema.collaborativeDocs).where(eq(schema.collaborativeDocs.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting collaborative doc:', error);
      return null;
    }
  }

  async getCollaborativeDocs(projectId: number): Promise<CollaborativeDoc[]> {
    try {
      return await db.select().from(schema.collaborativeDocs)
        .where(eq(schema.collaborativeDocs.projectId, projectId))
        .orderBy(desc(schema.collaborativeDocs.updatedAt));
    } catch (error) {
      console.error('Error getting collaborative docs:', error);
      return [];
    }
  }

  async createCollaborativeDoc(doc: InsertCollaborativeDoc): Promise<CollaborativeDoc> {
    const result = await db.insert(schema.collaborativeDocs).values(doc).returning();
    return result[0];
  }

  async updateCollaborativeDoc(id: number, updates: Partial<InsertCollaborativeDoc>): Promise<CollaborativeDoc | null> {
    try {
      const result = await db.update(schema.collaborativeDocs)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.collaborativeDocs.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating collaborative doc:', error);
      return null;
    }
  }

  async deleteCollaborativeDoc(id: number): Promise<void> {
    await db.delete(schema.collaborativeDocs).where(eq(schema.collaborativeDocs.id, id));
  }

  // Notifications methods
  async getNotification(id: number): Promise<Notification | null> {
    try {
      const result = await db.select().from(schema.notifications).where(eq(schema.notifications.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting notification:', error);
      return null;
    }
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    try {
      return await db.select().from(schema.notifications)
        .where(eq(schema.notifications.userId, userId))
        .orderBy(desc(schema.notifications.createdAt));
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(schema.notifications).values(notification).returning();
    return result[0];
  }

  async updateNotification(id: number, updates: Partial<InsertNotification>): Promise<Notification | null> {
    try {
      const result = await db.update(schema.notifications)
        .set(updates)
        .where(eq(schema.notifications.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating notification:', error);
      return null;
    }
  }

  async deleteNotification(id: number): Promise<void> {
    await db.delete(schema.notifications).where(eq(schema.notifications.id, id));
  }

  // Task comments methods
  async getTaskComment(id: number): Promise<TaskComment | null> {
    try {
      const result = await db.select().from(schema.taskComments).where(eq(schema.taskComments.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting task comment:', error);
      return null;
    }
  }

  async getTaskComments(taskId: number): Promise<TaskComment[]> {
    try {
      return await db.select().from(schema.taskComments)
        .where(eq(schema.taskComments.taskId, taskId))
        .orderBy(asc(schema.taskComments.createdAt));
    } catch (error) {
      console.error('Error getting task comments:', error);
      return [];
    }
  }

  async createTaskComment(comment: InsertTaskComment): Promise<TaskComment> {
    const result = await db.insert(schema.taskComments).values(comment).returning();
    return result[0];
  }

  async updateTaskComment(id: number, updates: Partial<InsertTaskComment>): Promise<TaskComment | null> {
    try {
      const result = await db.update(schema.taskComments)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.taskComments.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      console.error('Error updating task comment:', error);
      return null;
    }
  }

  async deleteTaskComment(id: number): Promise<void> {
    await db.delete(schema.taskComments).where(eq(schema.taskComments.id, id));
  }

  // Content history methods
  async getContentHistory(projectId: number): Promise<any[]> {
    try {
      return await db.select({
        id: schema.contentHistory.id,
        scheduleEntryId: schema.contentHistory.scheduleEntryId,
        version: schema.contentHistory.version,
        content: schema.contentHistory.content,
        changeDescription: schema.contentHistory.changeDescription,
        changedBy: schema.contentHistory.changedBy,
        createdAt: schema.contentHistory.createdAt,
        title: schema.scheduleEntries.title,
        platform: schema.scheduleEntries.platform
      })
        .from(schema.contentHistory)
        .innerJoin(
          schema.scheduleEntries,
          eq(schema.contentHistory.scheduleEntryId, schema.scheduleEntries.id)
        )
        .innerJoin(
          schema.schedules,
          eq(schema.scheduleEntries.scheduleId, schema.schedules.id)
        )
        .where(eq(schema.schedules.projectId, projectId))
        .orderBy(desc(schema.contentHistory.createdAt));
    } catch (error) {
      console.error('Error getting content history:', error);
      return [];
    }
  }

  async createContentHistory(data: any): Promise<any> {
    try {
      const scheduleEntryId = Number.parseInt(String(data?.scheduleEntryId), 10);
      const content = typeof data?.content === "string" ? data.content.trim() : "";

      if (!Number.isInteger(scheduleEntryId) || scheduleEntryId <= 0) {
        throw new Error("createContentHistory requires a valid scheduleEntryId");
      }

      if (!content) {
        throw new Error("createContentHistory requires non-empty content");
      }

      const [latestVersion] = await db.select({ version: schema.contentHistory.version })
        .from(schema.contentHistory)
        .where(eq(schema.contentHistory.scheduleEntryId, scheduleEntryId))
        .orderBy(desc(schema.contentHistory.version))
        .limit(1);

      const nextVersion = (latestVersion?.version ?? 0) + 1;

      const [createdRecord] = await db.insert(schema.contentHistory).values({
        scheduleEntryId,
        version: nextVersion,
        content,
        changeDescription: data?.changeDescription ?? "Initial content generation",
        changedBy: data?.changedBy ?? null
      }).returning();

      return createdRecord;
    } catch (error) {
      console.error('Error creating content history:', error);
      throw error;
    }
  }

  // Additional methods for routes.ts compatibility
  async deleteUser(id: string): Promise<void> {
    await db.delete(schema.users).where(eq(schema.users.id, id));
  }

  async listProductsByProject(projectId: number): Promise<Product[]> {
    return this.getProducts(projectId);
  }

  async listTasksByAssignee(userId: string): Promise<Task[]> {
    return this.getTasksByUser(userId);
  }

  async listProjectViews(projectId: number): Promise<ProjectView[]> {
    return this.getProjectViews(projectId);
  }

  async listAutomationRules(projectId: number): Promise<AutomationRule[]> {
    return this.getAutomationRules(projectId);
  }

  async getScheduleWithEntries(scheduleId: number): Promise<Schedule & { entries: ScheduleEntry[] } | null> {
    try {
      const schedule = await this.getSchedule(scheduleId);
      if (!schedule) return null;

      const entries = await this.getScheduleEntries(scheduleId);
      return { ...schedule, entries };
    } catch (error) {
      console.error('Error getting schedule with entries:', error);
      return null;
    }
  }

  async updateOtherViewsDefaultStatus(projectId: number, excludeId: number): Promise<void> {
    try {
      await db.update(schema.projectViews)
        .set({ isDefault: false })
        .where(and(
          eq(schema.projectViews.projectId, projectId),
          sql`${schema.projectViews.id} != ${excludeId}`
        ));
    } catch (error) {
      console.error('Error updating other views default status:', error);
    }
  }
}

// Create and export storage instance
const isProduction = process.env.NODE_ENV === "production";
const allowOfflineMode = isOfflineModeAllowed();
if (isOffline && (isProduction || !allowOfflineMode)) {
  throw new Error("Offline MemStorage fallback is disabled unless ALLOW_OFFLINE_MODE=true in non-production.");
}

export const storage = isOffline ? new MemStorage() : new DatabaseStorage();
