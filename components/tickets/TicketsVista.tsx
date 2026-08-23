'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ORDERED_STATES, STATES } from '@/lib/states'
import type { Catalogos, CtxSesion, Ticket } from '@/lib/tipos'
import { BarraProgreso } from '@/components/ui/Spinner'
import { BarraFiltros } from './BarraFiltros'
import { Tabla } from './Tabla'
import { Kanban } from './Kanban'

export interface Grupo {
  clave: string
  titulo: string
  color?: string
  fondo?: string
  tickets: Ticket[]
}

export function TicketsVista({
  tickets,
  catalogos,
  sesion,
}: {
  tickets: Ticket[]
  catalogos: Catalogos
  sesion: CtxSesion
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const modo = params.get('modo') === 'tabla' ? 'tabla' : 'kanban'
  const agrupar = (params.get('agrupar') ?? 'estado') as 'estado' | 'dueno' | 'tipo'
  const [navegando, empezarNavegacion] = useTransition()
  const [colapsados, setColapsados] = useState<Record<string, boolean>>({
    done: true,
    cancelled: true,
  })

  const abrirTicket = useCallback(
    (id: string | null) => {
      const q = new URLSearchParams(params.toString())
      if (id) q.set('ticket', id)
      else q.delete('ticket')
      // En transición: el detalle se arma en el servidor y la barra de arriba
      // avisa que algo viene, sin bloquear la lista que ya está en pantalla.
      empezarNavegacion(() => {
        router.replace(`${pathname}?${q.toString()}`, { scroll: false })
      })
    },
    [params, pathname, router],
  )

  const grupos = useMemo<Grupo[]>(() => {
    if (agrupar === 'dueno') {
      return agrupaPor(
        tickets,
        (t) => t.owner_id,
        (t) => t.owner.name,
      )
    }

    if (agrupar === 'tipo') {
      return agrupaPor(
        tickets,
        (t) => t.tipo.id,
        (t) => t.tipo.name,
        (t) => t.tipo.color,
      )
    }

    return ORDERED_STATES.map((estado, i) => ({
      clave: estado,
      titulo: STATES[estado].label,
      color: `var(--e${i + 1}-fg)`,
      fondo: `var(--e${i + 1}-bg)`,
      tickets: tickets.filter((t) => t.state === estado),
    }))
  }, [tickets, agrupar])

  const hayFiltros = ['tipo', 'dueno', 'estado', 'prio', 'etiqueta', 'desde', 'hasta', 'q'].some(
    (k) => params.get(k),
  )

  return (
    <>
      <BarraProgreso visible={navegando} />
      <BarraFiltros catalogos={catalogos} agrupar={agrupar} total={tickets.length} />

      {modo === 'tabla' ? (
        <div className="vista-scroll">
          <Tabla
            grupos={grupos}
            colapsados={colapsados}
            onColapsar={(clave) => setColapsados((c) => ({ ...c, [clave]: !c[clave] }))}
            onAbrir={abrirTicket}
            ticketAbierto={params.get('ticket')}
            sesion={sesion}
            hayFiltros={hayFiltros}
            vacio={tickets.length === 0}
          />
        </div>
      ) : (
        <Kanban
          tickets={tickets}
          onAbrir={abrirTicket}
          ticketAbierto={params.get('ticket')}
          sesion={sesion}
        />
      )}
    </>
  )
}

function agrupaPor(
  tickets: Ticket[],
  clave: (t: Ticket) => string,
  titulo: (t: Ticket) => string,
  color?: (t: Ticket) => string,
): Grupo[] {
  const mapa = new Map<string, Grupo>()

  for (const t of tickets) {
    const k = clave(t)
    if (!mapa.has(k)) {
      mapa.set(k, { clave: k, titulo: titulo(t), color: color?.(t), tickets: [] })
    }
    mapa.get(k)!.tickets.push(t)
  }

  return [...mapa.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'))
}
