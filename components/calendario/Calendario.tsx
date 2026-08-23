'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { stateVars } from '@/lib/design-map'
import { DIAS_CORTOS, MESES_LARGOS, lunesDe } from '@/lib/format'
import type { Ticket } from '@/lib/tipos'
import { IconoCaret } from '@/components/ui/iconos'
import { BarraProgreso } from '@/components/ui/Spinner'

/**
 * Retícula de seis semanas, lunes primero.
 *
 * `minmax(0, 1fr)` en las columnas y `min-width: 0` en toda la cadena hasta el
 * span del título: con `1fr` un título largo estira la columna y la semana
 * entera se desalinea.
 */
export function Calendario({
  anio,
  mes,
  tickets,
}: {
  anio: number
  mes: number
  tickets: Ticket[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [expandido, setExpandido] = useState<string | null>(null)
  const [navegando, empezarNavegacion] = useTransition()

  const hoy = new Date()
  const isoHoy = claveDia(hoy)

  const primero = new Date(anio, mes - 1, 1)
  const inicio = lunesDe(primero)

  const dias: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio)
    d.setDate(d.getDate() + i)
    dias.push(d)
  }

  // La sexta semana solo se dibuja si el mes realmente llega ahí.
  const necesitaSexta = dias[35].getMonth() === mes - 1
  const visibles = necesitaSexta ? dias : dias.slice(0, 35)

  const porDia = new Map<string, Ticket[]>()
  for (const t of tickets) {
    if (!t.due_date) continue
    const k = t.due_date.slice(0, 10)
    if (!porDia.has(k)) porDia.set(k, [])
    porDia.get(k)!.push(t)
  }

  function navegarMes(delta: number) {
    const d = new Date(anio, mes - 1 + delta, 1)
    const q = new URLSearchParams(params.toString())
    q.set('mes', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    q.delete('ticket')
    ir(q)
  }

  function abrir(id: string) {
    const q = new URLSearchParams(params.toString())
    q.set('ticket', id)
    ir(q)
  }

  /** Clic en la celda: el día entero, no un ticket al azar de ese día. */
  function abrirDia(clave: string) {
    const q = new URLSearchParams(params.toString())
    q.set('dia', clave)
    q.delete('ticket')
    ir(q)
  }

  /** Toda navegación del calendario pasa por acá: una sola barra de progreso. */
  function ir(q: URLSearchParams) {
    empezarNavegacion(() => {
      router.replace(`${pathname}?${q.toString()}`, { scroll: false })
    })
  }

  const diaAbierto = params.get('dia')

  return (
    <>
      <BarraProgreso visible={navegando} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h1 className="titulo-vista">
          {MESES_LARGOS[mes - 1]} {anio}
        </h1>
        <button
          type="button"
          className="btn-circular"
          aria-label="Mes anterior"
          onClick={() => navegarMes(-1)}
        >
          <span style={{ transform: 'rotate(90deg)', display: 'grid' }}>
            <IconoCaret abierto />
          </span>
        </button>
        <button
          type="button"
          className="btn-circular"
          aria-label="Mes siguiente"
          onClick={() => navegarMes(1)}
        >
          <span style={{ transform: 'rotate(-90deg)', display: 'grid' }}>
            <IconoCaret abierto />
          </span>
        </button>
        <span style={{ fontSize: 12, color: 'var(--tinta-3)' }}>
          Los tickets se ubican en su fecha de vencimiento.
        </span>
      </div>

      <div className="calendario-scroll">
        <div className="calendario" style={{ marginBottom: 4 }}>
          {DIAS_CORTOS.map((d) => (
            <span key={d} className="calendario-cab mono-xs">
              {d}
            </span>
          ))}
        </div>

        <div className="calendario">
        {visibles.map((d) => {
          const clave = claveDia(d)
          const delDia = porDia.get(clave) ?? []
          const fuera = d.getMonth() !== mes - 1
          const mostrarTodos = expandido === clave
          const aMostrar = mostrarTodos ? delDia : delDia.slice(0, 3)

          return (
            <div
              key={clave}
              className="celda-dia"
              role="button"
              tabIndex={0}
              aria-label={`${d.getDate()} de ${MESES_LARGOS[d.getMonth()]}: ${delDia.length} tickets`}
              data-fuera={fuera || undefined}
              data-hoy={clave === isoHoy || undefined}
              data-abierta={clave === diaAbierto || undefined}
              onClick={() => abrirDia(clave)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  abrirDia(clave)
                }
              }}
            >
              <span className="celda-dia-num">{d.getDate()}</span>

              {aMostrar.map((t) => {
                const { fg, bg } = stateVars(t.state)
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="pill-cal"
                    style={{ background: bg === 'transparent' ? 'var(--superficie-2)' : bg, color: fg }}
                    title={`${t.number} · ${t.title}`}
                    // La píldora abre SU ticket; la celda abre el día. Sin esto,
                    // el clic en la píldora haría las dos cosas.
                    onClick={(e) => {
                      e.stopPropagation()
                      abrir(t.id)
                    }}
                  >
                    <span className="punto" style={{ background: t.tipo.color, flex: 'none' }} />
                    <span>{t.title}</span>
                  </button>
                )
              })}

              {delDia.length > 3 && (
                <button
                  type="button"
                  className="btn-texto"
                  style={{ fontSize: 10.5, alignSelf: 'flex-start' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpandido(mostrarTodos ? null : clave)
                  }}
                >
                  {mostrarTodos ? 'ver menos' : `+${delDia.length - 3} más`}
                </button>
              )}
            </div>
          )
        })}
        </div>
      </div>
    </>
  )
}

function claveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
