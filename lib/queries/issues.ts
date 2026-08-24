/**
 * Acceso a datos de tickets.
 *
 * Las reglas de negocio viven en la base (triggers + RLS). Estas funciones no
 * las reimplementan: traducen los errores de Postgres a mensajes que la UI
 * puede mostrar.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { StateKey } from '@/lib/states'

type Client = SupabaseClient<Database>

/** Códigos que devuelven los triggers de la migración de transiciones. */
const PG_INSUFFICIENT_PRIVILEGE = '42501'
const PG_CHECK_VIOLATION = '23514'

export interface IssueFilters {
  state?: StateKey[]
  ownerId?: string
  supporterId?: string
  typeId?: string
  priorityId?: string
  labelIds?: string[]
  /** Texto libre sobre el título. */
  search?: string
  dueFrom?: string
  dueTo?: string
  createdFrom?: string
  createdTo?: string
  /** Por defecto los borradores se incluyen; el kanban tiene su propia columna. */
  includeDrafts?: boolean
}

/**
 * Soft-delete: el filtro que TODA lectura de tickets tiene que aplicar.
 *
 * POR QUÉ UN HELPER Y NO `.is('deleted_at', null)` suelto en cada sitio. El
 * filtro no se puede meter en ISSUE_SELECT —un select es la lista de columnas,
 * no el WHERE— así que la alternativa era repetir la misma línea en una docena
 * de consultas repartidas entre lib/queries, app/actions y los page.tsx. Una
 * consulta que se olvide no falla: muestra tickets borrados, en silencio, hasta
 * que alguien lo nota. Con el helper el olvido sigue siendo posible, pero ahora
 * hay UN nombre para buscar (`soloVivos`) y el grep dice de una qué consultas
 * están cubiertas y cuáles no.
 *
 * No se envuelve en un wrapper de `from('issues')` porque los tipos generados de
 * PostgREST se pierden en cuanto se pasa el nombre de la tabla por variable, y
 * perder el tipado del select es un precio más alto que un `.is()` explícito.
 */
export function soloVivos<T extends { is(col: 'deleted_at', val: null): T }>(q: T): T {
  return q.is('deleted_at', null)
}

const ISSUE_SELECT = `
  id, number, title, description, state, weight, due_date,
  created_at, updated_at, imported, owner_id, created_by, type_id, priority_id,
  type:issue_types!issues_type_id_fkey ( id, name, color, icon, abbrev ),
  priority:priorities ( id, name, color, order ),
  owner:users!issues_owner_id_fkey ( id, name, email, avatar_url ),
  creator:users!issues_created_by_fkey ( id, name, email, avatar_url ),
  labels:issue_labels ( label:labels ( id, name, color ) ),
  supporters:issue_supporters ( user:users ( id, name, avatar_url ) )
` as const

export async function listIssues(supabase: Client, filters: IssueFilters = {}) {
  let q = soloVivos(supabase.from('issues').select(ISSUE_SELECT))

  if (filters.state?.length) {
    q = q.in('state', filters.state)
  } else if (filters.includeDrafts === false) {
    q = q.neq('state', 'draft')
  }

  if (filters.ownerId) q = q.eq('owner_id', filters.ownerId)
  if (filters.typeId) q = q.eq('type_id', filters.typeId)
  if (filters.priorityId) q = q.eq('priority_id', filters.priorityId)
  if (filters.search) q = q.ilike('title', `%${filters.search}%`)
  if (filters.dueFrom) q = q.gte('due_date', filters.dueFrom)
  if (filters.dueTo) q = q.lte('due_date', filters.dueTo)
  if (filters.createdFrom) q = q.gte('created_at', filters.createdFrom)
  if (filters.createdTo) q = q.lte('created_at', filters.createdTo)

  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getIssue(supabase: Client, id: string) {
  const { data, error } = await soloVivos(
    supabase.from('issues').select(ISSUE_SELECT).eq('id', id),
  ).single()
  if (error) throw error
  return data
}

export interface CreateIssueInput {
  title: string
  description?: string
  typeId: string
  ownerId: string
  priorityId?: string
  weight?: number
  dueDate?: string
  labelIds?: string[]
  supporterIds?: string[]
}

/**
 * Crea un ticket.
 *
 * El estado inicial NO se manda: lo decide el trigger `set_initial_state`
 * según quién crea y para quién (draft si es para otra persona, todo si es
 * para uno mismo o si lo crea un admin). Mandarlo desde el cliente sería
 * ignorado de todas formas.
 */
export async function createIssue(
  supabase: Client,
  userId: string,
  input: CreateIssueInput,
) {
  const { data: issue, error } = await supabase
    .from('issues')
    .insert({
      title: input.title,
      description: input.description ?? null,
      type_id: input.typeId,
      owner_id: input.ownerId,
      created_by: userId,
      priority_id: input.priorityId ?? null,
      weight: input.weight ?? null,
      due_date: input.dueDate ?? null,
    })
    .select('id, number, state')
    .single()

  if (error) throw error

  if (input.labelIds?.length) {
    const { error: e } = await supabase
      .from('issue_labels')
      .insert(input.labelIds.map((label_id) => ({ issue_id: issue.id, label_id })))
    if (e) throw e
  }

  if (input.supporterIds?.length) {
    const { error: e } = await supabase
      .from('issue_supporters')
      .insert(input.supporterIds.map((user_id) => ({ issue_id: issue.id, user_id })))
    if (e) throw e
  }

  return issue
}

export interface MoveResult {
  ok: boolean
  error?: string
  /** La UI debe pedir un comentario y reintentar. */
  needsComment?: boolean
}

/**
 * Mueve un ticket de estado.
 *
 * Cancelar exige un comentario. La base lo valida con un constraint trigger
 * DIFERIDO, lo que permite insertar el comentario y hacer el UPDATE en
 * cualquier orden dentro de la misma transacción. PostgREST no expone
 * transacciones multi-sentencia, así que se hace por RPC: ver
 * `move_issue_state` en la migración de RPC.
 */
export async function moveIssueState(
  supabase: Client,
  issueId: string,
  toState: StateKey,
  comment?: string,
): Promise<MoveResult> {
  const { error } = await supabase.rpc('move_issue_state', {
    p_issue_id: issueId,
    p_to_state: toState,
    p_comment: comment ?? undefined,
  })

  if (!error) return { ok: true }

  // El trigger exige comentario y no vino ninguno.
  if (error.code === PG_CHECK_VIOLATION && /comentario/i.test(error.message)) {
    return { ok: false, needsComment: true, error: error.message }
  }

  if (error.code === PG_INSUFFICIENT_PRIVILEGE) {
    return { ok: false, error: error.message }
  }

  return { ok: false, error: error.message }
}

export interface UpdateIssueInput {
  title?: string
  description?: string | null
  typeId?: string
  priorityId?: string | null
  weight?: number | null
  dueDate?: string | null
  /** Solo admin. La base rechaza el cambio si el actor no lo es. */
  ownerId?: string
}

export async function updateIssue(
  supabase: Client,
  issueId: string,
  input: UpdateIssueInput,
) {
  const patch: Database['public']['Tables']['issues']['Update'] = {}
  if (input.title !== undefined) patch.title = input.title
  if (input.description !== undefined) patch.description = input.description
  if (input.typeId !== undefined) patch.type_id = input.typeId
  if (input.priorityId !== undefined) patch.priority_id = input.priorityId
  if (input.weight !== undefined) patch.weight = input.weight
  if (input.dueDate !== undefined) patch.due_date = input.dueDate
  if (input.ownerId !== undefined) patch.owner_id = input.ownerId

  // `soloVivos` también en el UPDATE: un ticket borrado no se edita. Sin esto
  // una pestaña abierta desde antes del borrado podría seguir guardando cambios.
  const { data, error } = await soloVivos(
    supabase.from('issues').update(patch).eq('id', issueId),
  )
    .select('id')
    .single()

  if (error) throw error
  return data
}

/** Historial de transiciones y cambios de campo, para el detalle del ticket. */
export async function getIssueActivity(supabase: Client, issueId: string) {
  const { data, error } = await supabase
    .from('issue_activity')
    .select('id, field, old_value, new_value, created_at, actor:users ( id, name, avatar_url )')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function getIssueComments(supabase: Client, issueId: string) {
  const { data, error } = await supabase
    .from('comments')
    .select('id, body, system_reason, created_at, updated_at, author:users ( id, name, avatar_url )')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function addComment(
  supabase: Client,
  issueId: string,
  authorId: string,
  body: string,
) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ issue_id: issueId, author_id: authorId, body })
    .select('id')
    .single()

  if (error) throw error
  return data
}
