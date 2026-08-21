-- =============================================================================
-- MVP 1 · Rendimiento de RLS
--
-- Envolver auth.uid() en (select ...) hace que Postgres lo evalúe UNA vez por
-- query en lugar de una vez por fila. Sin esto, cada listado de la tabla o del
-- kanban paga una llamada por ticket; con unos miles de tickets se nota.
-- La semántica de las políticas no cambia.
-- =============================================================================

drop policy issues_insert               on issues;
drop policy issues_update_owner         on issues;
drop policy issues_update_draft_creator on issues;

create policy issues_insert on issues for insert to authenticated
  with check (can_write() and created_by = (select auth.uid()));

create policy issues_update_owner on issues for update to authenticated
  using (owner_id = (select auth.uid()) and can_write())
  with check (owner_id = (select auth.uid()));

create policy issues_update_draft_creator on issues for update to authenticated
  using (state = 'draft' and created_by = (select auth.uid()) and can_write())
  with check (created_by = (select auth.uid()));

drop policy users_update_self on users;
create policy users_update_self on users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy comments_insert     on comments;
drop policy comments_update_own on comments;
drop policy comments_delete_own on comments;

create policy comments_insert on comments for insert to authenticated
  with check (can_write() and author_id = (select auth.uid()));

create policy comments_update_own on comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

create policy comments_delete_own on comments for delete to authenticated
  using (author_id = (select auth.uid()) or is_admin());

drop policy attachments_insert on attachments;
drop policy attachments_delete on attachments;

create policy attachments_insert on attachments for insert to authenticated
  with check (can_write() and uploaded_by = (select auth.uid()));

create policy attachments_delete on attachments for delete to authenticated
  using (uploaded_by = (select auth.uid()) or is_admin()
         or exists (select 1 from issues i where i.id = issue_id and i.owner_id = (select auth.uid())));

drop policy saved_views_own on saved_views;
create policy saved_views_own on saved_views for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy issue_supporters_write on issue_supporters;
create policy issue_supporters_write on issue_supporters for all to authenticated
  using (can_write() and (is_admin() or exists (
    select 1 from issues i where i.id = issue_id and i.owner_id = (select auth.uid()))))
  with check (can_write() and (is_admin() or exists (
    select 1 from issues i where i.id = issue_id and i.owner_id = (select auth.uid()))));

drop policy issue_labels_write on issue_labels;
create policy issue_labels_write on issue_labels for all to authenticated
  using (can_write() and (is_admin() or exists (
    select 1 from issues i where i.id = issue_id
      and (i.owner_id = (select auth.uid())
           or (i.state = 'draft' and i.created_by = (select auth.uid()))))))
  with check (can_write() and (is_admin() or exists (
    select 1 from issues i where i.id = issue_id
      and (i.owner_id = (select auth.uid())
           or (i.state = 'draft' and i.created_by = (select auth.uid()))))));

-- Índices de FK faltantes: sin ellos, borrar un usuario o una prioridad hace un
-- seq scan sobre la tabla referenciante.
create index if not exists issues_created_by_idx       on issues(created_by);
create index if not exists issues_priority_idx         on issues(priority_id) where priority_id is not null;
create index if not exists comments_author_idx         on comments(author_id);
create index if not exists attachments_uploaded_by_idx on attachments(uploaded_by);
