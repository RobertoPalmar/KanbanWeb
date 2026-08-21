-- =============================================================================
-- MVP 1 · Transiciones de estado + activity log
--
-- La validación de secuencia vive AQUÍ, no en el frontend. El kanban y el
-- formulario también validan, pero solo para dar feedback previo: esta capa es
-- la única que ningún camino de código puede saltarse.
--
-- Regla universal: ±1 posición en el orden. Ningún rol salta estados, incluido
-- el admin — el admin decide QUÉ tickets mueve (todos), no CÓMO se mueven.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers de identidad y rol
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER para que las políticas RLS sobre `users` no recursen al
-- consultar el rol del usuario actual.
create or replace function current_role_of()
returns user_role
language sql
stable
security definer
set search_path = public
as $fn$
  select role from users where id = auth.uid();
$fn$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce((select role = 'admin' from users where id = auth.uid()), false);
$fn$;

-- viewer no escribe nada. member y admin sí.
create or replace function can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select role in ('member', 'admin') from users where id = auth.uid()),
    false
  );
$fn$;

-- -----------------------------------------------------------------------------
-- Tabla de transiciones permitidas
--
-- Espejo de lib/transitions.ts. Es tabla y no función CASE por una razón:
-- cambiar una regla (p. ej. permitir que el owner reabra) es un UPDATE de una
-- fila, sin migración de código ni redeploy.
--
--   draft(1) -> todo(2) -> in_progress(3) -> in_review(4) -> done(5)
--                              |
--                         cancelled(6)  <- terminal, alcanzable lateralmente
--
-- Dos excepciones mecánicas a la secuencia:
--   1. Cancelar es lateral, no secuencial: alcanzable desde draft, todo,
--      in_progress e in_review. NO desde done — cancelar algo ya terminado
--      corrompería el throughput histórico.
--   2. cancelled es terminal. Sin reactivación en MVP 1: si el trabajo revive,
--      se crea un ticket nuevo. Mantiene limpio el cálculo de tiempos.
-- -----------------------------------------------------------------------------

create table state_transitions (
  from_state       issue_state not null,
  to_state         issue_state not null,
  admin_only       boolean not null default false,
  requires_comment boolean not null default false,
  note             text,
  primary key (from_state, to_state),
  constraint no_self_transition check (from_state <> to_state)
);

insert into state_transitions (from_state, to_state, admin_only, requires_comment, note) values
  ('draft',       'todo',        true,  false, 'Aprobación del borrador'),
  ('todo',        'in_progress', false, false, 'Arranca cycle time'),
  ('in_progress', 'todo',        false, false, 'Retroceso: se soltó el trabajo'),
  ('in_progress', 'in_review',   false, false, null),
  ('in_review',   'in_progress', false, false, 'Devolución por correcciones'),
  ('in_review',   'done',        false, false, null),
  ('done',        'in_review',   true,  false, 'Reapertura — solo admin, para que el throughput no sea un número móvil'),
  ('draft',       'cancelled',   false, true,  'Rechazo del borrador'),
  ('todo',        'cancelled',   false, true,  null),
  ('in_progress', 'cancelled',   false, true,  null),
  ('in_review',   'cancelled',   false, true,  null);

-- Nota sobre `done -> in_review` (admin_only = true): si preferís que el owner
-- también pueda reabrir, es un UPDATE:
--   update state_transitions set admin_only = false
--    where from_state = 'done' and to_state = 'in_review';
-- Solo que las métricas dejan de ser estables — el throughput semanal empieza
-- a cambiar hacia atrás.

-- -----------------------------------------------------------------------------
-- can_transition
-- Espejo exacto de lib/transitions.ts · canTransition().
-- -----------------------------------------------------------------------------

create or replace function can_transition(
  p_from     issue_state,
  p_to       issue_state,
  p_is_admin boolean
)
returns boolean
language sql
stable
as $fn$
  select exists (
    select 1 from state_transitions t
     where t.from_state = p_from
       and t.to_state   = p_to
       and (not t.admin_only or p_is_admin)
  );
$fn$;

-- -----------------------------------------------------------------------------
-- Bandera de sesión para el import
--
-- Los tickets importados con estado avanzado no tienen historia de
-- transiciones. Se importan con su estado tal cual, SALTÁNDOSE la validación
-- de secuencia, y registran un evento `imported` en lugar de una cadena de
-- transiciones falsas.
--
-- El import setea `set local app.importing = 'on'` dentro de su transacción.
-- Solo el service role puede hacerlo (el anon key no llega a SET).
-- -----------------------------------------------------------------------------

create or replace function is_importing()
returns boolean
language sql
stable
as $fn$
  select coalesce(current_setting('app.importing', true), 'off') = 'on';
$fn$;

-- -----------------------------------------------------------------------------
-- Trigger de validación de transiciones
-- -----------------------------------------------------------------------------

create or replace function enforce_state_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_is_admin boolean;
begin
  if new.state = old.state then
    return new;
  end if;

  -- El import se salta la secuencia por diseño (ver is_importing()).
  if is_importing() then
    return new;
  end if;

  v_is_admin := is_admin();

  if not can_transition(old.state, new.state, v_is_admin) then
    if exists (
      select 1 from state_transitions
       where from_state = old.state and to_state = new.state and admin_only
    ) then
      raise exception
        'Transición % -> % está reservada a admin'
        using errcode = '42501', detail = format('%s -> %s', old.state, new.state);
    else
      raise exception
        'Transición inválida: % -> %. Solo se permite avanzar o retroceder una posición, o cancelar.'
        using errcode = '23514', detail = format('%s -> %s', old.state, new.state);
    end if;
  end if;

  return new;
end;
$fn$;

create trigger issues_enforce_transition
  before update of state on issues
  for each row
  execute function enforce_state_transition();

-- -----------------------------------------------------------------------------
-- Comentario obligatorio en cancelación
--
-- Se valida como CONSTRAINT TRIGGER diferido: el cliente hace INSERT del
-- comentario y UPDATE del estado en la misma transacción, en cualquier orden,
-- y la comprobación corre al COMMIT.
-- -----------------------------------------------------------------------------

create or replace function enforce_transition_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.state = old.state or is_importing() then
    return new;
  end if;

  if not exists (
    select 1 from state_transitions
     where from_state = old.state
       and to_state   = new.state
       and requires_comment
  ) then
    return new;
  end if;

  -- Un comentario creado en esta misma transacción cuenta: el reloj de la
  -- transacción (now()) es idéntico para el INSERT y para esta comprobación.
  if not exists (
    select 1 from comments
     where issue_id = new.id
       and created_at >= now()
  ) then
    raise exception
      'La transición % -> % exige un comentario que explique el motivo'
      using errcode = '23514';
  end if;

  return new;
end;
$fn$;

create constraint trigger issues_enforce_transition_comment
  after update of state on issues
  deferrable initially deferred
  for each row
  execute function enforce_transition_comment();

-- -----------------------------------------------------------------------------
-- Activity log · escritura automática
--
-- Toda modificación de estado, owner, peso, tipo, prioridad o fecha escribe una
-- fila. Está en el trigger y no en la capa de aplicación para que ningún camino
-- de código pueda omitirla — incluido el import y cualquier script manual.
--
-- Para field = 'state', los valores guardan CLAVES de estado, no etiquetas.
-- -----------------------------------------------------------------------------

create or replace function log_issue_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    -- El import registra `imported` en lugar de una cadena de transiciones
    -- falsas. Su started_at queda nulo y se excluye del cycle time.
    if new.imported then
      insert into issue_activity (issue_id, actor_id, field, old_value, new_value)
      values (new.id, coalesce(v_actor, new.created_by), 'imported', null, new.state::text);
    else
      insert into issue_activity (issue_id, actor_id, field, old_value, new_value)
      values (new.id, coalesce(v_actor, new.created_by), 'created', null, new.state::text);
    end if;
    return new;
  end if;

  if new.state is distinct from old.state then
    insert into issue_activity (issue_id, actor_id, field, old_value, new_value)
    values (new.id, v_actor, 'state', old.state::text, new.state::text);
  end if;

  if new.owner_id is distinct from old.owner_id then
    insert into issue_activity (issue_id, actor_id, field, old_value, new_value)
    values (new.id, v_actor, 'owner_id', old.owner_id::text, new.owner_id::text);
  end if;

  if new.weight is distinct from old.weight then
    insert into issue_activity (issue_id, actor_id, field, old_value, new_value)
    values (new.id, v_actor, 'weight', old.weight::text, new.weight::text);
  end if;

  if new.type_id is distinct from old.type_id then
    insert into issue_activity (issue_id, actor_id, field, old_value, new_value)
    values (new.id, v_actor, 'type_id', old.type_id::text, new.type_id::text);
  end if;

  if new.priority_id is distinct from old.priority_id then
    insert into issue_activity (issue_id, actor_id, field, old_value, new_value)
    values (new.id, v_actor, 'priority_id', old.priority_id::text, new.priority_id::text);
  end if;

  if new.due_date is distinct from old.due_date then
    insert into issue_activity (issue_id, actor_id, field, old_value, new_value)
    values (new.id, v_actor, 'due_date', old.due_date::text, new.due_date::text);
  end if;

  if new.title is distinct from old.title then
    insert into issue_activity (issue_id, actor_id, field, old_value, new_value)
    values (new.id, v_actor, 'title', old.title, new.title);
  end if;

  return new;
end;
$fn$;

create trigger issues_log_activity
  after insert or update on issues
  for each row
  execute function log_issue_activity();

-- -----------------------------------------------------------------------------
-- Estado inicial según quién crea (sección 4)
--
--   Member -> sí mismo     => todo
--   Member -> otra persona => draft   (control de asignación)
--   Admin  -> cualquiera   => todo
--
-- Se fuerza en el trigger: si el cliente manda otro estado, se corrige. Así el
-- flujo de aprobación no depende de que el frontend calcule bien.
-- -----------------------------------------------------------------------------

create or replace function set_initial_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- El import trae su propio estado y se respeta tal cual.
  if new.imported or is_importing() then
    return new;
  end if;

  if is_admin() or new.owner_id = new.created_by then
    new.state := 'todo';
  else
    new.state := 'draft';
  end if;

  return new;
end;
$fn$;

create trigger issues_set_initial_state
  before insert on issues
  for each row
  execute function set_initial_state();

-- -----------------------------------------------------------------------------
-- Activity log append-only a nivel de tabla
--
-- Las políticas RLS ya niegan UPDATE/DELETE al cliente, pero estos triggers
-- cubren también al service role: la historia no se reescribe ni por error de
-- un script de mantenimiento.
-- -----------------------------------------------------------------------------

create or replace function reject_mutation()
returns trigger
language plpgsql
as $fn$
begin
  raise exception 'issue_activity es append-only: % no está permitido', tg_op
    using errcode = '42501';
end;
$fn$;

create trigger issue_activity_no_update
  before update on issue_activity
  for each statement
  execute function reject_mutation();

create trigger issue_activity_no_delete
  before delete on issue_activity
  for each statement
  execute function reject_mutation();
