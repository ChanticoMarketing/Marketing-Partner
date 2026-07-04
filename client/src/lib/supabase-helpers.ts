import { supabase } from "./supabase";

// Mapeo de columnas camelCase (cliente) ↔ snake_case (Supabase DB)
// Por tabla: { camelCaseKey: snake_case_column }
const columnMaps: Record<string, Record<string, string>> = {
  users: {
    id: "id",
    fullName: "full_name",
    username: "username",
    email: "email",
    isPrimary: "is_primary",
    role: "role",
    bio: "bio",
    profileImage: "profile_image",
    coverImage: "cover_image",
    nickname: "nickname",
    jobTitle: "job_title",
    department: "department",
    phoneNumber: "phone_number",
    preferredLanguage: "preferred_language",
    theme: "theme",
    customFields: "custom_fields",
    lastLogin: "last_login",
    firstName: "first_name",
    lastName: "last_name",
    profileImageUrl: "profile_image_url",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  user: {
    id: "id",
    fullName: "full_name",
    username: "username",
    email: "email",
    isPrimary: "is_primary",
    role: "role",
    bio: "bio",
    profileImage: "profile_image",
    coverImage: "cover_image",
    nickname: "nickname",
    jobTitle: "job_title",
    department: "department",
    phoneNumber: "phone_number",
    preferredLanguage: "preferred_language",
    theme: "theme",
    customFields: "custom_fields",
    lastLogin: "last_login",
    firstName: "first_name",
    lastName: "last_name",
    profileImageUrl: "profile_image_url",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  projects: {
    id: "id",
    name: "name",
    client: "client",
    description: "description",
    startDate: "start_date",
    endDate: "end_date",
    status: "status",
    createdBy: "created_by",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  tasks: {
    id: "id",
    projectId: "project_id",
    assignedToId: "assigned_to_id",
    createdById: "created_by_id",
    title: "title",
    description: "description",
    status: "status",
    priority: "priority",
    group: "group",
    position: "position",
    aiGenerated: "ai_generated",
    aiSuggestion: "ai_suggestion",
    tags: "tags",
    dueDate: "due_date",
    completedAt: "completed_at",
    estimatedHours: "estimated_hours",
    dependencies: "dependencies",
    parentTaskId: "parent_task_id",
    progress: "progress",
    attachments: "attachments",
    groupId: "group_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  analysis_results: {
    id: "id",
    projectId: "project_id",
    mission: "mission",
    vision: "vision",
    coreValues: "core_values",
    objectives: "objectives",
    communicationObjectives: "communication_objectives",
    buyerPersona: "buyer_persona",
    targetAudience: "target_audience",
    marketingStrategies: "marketing_strategies",
    archetypes: "archetypes",
    brandCommunicationStyle: "brand_communication_style",
    brandTone: "brand_tone",
    socialNetworks: "social_networks",
    responsePolicyPositive: "response_policy_positive",
    responsePolicyNegative: "response_policy_negative",
    keywords: "keywords",
    contentThemes: "content_themes",
    competitorAnalysis: "competitor_analysis",
    projectDescription: "project_description",
    additionalNotes: "additional_notes",
    uniqueValueProposition: "unique_value_proposition",
    customerQuotes: "customer_quotes",
    customerObjections: "customer_objections",
    customerVocabulary: "customer_vocabulary",
    seasonalCalendar: "seasonal_calendar",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  documents: {
    id: "id",
    projectId: "project_id",
    name: "name",
    type: "type",
    category: "category",
    subcategory: "subcategory",
    status: "status",
    sourceKind: "source_kind",
    content: "content",
    metadata: "metadata",
    uploadedBy: "uploaded_by",
    approvedBy: "approved_by",
    approvedAt: "approved_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  schedules: {
    id: "id",
    projectId: "project_id",
    name: "name",
    description: "description",
    additionalInstructions: "additional_instructions",
    startDate: "start_date",
    createdBy: "created_by",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  schedule_entries: {
    id: "id",
    scheduleId: "schedule_id",
    title: "title",
    description: "description",
    content: "content",
    copyIn: "copy_in",
    copyOut: "copy_out",
    designInstructions: "design_instructions",
    platform: "platform",
    postDate: "post_date",
    postTime: "post_time",
    hashtags: "hashtags",
    comments: "comments",
    referenceImageUrl: "reference_image_url",
    referenceImagePrompt: "reference_image_prompt",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  chat_messages: {
    id: "id",
    projectId: "project_id",
    userId: "user_id",
    message: "message",
    isAi: "is_ai",
    aiModel: "ai_model",
    createdAt: "created_at",
  },
  content_history: {
    id: "id",
    scheduleEntryId: "schedule_entry_id",
    version: "version",
    content: "content",
    changeDescription: "change_description",
    changedBy: "changed_by",
    createdAt: "created_at",
  },
  task_comments: {
    id: "id",
    taskId: "task_id",
    userId: "user_id",
    content: "content",
    isInternal: "is_internal",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  products: {
    id: "id",
    projectId: "project_id",
    name: "name",
    description: "description",
    imageUrl: "image_url",
    sku: "sku",
    price: "price",
    createdBy: "created_by",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  project_views: {
    id: "id",
    projectId: "project_id",
    name: "name",
    type: "type",
    config: "config",
    isDefault: "is_default",
    createdBy: "created_by",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  automation_rules: {
    id: "id",
    projectId: "project_id",
    name: "name",
    description: "description",
    trigger: "trigger",
    triggerConditions: "trigger_conditions",
    triggerConfig: "trigger_conditions",
    action: "action",
    actionConfig: "action_config",
    isActive: "is_active",
    createdBy: "created_by",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  time_entries: {
    id: "id",
    taskId: "task_id",
    userId: "user_id",
    description: "description",
    startTime: "start_time",
    endTime: "end_time",
    duration: "duration",
    isRunning: "is_running",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  tags: {
    id: "id",
    projectId: "project_id",
    name: "name",
    color: "color",
    createdBy: "created_by",
    createdAt: "created_at",
  },
  collaborative_docs: {
    id: "id",
    projectId: "project_id",
    title: "title",
    content: "content",
    contentJson: "content_json",
    lastEditedBy: "last_edited_by",
    createdBy: "created_by",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  notifications: {
    id: "id",
    userId: "user_id",
    type: "type",
    title: "title",
    message: "message",
    relatedEntityType: "related_entity_type",
    relatedEntityId: "related_entity_id",
    isRead: "is_read",
    createdAt: "created_at",
  },
  task_dependencies: {
    id: "id",
    taskId: "task_id",
    dependsOnTaskId: "depends_on_task_id",
    createdAt: "created_at",
  },
  project_members: {
    id: "id",
    projectId: "project_id",
    userId: "user_id",
    role: "role",
    permissions: "permissions",
    joinedAt: "joined_at",
  },
  project_assignments: {
    id: "id",
    projectId: "project_id",
    userId: "user_id",
    assignedAt: "assigned_at",
  },
  task_groups: {
    id: "id",
    projectId: "project_id",
    name: "name",
    color: "color",
    position: "position",
    createdAt: "created_at",
  },
  project_column_settings: {
    id: "id",
    projectId: "project_id",
    columnName: "column_name",
    columnType: "column_type",
    isVisible: "is_visible",
    position: "position",
    config: "config",
    createdAt: "created_at",
  },
  task_column_values: {
    id: "id",
    taskId: "task_id",
    columnId: "column_id",
    valueText: "value_text",
    valueNumber: "value_number",
    valueDate: "value_date",
    valueBool: "value_bool",
    valueJson: "value_json",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  task_assignees: {
    id: "id",
    taskId: "task_id",
    userId: "user_id",
    assignedBy: "assigned_by",
    assignedAt: "assigned_at",
  },
  task_attachments: {
    id: "id",
    taskId: "task_id",
    fileName: "file_name",
    fileUrl: "file_url",
    fileSize: "file_size",
    mimeType: "mime_type",
    uploadedBy: "uploaded_by",
    createdAt: "created_at",
  },
  activity_log: {
    id: "id",
    userId: "user_id",
    projectId: "project_id",
    taskId: "task_id",
    action: "action",
    description: "description",
    metadata: "metadata",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  user_settings: {
    id: "id",
    userId: "user_id",
    emailNotifications: "email_notifications",
    pushNotifications: "push_notifications",
    weeklyDigest: "weekly_digest",
    timezone: "timezone",
    dateFormat: "date_format",
    timeFormat: "time_format",
    language: "language",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
};

function camelToSnake(table: string, obj: Record<string, any>): Record<string, any> {
  const map = columnMaps[table];
  if (!map) return obj;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = map[key] ?? key;
    result[snakeKey] = value;
  }
  return result;
}

function snakeToCamel(table: string, obj: Record<string, any>): Record<string, any> {
  const map = columnMaps[table];
  if (!map) return obj;
  const inverse: Record<string, string> = {};
  for (const [camel, snake] of Object.entries(map)) {
    inverse[snake] = camel;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = inverse[key] ?? key;
    result[camelKey] = value;
  }
  return result;
}

function snakeToCamelDeep(table: string, obj: Record<string, any>): Record<string, any> {
  const result = snakeToCamel(table, obj);
  // Handle nested relations (e.g. analysis_results inside projects)
  for (const [key, value] of Object.entries(result)) {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
      // Check if key matches a known table
      const singularKey = key.replace(/s$/, "");
      if (columnMaps[key] || columnMaps[singularKey]) {
        const nestedTable = columnMaps[key] ? key : singularKey;
        result[key] = value.map((item: any) => snakeToCamelDeep(nestedTable, item));
      }
    } else if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      const singularKey = key.replace(/s$/, "");
      if (columnMaps[key] || columnMaps[singularKey]) {
        const nestedTable = columnMaps[key] ? key : singularKey;
        result[key] = snakeToCamelDeep(nestedTable, value);
      }
    }
  }
  return result;
}

export function toDb(table: string, obj: Record<string, any>): Record<string, any> {
  return camelToSnake(table, obj);
}

export function fromDb<T = any>(table: string, obj: Record<string, any> | null): T | null {
  if (!obj) return null;
  return snakeToCamelDeep(table, obj) as T;
}

export function fromDbArray<T = any>(table: string, arr: Record<string, any>[] | null): T[] {
  if (!arr) return [];
  return arr.map((item) => snakeToCamelDeep(table, item) as T);
}

// Wrapper que hace queries a Supabase y mapea automáticamente camelCase
export function dbQuery(table: string) {
  return {
    select: async (columns = "*", filters?: Record<string, any>) => {
      let query = supabase.from(table).select(columns);
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const snakeKey = columnMaps[table]?.[key] ?? key;
          query = query.eq(snakeKey, value);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return fromDbArray(table, data);
    },
    selectSingle: async (columns = "*", filters?: Record<string, any>) => {
      let query = supabase.from(table).select(columns);
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const snakeKey = columnMaps[table]?.[key] ?? key;
          query = query.eq(snakeKey, value);
        }
      }
      const { data, error } = await query.single();
      if (error) throw error;
      return fromDb(table, data);
    },
    insert: async (values: Record<string, any> | Record<string, any>[]) => {
      const mapped = Array.isArray(values)
        ? values.map((v) => camelToSnake(table, v))
        : camelToSnake(table, values);
      const { data, error } = await supabase
        .from(table)
        .insert(mapped)
        .select();
      if (error) throw error;
      return fromDbArray(table, data);
    },
    insertSingle: async (values: Record<string, any>) => {
      const mapped = camelToSnake(table, values);
      const { data, error } = await supabase
        .from(table)
        .insert(mapped)
        .select()
        .single();
      if (error) throw error;
      return fromDb(table, data);
    },
    update: async (values: Record<string, any>, filters: Record<string, any>) => {
      const mapped = camelToSnake(table, values);
      let query = supabase.from(table).update(mapped);
      for (const [key, value] of Object.entries(filters)) {
        const snakeKey = columnMaps[table]?.[key] ?? key;
        query = query.eq(snakeKey, value);
      }
      const { data, error } = await query.select();
      if (error) throw error;
      return fromDbArray(table, data);
    },
    updateSingle: async (values: Record<string, any>, filters: Record<string, any>) => {
      const mapped = camelToSnake(table, values);
      let query = supabase.from(table).update(mapped);
      for (const [key, value] of Object.entries(filters)) {
        const snakeKey = columnMaps[table]?.[key] ?? key;
        query = query.eq(snakeKey, value);
      }
      const { data, error } = await query.select().single();
      if (error) throw error;
      return fromDb(table, data);
    },
    upsert: async (values: Record<string, any>) => {
      const mapped = camelToSnake(table, values);
      const { data, error } = await supabase
        .from(table)
        .upsert(mapped)
        .select()
        .single();
      if (error) throw error;
      return fromDb(table, data);
    },
    delete: async (filters: Record<string, any>) => {
      let query = supabase.from(table).delete();
      for (const [key, value] of Object.entries(filters)) {
        const snakeKey = columnMaps[table]?.[key] ?? key;
        query = query.eq(snakeKey, value);
      }
      const { error } = await query;
      if (error) throw error;
    },
  };
}
