-- =============================================================================
-- MVP 1 · Vistas que la especificación exige y el handoff no dibujó
--
--   1. Bandeja de borradores pendientes de aprobación
--   2. Aging WIP con umbrales
--   3. Cycle time p85 por semana (serie para la tarjeta del Panel)
--   4. Resumen del dashboard en una sola llamada
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Bandeja de borradores
--
-- "Badge con contador para el admin (sin esto se acumulan invisibles)."
--
-- La vista trae quién lo creó y para quién: es la decisión que el admin toma al
-- aprobar, y con solo el conteo no puede tomarla.
-- -----------------------------------------------------------------------------

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
  -- Días esperando aprobación: es lo que vuelve accionable la bandeja. Un
  -- borrador de ayer no es lo mismo que uno de hace tres semanas.
  extract(epoch from (now() - i.created_at)) / 86400.0 as days_waiting
from issues i
join issue_types t     on t.id = i.type_id
left join priorities p on p.id = i.priority_id
join users creator     on creator.id = i.created_by
join users owner       on owner.id = i.owner_id
where i.state = 'draft';

alter view draft_inbox set (security_invoker = on);

-- -----------------------------------------------------------------------------
-- 2. Aging WIP
--
-- "Días que un ticket lleva sin moverse de estado."
--
-- Los umbrales viven acá y no en el front para que el Panel, la ficha de
-- Miembros y un futuro PDF cuenten la misma historia.
-- -----------------------------------------------------------------------------

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
where t.category = 'started';

alter view aging_wip set (security_invoker = on);

-- -----------------------------------------------------------------------------
-- 3. Cycle time p85 por semana
--
-- La tarjeta del Panel necesita una serie, no un número suelto: un p85 de 6
-- días no dice nada; que haya pasado de 3 a 6 en cinco semanas, sí.
--
-- Se agrupa por semana de CIERRE, igual que weekly_throughput, para que ambas
-- tarjetas compartan el eje X.
-- -----------------------------------------------------------------------------

create or replace view weekly_cycle_time as
select
  date_trunc('week', completed_at)::date as week_start,
  count(*)                               as sample_size,
  round(percentile_cont(0.85) within group (order by cycle_days)::numeric, 1) as p85_days,
  round(percentile_cont(0.50) within group (order by cycle_days)::numeric, 1) as median_days
from issue_cycle_times
group by 1;

alter view weekly_cycle_time set (security_invoker = on);

-- -----------------------------------------------------------------------------
-- 4. Resumen del Panel
--
-- El dashboard necesita nueve números que viven en seis vistas distintas. Sin
-- esto son seis round-trips en el render inicial de la pantalla que todos abren
-- a las 8am.
-- -----------------------------------------------------------------------------

create or replace function dashboard_summary()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $fn$
  select jsonb_build_object(
    'open_count', (
      select count(*) from issues
       where state_category(state) in ('unstarted', 'started')),
    'wip_count', (
      select count(*) from issues where counts_in_wip(state)),
    'wip_weight', (
      select coalesce(sum(weight), 0) from issues where counts_in_wip(state)),
    'overdue_count', (
      select count(*) from issues
       where due_date < current_date
         and state_category(state) in ('unstarted', 'started')),
    'due_this_week', (
      select count(*) from issues
       where due_date between current_date and current_date + 7
         and state_category(state) in ('unstarted', 'started')),
    'pending_drafts', (
      select count(*) from issues where state = 'draft'),
    'stale_count', (
      select count(*) from aging_wip where days_idle >= 7),
    'cycle_p85_days', cycle_time_p85(null, null, null),
    'closed_this_week', (
      select count(*) from issue_timings
       where category = 'completed'
         and completed_at >= date_trunc('week', now()))
  );
$fn$;

revoke execute on function dashboard_summary() from public, anon;
grant  execute on function dashboard_summary() to authenticated;
