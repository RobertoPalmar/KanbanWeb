'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSesion } from '@/lib/auth'
import {
  addComment,
  createIssue,
  moveIssueState,
  updateIssue,
  type CreateIssueInput,
  type UpdateIssueInput,
} from '@/lib/queries/issues'
import type { StateKey } from '@/lib/states'

/**
 * Las reglas viven en la base (triggers + RLS). Estas acciones no las repiten:
 * llaman y traducen el resultado. El único chequeo previo es de UX — cortar
 * antes de la ida y vuelta cuando ya se sabe que va a fallar.
 */

function revalidarTodo() {
  revalidatePath('/', 'layout')
}

export interface ResultadoMover {
  ok: boolean
  error?: string
  needsComment?: boolean
}

export async function moverEstado(
  issueId: string,
  toState: StateKey,
  comentario?: string,
): Promise<ResultadoMover> {
  await requireSesion()
  const supabase = await createClient()

  const res = await moveIssueState(supabase, issueId, toState, comentario)
  if (res.ok) revalidarTodo()

  return res
}

export async function crearTicket(input: CreateIssueInput) {
  const { actor } = await requireSesion()
  const supabase = await createClient()

  try {
    const issue = await createIssue(supabase, actor.id, input)
    revalidarTodo()
    return { ok: true as const, id: issue.id, number: issue.number, state: issue.state }
  } catch (e) {
    return { ok: false as const, error: mensaje(e) }
  }
}

export async function actualizarTicket(issueId: string, input: UpdateIssueInput) {
  await requireSesion()
  const supabase = await createClient()

  try {
    await updateIssue(supabase, issueId, input)
    revalidarTodo()
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, error: mensaje(e) }
  }
}

export async function comentar(issueId: string, body: string) {
  const { actor } = await requireSesion()
  if (!body.trim()) return { ok: false as const, error: 'El comentario está vacío.' }

  const supabase = await createClient()

  try {
    await addComment(supabase, issueId, actor.id, body.trim())
    revalidarTodo()
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, error: mensaje(e) }
  }
}

/**
 * Borra un ticket. SOFT-DELETE: fija `issues.deleted_at`.
 *
 * POR QUÉ NO ES UN DELETE. El `issue_activity` del ticket cascadearía, y ese
 * log es la FUENTE de `issue_timings`, `issue_cycle_times`,
 * `weekly_cycle_time` y `aging_wip`. Borrar de verdad un ticket ya cerrado le
 * saca su cycle time al histórico y cambia series de semanas que ya se
 * reportaron. Con soft-delete el ticket desaparece de todas las vistas de
 * presente y su historia sigue contando en lo que ya pasó.
 *
 * SOLO ADMIN, y la comprobación es acá, en el servidor. Ocultar la papelera en
 * el panel no protege nada: una Server Action es un endpoint HTTP que
 * cualquiera con la sesión abierta puede invocar con el id que quiera. La
 * segunda capa NO es una política RLS: `issues_update_owner` deja a un member
 * actualizar sus propios tickets, así que una política no alcanzaría para
 * frenar un `deleted_at` puesto a mano. Lo frena el trigger
 * `issues_guard_soft_delete` (20260824000400). Este chequeo es la primera capa,
 * y la que devuelve un mensaje legible en vez de un 42501 crudo.
 *
 * LOS ADJUNTOS SE QUEDAN. Antes se borraban del bucket acá, antes del DELETE,
 * porque después de la cascada ya no había forma de saber qué rutas había. Con
 * soft-delete no hay cascada: las filas de `attachments` siguen existiendo, y
 * el ticket es recuperable. Borrar los archivos lo volvería recuperable a
 * medias — un ticket restaurado con adjuntos roto es peor que no poder
 * restaurarlo. Si algún día hace falta liberar disco, la purga es un trabajo
 * aparte que recorre los tickets con `deleted_at` viejo y borra fila + archivo
 * juntos.
 */
export async function eliminarTicket(issueId: string) {
  const { actor } = await requireSesion()

  if (actor.role !== 'admin') {
    return {
      ok: false as const,
      error:
        'Borrar un ticket es una acción de admin. Si el trabajo ya no aplica, cancelalo: conserva el historial.',
    }
  }

  const supabase = await createClient()

  // `.is('deleted_at', null)` en el WHERE: si dos admins hacen clic a la vez,
  // el segundo UPDATE afecta cero filas en lugar de sobrescribir la marca de
  // tiempo del primero.
  const { data, error } = await supabase
    .from('issues')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', issueId)
    .is('deleted_at', null)
    .select('id')

  if (error) return { ok: false as const, error: error.message }
  if (!data?.length) {
    return { ok: false as const, error: 'El ticket ya no está disponible.' }
  }

  revalidarTodo()
  return { ok: true as const }
}

/** Etiquetas de un ticket: se reemplaza el set completo. */
export async function guardarEtiquetas(issueId: string, labelIds: string[]) {
  await requireSesion()
  const supabase = await createClient()

  const { error: eDel } = await supabase.from('issue_labels').delete().eq('issue_id', issueId)
  if (eDel) return { ok: false as const, error: eDel.message }

  if (labelIds.length) {
    const { error } = await supabase
      .from('issue_labels')
      .insert(labelIds.map((label_id) => ({ issue_id: issueId, label_id })))
    if (error) return { ok: false as const, error: error.message }
  }

  revalidarTodo()
  return { ok: true as const }
}

/** Apoyos: el owner del ticket o el admin. RLS lo vuelve a verificar. */
export async function guardarApoyos(issueId: string, userIds: string[]) {
  await requireSesion()
  const supabase = await createClient()

  const { error: eDel } = await supabase.from('issue_supporters').delete().eq('issue_id', issueId)
  if (eDel) return { ok: false as const, error: eDel.message }

  if (userIds.length) {
    const { error } = await supabase
      .from('issue_supporters')
      .insert(userIds.map((user_id) => ({ issue_id: issueId, user_id })))
    if (error) return { ok: false as const, error: error.message }
  }

  revalidarTodo()
  return { ok: true as const }
}

/** Crea la etiqueta si no existe y la devuelve, para el campo de etiquetas. */
export async function crearEtiqueta(name: string) {
  const { actor } = await requireSesion()
  if (actor.role === 'viewer') return { ok: false as const, error: 'Sin permiso.' }

  const limpio = name.trim()
  if (!limpio) return { ok: false as const, error: 'Nombre vacío.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('labels')
    .upsert({ name: limpio }, { onConflict: 'name' })
    .select('id, name, color')
    .single()

  if (error) return { ok: false as const, error: error.message }

  revalidarTodo()
  return { ok: true as const, label: data }
}

function mensaje(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: unknown }).message)
  }
  return 'Error inesperado.'
}
