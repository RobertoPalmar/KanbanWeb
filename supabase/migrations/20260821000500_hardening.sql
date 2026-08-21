-- =============================================================================
-- MVP 1 · Correcciones encontradas al probar contra la base real
--
-- Las cuatro migraciones anteriores pasaron el linter pero fallaron pruebas de
-- comportamiento. Este archivo recoge los arreglos. Cada bloque documenta el
-- fallo concreto que lo motivó.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. El guardia append-only bloqueaba la integridad referencial
--
-- FALLO: borrar un usuario devolvía
--   "issue_activity es append-only: UPDATE no está permitido"
-- El trigger a nivel de statement rechazaba también las acciones que Postgres
-- ejecuta internamente:
--   · actor_id ON DELETE SET NULL -> UPDATE interno al borrar un usuario
--   · issue_id ON DELETE CASCADE  -> DELETE interno al borrar un ticket
-- Ningún usuario podía borrarse jamás.
--
-- La intención es impedir que se REESCRIBA la historia, no impedir que las FK
-- hagan su trabajo. Se pasa a triggers por fila que reconocen esos dos casos.
-- -----------------------------------------------------------------------------

drop trigger if exists issue_activity_no_update on issue_activity;
drop trigger if exists issue_activity_no_delete on issue_activity;

-- Solo se acepta el UPDATE cuya firma es exactamente la del ON DELETE SET NULL:
-- actor_id pasando a NULL y nada más cambiando.
create or replace function reject_activity_update()
returns trigger language plpgsql
set search_path = public, pg_temp as $fn$
begin
  if new.actor_id is null
     and old.actor_id is not null
     and new.id         = old.id
     and new.issue_id   = old.issue_id
     and new.field      = old.field
     and new.old_value  is not distinct from old.old_value
     and new.new_value  is not distinct from old.new_value
     and new.created_at = old.created_at
  then
    return new;
  end if;

  raise exception 'issue_activity es append-only: la historia no se reescribe'
    using errcode = '42501';
end;
$fn$;

create trigger issue_activity_no_update
  before update on issue_activity
  for each row execute function reject_activity_update();

-- Solo se acepta el DELETE cuando el ticket dueño ya no existe: la firma del
-- ON DELETE CASCADE. Borrar eventos de un ticket vivo sigue prohibido.
create or replace function reject_activity_delete()
returns trigger language plpgsql
set search_path = public, pg_temp as $fn$
begin
  if not exists (select 1 from issues where id = old.issue_id) then
    return old;
  end if;

  raise exception 'issue_activity es append-only: no se pueden borrar eventos de un ticket existente'
    using errcode = '42501';
end;
$fn$;

create trigger issue_activity_no_delete
  before delete on issue_activity
  for each row execute function reject_activity_delete();

-- -----------------------------------------------------------------------------
-- 2. guard_role_change bloqueaba también al service role
--
-- FALLO: asignar un rol con la service key devolvía
--   "Solo un admin puede cambiar roles"
-- is_admin() consulta auth.uid(), que es NULL en una conexión con service key,
-- así que devolvía false. No había forma de asignar roles desde el backend: ni
-- el bootstrap inicial, ni una Edge Function de invitaciones, ni un script de
-- mantenimiento. Todo dependía de un admin que todavía no existía.
--
-- Se agrega además la protección del último admin.
-- -----------------------------------------------------------------------------

create or replace function guard_role_change()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $fn$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- Sin sesión de usuario: service role o migración.
  if auth.uid() is null then
    return new;
  end if;

  if not is_admin() then
    raise exception 'Solo un admin puede cambiar roles' using errcode = '42501';
  end if;

  -- Si el último admin se degrada, el workspace queda sin nadie que apruebe
  -- borradores ni asigne roles.
  if old.id = auth.uid() and old.role = 'admin' and new.role <> 'admin'
     and (select count(*) from users where role = 'admin') <= 1 then
    raise exception 'No podés quitarte el rol de admin: sos el único que queda'
      using errcode = '23514';
  end if;

  return new;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 3. Un member podía reasignar el owner de su propio ticket
--
-- FALLO: la prueba "member reasigna owner" pasaba cuando debía fallar. Un member
-- podía sacarse trabajo de encima pasándoselo a otro sin aprobación, saltándose
-- el control de asignación entero.
--
-- Causa: las políticas RLS permisivas se combinan con OR. `issues_update_owner`
-- exigía owner_id = auth.uid() en su WITH CHECK, pero `issues_update_draft_creator`
-- se satisfacía por la vía de created_by = auth.uid(). En un ticket donde el
-- member es a la vez owner y creador — el caso normal — la segunda política
-- abría el paso.
--
-- Un trigger expresa la regla una sola vez, sin depender de cómo se combinen las
-- políticas ni de que una política futura vuelva a abrir el hueco.
-- -----------------------------------------------------------------------------

create or replace function guard_owner_reassignment()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $fn$
begin
  if new.owner_id is not distinct from old.owner_id then
    return new;
  end if;

  if auth.uid() is null then       -- service role / migración
    return new;
  end if;

  if is_admin() then
    return new;
  end if;

  -- El creador de un borrador aún no aprobado puede corregir a quién se lo
  -- asigna: el ticket todavía no entró al flujo de nadie.
  if old.state = 'draft' and old.created_by = auth.uid() then
    return new;
  end if;

  raise exception 'Reasignar el responsable de un ticket es una acción de admin'
    using errcode = '42501';
end;
$fn$;

create trigger issues_guard_owner_reassignment
  before update of owner_id on issues
  for each row execute function guard_owner_reassignment();

-- -----------------------------------------------------------------------------
-- 4. search_path fijo
--
-- Sin search_path fijo, un rol puede anteponer un esquema propio y secuestrar
-- la resolución de nombres dentro del cuerpo de la función.
-- -----------------------------------------------------------------------------

alter function state_category(issue_state)            set search_path = public, pg_temp;
alter function state_order(issue_state)               set search_path = public, pg_temp;
alter function counts_in_wip(issue_state)             set search_path = public, pg_temp;
alter function touch_updated_at()                     set search_path = public, pg_temp;
alter function can_transition(issue_state, issue_state, boolean) set search_path = public, pg_temp;
alter function is_importing()                         set search_path = public, pg_temp;
alter function reject_mutation()                      set search_path = public, pg_temp;
alter function cycle_time_p85(timestamptz, timestamptz, uuid) set search_path = public, pg_temp;
alter function stale_issues(int)                      set search_path = public, pg_temp;
alter function monthly_summary(timestamptz, timestamptz)      set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 5. Exposición de funciones en la API REST
--
-- Postgres concede EXECUTE a PUBLIC en toda función nueva, y anon/authenticated
-- lo heredan: cada función quedaba publicada como endpoint /rest/v1/rpc/...
-- Revocar directamente a esos roles no surte efecto mientras el grant de PUBLIC
-- siga en pie — hay que revocar de PUBLIC y conceder explícitamente.
-- -----------------------------------------------------------------------------

-- Funciones de trigger: las ejecuta Postgres. Nadie más debe poder llamarlas.
revoke execute on function log_issue_activity()         from public, anon, authenticated;
revoke execute on function set_initial_state()          from public, anon, authenticated;
revoke execute on function enforce_state_transition()   from public, anon, authenticated;
revoke execute on function enforce_transition_comment() from public, anon, authenticated;
revoke execute on function guard_role_change()          from public, anon, authenticated;
revoke execute on function guard_owner_reassignment()   from public, anon, authenticated;
revoke execute on function handle_new_auth_user()       from public, anon, authenticated;
revoke execute on function reject_mutation()            from public, anon, authenticated;
revoke execute on function reject_activity_update()     from public, anon, authenticated;
revoke execute on function reject_activity_delete()     from public, anon, authenticated;

-- Helpers de rol: SECURITY DEFINER para que las políticas RLS no recursen sobre
-- `users`. Se conceden a authenticated porque la UI necesita el rol propio para
-- ocultar acciones no permitidas; solo leen auth.uid(), nunca un id ajeno.
revoke execute on function is_admin()        from public, anon;
revoke execute on function can_write()       from public, anon;
revoke execute on function current_role_of() from public, anon;
grant  execute on function is_admin()        to authenticated;
grant  execute on function can_write()       to authenticated;
grant  execute on function current_role_of() to authenticated;

-- Funciones puras y de métricas: sin acceso anónimo.
revoke execute on function state_category(issue_state)  from public, anon;
revoke execute on function state_order(issue_state)     from public, anon;
revoke execute on function counts_in_wip(issue_state)   from public, anon;
revoke execute on function is_importing()               from public, anon;
revoke execute on function can_transition(issue_state, issue_state, boolean) from public, anon;
revoke execute on function cycle_time_p85(timestamptz, timestamptz, uuid)    from public, anon;
revoke execute on function stale_issues(int)                                 from public, anon;
revoke execute on function monthly_summary(timestamptz, timestamptz)         from public, anon;

grant execute on function state_category(issue_state) to authenticated;
grant execute on function state_order(issue_state)    to authenticated;
grant execute on function counts_in_wip(issue_state)  to authenticated;
grant execute on function can_transition(issue_state, issue_state, boolean) to authenticated;
grant execute on function cycle_time_p85(timestamptz, timestamptz, uuid)    to authenticated;
grant execute on function stale_issues(int)                                 to authenticated;
grant execute on function monthly_summary(timestamptz, timestamptz)         to authenticated;

-- La app entera exige sesión: el rol anónimo no toca ninguna tabla.
revoke all on all tables in schema public from anon;
