drop policy if exists projects_select on public.projects;

create policy projects_select on public.projects
  for select to authenticated using (
    created_by = auth.uid()
    or is_admin_user()
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = id
        and pm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_assignments pa
      where pa.project_id = id
        and pa.user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
