drop policy if exists project_images_insert on storage.objects;
create policy project_images_insert
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-images'
    and exists (
      select 1
      from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and public.can_access_project(p.id)
    )
  );

drop policy if exists project_images_delete on storage.objects;
create policy project_images_delete
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-images'
    and exists (
      select 1
      from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and public.can_access_project(p.id)
    )
  );
