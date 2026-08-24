'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ORDERED_STATES, STATES, type StateKey } from '@/lib/states'
import { allowedTargets, checkTransition, requiresComment } from '@/lib/transitions'
import { canMoveIssue } from '@/lib/permissions'
import { kanbanColumnBackground, stateVars } from '@/lib/design-map'
import { plural, suma } from '@/lib/format'
import { moverEstado } from '@/app/actions/issues'
import type { CtxSesion, Ticket } from '@/lib/tipos'
import { TarjetaKanban } from './TarjetaKanban'
import { DialogoMotivo } from './DialogoMotivo'

/**
 * Kanban de seis columnas con arrastre por eventos de puntero.
 *
 * No usa HTML5 drag and drop: el arrastre nativo no permite el feedback en vivo
 * que el diseño pide (columnas inválidas al 38 %, fantasma bajo el cursor,
 * barra de pista). Umbral de 5px para no romper el clic que abre el detalle.
 *
 * El feedback va DURANTE el arrastre, nunca después de soltar: con seis
 * columnas y dos o tres destinos válidos, enterarse al soltar es tarde.
 */

interface Arrastre {
  id: string
  desde: StateKey
  titulo: string
  numero: number
  x: number
  y: number
  sobre: StateKey | null
  activo: boolean
}

export function Kanban({
  tickets,
  onAbrir,
  ticketAbierto,
  sesion,
  resaltarPropios,
}: {
  tickets: Ticket[]
  onAbrir: (id: string | null) => void
  ticketAbierto: string | null
  sesion: CtxSesion
  resaltarPropios: boolean
}) {
  const router = useRouter()
  const [arrastre, setArrastre] = useState<Arrastre | null>(null)
  const [soltado, setSoltado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendienteMotivo, setPendienteMotivo] = useState<{
    id: string
    hacia: StateKey
    titulo: string
  } | null>(null)
  /** Estado optimista: se aplica ya y se revierte si la base rechaza. */
  const [optimista, setOptimista] = useState<Record<string, StateKey>>({})

  const inicio = useRef<{ x: number; y: number } | null>(null)
  const columnas = useRef(new Map<StateKey, HTMLElement>())

  /**
   * El arrastre vive en un ref además del estado.
   *
   * Los handlers de puntero lo necesitan para decidir, y resolverlo dentro del
   * updater de `setArrastre` significaría disparar la server action durante el
   * render — que es exactamente lo que React prohíbe.
   */
  const arrastreRef = useRef<Arrastre | null>(null)

  const aplicarArrastre = useCallback((a: Arrastre | null) => {
    arrastreRef.current = a
    setArrastre(a)
  }, [])

  const estadoDe = useCallback(
    (t: Ticket): StateKey => optimista[t.id] ?? t.state,
    [optimista],
  )

  const esAdmin = sesion.role === 'admin'

  const mover = useCallback(
    async (id: string, desde: StateKey, hacia: StateKey, comentario?: string) => {
      setOptimista((o) => ({ ...o, [id]: hacia }))
      setSoltado(id)
      setTimeout(() => setSoltado((s) => (s === id ? null : s)), 900)

      const res = await moverEstado(id, hacia, comentario)

      if (!res.ok) {
        setOptimista((o) => {
          const copia = { ...o }
          delete copia[id]
          return copia
        })

        if (res.needsComment) {
          const t = tickets.find((x) => x.id === id)
          setPendienteMotivo({ id, hacia, titulo: t?.title ?? '' })
        } else {
          setError(res.error ?? 'No se pudo mover el ticket.')
        }
        return
      }

      // El estado optimista ya cumplió: dejarlo puesto enmascararía un cambio
      // que venga del servidor después.
      router.refresh()
      setOptimista((o) => {
        const copia = { ...o }
        delete copia[id]
        return copia
      })
    },
    [router, tickets],
  )

  // Listeners a nivel window: el puntero se sale de la tarjeta enseguida.
  useEffect(() => {
    if (!arrastre) return

    function onMove(e: PointerEvent) {
      const a = arrastreRef.current
      if (!a) return

      const activo =
        a.activo ||
        (inicio.current !== null &&
          Math.hypot(e.clientX - inicio.current.x, e.clientY - inicio.current.y) > 5)

      let sobre: StateKey | null = null
      for (const [estado, el] of columnas.current) {
        const r = el.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          sobre = estado
          break
        }
      }

      aplicarArrastre({ ...a, x: e.clientX, y: e.clientY, sobre, activo })
    }

    function onUp() {
      const a = arrastreRef.current
      aplicarArrastre(null)
      inicio.current = null

      if (!a?.activo || !a.sobre || a.sobre === a.desde) return

      const check = checkTransition(a.desde, a.sobre, {
        isAdmin: esAdmin,
        isOwner: true, // solo se arrastra lo propio; el admin además pasa por RLS
      })

      if (!check.allowed) {
        if (check.reason) setError(check.reason)
        return
      }

      if (requiresComment(a.sobre)) {
        setPendienteMotivo({ id: a.id, hacia: a.sobre, titulo: a.titulo })
      } else {
        void mover(a.id, a.desde, a.sobre)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // `arrastre` solo decide si los listeners están montados: los handlers leen
    // el ref, así que no hace falta re-suscribir en cada pointermove.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(arrastre), esAdmin, mover, aplicarArrastre])

  const destinos = arrastre?.activo
    ? allowedTargets(arrastre.desde, { isAdmin: esAdmin, isOwner: true })
    : []

  const sobreValido = arrastre?.sobre && destinos.includes(arrastre.sobre)

  return (
    <>
      <div className="kanban">
        {ORDERED_STATES.map((estado, i) => {
          const delEstado = tickets.filter((t) => estadoDe(t) === estado)
          const { fg } = stateVars(estado)
          const esDestino = arrastre?.activo && destinos.includes(estado)
          const invalida = Boolean(arrastre?.activo) && !esDestino && estado !== arrastre?.desde

          return (
            <section
              key={estado}
              className="columna"
              data-valida={esDestino || undefined}
              data-invalida={invalida || undefined}
              data-sobre={(esDestino && arrastre?.sobre === estado) || undefined}
              aria-label={`${STATES[estado].label}: ${delEstado.length}`}
              ref={(el) => {
                if (el) columnas.current.set(estado, el)
                else columnas.current.delete(estado)
              }}
            >
              <header
                className="columna-cab"
                style={{ borderTopColor: fg, background: `var(--e${i + 1}-bg)` }}
              >
                <span className="ui-xs" style={{ color: fg }}>
                  {STATES[estado].label}
                </span>
                <span className="columna-cuenta" style={{ background: fg }}>
                  {delEstado.length}
                </span>
                {sesion.pesoActivo && (
                  <span className="columna-peso mono-sm" data-col="peso">
                    peso {suma(delEstado.map((t) => t.weight))}
                  </span>
                )}
              </header>

              <div
                className="columna-cuerpo"
                style={{ background: kanbanColumnBackground(estado) }}
              >
                {delEstado.length === 0 ? (
                  <div className="columna-vacia">
                    {esDestino ? `Soltar en ${STATES[estado].label}` : 'Sin tickets'}
                  </div>
                ) : (
                  delEstado.map((t) => (
                    <TarjetaKanban
                      key={t.id}
                      ticket={t}
                      estado={estadoDe(t)}
                      abierta={ticketAbierto === t.id}
                      arrastrando={arrastre?.activo && arrastre.id === t.id}
                      soltado={soltado === t.id}
                      resaltada={resaltarPropios && t.owner_id === sesion.id}
                      pesoActivo={sesion.pesoActivo}
                      puedeMover={canMoveIssue(
                        { id: sesion.id, role: sesion.role },
                        { ownerId: t.owner_id, createdBy: t.created_by, state: estadoDe(t) },
                      )}
                      onAbrir={() => onAbrir(t.id)}
                      onArrastrar={(e) => {
                        inicio.current = { x: e.clientX, y: e.clientY }
                        aplicarArrastre({
                          id: t.id,
                          desde: estadoDe(t),
                          titulo: t.title,
                          numero: t.number,
                          x: e.clientX,
                          y: e.clientY,
                          sobre: estadoDe(t),
                          activo: false,
                        })
                      }}
                    />
                  ))
                )}
              </div>

              {delEstado.length > 6 && (
                <footer className="columna-pie mono-sm">
                  {delEstado.length} tickets · desplazá para ver el resto
                </footer>
              )}
            </section>
          )
        })}
      </div>

      {arrastre?.activo && (
        <>
          <div className="fantasma" style={{ left: arrastre.x + 14, top: arrastre.y - 12 }}>
            <div className="mono-sm" style={{ color: 'var(--tinta-3)', marginBottom: 3 }}>
              {arrastre.numero}
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.35, marginBottom: 6 }}>{arrastre.titulo}</div>
            <div
              style={{
                fontSize: 11.5,
                color: sobreValido ? 'var(--acento)' : 'var(--tinta-3)',
              }}
            >
              {sobreValido
                ? `Soltar en ${STATES[arrastre.sobre as StateKey].label}`
                : 'Destino no válido'}
            </div>
          </div>

          <div className="pista-arrastre">
            {destinos.length
              ? `Desde ${STATES[arrastre.desde].label} solo se puede pasar a ${destinos
                  .map((d) => STATES[d].label)
                  .join(', ')}.`
              : `${STATES[arrastre.desde].label} es terminal: si el trabajo revive, se crea un ticket nuevo.`}
          </div>
        </>
      )}

      {pendienteMotivo && (
        <DialogoMotivo
          titulo={`Cancelar “${pendienteMotivo.titulo}”`}
          descripcion="Cancelar exige un motivo. Queda en el historial del ticket y es lo que explica, meses después, por qué este trabajo no se hizo."
          onCancelar={() => setPendienteMotivo(null)}
          onConfirmar={async (motivo) => {
            const { id, hacia } = pendienteMotivo
            setPendienteMotivo(null)
            const desde = tickets.find((t) => t.id === id)?.state ?? 'todo'
            await mover(id, desde, hacia, motivo)
          }}
        />
      )}

      {error && (
        <div className="pista-arrastre" style={{ borderColor: 'var(--alerta)', color: 'var(--alerta)' }}>
          {error}
          <button type="button" className="btn-texto" onClick={() => setError(null)}>
            Entendido
          </button>
        </div>
      )}
    </>
  )
}

/** Texto de la cabecera de grupo cuando se agrupa por estado. */
export const resumenColumna = (n: number) => plural(n, 'ticket', 'tickets')
