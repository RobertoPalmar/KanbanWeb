import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getIssue, getIssueActivity, getIssueComments } from '@/lib/queries/issues'
import { listAttachments } from '@/lib/queries/attachments'
import { aplanarTicket, type Ticket } from '@/lib/tipos'

/**
 * Todo lo que necesita el panel de detalle, en una tanda.
 *
 * Comentarios e historial se piden por separado porque se intercalan
 * cronológicamente pero con jerarquías tipográficas distintas: cincuenta
 * eventos no pueden ahogar tres comentarios.
 */

export interface Comentario {
  id: string
  body: string
  system_reason: string | null
  created_at: string
  author: { id: string; name: string; avatar_url: string | null } | null
}

export interface Evento {
  id: string
  field: string
  old_value: string | null
  new_value: string | null
  created_at: string
  actor: { id: string; name: string; avatar_url: string | null } | null
}

export interface Adjunto {
  id: string
  kind: 'file' | 'link'
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  storage_path: string | null
  external_url: string | null
  created_at: string
  uploader: { id: string; name: string } | null
}

export interface Detalle {
  ticket: Ticket
  comentarios: Comentario[]
  eventos: Evento[]
  adjuntos: Adjunto[]
}

export async function cargarDetalle(
  supabase: SupabaseClient<Database>,
  issueId: string,
): Promise<Detalle | null> {
  try {
    const [issue, comentarios, eventos, adjuntos] = await Promise.all([
      getIssue(supabase, issueId),
      getIssueComments(supabase, issueId),
      getIssueActivity(supabase, issueId),
      listAttachments(supabase, issueId),
    ])

    return {
      ticket: aplanarTicket(issue),
      comentarios: comentarios as unknown as Comentario[],
      eventos: eventos as unknown as Evento[],
      adjuntos: adjuntos as unknown as Adjunto[],
    }
  } catch {
    // Id inexistente o sin permiso de lectura: la vista se renderiza sin panel
    // en lugar de romper la página entera.
    return null
  }
}
