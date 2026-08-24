/**
 * Ejecución del import, tras la confirmación del preview.
 *
 * Toda la escritura ocurre dentro de `import_issues` en Postgres: una sola
 * transacción, con la bandera `app.importing` activa, que se salta la
 * validación de secuencia y marca los tickets como `imported`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { ImportRow } from './parse'

type Client = SupabaseClient<Database>

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: string; message: string }>
}

/** external_id ya existentes: alimenta el conteo de "se actualizarán" del preview. */
export async function getKnownExternalIds(supabase: Client): Promise<Set<string>> {
  // A PROPÓSITO sin `soloVivos`: acá el conteo no se muestra, se usa para
  // decidir insert vs update contra el UNIQUE de `external_id`. Un ticket
  // borrado sigue ocupando su external_id en el índice, así que ignorarlo haría
  // que el import intentara insertar un duplicado y fallara. Reimportar una fila
  // cuyo ticket fue borrado lo ACTUALIZA — y lo revive solo si el import limpia
  // `deleted_at`, que hoy no hace: queda borrado, que es lo correcto (el admin
  // lo borró a propósito).
  const { data, error } = await supabase
    .from('issues')
    .select('external_id')
    .not('external_id', 'is', null)

  if (error) throw error
  return new Set(data.map((r) => r.external_id!).filter(Boolean))
}

export async function runImport(
  supabase: Client,
  rows: ImportRow[],
): Promise<ImportResult> {
  const payload = rows.map((r) => ({
    rowNumber: String(r.rowNumber),
    external_id: r.external_id ?? null,
    title: r.title,
    description: r.description ?? null,
    type: r.type ?? null,
    state: r.state,
    owner: r.owner ?? null,
    priority: r.priority ?? null,
    weight: r.weight ?? null,
    due_date: r.due_date ?? null,
  }))

  const { data, error } = await supabase.rpc('import_issues', {
    p_rows: payload as never,
  })

  if (error) throw error
  return data as unknown as ImportResult
}
