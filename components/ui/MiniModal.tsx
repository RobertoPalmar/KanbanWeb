'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconoCerrar } from '@/components/ui/iconos'

/**
 * Diálogo chico reutilizable: alta de un elemento, confirmación de un borrado.
 *
 * POR QUÉ EXISTE ESTE COMPONENTE Y NO SE COPIA EL PATRÓN OTRA VEZ
 *
 * `ModalNuevoTicket` y `DialogoMotivo` ya usan `.overlay` + `.modal` con
 * `role="dialog"`, pero cada uno reimplementó su propio `keydown`: el de ticket
 * nuevo atrapa el foco, el de motivo solo escucha Escape, y ninguno de los dos
 * bloquea el scroll del fondo ni devuelve el foco al disparador. Con dos
 * diálogos más en el catálogo (alta de tipo, alta de etiqueta) y uno por
 * confirmación de borrado, la cuarta copia del mismo `useEffect` era el momento
 * de tener la pieza. Las CLASES son las del proyecto —no hay CSS nuevo de
 * overlay— así que se ve exactamente igual que los diálogos que ya existían.
 *
 * LO QUE GARANTIZA
 *
 * - Escape cierra. Se escucha en fase de captura y se detiene la propagación:
 *   si no, un mini modal abierto sobre una vista que también escucha Escape
 *   (el panel de detalle) cerraría los dos con una sola tecla.
 * - Clic fuera cierra, con `pointerdown` sobre el overlay y comparando
 *   `target === currentTarget`. No `click`: apretar dentro del diálogo y
 *   soltar sobre el overlay —lo que pasa al arrastrar para seleccionar texto—
 *   dispara un `click` en el overlay y cerraría el diálogo con datos escritos.
 * - Tab circula solo entre los focusables del diálogo, y no se recalcula la
 *   lista al montar sino en cada Tab: la paleta de colores cambia qué botón es
 *   tabbable según el color elegido, así que una lista cacheada se desincroniza.
 * - Al cerrar, el foco vuelve al elemento que lo abrió. Sin esto, cerrar el
 *   alta de un tipo con Escape deja el foco en el `body` y el siguiente Tab
 *   arranca desde el principio de la página.
 * - El scroll del fondo se bloquea con `overflow: hidden` en el `body`,
 *   restaurando el valor previo y no la cadena vacía: Ajustes no lo toca hoy,
 *   pero borrar el valor a ciegas es la clase de bug que aparece meses después.
 */
export function MiniModal({
  titulo,
  descripcion,
  ancho = 460,
  onCerrar,
  children,
  pie,
}: {
  titulo: string
  /** Línea de contexto bajo el título. Es lo que explica qué se pierde al borrar. */
  descripcion?: ReactNode
  ancho?: number
  onCerrar: () => void
  children?: ReactNode
  /** Botones del pie. Van acá y no en `children` para que el layout sea el mismo en todos. */
  pie: ReactNode
}) {
  const idTitulo = useId()
  const dialogo = useRef<HTMLDivElement>(null)
  /** Quién tenía el foco al abrir. Se le devuelve al cerrar. */
  const disparador = useRef<HTMLElement | null>(null)

  useEffect(() => {
    disparador.current = document.activeElement as HTMLElement | null

    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // El primer focusable del diálogo. Si el contenido trae un `autoFocus` ya se
    // lo llevó él, y este `focus()` no lo pisa porque solo corre si el foco
    // sigue afuera del diálogo.
    const nodo = dialogo.current
    if (nodo && !nodo.contains(document.activeElement)) {
      nodo.querySelector<HTMLElement>(SELECTOR_FOCUSABLE)?.focus()
    }

    return () => {
      document.body.style.overflow = previo
      disparador.current?.focus()
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCerrar()
        return
      }

      if (e.key !== 'Tab' || !dialogo.current) return

      const focusables = Array.from(
        dialogo.current.querySelectorAll<HTMLElement>(SELECTOR_FOCUSABLE),
      ).filter((n) => n.offsetParent !== null || n === document.activeElement)

      if (!focusables.length) return

      const primero = focusables[0]
      const ultimo = focusables[focusables.length - 1]

      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onCerrar])

  return (
    <div
      className="overlay overlay-mini"
      onPointerDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div
        ref={dialogo}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        style={{ width: ancho }}
      >
        <div className="modal-cab">
          <h2 id={idTitulo} style={{ fontSize: 15 }}>
            {titulo}
          </h2>
          <button
            type="button"
            className="btn-icono"
            style={{ marginLeft: 'auto' }}
            aria-label="Cerrar"
            title="Cerrar"
            onClick={onCerrar}
          >
            <IconoCerrar />
          </button>
        </div>

        <div className="modal-cuerpo" style={{ gap: 12 }}>
          {descripcion && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--tinta-2)', lineHeight: 1.5 }}>
              {descripcion}
            </p>
          )}
          {children}
        </div>

        <div className="modal-pie">{pie}</div>
      </div>
    </div>
  )
}

const SELECTOR_FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
