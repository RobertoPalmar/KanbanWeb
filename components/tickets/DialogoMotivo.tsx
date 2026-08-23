'use client'

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Paso de motivo al cancelar.
 *
 * El handoff ejecutaba el cambio directo; la base lo rechaza sin comentario
 * (constraint diferido) y la RPC devuelve `needsComment` justamente para que la
 * UI abra este diálogo y reintente. Es la pieza que faltaba en el prototipo.
 */
export function DialogoMotivo({
  titulo,
  descripcion,
  onCancelar,
  onConfirmar,
}: {
  titulo: string
  descripcion: string
  onCancelar: () => void
  onConfirmar: (motivo: string) => void | Promise<void>
}) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    area.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancelar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancelar])

  async function confirmar() {
    if (!motivo.trim() || enviando) return
    setEnviando(true)
    await onConfirmar(motivo.trim())
  }

  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && onCancelar()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="motivo-titulo"
        style={{ width: 460 }}
      >
        <div className="modal-cab">
          <h2 id="motivo-titulo" style={{ fontSize: 15 }}>
            {titulo}
          </h2>
        </div>

        <div className="modal-cuerpo" style={{ gap: 12 }}>
          <p className="subtitulo" style={{ margin: 0 }}>
            {descripcion}
          </p>
          <textarea
            ref={area}
            className="campo"
            style={{ height: 84 }}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por qué se cancela"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void confirmar()
            }}
          />
        </div>

        <div className="modal-pie">
          <span className="mono-sm" style={{ color: 'var(--tinta-3)' }}>
            ⌘↵ para confirmar
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="btn-secundario" onClick={onCancelar}>
              Volver
            </button>
            <button
              type="button"
              className="btn-primario"
              disabled={!motivo.trim() || enviando}
              onClick={() => void confirmar()}
            >
              {enviando && <Spinner label="Guardando" />}
              {enviando ? 'Guardando…' : 'Confirmar'}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
