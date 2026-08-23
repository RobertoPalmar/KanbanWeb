-- =============================================================================
-- Bucket de fotos de perfil
--
-- Público a diferencia de `attachments`: una foto de perfil se muestra en cada
-- fila de la tabla y firmar una URL por avatar y por render sería absurdo. No
-- hay nada sensible en la imagen.
--
-- La escritura sí está acotada: cada quien solo escribe dentro de la carpeta que
-- lleva su propio uid.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 2 * 1024 * 1024,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

drop policy if exists avatars_select on storage.objects;
create policy avatars_select on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert_self on storage.objects;
create policy avatars_insert_self on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update_self on storage.objects;
create policy avatars_update_self on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete_self on storage.objects;
create policy avatars_delete_self on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
