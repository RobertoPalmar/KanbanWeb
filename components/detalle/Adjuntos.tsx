'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  addLinkAttachment,
  deleteAttachment,
  getAttachmentUrl,
  uploadAttachment,
} from '@/lib/queries/attachments'
import { momento, tamanoArchivo } from '@/lib/format'
import { IconoCerrar, IconoEnlace, IconoSubir } from '@/components/ui/iconos'
import { Spinner } from '@/components/ui/Spinner'
import type { Adjunto } from './cargar'

/**
 * Archivos y enlaces en la misma lista, distinguidos por el badge de extensión.
 *
 * El enlace externo no es un caso menor: un video de 800 MB vive en Drive y no
 * tiene sentido duplicarlo acá. El límite de 25 MB se valida antes de subir.
 */
export function Adjuntos({
  issueId,
  adjuntos,
  usuarioId,
  puedeAdjuntar,
}: {
  issueId: string
  adjuntos: Adjunto[]
  usuarioId: string
  puedeAdjuntar: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [modoEnlace, setModoEnlace] = useState(false)
  const [url, setUrl] = useState('')

  async function subir(files: FileList | null) {
    if (!files?.length) return
    setSubiendo(true)
    setError(null)
    const supabase = createClient()

    for (const file of Array.from(files)) {
      const res = await uploadAttachment(supabase, issueId, usuarioId, file)
      if (!res.ok) {
        setError(res.error ?? 'No se pudo subir el archivo.')
        break
      }
    }

    setSubiendo(false)
    router.refresh()
  }

  async function agregarEnlace() {
    const limpio = url.trim()
    if (!limpio) return

    setError(null)
    try {
      await addLinkAttachment(createClient(), issueId, usuarioId, limpio)
      setUrl('')
      setModoEnlace(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar el enlace.')
    }
  }

  async function abrir(a: Adjunto) {
    if (a.kind === 'link' && a.external_url) {
      window.open(a.external_url, '_blank', 'noopener,noreferrer')
      return
    }
    if (!a.storage_path) return

    try {
      const firmada = await getAttachmentUrl(createClient(), a.storage_path)
      window.open(firmada, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el adjunto.')
    }
  }

  async function quitar(a: Adjunto) {
    setError(null)
    try {
      await deleteAttachment(createClient(), a.id)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar el adjunto.')
    }
  }

  return (
    <section className="seccion">
      <div className="seccion-cab">
        <span className="mono-xs">Adjuntos</span>
        <span className="mono-sm" style={{ marginLeft: 'auto', color: 'var(--tinta-3)' }}>
          {adjuntos.length}
        </span>
      </div>

      {error && <p className="error-caja" style={{ marginBottom: 8 }}>{error}</p>}

      {adjuntos.length > 0 && (
        <div className="lista-borde" style={{ marginBottom: 8 }}>
          {adjuntos.map((a) => (
            <div className="adjunto" key={a.id}>
              <span className="badge-ext">{extension(a)}</span>
              <button
                type="button"
                className="btn-texto"
                style={{
                  textDecoration: 'none',
                  color: 'var(--tinta)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => void abrir(a)}
              >
                {a.file_name ?? a.external_url}
              </button>
              <span
                className="mono-sm"
                style={{ marginLeft: 'auto', color: 'var(--tinta-2)', flex: 'none' }}
              >
                {a.kind === 'file' ? `${tamanoArchivo(a.size_bytes)} · ` : ''}
                {a.uploader?.name.split(' ')[0] ?? '—'} · {momento(a.created_at)}
              </span>
              {puedeAdjuntar && (
                <button
                  type="button"
                  className="btn-icono"
                  style={{ flex: 'none' }}
                  aria-label="Quitar adjunto"
                  onClick={() => void quitar(a)}
                >
                  <IconoCerrar size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {puedeAdjuntar &&
        (modoEnlace ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              autoFocus
              className="campo"
              style={{ height: 30, fontSize: 12 }}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void agregarEnlace()
                if (e.key === 'Escape') setModoEnlace(false)
              }}
            />
            <button type="button" className="btn-primario" onClick={() => void agregarEnlace()}>
              Agregar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <label className="btn-secundario" style={{ cursor: 'pointer' }}>
              {subiendo ? <Spinner label="Subiendo archivo" /> : <IconoSubir size={13} />}
              {subiendo ? 'Subiendo…' : 'Añadir archivo'}
              <input type="file" multiple hidden onChange={(e) => void subir(e.target.files)} />
            </label>
            <button type="button" className="btn-secundario" onClick={() => setModoEnlace(true)}>
              <IconoEnlace size={13} />
              Añadir enlace
            </button>
          </div>
        ))}
    </section>
  )
}

function extension(a: Adjunto): string {
  if (a.kind === 'link') return 'url'
  const nombre = a.file_name ?? ''
  const ext = nombre.includes('.') ? nombre.split('.').pop()! : 'file'
  return ext.slice(0, 4)
}
