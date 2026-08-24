-- =============================================================================
-- Borrado de tickets · SOFT-DELETE
--
-- POR QUÉ SE CAMBIA. 20260824000300 dejó escrita la deuda: un DELETE real se
-- lleva por cascade el `issue_activity` del ticket, y ese log es la FUENTE de
-- `issue_timings`, `issue_cycle_times`, `weekly_cycle_time` y `aging_wip`.
-- Borrar un ticket ya cerrado no lo saca del tablero: le saca su cycle time al
-- histórico y cambia series de semanas que ya se habían reportado. Un reporte
-- de marzo no puede cambiar en agosto porque alguien limpió un duplicado.
--
-- Con soft-delete el ticket desaparece de todo lo que se mira en presente
-- —tablero, calendario, bandeja de borradores, WIP, aging— y su historia sigue
-- contando en lo que ya pasó. Y es recuperable: el borrado deja de ser una
-- decisión irreversible tomada en un mini modal.
-- =============================================================================

alter table issues add column if not exists deleted_at timestamptz;

comment on column issues.deleted_at is
  'Soft-delete. Nulo = ticket vivo. Con valor, el ticket no se muestra en '
  'ninguna vista de presente (listados, kanban, calendario, bandeja de '
  'borradores, WIP, aging) pero conserva su issue_activity, y por lo tanto su '
  'cycle time sigue contando en las series históricas ya reportadas. No se '
  'hace DELETE de issues: el activity log cascadearía y agujerearía los '
  'reportes. Lo fija solo un admin — ver guard_soft_delete().';

-- -----------------------------------------------------------------------------
-- Índice
--
-- CRITERIO: con ~17 tickets no hay índice que le gane a un seq scan, y este de
-- hecho no se va a usar hasta bien pasados los miles de filas. Se crea igual, y
-- parcial, por dos razones que no dependen del volumen de hoy:
--
--   1. `where deleted_at is null` es el predicado de CASI TODA consulta de la
--      app a partir de esta migración. Un índice parcial sobre esa condición
--      indexa solo los tickets vivos, que son el 100% menos un puñado: cuesta
--      casi nada de disco y no hay que mantener entradas de los borrados.
--   2. Es el índice correcto para el día que importe, y ponerlo ahora evita
--      tener que diagnosticar una tabla lenta más adelante.
--
-- UMBRAL para volver a mirar esto: si `issues` pasa de ~50k filas, o si la
-- proporción de borrados sube de ~5%, conviene medir con EXPLAIN ANALYZE los
-- listados del kanban y considerar índices compuestos parciales
-- (p.ej. `(state) where deleted_at is null`) en lugar de este suelto.
-- -----------------------------------------------------------------------------

create index if not exists issues_vivos_idx on issues (id) where deleted_at is null;

-- -----------------------------------------------------------------------------
-- ESCALADA DE PERMISOS · el agujero que abre el soft-delete
--
-- EL PROBLEMA. Borrar pasa de ser un DELETE a ser un UPDATE de `deleted_at`. Y
-- sobre UPDATE hay políticas permisivas que NO son de admin:
--
--   issues_update_owner         → owner_id = auth.uid() and can_write()
--   issues_update_draft_creator → state = 'draft' and created_by = auth.uid()
--
-- Las políticas permisivas se combinan con OR. Así que cualquier member podría
-- hacer `update issues set deleted_at = now() where owner_id = <yo>` y borrarse
-- sus propios tickets, saltándose entera la regla "solo admin borra" — que es
-- justamente la regla que protege el histórico de reportes. Es el MISMO fallo
-- que 20260821000500_hardening.sql documentó para la reasignación de owner.
--
-- POR QUÉ NO SE ARREGLA CON POLÍTICAS. Habría que meter una condición sobre
-- `deleted_at` en el WITH CHECK de cada política de UPDATE existente, y eso
-- vuelve a depender de cómo se combinan y de que nadie agregue una política
-- nueva sin acordarse. La lección de hardening fue explícita: "un trigger
-- expresa la regla una sola vez, sin depender de cómo se combinen las políticas
-- ni de que una política futura vuelva a abrir el hueco".
--
-- LA SOLUCIÓN. Un trigger `before update of deleted_at`, con la misma forma que
-- guard_owner_reassignment: solo se pronuncia si la columna cambió de verdad,
-- deja pasar al service role (auth.uid() nulo: migraciones, imports) y al
-- admin, y rechaza a cualquier otro con 42501. Cubre borrar Y restaurar: las
-- dos direcciones del cambio son de admin.
-- -----------------------------------------------------------------------------

create or replace function guard_soft_delete()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $fn$
begin
  -- `is not distinct from` y no `=`: con nulos de los dos lados `=` da nulo, y
  -- el guard se saltearía justo en el caso normal (ticket vivo que se edita).
  if new.deleted_at is not distinct from old.deleted_at then
    return new;
  end if;

  if auth.uid() is null then       -- service role / migración / import
    return new;
  end if;

  if is_admin() then
    return new;
  end if;

  raise exception 'Borrar o restaurar un ticket es una acción de admin'
    using errcode = '42501';
end;
$fn$;

create trigger issues_guard_soft_delete
  before update of deleted_at on issues
  for each row execute function guard_soft_delete();

-- La función de trigger no debe quedar publicada como endpoint
-- /rest/v1/rpc/. Postgres concede EXECUTE a PUBLIC en toda función nueva y
-- anon/authenticated lo heredan; hay que revocar de PUBLIC para que el revoke
-- surta efecto (ver hardening, punto 5).
revoke execute on function guard_soft_delete() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- La política DELETE
--
-- SE REVOCA `issues_delete_admin`. Ya no hay ninguna ruta de la app que haga
-- DELETE de un ticket, y dejarla puesta sería peor que inútil: sería una puerta
-- abierta al problema exacto que este soft-delete existe para evitar. Un admin
-- con la consola de Supabase podría, sin querer, hacer el borrado destructivo
-- del histórico creyendo que hace lo mismo que la papelera de la UI. Con la
-- política fuera, ese DELETE se deniega y purgar de verdad exige una migración
-- deliberada.
--
-- `issues_admin_all` es `for all`, y `for all` incluye DELETE, así que hay que
-- reescribirla acotada a los comandos que sí corresponden. Ese `for all` era
-- también lo que 20260824000300 señaló como el problema de fondo: el permiso
-- más destructivo del esquema leído entre líneas.
-- -----------------------------------------------------------------------------

drop policy if exists issues_delete_admin on issues;
drop policy if exists issues_admin_all    on issues;

drop policy if exists issues_admin_select on issues;
create policy issues_admin_select on issues for select to authenticated
  using (is_admin());

drop policy if exists issues_admin_insert on issues;
create policy issues_admin_insert on issues for insert to authenticated
  with check (is_admin());

drop policy if exists issues_admin_update on issues;
create policy issues_admin_update on issues for update to authenticated
  using (is_admin()) with check (is_admin());

-- Sin política FOR DELETE sobre issues: el comando se deniega para todos, admin
-- incluido. La purga real, si algún día hace falta, es una migración.

-- -----------------------------------------------------------------------------
-- LAS VISTAS DE MÉTRICAS · criterio, una por una
--
-- La regla que se aplica: si la vista responde "¿qué está pasando AHORA?", el
-- ticket borrado sale. Si responde "¿qué pasó?", el ticket borrado se queda,
-- porque el punto entero del soft-delete es que el histórico no se mueva.
--
--   issue_timings ........... NO filtra. Es la vista base por-ticket de la que
--       cuelgan casi todas las demás; si filtrara acá, arrastraría la exclusión
--       al histórico y el cambio perdería el sentido. Se le AGREGA la columna
--       `deleted_at` para que cada consumidor decida por sí mismo — y para que
--       la ficha de detalle de un ticket borrado siga pudiendo mostrar sus
--       tiempos.
--
--   issue_cycle_times ....... NO filtra. Es el histórico puro: un ticket que se
--       empezó y se cerró tardó lo que tardó, y borrarlo después no cambia eso.
--       Filtrar acá reescribiría el p85 de semanas ya reportadas, que es
--       exactamente el daño que se está evitando.
--
--   weekly_cycle_time ....... NO filtra (hereda de issue_cycle_times). Igual
--       criterio: la serie semanal es historia cerrada.
--
--   weekly_throughput ....... NO filtra. Un ticket cerrado en la semana 12 se
--       cerró en la semana 12. El throughput de una semana pasada no puede
--       cambiar porque hoy alguien limpió el tablero.
--
--   monthly_summary ......... NO filtra. Es el reporte del PDF sobre un rango
--       cerrado; mismo argumento. (No se toca en esta migración.)
--
--   issue_state_durations ... NO filtra. Es el desglose por ticket que alimenta
--       la ficha de detalle; no agrega nada entre tickets, así que no hay nada
--       que contaminar. Y si un admin mira un ticket borrado, quiere ver sus
--       tiempos.
--
--   aging_wip ............... SÍ filtra. Es la definición de vista de presente:
--       "trabajo estancado que hay que destrabar". Un ticket borrado no es
--       trabajo estancado, es trabajo que ya no existe, y mostrarlo en rojo
--       como 'critico' manda a alguien a perseguir un fantasma.
--
--   member_wip .............. SÍ filtra. El WIP de una persona es su carga
--       ACTUAL. Un ticket borrado no le ocupa capacidad a nadie, y dejarlo
--       inflaría el wip_weight con el que se decide a quién no asignarle más.
--
--   draft_inbox ............. SÍ filtra. Es la cola de "aprobá o rechazá esto".
--       Un borrador borrado no espera decisión de nadie; dejarlo ahí es una
--       tarea imposible de sacarse de la bandeja.
--
--   pending_drafts .......... SÍ filtra. Es el badge de draft_inbox: si no
--       coinciden, el contador manda al admin a una bandeja con menos filas de
--       las que anuncia.
--
--   dashboard_summary ....... MIXTO, y por eso se reescribe entera en lugar de
--       filtrar en bloque. Los números de presente (open, wip, wip_weight,
--       overdue, due_this_week, pending_drafts, stale) excluyen borrados. Los
--       de histórico (cycle_p85_days vía issue_cycle_times, closed_this_week)
--       NO: "cerrados esta semana" es un hecho consumado, y si un ticket
--       cerrado el lunes se borra el jueves, el jueves siguen habiendo sido N
--       cierres.
--
--   stale_issues(p_days) .... SÍ filtra. Mismo argumento que aging_wip: es la
--       lista de lo que hay que ir a destrabar hoy.
-- -----------------------------------------------------------------------------

-- issue_timings: sin filtro, pero expone deleted_at para que decidan los de
-- arriba. La columna nueva va al final, que es lo único que
-- `create or replace view` admite agregar.
create or replace view issue_timings as
with state_events as (
  select
    a.issue_id,
    a.created_at,
    a.old_value::issue_state as from_state,
    a.new_value::issue_state as to_state
  from issue_activity a
  where a.field = 'state'
)
select
  i.id                as issue_id,
  i.number,
  i.owner_id,
  i.type_id,
  i.state,
  state_category(i.state) as category,
  i.weight,
  i.created_at,
  i.due_date,
  i.imported,

  (select min(e.created_at) from state_events e
    where e.issue_id = i.id and state_category(e.to_state) = 'started'
  ) as started_at,

  (select max(e.created_at) from state_events e
    where e.issue_id = i.id
      and state_category(e.to_state) in ('completed', 'cancelled')
  ) as completed_at,

  (select count(*) from state_events e
    where e.issue_id = i.id and state_category(e.from_state) = 'completed'
  ) as reopen_count,

  extract(epoch from (
    now() - coalesce(
      (select max(e.created_at) from state_events e where e.issue_id = i.id),
      i.created_at
    )
  )) / 86400.0 as days_in_current_state,

  -- Nueva. Deliberadamente NO se filtra acá: cada consumidor decide.
  i.deleted_at
from issues i;

-- member_wip: el WIP es carga actual.
create or replace view member_wip as
select
  u.id   as user_id,
  u.name,
  u.role,
  count(i.id)                          as wip_count,
  coalesce(sum(i.weight), 0)           as wip_weight,
  count(i.id) filter (where i.state = 'in_progress') as in_progress_count,
  count(i.id) filter (where i.state = 'in_review')   as in_review_count
from users u
left join issues i
       on i.owner_id = u.id
      and counts_in_wip(i.state)
      and i.deleted_at is null
where u.role <> 'viewer'
group by u.id, u.name, u.role;

-- pending_drafts: tiene que coincidir con draft_inbox.
create or replace view pending_drafts as
select count(*) as pending_count
  from issues
 where state = 'draft'
   and deleted_at is null;

-- draft_inbox: la cola de decisiones pendientes.
create or replace view draft_inbox as
select
  i.id            as issue_id,
  i.number,
  i.title,
  i.created_at,
  i.due_date,
  i.weight,
  t.id            as type_id,
  t.name          as type_name,
  t.abbrev        as type_abbrev,
  t.color         as type_color,
  p.name          as priority_name,
  p.color         as priority_color,
  creator.id      as creator_id,
  creator.name    as creator_name,
  owner.id        as owner_id,
  owner.name      as owner_name,
  extract(epoch from (now() - i.created_at)) / 86400.0 as days_waiting
from issues i
join issue_types t     on t.id = i.type_id
left join priorities p on p.id = i.priority_id
join users creator     on creator.id = i.created_by
join users owner       on owner.id = i.owner_id
where i.state = 'draft'
  and i.deleted_at is null;

-- aging_wip: trabajo estancado que alguien tiene que ir a destrabar.
create or replace view aging_wip as
select
  t.issue_id,
  t.number,
  i.title,
  t.owner_id,
  u.name            as owner_name,
  t.state,
  t.weight,
  t.due_date,
  ty.abbrev         as type_abbrev,
  ty.color          as type_color,
  round(t.days_in_current_state::numeric, 1) as days_idle,
  case
    when t.days_in_current_state >= 14 then 'critico'
    when t.days_in_current_state >= 7  then 'alerta'
    when t.days_in_current_state >= 3  then 'atencion'
    else 'normal'
  end as aging_level
from issue_timings t
join issues i       on i.id  = t.issue_id
join users u        on u.id  = t.owner_id
join issue_types ty on ty.id = t.type_id
where t.category = 'started'
  and t.deleted_at is null;

-- stale_issues: lo que hay que ir a destrabar hoy.
create or replace function stale_issues(p_days int default 7)
returns table (
  issue_id  uuid,
  number    bigint,
  owner_id  uuid,
  state     issue_state,
  days_idle numeric
)
language sql
stable
set search_path = public, pg_temp
as $fn$
  select t.issue_id, t.number, t.owner_id, t.state,
         round(t.days_in_current_state::numeric, 1)
    from issue_timings t
   where t.category = 'started'
     and t.deleted_at is null
     and t.days_in_current_state >= p_days
   order by t.days_in_current_state desc;
$fn$;

-- dashboard_summary: presente filtra, histórico no. Ver el criterio arriba.
create or replace function dashboard_summary()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $fn$
  select jsonb_build_object(
    -- Presente: excluyen borrados.
    'open_count', (
      select count(*) from issues
       where state_category(state) in ('unstarted', 'started')
         and deleted_at is null),
    'wip_count', (
      select count(*) from issues
       where counts_in_wip(state) and deleted_at is null),
    'wip_weight', (
      select coalesce(sum(weight), 0) from issues
       where counts_in_wip(state) and deleted_at is null),
    'overdue_count', (
      select count(*) from issues
       where due_date < current_date
         and state_category(state) in ('unstarted', 'started')
         and deleted_at is null),
    'due_this_week', (
      select count(*) from issues
       where due_date between current_date and current_date + 7
         and state_category(state) in ('unstarted', 'started')
         and deleted_at is null),
    'pending_drafts', (
      select count(*) from issues
       where state = 'draft' and deleted_at is null),
    'stale_count', (
      select count(*) from aging_wip where days_idle >= 7),

    -- Histórico: NO excluyen. Un cierre de esta semana ya ocurrió, y borrar el
    -- ticket después no lo deshace.
    'cycle_p85_days', cycle_time_p85(null, null, null),
    'closed_this_week', (
      select count(*) from issue_timings
       where category = 'completed'
         and completed_at >= date_trunc('week', now()))
  );
$fn$;

-- `create or replace view` preserva las opciones, pero se reafirman: sin
-- security_invoker la vista correría con los permisos de su dueño y saltearía
-- la RLS de issues.
alter view issue_timings  set (security_invoker = on);
alter view member_wip     set (security_invoker = on);
alter view pending_drafts set (security_invoker = on);
alter view draft_inbox    set (security_invoker = on);
alter view aging_wip      set (security_invoker = on);

revoke execute on function dashboard_summary() from public, anon;
grant  execute on function dashboard_summary() to authenticated;
revoke execute on function stale_issues(int)   from public, anon;
grant  execute on function stale_issues(int)   to authenticated;
