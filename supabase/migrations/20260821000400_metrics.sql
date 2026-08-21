-- =============================================================================
-- MVP 1 · Métricas derivadas del activity log
--
-- Nada de esto necesita columnas extra en `issues`. La fuente de verdad es
-- issue_activity; started_at y completed_at pueden cachearse más adelante si el
-- rendimiento lo exige, pero se calculan aquí.
--
--   started_at   = PRIMERA transición hacia categoría 'started'
--   completed_at = ÚLTIMA transición hacia 'completed' o 'cancelled'
--   reopens      = transiciones que SALEN de 'completed'
-- =============================================================================

-- -----------------------------------------------------------------------------
-- issue_timings
-- Un renglón por ticket con los hitos temporales reconstruidos.
-- -----------------------------------------------------------------------------

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

  -- Primera entrada a 'started'.
  (select min(e.created_at) from state_events e
    where e.issue_id = i.id and state_category(e.to_state) = 'started'
  ) as started_at,

  -- Última salida del flujo (completado o cancelado).
  (select max(e.created_at) from state_events e
    where e.issue_id = i.id
      and state_category(e.to_state) in ('completed', 'cancelled')
  ) as completed_at,

  -- Reaperturas: transiciones que salen de 'completed'.
  (select count(*) from state_events e
    where e.issue_id = i.id and state_category(e.from_state) = 'completed'
  ) as reopen_count,

  -- Aging WIP: días que el ticket lleva sin moverse de estado. Para un ticket
  -- que nunca se movió, se cuenta desde su creación.
  extract(epoch from (
    now() - coalesce(
      (select max(e.created_at) from state_events e where e.issue_id = i.id),
      i.created_at
    )
  )) / 86400.0 as days_in_current_state
from issues i;

-- -----------------------------------------------------------------------------
-- issue_cycle_times
--
-- Cycle time por ticket, solo de los que tienen historia real.
-- Los importados quedan fuera: su started_at es nulo, y meterlos distorsionaría
-- todas las métricas del primer mes.
-- Los cancelados quedan fuera: no representan trabajo completado.
-- -----------------------------------------------------------------------------

create or replace view issue_cycle_times as
select
  t.issue_id,
  t.number,
  t.owner_id,
  t.type_id,
  t.started_at,
  t.completed_at,
  extract(epoch from (t.completed_at - t.started_at)) / 86400.0 as cycle_days
from issue_timings t
where t.started_at   is not null
  and t.completed_at is not null
  and t.category = 'completed'
  and not t.imported;

-- -----------------------------------------------------------------------------
-- WIP por persona
--
-- Suma de tickets/pesos en categoría 'started'. Los borradores están excluidos
-- por definición: 'draft' no es 'started'.
-- -----------------------------------------------------------------------------

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
where u.role <> 'viewer'
group by u.id, u.name, u.role;

-- -----------------------------------------------------------------------------
-- Throughput semanal
-- Cerrados por semana. Excluye cancelados.
-- -----------------------------------------------------------------------------

create or replace view weekly_throughput as
select
  date_trunc('week', t.completed_at)::date as week_start,
  t.owner_id,
  count(*)                    as closed_count,
  coalesce(sum(t.weight), 0)  as closed_weight
from issue_timings t
where t.category = 'completed'
  and t.completed_at is not null
group by 1, 2;

-- -----------------------------------------------------------------------------
-- cycle_time_p85
--
-- Percentil 85, no promedio: el promedio lo distorsiona un ticket olvidado tres
-- meses. p_owner nulo = todo el equipo.
-- -----------------------------------------------------------------------------

create or replace function cycle_time_p85(
  p_from  timestamptz default null,
  p_to    timestamptz default null,
  p_owner uuid        default null
)
returns numeric
language sql
stable
as $fn$
  select percentile_cont(0.85) within group (order by cycle_days)
    from issue_cycle_times
   where (p_from  is null or completed_at >= p_from)
     and (p_to    is null or completed_at <  p_to)
     and (p_owner is null or owner_id = p_owner);
$fn$;

-- -----------------------------------------------------------------------------
-- Tickets estancados (aging WIP)
--
-- Tickets en 'started' que llevan más de p_days sin moverse de estado.
-- -----------------------------------------------------------------------------

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
as $fn$
  select t.issue_id, t.number, t.owner_id, t.state,
         round(t.days_in_current_state::numeric, 1)
    from issue_timings t
   where t.category = 'started'
     and t.days_in_current_state >= p_days
   order by t.days_in_current_state desc;
$fn$;

-- -----------------------------------------------------------------------------
-- Tiempo en cada estado
--
-- Diferencia entre transiciones consecutivas. Base del cumulative flow del
-- MVP 2 y del desglose en la ficha del ticket.
-- -----------------------------------------------------------------------------

create or replace view issue_state_durations as
with events as (
  select
    a.issue_id,
    a.new_value::issue_state as state,
    a.created_at             as entered_at,
    lead(a.created_at) over (partition by a.issue_id order by a.created_at) as left_at
  from issue_activity a
  where a.field in ('state', 'created', 'imported')
)
select
  e.issue_id,
  e.state,
  e.entered_at,
  e.left_at,
  extract(epoch from (coalesce(e.left_at, now()) - e.entered_at)) / 86400.0 as days_in_state,
  e.left_at is null as is_current
from events e;

-- -----------------------------------------------------------------------------
-- Resumen mensual · alimenta el PDF de reportes (sección 6)
-- -----------------------------------------------------------------------------

create or replace function monthly_summary(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  created_count   bigint,
  closed_count    bigint,
  cancelled_count bigint,
  cycle_p85_days  numeric
)
language sql
stable
as $fn$
  select
    (select count(*) from issues
      where created_at >= p_from and created_at < p_to
        and state <> 'draft'),
    (select count(*) from issue_timings
      where category = 'completed'
        and completed_at >= p_from and completed_at < p_to),
    (select count(*) from issue_timings
      where category = 'cancelled'
        and completed_at >= p_from and completed_at < p_to),
    cycle_time_p85(p_from, p_to, null);
$fn$;

-- -----------------------------------------------------------------------------
-- Contador de borradores pendientes · badge del admin
-- Sin esto los borradores se acumulan invisibles.
-- -----------------------------------------------------------------------------

create or replace view pending_drafts as
select count(*) as pending_count
  from issues
 where state = 'draft';

-- -----------------------------------------------------------------------------
-- Las vistas heredan la RLS de las tablas base (security_invoker), en lugar de
-- correr con los permisos del dueño de la vista.
-- -----------------------------------------------------------------------------

alter view issue_timings          set (security_invoker = on);
alter view issue_cycle_times      set (security_invoker = on);
alter view member_wip             set (security_invoker = on);
alter view weekly_throughput      set (security_invoker = on);
alter view issue_state_durations  set (security_invoker = on);
alter view pending_drafts         set (security_invoker = on);
