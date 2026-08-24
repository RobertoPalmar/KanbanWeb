'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconoInfo } from '@/components/ui/iconos'

/**
 * Ícono de ayuda con su explicación al lado.
 *
 * Se abre con hover, con foco de teclado y con clic. Los tres hacen falta:
 * en táctil no hay hover, con teclado no hay puntero, y el clic deja el texto
 * fijo para poder leerlo sin mantener el mouse quieto.
 *
 * El globo se monta en un portal al `body` con coordenadas fijas, igual que
 * `MenuFlotante`: `.app` y `.contenido` llevan `overflow: hidden` y la fila de
 * miembro es angosta, así que un `position: absolute` quedaba recortado o
 * empujaba scroll horizontal. Por coordenadas nunca sale del viewport.
 *
 * `title` queda como respaldo para el caso raro en que el JS no haya montado.
 */
export function Pista({
  etiqueta,
  children,
  ancho = 260,
  respaldo,
}: {
  /** Qué explica, para el `aria-label` del disparador. Ej.: "capacidad". */
  etiqueta: string
  children: React.ReactNode
  ancho?: number
  /** Respaldo nativo por si el JS no monto. Si se omite se usa el texto plano. */
  respaldo?: string
}) {
  const id = useId()
  const disparador = useRef<HTMLButtonElement>(null)
  const globo = useRef<HTMLDivElement>(null)

  // `fijado` es el clic (persiste); `rozado` es hover/foco (se va al salir).
  const [fijado, setFijado] = useState(false)
  const [rozado, setRozado] = useState(false)
  const abierto = fijado || rozado

  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!abierto) return

    function ubicar() {
      const el = disparador.current
      if (!el) return

      const r = el.getBoundingClientRect()
      const h = globo.current?.offsetHeight ?? 96
      const margen = 8

      // Preferimos abajo; si no cabe y arriba sí, va arriba.
      const abajo = r.bottom + 6
      const arriba = r.top - h - 6
      const top = abajo + h <= window.innerHeight - margen && arriba >= margen ? abajo : arriba >= margen ? arriba : abajo

      // Centrado sobre el ícono, recortado a los bordes del viewport: en la
      // fila de miembro el ícono está cerca del borde derecho de la tarjeta.
      const crudo = r.left + r.width / 2 - ancho / 2
      const left = Math.max(margen, Math.min(crudo, window.innerWidth - ancho - margen))

      setPos({ top, left })
    }

    ubicar()

    window.addEventListener('resize', ubicar)
    // `true` para capturar el scroll de cualquier contenedor, no solo del window.
    window.addEventListener('scroll', ubicar, true)

    return () => {
      window.removeEventListener('resize', ubicar)
      window.removeEventListener('scroll', ubicar, true)
    }
  }, [abierto, ancho])

  useEffect(() => {
    if (!fijado) return

    function fuera(e: PointerEvent) {
      const t = e.target as Node
      if (globo.current?.contains(t) || disparador.current?.contains(t)) return
      setFijado(false)
    }

    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [fijado])

  useEffect(() => {
    if (!abierto) return

    function tecla(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setFijado(false)
      setRozado(false)
      disparador.current?.focus()
    }

    document.addEventListener('keydown', tecla, true)
    return () => document.removeEventListener('keydown', tecla, true)
  }, [abierto])

  return (
    <>
      <button
        ref={disparador}
        type="button"
        className="pista-boton"
        aria-label={`Qué es ${etiqueta}`}
        title={respaldo}
        aria-expanded={abierto}
        aria-describedby={abierto ? id : undefined}
        data-abierto={abierto ? 'true' : undefined}
        onClick={() => setFijado((v) => !v)}
        onPointerEnter={() => setRozado(true)}
        onPointerLeave={() => setRozado(false)}
        onFocus={() => setRozado(true)}
        onBlur={() => setRozado(false)}
      >
        <IconoInfo size={13} />
      </button>

      {abierto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={globo}
            id={id}
            role="tooltip"
            className="pista-globo"
            style={{
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: ancho,
              visibility: pos ? 'visible' : 'hidden',
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  )
}
