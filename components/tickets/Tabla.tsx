'use client'

import { useState } from 'react'
import { dueTone, stateVars } from '@/lib/design-map'
import { plural, suma } from '@/lib/format'
import type { CtxSesion, Ticket } from '@/lib/tipos'
import { useNuevoTicket } from '@/components/nuevo/NuevoTicketProvider'
import {
  Apoyos,
  Avatar,
  ChipEstado,
  CirculoPrioridad,
  Etiquetas,
  NumeroTicket,
  PillTipo,
  Vencimiento,
} from '@/components/ui/piezas'
import { IconoCaret, IconoComentario, IconoElipsis, IconoUsuario } from '@/components/ui/iconos'
import type { Grupo } from './TicketsVista'

/**
 * Grid de 11 columnas. Los anchos viven en `--cols` (tokens.css) para que la
 * columna de peso se pueda colapsar a 0 sin mover ninguna otra.
 *
 * `filaHover` no es estado de React a propósito: con cientos de filas, un
 * setState por movimiento del puntero re-renderiza la tabla entera. El hover y
 * el ancho de la tira son CSS.
 */
export function Tabla({
  grupos,
  colapsados,
  onColapsar,
  onAbrir,
  ticketAbierto,
  sesion,
  hayFiltros,
  vacio,
}: {
  grupos: Grupo[]
  colapsados: Record<string, boolean>
  onColapsar: (clave: string) => void
  onAbrir: (id: string | null) => void
  ticketAbierto: string | null
  sesion: CtxSesion
  hayFiltros: boolean
  vacio: boolean
}) {
  const { abrir } = useNuevoTicket()

  if (vacio) {
    return (
      <div className="tabla">
        <Encabezado />
        <div className="vacio">
          {hayFiltros ? (
            <>
              <h2>Ningún ticket coincide con estos filtros</h2>
              <p>
                Probá quitar el filtro más restrictivo, o creá el ticket que estabas buscando.
              </p>
              <button type="button" className="btn-primario" onClick={() => abrir()}>
                Nuevo ticket
              </button>
            </>
          ) : (
            <>
              <h2>Todavía no hay tickets</h2>
              <p>
                Creá el primero, o importá el trabajo que ya está en una planilla desde Ajustes.
              </p>
              {sesion.role !== 'viewer' && (
                <button type="button" className="btn-primario" onClick={() => abrir()}>
                  Nuevo ticket
                </button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="tabla" role="table" aria-label="Tickets">
      <Encabezado />

      {grupos.map((g) => {
        if (!g.tickets.length) return null

        const colapsado = colapsados[g.clave]
        const vencidos = g.tickets.filter((t) => {
          const tono = dueTone(t.due_date)
          return tono === 'overdue' && t.state !== 'done' && t.state !== 'cancelled'
        }).length

        return (
          <div key={g.clave}>
            <button
              type="button"
              className="grupo-cab"
              aria-expanded={!colapsado}
              onClick={() => onColapsar(g.clave)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' && !colapsado) onColapsar(g.clave)
                if (e.key === 'ArrowRight' && colapsado) onColapsar(g.clave)
              }}
            >
              <IconoCaret abierto={!colapsado} />
              <span
                className="grupo-chip ui-xs"
                style={{ color: g.color ?? 'var(--tinta-2)', background: g.fondo ?? 'var(--superficie-3)' }}
              >
                {g.titulo}
              </span>
              <span className="mono-sm" style={{ color: 'var(--tinta-2)' }}>
                {g.tickets.length}
              </span>
              {sesion.pesoActivo && (
                <span className="mono-sm" data-col="peso" style={{ color: 'var(--tinta-3)' }}>
                  peso {suma(g.tickets.map((t) => t.weight))}
                </span>
              )}
              {vencidos > 0 && (
                <span className="mono-sm vencido">{plural(vencidos, 'vencido', 'vencidos')}</span>
              )}
            </button>

            {!colapsado &&
              g.tickets.map((t) => (
                <Fila
                  key={t.id}
                  ticket={t}
                  abierta={ticketAbierto === t.id}
                  onAbrir={onAbrir}
                  pesoActivo={sesion.pesoActivo}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}

function Encabezado() {
  return (
    <div className="tabla-cab mono-xs" role="row">
      <span />
      <span>Nº</span>
      <span>Título</span>
      <span data-col="tipo">Tipo</span>
      <span data-col="estado">Estado</span>
      <span data-col="prio">Prio</span>
      <span data-col="dueno">Dueño</span>
      <span data-col="apoyos">Apoyos</span>
      <span data-col="etiquetas">Etiquetas</span>
      <span data-col="peso" style={{ textAlign: 'right' }}>
        Peso
      </span>
      <span>Vence</span>
    </div>
  )
}

function Fila({
  ticket,
  abierta,
  onAbrir,
  pesoActivo,
}: {
  ticket: Ticket
  abierta: boolean
  onAbrir: (id: string | null) => void
  pesoActivo: boolean
}) {
  const { fg } = stateVars(ticket.state)
  const [menu, setMenu] = useState(false)

  return (
    <div
      className="tabla-fila"
      role="row"
      tabIndex={0}
      data-abierta={abierta}
      onClick={() => onAbrir(ticket.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAbrir(ticket.id)
        }
      }}
    >
      <span className="tira-estado" style={{ background: fg }} />

      <span className="celda">
        <NumeroTicket numero={ticket.number} estado={ticket.state} />
      </span>

      <span className="celda-titulo">
        <span title={ticket.title}>{ticket.title}</span>
        {ticket.imported && (
          <span className="badge-ext" title="Importado de una planilla">
            imp
          </span>
        )}
        <span className="acciones-fila">
          <button
            type="button"
            className="btn-icono"
            title="Ver dueño y apoyos"
            onClick={(e) => {
              e.stopPropagation()
              onAbrir(ticket.id)
            }}
          >
            <IconoUsuario size={12} />
          </button>
          <button
            type="button"
            className="btn-icono"
            title="Comentar"
            onClick={(e) => {
              e.stopPropagation()
              onAbrir(ticket.id)
            }}
          >
            <IconoComentario size={12} />
          </button>
          <button
            type="button"
            className="btn-icono"
            title="Más acciones"
            aria-expanded={menu}
            onClick={(e) => {
              e.stopPropagation()
              setMenu(!menu)
            }}
          >
            <IconoElipsis size={12} />
          </button>
        </span>
      </span>

      <span className="celda" data-col="tipo">
        <PillTipo tipo={ticket.tipo} />
      </span>

      <span className="celda" data-col="estado">
        <ChipEstado estado={ticket.state} />
      </span>

      <span className="celda" data-col="prio">
        <CirculoPrioridad prioridad={ticket.prioridad} />
      </span>

      <span className="celda" data-col="dueno">
        <Avatar persona={ticket.owner} />
      </span>

      <span className="celda" data-col="apoyos">
        <Apoyos personas={ticket.apoyos} />
      </span>

      <span className="celda" data-col="etiquetas">
        <Etiquetas etiquetas={ticket.etiquetas} />
      </span>

      <span className="celda mono-sm" data-col="peso" style={{ textAlign: 'right' }}>
        {pesoActivo ? (ticket.weight ?? '—') : null}
      </span>

      <span className="celda">
        <Vencimiento iso={ticket.due_date} />
      </span>
    </div>
  )
}
