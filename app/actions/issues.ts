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
