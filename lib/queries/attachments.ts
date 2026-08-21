/**
 * Adjuntos: archivos en Supabase Storage y enlaces externos.
 *
 * Dos modalidades, según la especificación:
 *   · kind = 'file' → Storage, límite duro de 25 MB
 *   · kind = 'link' → solo URL. Indispensable para videos pesados que viven
 *     en Drive y que no tiene sentido duplicar.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { MAX_ATTACHMENT_BYTES } from '@/lib/permissions'

type Client = SupabaseClient<Database>

const BUCKET = 'attachments'

export async function listAttachments(supabase: Client, issueId: string) {
  const { data, error } = await supabase
    .from('attachments')
    .select('id, kind, file_name, mime_type, size_bytes, storage_path, external_url, created_at, uploader:users ( id, name, avatar_url )')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export interface UploadResult {
  ok: boolean
  error?: string
  id?: string
}

/**
 * Sube un archivo y registra el adjunto.
 *
 * El tamaño se valida antes de subir para no gastar el ancho de banda de una
 * subida que Storage va a rechazar igual. Es la primera de las tres capas: el
 * bucket y el constraint de la tabla son las otras dos.
 */
export async function uploadAttachment(
  supabase: Client,
  issueId: string,
  userId: string,
  file: File,
): Promise<UploadResult> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    return {
      ok: false,
      error: `El archivo pesa ${mb} MB. El límite es 25 MB — para archivos más grandes, subilo a Drive y agregalo como enlace.`,
    }
  }

  // {issue_id}/{uuid}-{nombre}: el primer segmento es lo que usan las políticas
  // de Storage para resolver el permiso.
  const safeName = file.name.replace(/[^\w.\-]/g, '_')
  const path = `${issueId}/${crypto.randomUUID()}-${safeName}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (upErr) return { ok: false, error: upErr.message }

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      issue_id: issueId,
      uploaded_by: userId,
      kind: 'file',
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      storage_path: path,
    })
    .select('id')
    .single()

  if (error) {
    // El registro falló: hay que quitar el archivo o queda huérfano en el bucket.
    await supabase.storage.from(BUCKET).remove([path])
    return { ok: false, error: error.message }
  }

  return { ok: true, id: data.id }
}

export async function addLinkAttachment(
  supabase: Client,
  issueId: string,
  userId: string,
  url: string,
  label?: string,
) {
  const { data, error } = await supabase
    .from('attachments')
    .insert({
      issue_id: issueId,
      uploaded_by: userId,
      kind: 'link',
      external_url: url,
      file_name: label ?? url,
    })
    .select('id')
    .single()

  if (error) throw error
  return data
}

/**
 * URL firmada para descargar o previsualizar.
 *
 * El bucket es privado, así que no hay URL pública: cada acceso pide una firma
 * temporal. Una hora alcanza para abrir o descargar sin que el enlace quede
 * circulando indefinidamente.
 */
export async function getAttachmentUrl(
  supabase: Client,
  storagePath: string,
  expiresInSeconds = 3600,
) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error) throw error
  return data.signedUrl
}

export async function deleteAttachment(
  supabase: Client,
  attachmentId: string,
) {
  const { data: att, error: findErr } = await supabase
    .from('attachments')
    .select('storage_path, kind')
    .eq('id', attachmentId)
    .single()

  if (findErr) throw findErr

  // Primero la fila: si RLS rechaza el borrado, el archivo sigue intacto.
  const { error } = await supabase.from('attachments').delete().eq('id', attachmentId)
  if (error) throw error

  if (att.kind === 'file' && att.storage_path) {
    await supabase.storage.from(BUCKET).remove([att.storage_path])
  }
}
