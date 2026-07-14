-- ============================================================
-- Marketing - Mate: Schema Supabase
-- Crea 26 tablas con users.id UUID -> auth.users.id
-- RLS habilitada en todas las tablas + policies
-- Sin sessions ni password_reset_tokens (Supabase gestiona)
-- ============================================================

-- ===== EXTENSIONS =====
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== ENUMS =====
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin','project_manager','content_creator','designer','developer','stakeholder');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('active','planning','completed','on_hold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('pending','in_progress','completed','cancelled','blocked','deferred');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low','medium','high','urgent','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_group AS ENUM ('todo','in_progress','completed','blocked','upcoming');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('info','warning','error','success','comment','mention','assignment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE view_type AS ENUM ('list','kanban','calendar','gantt','table');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE column_type AS ENUM ('text','number','date','status','priority','people','checkbox','dropdown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE automation_trigger AS ENUM ('status_change','assignment','due_date','creation','completion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE automation_action AS ENUM ('notify','assign','move','update_status','create_task');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ai_model AS ENUM ('gpt-4','gpt-3.5-turbo','gemini-1.5-pro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== UTILITY: updated_at trigger function =====
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===== TABLE: users (profile, linked to auth.users) =====
CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  username        text NOT NULL UNIQUE,
  email           text UNIQUE,
  is_primary      boolean NOT NULL DEFAULT false,
  role            user_role DEFAULT 'content_creator',
  bio             text,
  profile_image   text,
  cover_image     text,
  nickname        text,
  job_title       text,
  department      text,
  phone_number    text,
  preferred_language text DEFAULT 'es',
  theme           text DEFAULT 'light',
  custom_fields   jsonb DEFAULT '[]'::jsonb,
  last_login      timestamp,
  first_name      text,
  last_name       text,
  profile_image_url text,
  created_at      timestamp NOT NULL DEFAULT now(),
  updated_at      timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: projects =====
CREATE TABLE IF NOT EXISTS projects (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  client      text NOT NULL,
  color       text,
  image_url   text,
  description text,
  start_date  timestamp,
  end_date    timestamp,
  status      project_status DEFAULT 'active',
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: tasks =====
CREATE TABLE IF NOT EXISTS tasks (
  id             serial PRIMARY KEY,
  project_id     integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assigned_to_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  title          text NOT NULL,
  description    text,
  status         task_status NOT NULL DEFAULT 'pending',
  priority       task_priority NOT NULL DEFAULT 'medium',
  "group"        task_group DEFAULT 'todo',
  position       integer DEFAULT 0,
  ai_generated   boolean DEFAULT false,
  ai_suggestion  text,
  tags           text[],
  due_date       timestamp,
  completed_at   timestamp,
  estimated_hours integer,
  dependencies   text[],
  parent_task_id integer,
  progress       integer DEFAULT 0,
  attachments    jsonb,
  group_id       integer,
  created_at     timestamp NOT NULL DEFAULT now(),
  updated_at     timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: analysis_results =====
CREATE TABLE IF NOT EXISTS analysis_results (
  id              serial PRIMARY KEY,
  project_id      integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  mission         text,
  vision          text,
  core_values     text,
  objectives      text,
  communication_objectives text,
  buyer_persona   text,
  target_audience text,
  marketing_strategies text,
  archetypes      jsonb,
  brand_communication_style text,
  brand_tone      text,
  social_networks jsonb,
  response_policy_positive text,
  response_policy_negative text,
  keywords        text,
  content_themes  jsonb,
  competitor_analysis jsonb,
  project_description text,
  additional_notes text,
  -- Campos P0 calidad de contenido
  unique_value_proposition text,
  customer_quotes jsonb,
  customer_objections text,
  customer_vocabulary text,
  seasonal_calendar jsonb,
  created_at      timestamp NOT NULL DEFAULT now(),
  updated_at      timestamp NOT NULL DEFAULT now(),
  CONSTRAINT analysis_results_project_id_key UNIQUE (project_id)
);
CREATE TRIGGER analysis_results_set_updated_at BEFORE UPDATE ON analysis_results
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: documents =====
CREATE TABLE IF NOT EXISTS documents (
  id          serial PRIMARY KEY,
  project_id  integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL,
  category    text NOT NULL DEFAULT 'examples',
  subcategory text NOT NULL DEFAULT 'other',
  status      text NOT NULL DEFAULT 'draft',
  source_kind text NOT NULL DEFAULT 'upload',
  content     text,
  metadata    jsonb DEFAULT '{}'::jsonb,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamp,
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now(),
  CONSTRAINT documents_status_check CHECK (status IN ('draft', 'processing', 'review', 'approved', 'failed', 'archived')),
  CONSTRAINT documents_source_kind_check CHECK (source_kind IN ('upload', 'manual'))
);
CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: schedules =====
CREATE TABLE IF NOT EXISTS schedules (
  id                     serial PRIMARY KEY,
  project_id             integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                   text NOT NULL,
  description            text,
  additional_instructions text,
  created_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at             timestamp NOT NULL DEFAULT now(),
  updated_at             timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER schedules_set_updated_at BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: schedule_entries =====
CREATE TABLE IF NOT EXISTS schedule_entries (
  id                  serial PRIMARY KEY,
  schedule_id         integer NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text,
  content             text,
  copy_in             text,
  copy_out            text,
  design_instructions text,
  platform            text NOT NULL,
  post_date           timestamp NOT NULL,
  post_time           text NOT NULL,
  hashtags            text,
  comments            text,
  created_at          timestamp NOT NULL DEFAULT now(),
  updated_at          timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER schedule_entries_set_updated_at BEFORE UPDATE ON schedule_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: chat_messages =====
CREATE TABLE IF NOT EXISTS chat_messages (
  id          serial PRIMARY KEY,
  project_id  integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  message     text NOT NULL,
  is_ai       boolean DEFAULT false,
  ai_model    ai_model,
  created_at  timestamp NOT NULL DEFAULT now()
);

-- ===== TABLE: content_history =====
CREATE TABLE IF NOT EXISTS content_history (
  id                 serial PRIMARY KEY,
  schedule_entry_id  integer NOT NULL REFERENCES schedule_entries(id) ON DELETE CASCADE,
  version            integer NOT NULL,
  content            text NOT NULL,
  change_description text,
  changed_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamp NOT NULL DEFAULT now()
);

-- ===== TABLE: task_comments =====
CREATE TABLE IF NOT EXISTS task_comments (
  id          serial PRIMARY KEY,
  task_id     integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER task_comments_set_updated_at BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: products =====
CREATE TABLE IF NOT EXISTS products (
  id          serial PRIMARY KEY,
  project_id  integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  image_url   text,
  sku         text,
  price       numeric(10,2),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: project_views =====
CREATE TABLE IF NOT EXISTS project_views (
  id          serial PRIMARY KEY,
  project_id  integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        view_type NOT NULL DEFAULT 'list',
  config      jsonb DEFAULT '{}'::jsonb,
  is_default  boolean DEFAULT false,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER project_views_set_updated_at BEFORE UPDATE ON project_views
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: automation_rules =====
CREATE TABLE IF NOT EXISTS automation_rules (
  id                 serial PRIMARY KEY,
  project_id         integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name               text NOT NULL,
  description        text,
  trigger            automation_trigger NOT NULL,
  trigger_conditions jsonb,
  action             automation_action NOT NULL,
  action_config      jsonb,
  is_active          boolean DEFAULT true,
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamp NOT NULL DEFAULT now(),
  updated_at         timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER automation_rules_set_updated_at BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: time_entries =====
CREATE TABLE IF NOT EXISTS time_entries (
  id          serial PRIMARY KEY,
  task_id     integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description text,
  start_time  timestamp NOT NULL,
  end_time    timestamp,
  duration    integer,
  is_running  boolean DEFAULT false,
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER time_entries_set_updated_at BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: tags =====
CREATE TABLE IF NOT EXISTS tags (
  id          serial PRIMARY KEY,
  project_id  integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text DEFAULT '#3498db',
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamp NOT NULL DEFAULT now()
);

-- ===== TABLE: collaborative_docs =====
CREATE TABLE IF NOT EXISTS collaborative_docs (
  id              serial PRIMARY KEY,
  project_id      integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           text NOT NULL,
  content         text,
  content_json    jsonb,
  last_edited_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamp NOT NULL DEFAULT now(),
  updated_at      timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER collaborative_docs_set_updated_at BEFORE UPDATE ON collaborative_docs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: notifications =====
CREATE TABLE IF NOT EXISTS notifications (
  id                  serial PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                notification_type NOT NULL,
  title               text,
  message             text NOT NULL,
  related_entity_type text,
  related_entity_id   text,
  is_read             boolean DEFAULT false,
  created_at          timestamp NOT NULL DEFAULT now()
);

-- ===== TABLE: task_dependencies =====
CREATE TABLE IF NOT EXISTS task_dependencies (
  id                serial PRIMARY KEY,
  task_id           integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at        timestamp NOT NULL DEFAULT now()
);

-- ===== TABLE: project_members =====
CREATE TABLE IF NOT EXISTS project_members (
  id          serial PRIMARY KEY,
  project_id  integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        text DEFAULT 'member',
  permissions jsonb DEFAULT '[]'::jsonb,
  joined_at   timestamp NOT NULL DEFAULT now()
);

-- ===== TABLE: project_assignments =====
CREATE TABLE IF NOT EXISTS project_assignments (
  id          serial PRIMARY KEY,
  project_id  integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamp NOT NULL DEFAULT now()
);

-- ===== TABLE: task_groups =====
CREATE TABLE IF NOT EXISTS task_groups (
  id          serial PRIMARY KEY,
  project_id  integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text DEFAULT '#3498db',
  position    integer DEFAULT 0,
  created_at  timestamp NOT NULL DEFAULT now()
);

-- ===== TABLE: project_column_settings =====
CREATE TABLE IF NOT EXISTS project_column_settings (
  id           serial PRIMARY KEY,
  project_id   integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  column_name  text NOT NULL,
  column_type  column_type NOT NULL,
  is_visible   boolean DEFAULT true,
  position     integer DEFAULT 0,
  config       jsonb DEFAULT '{}'::jsonb,
  created_at   timestamp NOT NULL DEFAULT now()
);

-- ===== TABLE: task_column_values =====
CREATE TABLE IF NOT EXISTS task_column_values (
  id           serial PRIMARY KEY,
  task_id      integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  column_id    integer NOT NULL REFERENCES project_column_settings(id) ON DELETE CASCADE,
  value_text   text,
  value_number numeric(10,2),
  value_date   timestamp,
  value_bool   boolean,
  value_json   jsonb,
  created_at   timestamp NOT NULL DEFAULT now(),
  updated_at   timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER task_column_values_set_updated_at BEFORE UPDATE ON task_column_values
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: task_assignees =====
CREATE TABLE IF NOT EXISTS task_assignees (
  id          serial PRIMARY KEY,
  task_id     integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamp NOT NULL DEFAULT now()
);

-- ===== TABLE: task_attachments =====
CREATE TABLE IF NOT EXISTS task_attachments (
  id          serial PRIMARY KEY,
  task_id     integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  file_url    text NOT NULL,
  file_size   integer,
  mime_type   text,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamp NOT NULL DEFAULT now()
);

-- ===== TABLE: activity_log =====
CREATE TABLE IF NOT EXISTS activity_log (
  id          serial PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id  integer REFERENCES projects(id) ON DELETE CASCADE,
  task_id     integer REFERENCES tasks(id) ON DELETE CASCADE,
  action      text NOT NULL,
  description text,
  metadata    jsonb,
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER activity_log_set_updated_at BEFORE UPDATE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== TABLE: user_settings =====
CREATE TABLE IF NOT EXISTS user_settings (
  id                  serial PRIMARY KEY,
  user_id             uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email_notifications boolean DEFAULT true,
  push_notifications  boolean DEFAULT true,
  weekly_digest       boolean DEFAULT true,
  timezone            text DEFAULT 'UTC',
  date_format         text DEFAULT 'MM/DD/YYYY',
  time_format         text DEFAULT '12h',
  language            text DEFAULT 'en',
  created_at          timestamp NOT NULL DEFAULT now(),
  updated_at          timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER user_settings_set_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TRIGGER: auto-crear profile en public.users al registrar usuario
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, username, email, first_name, last_name, profile_image_url, department)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN NEW.email LIKE '%@cohetebrands.com' THEN 'Cohete Brands' ELSE NULL END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- RLS: habilitar en todas las tablas
-- ============================================================
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules              ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_history        ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_views          ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborative_docs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_column_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_column_values     ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings          ENABLE ROW LEVEL SECURITY;
