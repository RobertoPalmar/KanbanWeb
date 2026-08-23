'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Menú anclado a un disparador, renderizado en un portal al `body`.
 *
 * No alcanza con `position: absolute`: la barra de filtros lleva
 * `overflow: hidden` a propósito —para que nunca se parta en dos líneas— y el
 * cuerpo del panel de detalle tiene scroll propio. En los dos casos el menú
 * quedaba recortado. Un portal con coordenadas fijas lo saca de cualquier caja.
 */
export function MenuFlotante({
  ancla,
  abierto,
  onCerrar,
  alinear = 'izquierda',
  ancho,
  children,
}: {
  ancla: React.RefObject<HTMLElement | null>
  abierto: boolean
  onCerrar: () => void
  alinear?: 'izquierda' | 'derecha'
  ancho?: number
  children: React.ReactNode
}) {
  const caja = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!abierto) return

    function ubicar() {
      const el = ancla.current
      if (!el) return

      const r = el.getBoundingClientRect()
      const w = ancho ?? caja.current?.offsetWidth ?? 220
      const h = caja.current?.offsetHeight ?? 260

      // Se abre hacia abajo salvo que no quepa; y nunca sale del viewport.
      const abajo = r.bottom + 4
      const arriba = r.top - h - 4
      const top = abajo + h <= window.innerHeight || arriba < 0 ? abajo : arriba

      const crudo = alinear === 'derecha' ? r.right - w : r.left
      const left = Math.max(8, Math.min(crudo, window.innerWidth - w - 8))

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
  }, [abierto, ancla, alinear, ancho])

  useEffect(() => {
    if (!abierto) return

    function fuera(e: PointerEvent) {
      const t = e.target as Node
      if (caja.current?.contains(t) || ancla.current?.contains(t)) return
      onCerrar()
    }

    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCerrar()
      }
    }

    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla, true)

    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', tecla, true)
    }
  }, [abierto, ancla, onCerrar])

  if (!abierto || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={caja}
      className="menu"
      role="menu"
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
  )
}
