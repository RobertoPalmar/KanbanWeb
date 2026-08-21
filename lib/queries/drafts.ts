/**
 * Bandeja de borradores pendientes de aprobación.
 *
 * La especificación es explícita sobre por qué existe: "badge con contador para
 * el admin — sin esto se acumulan invisibles". Un borrador que nadie aprueba es
 * trabajo que alguien pidió y que no está pasando.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

/** Ordenados por antigüedad: lo que más lleva esperando va primero. */
export async function getDraftInbox(supabase: Client) {
  const { data, error } = await supabase
    .from('draft_inbox')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Aprobar un borrador: `draft → todo`.
 *
 * Es admin-only, y quien lo hace queda registrado en el activity log. Pasa por
 * la misma RPC que cualquier otro movimiento — no hay atajo, porque la
 * aprobación es una transición como las demás.
 */
export async function approveDraft(supabase: Client, issueId: string) {
  const { error } = await supabase.rpc('move_issue_state', {
    p_issue_id: issueId,
    p_to_state: 'todo',
    p_comment: null,
  })

  if (error) throw error
}

/**
 * Rechazar un borrador: `draft → cancelled`, con motivo obligatorio.
 *
 * No hay estado `rejected` aparte: el activity log ya registra que el estado
 * anterior era `draft`, lo que permite distinguir en reportes "rechazado en
 * borrador" de "cancelado a mitad de trabajo".
 */
export async function rejectDraft(
  supabase: Client,
  issueId: string,
  reason: string,
) {
  if (!reason.trim()) {
    throw new Error('Rechazar un borrador exige explicar el motivo')
  }

  const { error } = await supabase.rpc('move_issue_state', {
    p_issue_id: issueId,
    p_to_state: 'cancelled',
    p_comment: reason,
  })

  if (error) throw error
}

/**
 * Distingue un rechazo en borrador de una cancelación a mitad de trabajo.
 * Se resuelve mirando el estado del que salió, en el activity log.
 */
export function wasRejectedAsDraft(
  activity: Array<{ field: string; old_value: string | null; new_value: string | null }>,
): boolean {
  return activity.some(
    (a) => a.field === 'state' && a.old_value === 'draft' && a.new_value === 'cancelled',
  )
}
