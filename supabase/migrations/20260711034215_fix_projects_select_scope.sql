drop policy if exists projects_select on public.projects;

create policy projects_select on public.projects
  for select to authenticated using (can_access_project(id));

notify pgrst, 'reload schema';
