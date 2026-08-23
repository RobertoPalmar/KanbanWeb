'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useNuevoTicket } from '@/components/nuevo/NuevoTicketProvider'
import { IconoMas } from '@/components/ui/iconos'
import { BotonMenu } from '@/components/shell/MenuLateral'
import { BarraProgreso, Spinner } from '@/components/ui/Spinner'

/**
 * Header de 40px: migaja a la izquierda, conmutador de vista y "Nuevo ticket" a
 * la derecha. El conmutador solo aparece en Tickets, que es donde hay dos formas
 * de ver lo mismo.
 */
export function Header({
  vista,
  conmutador = false,
  orgName,
}: {
  vista: string
  conmutador?: boolean
  orgName: string
}) {
  const { abrir, sesion } = useNuevoTicket()
  const router = useRouter()
  const params = useSearchParams()
  const [cambiando, empezarCambio] = useTransition()
  const modo = params.get('modo') === 'tabla' ? 'tabla' : 'kanban'

  function cambiarModo(nuevo: 'tabla' | 'kanban') {
    const q = new URLSearchParams(params.toString())
    q.set('modo', nuevo)
    // La vista se rearma en el servidor: la transición habilita el spinner del
    // botón y la barra de arriba mientras llega.
    empezarCambio(() => {
      router.replace(`/tickets?${q.toString()}`, { scroll: false })
    })
  }

  return (
    <header className="header">
      <BarraProgreso visible={cambiando} />
      <BotonMenu />
      <div className="migaja">
        <span>{orgName}</span>
        <span aria-hidden="true">/</span>
        <strong>{vista}</strong>
      </div>

      <div className="header-derecha">
        {conmutador && (
          <div className="segmentado" role="group" aria-label="Forma de ver los tickets">
            <button
              type="button"
              aria-pressed={modo === 'tabla'}
              disabled={cambiando}
              onClick={() => cambiarModo('tabla')}
            >
              {cambiando && modo !== 'tabla' && <Spinner label="Cargando tabla" />}
              Tabla
            </button>
            <button
              type="button"
              aria-pressed={modo === 'kanban'}
              disabled={cambiando}
              onClick={() => cambiarModo('kanban')}
            >
              {cambiando && modo !== 'kanban' && <Spinner label="Cargando kanban" />}
              Kanban
            </button>
          </div>
        )}

        {sesion.role !== 'viewer' && (
          <button type="button" className="btn-primario" onClick={() => abrir()}>
            <IconoMas size={12} />
            Nuevo ticket
          </button>
        )}
      </div>
    </header>
  )
}
