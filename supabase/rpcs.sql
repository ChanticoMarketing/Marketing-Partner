-- ============================================================
-- Marketing - Mate: RPCs y vistas para JOINs complejos
-- ============================================================

-- ===== RPC: tasks_with_groups =====
-- Retorna tasks agrupadas por task_group con column_values anidadas
CREATE OR REPLACE FUNCTION get_tasks_with_groups(proj_id integer)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', tg.id,
      'name', tg.name,
      'color', tg.color,
      'position', tg.position,
      'tasks', (
        SELECT json_agg(
          json_build_object(
            'id', t.id,
            'title', t.title,
            'description', t.description,
            'status', t.status,
            'priority', t.priority,
            'position', t.position,
            'assignedToId', t.assigned_to_id,
            'createdById', t.created_by_id,
            'dueDate', t.due_date,
            'completedAt', t.completed_at,
            'progress', t.progress,
            'aiGenerated', t.ai_generated,
            'tags', t.tags,
            'createdAt', t.created_at,
            'updatedAt', t.updated_at
          )
        )
        FROM tasks t
        WHERE t.project_id = proj_id AND t.group_id = tg.id
      )
    )
  ) INTO result
  FROM task_groups tg
  WHERE tg.project_id = proj_id;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== RPC: get_user_stats =====
-- Retorna estadísticas agregadas del usuario
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'projectCount', (
      SELECT count(*) FROM projects p
      WHERE p.created_by = user_uuid
        OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = user_uuid)
        OR EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id = p.id AND pa.user_id = user_uuid)
    ),
    'taskCount', (
      SELECT count(*) FROM tasks t
      WHERE t.assigned_to_id = user_uuid OR t.created_by_id = user_uuid
    ),
    'completedTaskCount', (
      SELECT count(*) FROM tasks t
      WHERE (t.assigned_to_id = user_uuid OR t.created_by_id = user_uuid)
        AND t.status = 'completed'
    ),
    'scheduleCount', (
      SELECT count(*) FROM schedules s
      WHERE s.created_by = user_uuid
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== RPC: get_user_activity =====
-- Retorna actividad reciente del usuario
CREATE OR REPLACE FUNCTION get_user_activity(user_uuid uuid, activity_limit integer DEFAULT 10)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', a.id,
      'action', a.action,
      'description', a.description,
      'projectId', a.project_id,
      'taskId', a.task_id,
      'createdAt', a.created_at
    )
    ORDER BY a.created_at DESC
  ) INTO result
  FROM activity_log a
  WHERE a.user_id = user_uuid
  LIMIT activity_limit;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== Permisos: ejecutar RPCs como authenticated =====
GRANT EXECUTE ON FUNCTION get_tasks_with_groups(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity(uuid, integer) TO authenticated;
