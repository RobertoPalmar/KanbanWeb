/**
 * Catálogos de configuración: tipos, labels, prioridades, miembros y settings.
 *
 * Todo esto se archiva, nunca se borra. Borrar un tipo con tickets históricos
 * rompería los reportes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

/** `includeArchived` solo tiene sentido en la pantalla de Configuración. */
export async function getIssueTypes(supabase: Client, includeArchived = false) {
  let q = supabase.from('issue_types').select('*')
  if (!includeArchived) q = q.eq('archived', false)

  const { data, error } = await q.order('order', { ascending: true })
  if (error) throw error
  return data
}

export async function getLabels(supabase: Client, includeArchived = false) {
  let q = supabase.from('labels').select('*')
  if (!includeArchived) q = q.eq('archived', false)

  const { data, error } = await q.order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function getPriorities(supabase: Client, includeArchived = false) {
  let q = supabase.from('priorities').select('*')
  if (!includeArchived) q = q.eq('archived', false)

  const { data, error } = await q.order('order', { ascending: true })
  if (error) throw error
  return data
}

export async function getUsers(supabase: Client) {
  const { data, error } = await supabase
    .from('users')
    // `job_title` es descriptivo ("Producción y eventos") y `role` es permisos:
    // la vista Personas muestra el primero y nunca el segundo.
    .select('id, name, email, avatar_url, role, job_title, capacity')
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

/** Candidatos a owner: los viewer no reciben trabajo. */
export async function getAssignableUsers(supabase: Client) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, avatar_url, role')
    .neq('role', 'viewer')
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

export async function getSettings(supabase: Client) {
  const { data, error } = await supabase.from('settings').select('*').single()
  if (error) throw error
  return data
}

/**
 * Escala de estimación: Fibonacci.
 *
 * Decisión cerrada para el MVP 1. El diseño SUMA pesos en tres lugares
 * —cabecera de grupo, cabecera de columna kanban y barra de carga de Personas—
 * y una escala t-shirt no se puede sumar. La base lo valida con un CHECK, así
 * que este array y el constraint tienen que moverse juntos.
 *
 * El peso vive siempre en la tabla, incluso con el toggle apagado, para no
 * perder datos históricos al alternar.
 */
export const FIBONACCI_WEIGHTS = [1, 2, 3, 5, 8, 13] as const

export type Weight = (typeof FIBONACCI_WEIGHTS)[number]

export function isValidWeight(w: number | null | undefined): boolean {
  return w == null || (FIBONACCI_WEIGHTS as readonly number[]).includes(w)
}

/**
 * Ocho puntos equivalen aproximadamente a una semana de trabajo, y la capacidad
 * por defecto son 20 puntos (unas dos semanas y media). Es la referencia que el
 * diseño muestra como subtítulo de la vista Personas.
 */
export const POINTS_PER_WEEK = 8

/** Archiva un tipo. Nunca se borra: los tickets históricos lo referencian. */
export async function archiveIssueType(supabase: Client, id: string) {
  const { error } = await supabase
    .from('issue_types')
    .update({ archived: true })
    .eq('id', id)

  if (error) throw error
}

export async function archiveLabel(supabase: Client, id: string) {
  const { error } = await supabase.from('labels').update({ archived: true }).eq('id', id)
  if (error) throw error
}

/** Vistas guardadas: filtro + nombre, privadas de cada usuario. */
export async function getSavedViews(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from('saved_views')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

export async function saveView(
  supabase: Client,
  userId: string,
  name: string,
  filters: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from('saved_views')
    .upsert(
      { user_id: userId, name, filters_json: filters as never },
      { onConflict: 'user_id,name' },
    )
    .select('id')
    .single()

  if (error) throw error
  return data
}
