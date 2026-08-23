'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Catalogos, CtxSesion } from '@/lib/tipos'
import { ModalNuevoTicket } from './ModalNuevoTicket'

/**
 * El botón "Nuevo ticket" vive en el header de todas las vistas, así que el
 * modal se monta una sola vez acá arriba y se abre por contexto. Los catálogos
 * ya vienen cargados del layout: abrir el modal no dispara ninguna petición.
 */

interface Ctx {
  abrir: (prefill?: Prefill) => void
  catalogos: Catalogos
  sesion: CtxSesion
}

export interface Prefill {
  ownerId?: string
  dueDate?: string
  state?: string
}

const NuevoTicketCtx = createContext<Ctx | null>(null)

export function useNuevoTicket() {
  const ctx = useContext(NuevoTicketCtx)
  if (!ctx) throw new Error('useNuevoTicket fuera del provider')
  return ctx
}

export function NuevoTicketProvider({
  tipos,
  prioridades,
  personas,
  etiquetas,
  sesion,
  children,
}: Catalogos & { sesion: CtxSesion; children: React.ReactNode }) {
  const [prefill, setPrefill] = useState<Prefill | null>(null)
  const [abierto, setAbierto] = useState(false)

  const abrir = useCallback((p?: Prefill) => {
    setPrefill(p ?? null)
    setAbierto(true)
  }, [])

  const catalogos = useMemo<Catalogos>(
    () => ({ tipos, prioridades, personas, etiquetas }),
    [tipos, prioridades, personas, etiquetas],
  )

  const valor = useMemo<Ctx>(() => ({ abrir, catalogos, sesion }), [abrir, catalogos, sesion])

  return (
    <NuevoTicketCtx.Provider value={valor}>
      {children}
      {abierto && (
        <ModalNuevoTicket
          catalogos={catalogos}
          sesion={sesion}
          prefill={prefill}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </NuevoTicketCtx.Provider>
  )
}
