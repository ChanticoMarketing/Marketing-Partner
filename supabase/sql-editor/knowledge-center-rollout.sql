-- ponytail: single SQL Editor script for the hosted project

BEGIN;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamp;

ALTER TABLE public.documents
  ALTER COLUMN category SET DEFAULT 'examples',
  ALTER COLUMN subcategory SET DEFAULT 'other',
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN source_kind SET DEFAULT 'upload',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

UPDATE public.documents
SET
  category = COALESCE(category, 'examples'),
  subcategory = COALESCE(subcategory, 'other'),
  status = COALESCE(
    status,
    CASE
      WHEN COALESCE(metadata->>'analysisStatus', '') = 'completed' THEN 'review'
      WHEN COALESCE(metadata->>'analysisStatus', '') = 'processing' THEN 'processing'
      WHEN COALESCE(metadata->>'analysisStatus', '') = 'failed' THEN 'failed'
      ELSE 'draft'
    END
  ),
  source_kind = COALESCE(source_kind, 'upload'),
  metadata = COALESCE(metadata, '{}'::jsonb);

ALTER TABLE public.documents
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN subcategory SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN source_kind SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_status_check'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_status_check
      CHECK (status IN ('draft', 'processing', 'review', 'approved', 'failed', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_source_kind_check'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_source_kind_check
      CHECK (source_kind IN ('upload', 'manual'));
  END IF;
END $$;

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

DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents
  FOR SELECT TO authenticated USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS documents_insert ON public.documents;
CREATE POLICY documents_insert ON public.documents
  FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id));

DROP POLICY IF EXISTS documents_update ON public.documents;
CREATE POLICY documents_update ON public.documents
  FOR UPDATE TO authenticated
  USING (
    public.can_access_project(project_id)
    AND (
      status IN ('draft', 'processing', 'review', 'failed')
      OR public.can_approve_project_knowledge(project_id)
    )
  )
  WITH CHECK (
    public.can_access_project(project_id)
    AND (
      public.can_approve_project_knowledge(project_id)
      OR (
        status IN ('draft', 'processing', 'review', 'failed')
        AND approved_at IS NULL
        AND approved_by IS NULL
      )
    )
  );

DROP POLICY IF EXISTS documents_delete ON public.documents;
CREATE POLICY documents_delete ON public.documents
  FOR DELETE TO authenticated USING (public.can_approve_project_knowledge(project_id));

COMMIT;
