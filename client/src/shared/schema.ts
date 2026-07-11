// ===== CLIENT-SAFE SCHEMA TYPES =====
// This file contains ONLY TypeScript type definitions
// NO imports from server code or Drizzle ORM to prevent bundling Node.js modules in the client

// ===== USER TYPES =====
export type User = {
    id: string;
    fullName: string;
    username: string;
    email: string | null;
    password: string | null;
    isPrimary: boolean;
    role: "admin" | "project_manager" | "content_creator" | "designer" | "developer" | "stakeholder" | null;
    bio: string | null;
    profileImage: string | null;
    coverImage: string | null;
    nickname: string | null;
    jobTitle: string | null;
    department: string | null;
    phoneNumber: string | null;
    preferredLanguage: string | null;
    theme: string | null;
    customFields: any;
    lastLogin: Date | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertUser = Omit<User, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== PROJECT TYPES =====
export type Project = {
    id: number;
    name: string;
    client: string;
    color: string | null;
    imageUrl: string | null;
    description: string | null;
    startDate: Date | null;
    endDate: Date | null;
    status: "active" | "planning" | "completed" | "on_hold" | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertProject = Omit<Project, "id" | "createdAt" | "updatedAt"> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== TASK TYPES =====
export type Task = {
    id: number;
    projectId: number;
    assignedToId: string | null;
    createdById: string | null;
    title: string;
    description: string | null;
    status: "pending" | "in_progress" | "completed" | "cancelled" | "blocked" | "deferred";
    priority: "low" | "medium" | "high" | "urgent" | "critical";
    group: "todo" | "in_progress" | "completed" | "blocked" | "upcoming" | null;
    position: number | null;
    aiGenerated: boolean | null;
    aiSuggestion: string | null;
    tags: string[] | null;
    dueDate: Date | null;
    completedAt: Date | null;
    estimatedHours: number | null;
    dependencies: string[] | null;
    parentTaskId: number | null;
    progress: number | null;
    attachments: any;
    groupId: number | null;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertTask = Omit<Task, "id" | "createdAt" | "updatedAt"> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== ANALYSIS RESULT TYPES =====
export type AnalysisResult = {
    id: number;
    projectId: number;
    mission: string | null;
    vision: string | null;
    coreValues: string | null;
    objectives: string | null;
    communicationObjectives: string | null;
    buyerPersona: string | null;
    targetAudience: string | null;
    marketingStrategies: string | null;
    archetypes: any;
    brandCommunicationStyle: string | null;
    brandTone: string | null;
    socialNetworks: any;
    responsePolicyPositive: string | null;
    responsePolicyNegative: string | null;
    keywords: string | null;
    contentThemes: any;
    competitorAnalysis: any;
    projectDescription: string | null;
    additionalNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertAnalysisResult = Omit<AnalysisResult, "id" | "createdAt" | "updatedAt"> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== DOCUMENT TYPES =====
export type Document = {
    id: number;
    projectId: number;
    name: string;
    type: string;
    category: string;
    subcategory: string;
    status: "draft" | "processing" | "review" | "approved" | "failed" | "archived";
    sourceKind: "upload" | "manual";
    content: string | null;
    metadata: any;
    uploadedBy: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertDocument = Omit<Document, "id" | "createdAt" | "updatedAt"> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== SCHEDULE TYPES =====
export type Schedule = {
    id: number;
    projectId: number;
    name: string;
    description: string | null;
    additionalInstructions: string | null;
    startDate: Date | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertSchedule = Omit<Schedule, "id" | "createdAt" | "updatedAt"> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== SCHEDULE ENTRY TYPES =====
export type ScheduleEntry = {
    id: number;
    scheduleId: number;
    title: string;
    description: string | null;
    content: string | null;
    copyIn: string | null;
    copyOut: string | null;
    designInstructions: string | null;
    platform: string;
    postDate: Date;
    postTime: string;
    hashtags: string | null;
    comments: string | null;
    referenceImageUrl: string | null;
    referenceImagePrompt: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertScheduleEntry = Omit<ScheduleEntry, "id" | "createdAt" | "updatedAt"> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== CHAT MESSAGE TYPES =====
export type ChatMessage = {
    id: number;
    projectId: number;
    userId: string | null;
    message: string;
    isAi: boolean | null;
    aiModel: "gpt-4" | "gpt-3.5-turbo" | "gemini-1.5-pro" | null;
    createdAt: Date;
};

export type InsertChatMessage = Omit<ChatMessage, "id" | "createdAt"> & {
    id?: number;
    createdAt?: Date;
};

// ===== CONTENT HISTORY TYPES =====
export type ContentHistory = {
    id: number;
    scheduleEntryId: number;
    version: number;
    content: string;
    changeDescription: string | null;
    changedBy: string | null;
    createdAt: Date;
};

export type InsertContentHistory = Omit<ContentHistory, "id" | "createdAt"> & {
    id?: number;
    createdAt?: Date;
};

// ===== TASK COMMENT TYPES =====
export type TaskComment = {
    id: number;
    taskId: number;
    userId: string;
    content: string;
    isInternal: boolean | null;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertTaskComment = Omit<TaskComment, "id" | "createdAt" | "updatedAt"> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== PRODUCT TYPES =====
export type Product = {
    id: number;
    projectId: number;
    name: string;
    description: string | null;
    imageUrl: string | null;
    sku: string | null;
    price: string | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertProduct = Omit<Product, "id" | "createdAt" | "updatedAt"> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== PROJECT VIEW TYPES =====
export type ProjectView = {
    id: number;
    projectId: number;
    name: string;
    type: "list" | "kanban" | "calendar" | "gantt" | "table" | "board";
    config: any;
    isDefault: boolean | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertProjectView = Omit<ProjectView, "id" | "createdAt" | "updatedAt"> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== AUTOMATION RULE TYPES =====
export type AutomationRule = {
    id: number;
    projectId: number;
    name: string;
    description: string | null;
    trigger: "status_change" | "assignment" | "due_date" | "creation" | "completion";
    triggerConditions: any;
    action: "notify" | "assign" | "move" | "update_status" | "create_task";
    actionConfig: any;
    isActive: boolean | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertAutomationRule = Omit<AutomationRule, "id" | "createdAt" | "updatedAt"> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== TIME ENTRY TYPES =====
export type TimeEntry = {
    id: number;
    taskId: number;
    userId: string;
    description: string | null;
    startTime: Date;
    endTime: Date | null;
    duration: number | null;
    isRunning: boolean | null;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertTimeEntry = Omit<TimeEntry, "id" | "createdAt" | "updatedAt"> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== TAG TYPES =====
export type Tag = {
    id: number;
    projectId: number;
    name: string;
    color: string | null;
    createdBy: string | null;
    createdAt: Date;
};

export type InsertTag = Omit<Tag, "id" | "createdAt"> & {
    id?: number;
    createdAt?: Date;
};

// ===== COLLABORATIVE DOC TYPES =====
export type CollaborativeDoc = {
    id: number;
    projectId: number;
    title: string;
    content: string | null;
    contentJson: any;
    lastEditedBy: string | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertCollaborativeDoc = Omit<CollaborativeDoc, "id" | "createdAt" | "updatedAt"> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== NOTIFICATION TYPES =====
export type Notification = {
    id: number;
    userId: string;
    type: "info" | "warning" | "error" | "success" | "comment" | "mention" | "assignment";
    title: string | null;
    message: string;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    isRead: boolean | null;
    createdAt: Date;
};

export type InsertNotification = Omit<Notification, "id" | "createdAt"> & {
    id?: number;
    createdAt?: Date;
};

// ===== TASK DEPENDENCY TYPES =====
export type TaskDependency = {
    id: number;
    taskId: number;
    dependsOnTaskId: number;
    createdAt: Date;
};

export type InsertTaskDependency = Omit<TaskDependency, "id" | "createdAt"> & {
    id?: number;
    createdAt?: Date;
};

// ===== PROJECT MEMBER TYPES =====
export type ProjectMember = {
    id: number;
    projectId: number;
    userId: string;
    role: string | null;
    permissions: any;
    joinedAt: Date;
};

export type InsertProjectMember = Omit<ProjectMember, "id" | "joinedAt"> & {
    id?: number;
    joinedAt?: Date;
};

// ===== PROJECT ASSIGNMENT TYPES =====
export type ProjectAssignment = {
    id: number;
    projectId: number;
    userId: string;
    assignedAt: Date;
};

// ===== ADDITIONAL TYPES =====
export type TaskGroup = {
    id: number;
    projectId: number;
    name: string;
    color: string | null;
    position: number | null;
    createdAt: Date;
};

export type InsertTaskGroup = Omit<TaskGroup, "id" | "createdAt"> & {
    id?: number;
    createdAt?: Date;
};

export type ProjectColumnSetting = {
    id: number;
    projectId: number;
    columnName: string;
    columnType: "text" | "number" | "date" | "status" | "priority" | "people" | "checkbox" | "dropdown";
    isVisible: boolean | null;
    position: number | null;
    config: any;
    createdAt: Date;
};

export type InsertProjectColumnSetting = Omit<ProjectColumnSetting, "id" | "createdAt"> & {
    id?: number;
    createdAt?: Date;
};

export type TaskColumnValue = {
    id: number;
    taskId: number;
    columnId: number;
    valueText: string | null;
    valueNumber: string | null;
    valueDate: Date | null;
    valueBool: boolean | null;
    valueJson: any;
    createdAt: Date;
    updatedAt: Date;
};

export type InsertTaskColumnValue = Omit<TaskColumnValue, "id" | "createdAt" | "updatedAt"> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
};

// ===== AI MODEL TYPE =====
export type AIModelType = "gpt-4" | "gpt-3.5-turbo" | "gemini-1.5-pro";

// ===== UPDATE PROFILE TYPE =====
export type UpdateProfile = {
    fullName?: string;
    bio?: string;
    jobTitle?: string;
    department?: string;
    phoneNumber?: string;
    preferredLanguage?: string;
    theme?: string;
    profileImage?: string;
    coverImage?: string;
    nickname?: string;
    firstName?: string;
    lastName?: string;
};

// ===== ENUM VALUES (for runtime use) =====
// These are plain objects, not Drizzle ORM enums, to avoid bundling Node.js modules

export const viewTypeEnum = {
    enumValues: ["list", "kanban", "calendar", "gantt", "table", "board"] as const
};

export const taskStatusEnum = {
    enumValues: ["pending", "in_progress", "completed", "cancelled", "blocked", "deferred"] as const
};

export const taskPriorityEnum = {
    enumValues: ["low", "medium", "high", "urgent", "critical"] as const
};

export const taskGroupEnum = {
    enumValues: ["todo", "in_progress", "completed", "blocked", "upcoming"] as const
};

export const userRoleEnum = {
    enumValues: ["admin", "project_manager", "content_creator", "designer", "developer", "stakeholder"] as const
};

export const projectStatusEnum = {
    enumValues: ["active", "planning", "completed", "on_hold"] as const
};

export const notificationTypeEnum = {
    enumValues: ["info", "warning", "error", "success", "comment", "mention", "assignment"] as const
};

export const columnTypeEnum = {
    enumValues: ["text", "number", "date", "status", "priority", "people", "checkbox", "dropdown"] as const
};

export const automationTriggerEnum = {
    enumValues: ["status_change", "assignment", "due_date", "creation", "completion"] as const
};

export const automationActionEnum = {
    enumValues: ["notify", "assign", "move", "update_status", "create_task"] as const
};

export const aiModelEnum = {
    enumValues: ["gpt-4", "gpt-3.5-turbo", "gemini-1.5-pro"] as const
};
