-- =============================================================================
-- MVP 1 · Storage para adjuntos
--
-- Bucket privado: los adjuntos de trabajo interno no deben ser accesibles por
-- URL pública. El front pide una signed URL cuando necesita mostrarlos.
--
-- Límite duro de 25 MB, declarado en tres lugares:
--   1. file_size_limit del bucket        (lo aplica el servicio de Storage)
--   2. constraint attachments_size_limit (lo aplica Postgres)
--   3. MAX_ATTACHMENT_BYTES              (feedback inmediato en el cliente)
--
-- Convención de rutas: {issue_id}/{uuid}-{nombre}
-- El primer segmento es el issue_id, que permite a las políticas resolver el
-- permiso sin consultar la tabla attachments.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do update
  set public = false, file_size_limit = 26214400;

-- Ver: cualquier usuario autenticado, igual que los tickets.
create policy "attachments_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments');

-- Subir: member y admin. El viewer no sube nada.
create policy "attachments_upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and can_write());

-- Borrar: quien lo subió, el owner del ticket, o un admin.
create policy "attachments_remove"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (
      owner = (select auth.uid())
      or is_admin()
      or exists (
        select 1 from issues i
         where i.id::text = split_part(name, '/', 1)
           and i.owner_id = (select auth.uid())
      )
    )
  );
