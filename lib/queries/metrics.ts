/**
 * Métricas del MVP 1.
 *
 * Todo se deriva del activity log. Ninguna de estas funciones calcula nada en
 * JavaScript: las vistas y funciones de Postgres hacen el trabajo, y aquí solo
 * se las invoca.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

/** WIP por persona: tickets y suma de pesos en categoría `started`. */
export async function getMemberWip(supabase: Client) {
  const { data, error } = await supabase
    .from('member_wip')
    .select('*')
    .order('wip_count', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Throughput semanal: cerrados por semana, excluyendo cancelados.
 * `weeks` acota cuántas semanas hacia atrás; el dashboard del admin usa 8.
 */
export async function getWeeklyThroughput(
  supabase: Client,
  weeks = 8,
  ownerId?: string,
) {
  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)

  let q = supabase
    .from('weekly_throughput')
    .select('*')
    .gte('week_start', since.toISOString().slice(0, 10))

  if (ownerId) q = q.eq('owner_id', ownerId)

  const { data, error } = await q.order('week_start', { ascending: true })
  if (error) throw error
  return data
}

/**
 * Cycle time p85 en días.
 *
 * Percentil 85 y no promedio: el promedio lo distorsiona un ticket olvidado
 * tres meses. Devuelve null si no hay tickets completados en el rango.
 */
export async function getCycleTimeP85(
  supabase: Client,
  opts: { from?: string; to?: string; ownerId?: string } = {},
) {
  const { data, error } = await supabase.rpc('cycle_time_p85', {
    p_from: opts.from ?? undefined,
    p_to: opts.to ?? undefined,
    p_owner: opts.ownerId ?? undefined,
  })

  if (error) throw error
  return data as number | null
}

/** Tickets estancados: en `started` y sin moverse hace más de `days` días. */
export async function getStaleIssues(supabase: Client, days = 7) {
  const { data, error } = await supabase.rpc('stale_issues', { p_days: days })
  if (error) throw error
  return data
}

/**
 * Aging WIP: qué lleva cuánto tiempo sin moverse, con nivel de alerta.
 *
 * Los umbrales (3 / 7 / 14 días) viven en la vista de Postgres para que el
 * Panel, la ficha de Miembros y un futuro PDF cuenten la misma historia.
 */
export type AgingLevel = 'normal' | 'atencion' | 'alerta' | 'critico'

export async function getAgingWip(
  supabase: Client,
  opts: { minLevel?: AgingLevel; ownerId?: string } = {},
) {
  let q = supabase.from('aging_wip').select('*')

  if (opts.ownerId) q = q.eq('owner_id', opts.ownerId)

  if (opts.minLevel && opts.minLevel !== 'normal') {
    const threshold = { atencion: 3, alerta: 7, critico: 14 }[opts.minLevel]
    q = q.gte('days_idle', threshold)
  }

  const { data, error } = await q.order('days_idle', { ascending: false })
  if (error) throw error
  return data
}

/**
 * Color del nivel de aging, según los tokens del handoff.
 *
 * El ámbar sale de `--e4-fg` (el naranja de "En revisión") y no de su hex: en
 * tema claro vale #E07100 y en oscuro #FFA23D. Un hex fijo se vería casi negro
 * contra `--superficie` en modo oscuro.
 */
export function agingColor(level: AgingLevel): string {
  switch (level) {
    case 'critico':
      return 'var(--alerta)'
    case 'alerta':
      return 'var(--e4-fg)'
    case 'atencion':
      return 'var(--tinta-2)'
    default:
      return 'var(--tinta-3)'
  }
}

/**
 * Cycle time p85 por semana.
 *
 * La tarjeta del Panel necesita la serie, no el número suelto: un p85 de 6 días
 * no dice nada; que haya pasado de 3 a 6 en cinco semanas, sí.
 *
 * `sample_size` viene incluido a propósito: un p85 calculado sobre 2 tickets no
 * es una tendencia, y la UI debería atenuarlo en vez de dibujarlo como dato
 * firme.
 */
export async function getWeeklyCycleTime(supabase: Client, weeks = 8) {
  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)

  const { data, error } = await supabase
    .from('weekly_cycle_time')
    .select('*')
    .gte('week_start', since.toISOString().slice(0, 10))
    .order('week_start', { ascending: true })

  if (error) throw error
  return data
}

export interface DashboardSummary {
  open_count: number
  wip_count: number
  wip_weight: number
  overdue_count: number
  due_this_week: number
  pending_drafts: number
  stale_count: number
  cycle_p85_days: number | null
  closed_this_week: number
}

/**
 * Los nueve números del Panel en una sola llamada.
 *
 * Viven en seis vistas distintas; sin esto serían seis round-trips en el render
 * inicial de la pantalla que todos abren a las 8am.
 */
export async function getDashboardSummary(supabase: Client): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc('dashboard_summary')
  if (error) throw error
  return data as unknown as DashboardSummary
}

/** Contador de borradores pendientes — badge del admin. */
export async function getPendingDraftCount(supabase: Client) {
  const { data, error } = await supabase
    .from('pending_drafts')
    .select('pending_count')
    .single()

  if (error) throw error
  return data.pending_count ?? 0
}

/** Resumen del mes para el PDF: creados, cerrados, cancelados y cycle time. */
export async function getMonthlySummary(
  supabase: Client,
  from: string,
  to: string,
) {
  const { data, error } = await supabase.rpc('monthly_summary', {
    p_from: from,
    p_to: to,
  })

  if (error) throw error
  return data?.[0] ?? null
}

/** Hitos temporales de un ticket, para su ficha de detalle. */
export async function getIssueTimings(supabase: Client, issueId: string) {
  const { data, error } = await supabase
    .from('issue_timings')
    .select('*')
    .eq('issue_id', issueId)
    .single()

  if (error) throw error
  return data
}

/** Tiempo en cada estado — desglose del detalle y base del cumulative flow. */
export async function getIssueStateDurations(supabase: Client, issueId: string) {
  const { data, error } = await supabase
    .from('issue_state_durations')
    .select('*')
    .eq('issue_id', issueId)
    .order('entered_at', { ascending: true })

  if (error) throw error
  return data
}

/** Ficha de un miembro: WIP, cerrados recientes, cycle time y estancados. */
export async function getMemberStats(supabase: Client, userId: string) {
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
  const since = fourWeeksAgo.toISOString()

  const [wip, closed, p85, stale] = await Promise.all([
    supabase.from('member_wip').select('*').eq('user_id', userId).single(),
    supabase
      .from('issue_timings')
      .select('issue_id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('category', 'completed')
      .gte('completed_at', since),
    getCycleTimeP85(supabase, { ownerId: userId }),
    supabase.rpc('stale_issues', { p_days: 7 }),
  ])

  if (wip.error) throw wip.error

  return {
    wip: wip.data,
    closedLast4Weeks: closed.count ?? 0,
    cycleTimeP85Days: p85,
    staleIssues: (stale.data ?? []).filter((i) => i.owner_id === userId),
  }
}
