'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSesion } from '@/lib/auth'
import { approveDraft, rejectDraft } from '@/lib/queries/drafts'
import { canApproveDrafts } from '@/lib/permissions'

/**
 * Aprobar y rechazar borradores.
 *
 * Las dos pasan por la misma RPC `move_issue_state` que cualquier otro
 * movimiento: la aprobación es una transición (`draft → todo`), no un atajo. El
 * rechazo es `draft → cancelled` con motivo obligatorio, y el activity log
 * conserva que el estado anterior era `draft` — que es lo que después distingue
 * "rechazado en borrador" de "cancelado a mitad de trabajo".
 */

export async function aprobarBorrador(issueId: string) {
  const { actor } = await requireSesion()
  if (!canApproveDrafts(actor)) return { ok: false as const, error: 'Aprobar es una acción de admin.' }

  const supabase = await createClient()

  try {
    await approveDraft(supabase, issueId)
    revalidatePath('/', 'layout')
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'No se pudo aprobar.' }
  }
}

export async function rechazarBorrador(issueId: string, motivo: string) {
  const { actor } = await requireSesion()
  if (!canApproveDrafts(actor)) return { ok: false as const, error: 'Rechazar es una acción de admin.' }

  const supabase = await createClient()

  try {
    await rejectDraft(supabase, issueId, motivo)
    revalidatePath('/', 'layout')
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'No se pudo rechazar.' }
  }
}
