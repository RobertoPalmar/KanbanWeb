'use client'

import type { StateKey } from '@/lib/states'
import type { Ticket } from '@/lib/tipos'
import { Avatar, Etiquetas, NumeroTicket, PillPrioridad, PillTipo, Vencimiento } from '@/components/ui/piezas'

/**
 * Tarjeta legible a 280px: tres filas y nada más.
 *
 * El riel de 3px del borde izquierdo dice "esta la podés levantar" antes de
 * intentarlo. Las ajenas no lo tienen y no elevan en hover — la diferencia se
 * percibe sin poner un candado en cada tarjeta.
 */
export function TarjetaKanban({
  ticket,
  estado,
  abierta,
  arrastrando,
  soltado,
  pesoActivo,
  puedeMover,
  onAbrir,
  onArrastrar,
}: {
  ticket: Ticket
  estado: StateKey
  abierta: boolean
  arrastrando?: boolean
  soltado?: boolean
  pesoActivo: boolean
  puedeMover: boolean
  onAbrir: () => void
  onArrastrar: (e: React.PointerEvent) => void
}) {
  return (
    <article
      className="tarjeta"
      data-propia={puedeMover}
      data-arrastrando={arrastrando || undefined}
      data-soltado={soltado || undefined}
      style={abierta ? { borderColor: 'var(--acento)' } : undefined}
      tabIndex={0}
      role="button"
      aria-label={`Ticket ${ticket.number}: ${ticket.title}`}
      onPointerDown={(e) => {
        if (!puedeMover || e.button !== 0) return
        onArrastrar(e)
      }}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAbrir()
        }
      }}
    >
      <div className="tarjeta-meta">
        <NumeroTicket numero={ticket.number} estado={estado} />
        <PillTipo tipo={ticket.tipo} />
        <span style={{ marginLeft: 'auto' }}>
          <PillPrioridad prioridad={ticket.prioridad} />
        </span>
      </div>

      <p className="tarjeta-titulo">{ticket.title}</p>

      <div className="tarjeta-pie">
        <Etiquetas etiquetas={ticket.etiquetas} />
        <span className="tarjeta-pie-derecha">
          {pesoActivo && ticket.weight != null && (
            <span className="mono-sm" data-col="peso" style={{ color: 'var(--tinta-2)' }}>
              {ticket.weight} pt
            </span>
          )}
          <Vencimiento iso={ticket.due_date} />
          <Avatar persona={ticket.owner} />
        </span>
      </div>
    </article>
  )
}
