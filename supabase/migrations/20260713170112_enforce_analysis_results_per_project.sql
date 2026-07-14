do $$
begin
  if exists (
    select 1
    from public.analysis_results
    group by project_id
    having count(*) > 1
  ) then
    raise exception 'analysis_results contiene más de una fila por proyecto; requiere consolidación manual antes de imponer unicidad';
  end if;
end;
$$;

alter table public.analysis_results
  add constraint analysis_results_project_id_key unique (project_id);
