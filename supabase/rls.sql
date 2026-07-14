-- ============================================================
-- Marketing - Mate: RLS Policies
-- Requiere que schema.sql ya esté aplicado
-- ============================================================

-- ===== Helper: chequear acceso a un proyecto =====
-- Un usuario tiene acceso si es creador, admin/isPrimary,
-- miembro de project_members, o asignado en project_assignments
CREATE OR REPLACE FUNCTION can_access_project(proj_id integer)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = proj_id
    AND (
      p.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND (u.is_primary = true OR u.role = 'admin'))
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = proj_id AND pm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id = proj_id AND pa.user_id = auth.uid())
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

-- ===== Helper: chequear si el usuario es admin/isPrimary =====
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND (u.is_primary = true OR u.role = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

-- ===== Helper: permisos de aprobación del centro de conocimiento =====
CREATE OR REPLACE FUNCTION can_approve_project_knowledge(proj_id integer)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.id = proj_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM users u
          WHERE u.id = auth.uid()
            AND (u.is_primary = true OR u.role = 'admin')
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

-- ============================================================
-- users (profiles)
-- ============================================================
-- SELECT: cualquier usuario autenticado puede ver perfiles (limitado)
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users
  FOR SELECT TO authenticated USING (true);

-- UPDATE: solo el propio usuario
DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- INSERT: solo via trigger (auth.users) o service role
-- No se permite INSERT directo desde el cliente
DROP POLICY IF EXISTS users_insert ON users;
CREATE POLICY users_insert ON users
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- DELETE: solo admin/isPrimary
DROP POLICY IF EXISTS users_delete ON users;
CREATE POLICY users_delete ON users
  FOR DELETE TO authenticated USING (is_admin_user());

-- ============================================================
-- projects
-- ============================================================
DROP POLICY IF EXISTS projects_select ON projects;
CREATE POLICY projects_select ON projects
  FOR SELECT TO authenticated USING (can_access_project(id));

DROP POLICY IF EXISTS projects_insert ON projects;
CREATE POLICY projects_insert ON projects
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS projects_update ON projects;
CREATE POLICY projects_update ON projects
  FOR UPDATE TO authenticated
  USING (can_approve_project_knowledge(id))
  WITH CHECK (can_approve_project_knowledge(id));

DROP POLICY IF EXISTS projects_delete ON projects;
CREATE POLICY projects_delete ON projects
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR is_admin_user()
  );

-- ============================================================
-- tasks (y subtablas con project_id directo)
-- ============================================================
DROP POLICY IF EXISTS tasks_select ON tasks;
CREATE POLICY tasks_select ON tasks
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS tasks_insert ON tasks;
CREATE POLICY tasks_insert ON tasks
  FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS tasks_update ON tasks;
CREATE POLICY tasks_update ON tasks
  FOR UPDATE TO authenticated
  USING (can_access_project(project_id))
  WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS tasks_delete ON tasks;
CREATE POLICY tasks_delete ON tasks
  FOR DELETE TO authenticated USING (can_access_project(project_id));

-- ===== analysis_results =====
DROP POLICY IF EXISTS analysis_results_select ON analysis_results;
CREATE POLICY analysis_results_select ON analysis_results
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS analysis_results_insert ON analysis_results;
CREATE POLICY analysis_results_insert ON analysis_results
  FOR INSERT TO authenticated WITH CHECK (can_approve_project_knowledge(project_id));

DROP POLICY IF EXISTS analysis_results_update ON analysis_results;
CREATE POLICY analysis_results_update ON analysis_results
  FOR UPDATE TO authenticated
  USING (can_approve_project_knowledge(project_id))
  WITH CHECK (can_approve_project_knowledge(project_id));

DROP POLICY IF EXISTS analysis_results_delete ON analysis_results;
CREATE POLICY analysis_results_delete ON analysis_results
  FOR DELETE TO authenticated USING (can_approve_project_knowledge(project_id));

-- ===== documents =====
DROP POLICY IF EXISTS documents_select ON documents;
CREATE POLICY documents_select ON documents
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS documents_insert ON documents;
CREATE POLICY documents_insert ON documents
  FOR INSERT TO authenticated WITH CHECK (can_approve_project_knowledge(project_id));

DROP POLICY IF EXISTS documents_update ON documents;
CREATE POLICY documents_update ON documents
  FOR UPDATE TO authenticated
  USING (can_approve_project_knowledge(project_id))
  WITH CHECK (can_approve_project_knowledge(project_id));

DROP POLICY IF EXISTS documents_delete ON documents;
CREATE POLICY documents_delete ON documents
  FOR DELETE TO authenticated USING (can_approve_project_knowledge(project_id));

-- ===== schedules =====
DROP POLICY IF EXISTS schedules_select ON schedules;
CREATE POLICY schedules_select ON schedules
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS schedules_insert ON schedules;
CREATE POLICY schedules_insert ON schedules
  FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS schedules_update ON schedules;
CREATE POLICY schedules_update ON schedules
  FOR UPDATE TO authenticated
  USING (can_access_project(project_id))
  WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS schedules_delete ON schedules;
CREATE POLICY schedules_delete ON schedules
  FOR DELETE TO authenticated USING (can_access_project(project_id));

-- ===== products =====
DROP POLICY IF EXISTS products_select ON products;
CREATE POLICY products_select ON products
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS products_insert ON products;
CREATE POLICY products_insert ON products
  FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS products_update ON products;
CREATE POLICY products_update ON products
  FOR UPDATE TO authenticated
  USING (can_access_project(project_id))
  WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS products_delete ON products;
CREATE POLICY products_delete ON products
  FOR DELETE TO authenticated USING (can_access_project(project_id));

-- ===== tags =====
DROP POLICY IF EXISTS tags_select ON tags;
CREATE POLICY tags_select ON tags
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS tags_insert ON tags;
CREATE POLICY tags_insert ON tags
  FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS tags_update ON tags;
CREATE POLICY tags_update ON tags
  FOR UPDATE TO authenticated
  USING (can_access_project(project_id))
  WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS tags_delete ON tags;
CREATE POLICY tags_delete ON tags
  FOR DELETE TO authenticated USING (can_access_project(project_id));

-- ===== project_views =====
DROP POLICY IF EXISTS project_views_select ON project_views;
CREATE POLICY project_views_select ON project_views
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS project_views_insert ON project_views;
CREATE POLICY project_views_insert ON project_views
  FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS project_views_update ON project_views;
CREATE POLICY project_views_update ON project_views
  FOR UPDATE TO authenticated
  USING (can_access_project(project_id))
  WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS project_views_delete ON project_views;
CREATE POLICY project_views_delete ON project_views
  FOR DELETE TO authenticated USING (can_access_project(project_id));

-- ===== automation_rules =====
DROP POLICY IF EXISTS automation_rules_select ON automation_rules;
CREATE POLICY automation_rules_select ON automation_rules
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS automation_rules_insert ON automation_rules;
CREATE POLICY automation_rules_insert ON automation_rules
  FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS automation_rules_update ON automation_rules;
CREATE POLICY automation_rules_update ON automation_rules
  FOR UPDATE TO authenticated
  USING (can_access_project(project_id))
  WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS automation_rules_delete ON automation_rules;
CREATE POLICY automation_rules_delete ON automation_rules
  FOR DELETE TO authenticated USING (can_access_project(project_id));

-- ===== task_groups =====
DROP POLICY IF EXISTS task_groups_select ON task_groups;
CREATE POLICY task_groups_select ON task_groups
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS task_groups_insert ON task_groups;
CREATE POLICY task_groups_insert ON task_groups
  FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS task_groups_update ON task_groups;
CREATE POLICY task_groups_update ON task_groups
  FOR UPDATE TO authenticated
  USING (can_access_project(project_id))
  WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS task_groups_delete ON task_groups;
CREATE POLICY task_groups_delete ON task_groups
  FOR DELETE TO authenticated USING (can_access_project(project_id));

-- ===== project_column_settings =====
DROP POLICY IF EXISTS project_column_settings_select ON project_column_settings;
CREATE POLICY project_column_settings_select ON project_column_settings
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS project_column_settings_insert ON project_column_settings;
CREATE POLICY project_column_settings_insert ON project_column_settings
  FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS project_column_settings_update ON project_column_settings;
CREATE POLICY project_column_settings_update ON project_column_settings
  FOR UPDATE TO authenticated
  USING (can_access_project(project_id))
  WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS project_column_settings_delete ON project_column_settings;
CREATE POLICY project_column_settings_delete ON project_column_settings
  FOR DELETE TO authenticated USING (can_access_project(project_id));

-- ===== collaborative_docs =====
DROP POLICY IF EXISTS collaborative_docs_select ON collaborative_docs;
CREATE POLICY collaborative_docs_select ON collaborative_docs
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS collaborative_docs_insert ON collaborative_docs;
CREATE POLICY collaborative_docs_insert ON collaborative_docs
  FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS collaborative_docs_update ON collaborative_docs;
CREATE POLICY collaborative_docs_update ON collaborative_docs
  FOR UPDATE TO authenticated
  USING (can_access_project(project_id))
  WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS collaborative_docs_delete ON collaborative_docs;
CREATE POLICY collaborative_docs_delete ON collaborative_docs
  FOR DELETE TO authenticated USING (can_access_project(project_id));

-- ===== chat_messages =====
DROP POLICY IF EXISTS chat_messages_select ON chat_messages;
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS chat_messages_delete ON chat_messages;
CREATE POLICY chat_messages_delete ON chat_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- Tablas con FK a schedule_id (no project_id directo)
-- ============================================================

-- ===== schedule_entries =====
DROP POLICY IF EXISTS schedule_entries_select ON schedule_entries;
CREATE POLICY schedule_entries_select ON schedule_entries
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM schedules s WHERE s.id = schedule_id AND can_access_project(s.project_id))
  );

DROP POLICY IF EXISTS schedule_entries_insert ON schedule_entries;
CREATE POLICY schedule_entries_insert ON schedule_entries
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM schedules s WHERE s.id = schedule_id AND can_access_project(s.project_id))
  );

DROP POLICY IF EXISTS schedule_entries_update ON schedule_entries;
CREATE POLICY schedule_entries_update ON schedule_entries
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM schedules s WHERE s.id = schedule_id AND can_access_project(s.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM schedules s WHERE s.id = schedule_id AND can_access_project(s.project_id)));

DROP POLICY IF EXISTS schedule_entries_delete ON schedule_entries;
CREATE POLICY schedule_entries_delete ON schedule_entries
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM schedules s WHERE s.id = schedule_id AND can_access_project(s.project_id))
  );

-- ===== content_history =====
DROP POLICY IF EXISTS content_history_select ON content_history;
CREATE POLICY content_history_select ON content_history
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM schedule_entries se JOIN schedules s ON s.id = se.schedule_id WHERE se.id = schedule_entry_id AND can_access_project(s.project_id))
  );

DROP POLICY IF EXISTS content_history_insert ON content_history;
CREATE POLICY content_history_insert ON content_history
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM schedule_entries se JOIN schedules s ON s.id = se.schedule_id WHERE se.id = schedule_entry_id AND can_access_project(s.project_id))
  );

DROP POLICY IF EXISTS content_history_delete ON content_history;
CREATE POLICY content_history_delete ON content_history
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM schedule_entries se JOIN schedules s ON s.id = se.schedule_id WHERE se.id = schedule_entry_id AND can_access_project(s.project_id))
  );

-- ============================================================
-- Tablas con FK a task_id (no project_id directo)
-- ============================================================

-- ===== task_comments =====
DROP POLICY IF EXISTS task_comments_select ON task_comments;
CREATE POLICY task_comments_select ON task_comments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

DROP POLICY IF EXISTS task_comments_insert ON task_comments;
CREATE POLICY task_comments_insert ON task_comments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id)) AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS task_comments_update ON task_comments;
CREATE POLICY task_comments_update ON task_comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS task_comments_delete ON task_comments;
CREATE POLICY task_comments_delete ON task_comments
  FOR DELETE TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id) AND (t.created_by_id = auth.uid() OR is_admin_user()))
  );

-- ===== task_dependencies =====
DROP POLICY IF EXISTS task_dependencies_select ON task_dependencies;
CREATE POLICY task_dependencies_select ON task_dependencies
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

DROP POLICY IF EXISTS task_dependencies_insert ON task_dependencies;
CREATE POLICY task_dependencies_insert ON task_dependencies
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

DROP POLICY IF EXISTS task_dependencies_delete ON task_dependencies;
CREATE POLICY task_dependencies_delete ON task_dependencies
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

-- ===== time_entries =====
DROP POLICY IF EXISTS time_entries_select ON time_entries;
CREATE POLICY time_entries_select ON time_entries
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

DROP POLICY IF EXISTS time_entries_insert ON time_entries;
CREATE POLICY time_entries_insert ON time_entries
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id)) AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS time_entries_update ON time_entries;
CREATE POLICY time_entries_update ON time_entries
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS time_entries_delete ON time_entries;
CREATE POLICY time_entries_delete ON time_entries
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ===== task_assignees =====
DROP POLICY IF EXISTS task_assignees_select ON task_assignees;
CREATE POLICY task_assignees_select ON task_assignees
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

DROP POLICY IF EXISTS task_assignees_insert ON task_assignees;
CREATE POLICY task_assignees_insert ON task_assignees
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

DROP POLICY IF EXISTS task_assignees_delete ON task_assignees;
CREATE POLICY task_assignees_delete ON task_assignees
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

-- ===== task_attachments =====
DROP POLICY IF EXISTS task_attachments_select ON task_attachments;
CREATE POLICY task_attachments_select ON task_attachments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

DROP POLICY IF EXISTS task_attachments_insert ON task_attachments;
CREATE POLICY task_attachments_insert ON task_attachments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

DROP POLICY IF EXISTS task_attachments_delete ON task_attachments;
CREATE POLICY task_attachments_delete ON task_attachments
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

-- ===== task_column_values =====
DROP POLICY IF EXISTS task_column_values_select ON task_column_values;
CREATE POLICY task_column_values_select ON task_column_values
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

DROP POLICY IF EXISTS task_column_values_insert ON task_column_values;
CREATE POLICY task_column_values_insert ON task_column_values
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

DROP POLICY IF EXISTS task_column_values_update ON task_column_values;
CREATE POLICY task_column_values_update ON task_column_values
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id)));

DROP POLICY IF EXISTS task_column_values_delete ON task_column_values;
CREATE POLICY task_column_values_delete ON task_column_values
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_project(t.project_id))
  );

-- ============================================================
-- project_members / project_assignments (gestion de acceso)
-- ============================================================

-- ===== project_members =====
DROP POLICY IF EXISTS project_members_select ON project_members;
CREATE POLICY project_members_select ON project_members
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS project_members_insert ON project_members;
CREATE POLICY project_members_insert ON project_members
  FOR INSERT TO authenticated WITH CHECK (
    can_access_project(project_id) AND is_admin_user()
  );

DROP POLICY IF EXISTS project_members_update ON project_members;
CREATE POLICY project_members_update ON project_members
  FOR UPDATE TO authenticated
  USING (can_access_project(project_id) AND is_admin_user())
  WITH CHECK (can_access_project(project_id) AND is_admin_user());

DROP POLICY IF EXISTS project_members_delete ON project_members;
CREATE POLICY project_members_delete ON project_members
  FOR DELETE TO authenticated USING (
    can_access_project(project_id) AND is_admin_user()
  );

-- ===== project_assignments =====
DROP POLICY IF EXISTS project_assignments_select ON project_assignments;
CREATE POLICY project_assignments_select ON project_assignments
  FOR SELECT TO authenticated USING (can_access_project(project_id));

DROP POLICY IF EXISTS project_assignments_insert ON project_assignments;
CREATE POLICY project_assignments_insert ON project_assignments
  FOR INSERT TO authenticated WITH CHECK (
    can_access_project(project_id) AND is_admin_user()
  );

DROP POLICY IF EXISTS project_assignments_delete ON project_assignments;
CREATE POLICY project_assignments_delete ON project_assignments
  FOR DELETE TO authenticated USING (
    can_access_project(project_id) AND is_admin_user()
  );

-- ============================================================
-- Tablas personales (user_id directo)
-- ============================================================

-- ===== notifications =====
DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_update ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_delete ON notifications;
CREATE POLICY notifications_delete ON notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- notifications INSERT solo desde service role / Edge Functions (sin policy = bloqueado)

-- ===== user_settings =====
DROP POLICY IF EXISTS user_settings_select ON user_settings;
CREATE POLICY user_settings_select ON user_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_settings_insert ON user_settings;
CREATE POLICY user_settings_insert ON user_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_settings_update ON user_settings;
CREATE POLICY user_settings_update ON user_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_settings_delete ON user_settings;
CREATE POLICY user_settings_delete ON user_settings
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- activity_log (INSERT solo service role/Edge; SELECT por acceso al proyecto)
-- ============================================================
DROP POLICY IF EXISTS activity_log_select ON activity_log;
CREATE POLICY activity_log_select ON activity_log
  FOR SELECT TO authenticated USING (
    project_id IS NULL OR can_access_project(project_id)
  );

-- activity_log: INSERT y UPDATE solo desde service role (sin policy = bloqueado para anon/authenticated)

-- ===== project-images Storage =====
DROP POLICY IF EXISTS project_images_insert ON storage.objects;
CREATE POLICY project_images_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-images'
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
        AND public.can_approve_project_knowledge(p.id)
    )
  );

DROP POLICY IF EXISTS project_images_delete ON storage.objects;
CREATE POLICY project_images_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-images'
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
        AND public.can_approve_project_knowledge(p.id)
    )
  );
