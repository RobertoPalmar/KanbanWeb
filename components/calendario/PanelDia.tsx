'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { DIAS_LARGOS, MESES_LARGOS, parseFecha, plural, suma } from '@/lib/format'
import { dueTone } from '@/lib/design-map'
import type { Ticket } from '@/lib/tipos'
import {
  Avatar,
  ChipEstado,
  CirculoPrioridad,
  NumeroTicket,
  PillTipo,
} from '@/components/ui/piezas'
import { IconoCerrar, IconoMas } from '@/components/ui/iconos'
import { useNuevoTicket } from '@/components/nuevo/NuevoTicketProvider'

/**
 * Panel del día: mismo lugar y mismo ancho que el detalle de ticket.
 *
 * Es el paso intermedio que faltaba en el calendario: una celda de 96px no puede
 * mostrar seis tickets, y abrir uno al azar no responde la pregunta real, que es
 * "qué hay que entregar ese día".
 */
export function PanelDia({ dia, tickets }: { dia: string; tickets: Ticket[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { abrir, sesion } = useNuevoTicket()

  const fecha = parseFecha(dia)

  function cerrar() {
    const q = new URLSearchParams(params.toString())
    q.delete('dia')
    router.replace(`${pathname}?${q.toString()}`, { scroll: false })
  }

  function abrirTicket(id: string) {
    const q = new URLSearchParams(params.toString())
    q.set('ticket', id)
    router.replace(`${pathname}?${q.toString()}`, { scroll: false })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const vencidos = tickets.filter((t) => dueTone(t.due_date) === 'overdue').length

  return (
    <aside className="panel" role="complementary" aria-label={`Tickets del ${dia}`}>
      <div className="panel-cab">
        <span className="mono-sm" style={{ color: 'var(--tinta-3)' }}>
          {dia}
        </span>
        <strong style={{ fontSize: 13, fontWeight: 500 }}>
          {fecha ? `${DIAS_LARGOS[fecha.getDay()]} ${fecha.getDate()} de ${MESES_LARGOS[fecha.getMonth()]}` : dia}
        </strong>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {sesion.role !== 'viewer' && (
            <button
              type="button"
              className="btn-secundario"
              style={{ height: 24 }}
              onClick={() => abrir({ dueDate: dia })}
            >
              <IconoMas size={11} />
              Nuevo acá
            </button>
          )}
          <button type="button" className="btn-circular" onClick={cerrar} aria-label="Cerrar panel">
            <IconoCerrar />
          </button>
        </span>
      </div>

      <div className="panel-cuerpo">
        <p className="subtitulo" style={{ marginBottom: 14 }}>
          {tickets.length === 0
            ? 'Nada vence este día.'
            : `${plural(tickets.length, 'ticket vence', 'tickets vencen')} este día${
                sesion.pesoActivo ? ` · ${suma(tickets.map((t) => t.weight))} puntos` : ''
              }`}
          {vencidos > 0 && (
            <>
              {' · '}
              <span className="vencido">{plural(vencidos, 'ya vencido', 'ya vencidos')}</span>
            </>
          )}
        </p>

        {tickets.length === 0 ? (
          <div className="columna-vacia" style={{ minHeight: 88 }}>
            Sin entregas
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                className="tarjeta"
                style={{ cursor: 'pointer' }}
                onClick={() => abrirTicket(t.id)}
              >
                <div className="tarjeta-meta">
                  <NumeroTicket numero={t.number} estado={t.state} />
                  <PillTipo tipo={t.tipo} />
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <CirculoPrioridad prioridad={t.prioridad} />
                    <ChipEstado estado={t.state} />
                  </span>
                </div>

                <p className="tarjeta-titulo">{t.title}</p>

                <div className="tarjeta-pie">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Avatar persona={t.owner} size={20} />
                    <span style={{ fontSize: 11.5, color: 'var(--tinta-2)' }}>{t.owner.name}</span>
                  </span>
                  {sesion.pesoActivo && t.weight != null && (
                    <span
                      className="mono-sm tarjeta-pie-derecha"
                      data-col="peso"
                      style={{ color: 'var(--tinta-2)' }}
                    >
                      {t.weight} pt
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
