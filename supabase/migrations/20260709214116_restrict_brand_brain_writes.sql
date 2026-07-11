drop policy if exists analysis_results_insert on public.analysis_results;
create policy analysis_results_insert on public.analysis_results
  for insert to authenticated with check (can_approve_project_knowledge(project_id));

drop policy if exists analysis_results_update on public.analysis_results;
create policy analysis_results_update on public.analysis_results
  for update to authenticated
  using (can_approve_project_knowledge(project_id))
  with check (can_approve_project_knowledge(project_id));

drop policy if exists analysis_results_delete on public.analysis_results;
create policy analysis_results_delete on public.analysis_results
  for delete to authenticated using (can_approve_project_knowledge(project_id));

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents
  for insert to authenticated with check (can_approve_project_knowledge(project_id));

drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents
  for update to authenticated
  using (can_approve_project_knowledge(project_id))
  with check (can_approve_project_knowledge(project_id));

notify pgrst, 'reload schema';
