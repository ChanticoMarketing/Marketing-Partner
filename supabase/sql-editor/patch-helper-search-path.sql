CREATE OR REPLACE FUNCTION public.can_access_project(proj_id integer)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = proj_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND (u.is_primary = true OR u.role = 'admin')
        )
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = proj_id
            AND pm.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.project_assignments pa
          WHERE pa.project_id = proj_id
            AND pa.user_id = auth.uid()
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND (u.is_primary = true OR u.role = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.can_approve_project_knowledge(proj_id integer)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = proj_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND (u.is_primary = true OR u.role = 'admin')
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;
