-- =============================================================================
-- MVP 1 · Políticas RLS
--
-- Alcance y secuencia son dos reglas independientes:
--   · Estas políticas definen SOBRE QUÉ TICKETS actúa cada rol.
--   · El trigger de la migración anterior define CÓMO se mueve cualquier ticket.
-- El admin tiene alcance total, no exención de secuencia.
--
-- Matriz de permisos (sección 3):
--                                          viewer  member  admin
--   Ver todos los tickets                     ✓       ✓       ✓
--   Crear ticket para sí mismo                ✗       ✓       ✓
--   Crear ticket para otro                    ✗       ✓       ✓   (member -> draft)
--   Editar / mover ticket donde es owner      ✗       ✓       ✓
--   Comentar y adjuntar en cualquier ticket   ✗       ✓       ✓
--   Editar / mover ticket de otro             ✗       ✗       ✓
--   Reasignar owner                           ✗       ✗       ✓
--   Aprobar borradores                        ✗       ✗       ✓
--   Configuración                             ✗       ✗       ✓
-- =============================================================================

alter table users             enable row level security;
alter table issue_types       enable row level security;
alter table labels            enable row level security;
alter table priorities        enable row level security;
alter table settings          enable row level security;
alter table issues            enable row level security;
alter table issue_supporters  enable row level security;
alter table issue_labels      enable row level security;
alter table issue_activity    enable row level security;
alter table comments          enable row level security;
alter table attachments       enable row level security;
alter table saved_views       enable row level security;
alter table state_transitions enable row level security;

-- -----------------------------------------------------------------------------
-- users
-- Todos ven a todos (necesario para la sección Miembros y los selectores de
-- owner). Solo el admin cambia roles.
-- -----------------------------------------------------------------------------

create policy users_select on users
  for select to authenticated
  using (true);

-- El propio usuario edita su perfil; el trigger de abajo le impide cambiarse
-- el rol a sí mismo.
create policy users_update_self on users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy users_admin_all on users
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- Escalada de privilegios: sin esto, users_update_self permitiría que
-- cualquiera se hiciera admin.
create or replace function guard_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Solo un admin puede cambiar roles'
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;

create trigger users_guard_role
  before update of role on users
  for each row
  execute function guard_role_change();

-- -----------------------------------------------------------------------------
-- Catálogos: lectura para todos, escritura solo admin (Configuración)
-- -----------------------------------------------------------------------------

create policy issue_types_select on issue_types
  for select to authenticated using (true);

create policy issue_types_admin on issue_types
  for all to authenticated using (is_admin()) with check (is_admin());

create policy labels_select on labels
  for select to authenticated using (true);

create policy labels_admin on labels
  for all to authenticated using (is_admin()) with check (is_admin());

create policy priorities_select on priorities
  for select to authenticated using (true);

create policy priorities_admin on priorities
  for all to authenticated using (is_admin()) with check (is_admin());

create policy settings_select on settings
  for select to authenticated using (true);

create policy settings_admin on settings
  for all to authenticated using (is_admin()) with check (is_admin());

-- Solo lectura para todos: la tabla se edita por migración, no por la app.
create policy state_transitions_select on state_transitions
  for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- issues
-- -----------------------------------------------------------------------------

-- Visibilidad total del trabajo del departamento, borradores incluidos: el
-- documento los pide en la columna Borrador del kanban y en el filtro de tabla.
create policy issues_select on issues
  for select to authenticated
  using (true);

-- Crear: member y admin. created_by tiene que ser uno mismo — sin esto se
-- podría falsificar la autoría y, con ella, el estado inicial del ticket.
-- El trigger set_initial_state decide draft vs todo.
create policy issues_insert on issues
  for insert to authenticated
  with check (can_write() and created_by = auth.uid());

-- Editar / mover: el owner sobre lo suyo. Un member no puede reasignar el
-- owner ni deshacerse de un ticket pasándoselo a otro.
create policy issues_update_owner on issues
  for update to authenticated
  using (owner_id = auth.uid() and can_write())
  with check (owner_id = auth.uid());

-- El creador edita libremente su borrador hasta la aprobación. Después queda
-- como cualquier otro: solo owner y admin tocan el ticket.
create policy issues_update_draft_creator on issues
  for update to authenticated
  using (state = 'draft' and created_by = auth.uid() and can_write())
  with check (created_by = auth.uid());

create policy issues_admin_all on issues
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- Nadie borra tickets: cancelar es la salida. Un DELETE se llevaría el activity
-- log del ticket por cascade y agujerearía los reportes históricos.
-- (Se implementa por omisión: no hay política FOR DELETE salvo la de admin.)

-- -----------------------------------------------------------------------------
-- issue_supporters
-- Los apoyos los gestiona el owner del ticket o el admin.
-- -----------------------------------------------------------------------------

create policy issue_supporters_select on issue_supporters
  for select to authenticated using (true);

create policy issue_supporters_write on issue_supporters
  for all to authenticated
  using (
    can_write() and (
      is_admin()
      or exists (select 1 from issues i where i.id = issue_id and i.owner_id = auth.uid())
    )
  )
  with check (
    can_write() and (
      is_admin()
      or exists (select 1 from issues i where i.id = issue_id and i.owner_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- issue_labels
-- -----------------------------------------------------------------------------

create policy issue_labels_select on issue_labels
  for select to authenticated using (true);

create policy issue_labels_write on issue_labels
  for all to authenticated
  using (
    can_write() and (
      is_admin()
      or exists (
        select 1 from issues i
         where i.id = issue_id
           and (i.owner_id = auth.uid()
                or (i.state = 'draft' and i.created_by = auth.uid()))
      )
    )
  )
  with check (
    can_write() and (
      is_admin()
      or exists (
        select 1 from issues i
         where i.id = issue_id
           and (i.owner_id = auth.uid()
                or (i.state = 'draft' and i.created_by = auth.uid()))
      )
    )
  );

-- -----------------------------------------------------------------------------
-- issue_activity · append-only
--
-- Sin política de INSERT para el cliente: las filas las escribe únicamente el
-- trigger log_issue_activity (SECURITY DEFINER, que no pasa por RLS).
-- Sin política de UPDATE ni DELETE: la historia no se reescribe.
-- -----------------------------------------------------------------------------

create policy issue_activity_select on issue_activity
  for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- comments · cualquiera con permiso de escritura comenta en cualquier ticket
-- (así los apoyos participan sin poder mover el ticket).
-- -----------------------------------------------------------------------------

create policy comments_select on comments
  for select to authenticated using (true);

create policy comments_insert on comments
  for insert to authenticated
  with check (can_write() and author_id = auth.uid());

-- Solo el autor edita su propio comentario.
create policy comments_update_own on comments
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy comments_delete_own on comments
  for delete to authenticated
  using (author_id = auth.uid() or is_admin());

-- -----------------------------------------------------------------------------
-- attachments
-- -----------------------------------------------------------------------------

create policy attachments_select on attachments
  for select to authenticated using (true);

create policy attachments_insert on attachments
  for insert to authenticated
  with check (can_write() and uploaded_by = auth.uid());

create policy attachments_delete on attachments
  for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or is_admin()
    or exists (select 1 from issues i where i.id = issue_id and i.owner_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- saved_views · privadas de cada usuario
-- -----------------------------------------------------------------------------

create policy saved_views_own on saved_views
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Alta de usuarios
--
-- Espeja auth.users -> users. El primer usuario del workspace queda admin: sin
-- esto no habría nadie que pudiera aprobar borradores ni asignar roles.
-- -----------------------------------------------------------------------------

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_role user_role;
begin
  if not exists (select 1 from users) then
    v_role := 'admin';
  else
    v_role := coalesce(
      (new.raw_user_meta_data ->> 'role')::user_role,
      'member'
    );
  end if;

  insert into users (id, name, email, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url',
    v_role
  )
  on conflict (id) do nothing;

  return new;
end;
$fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_auth_user();
