'use client'

import { PALETA_CATALOGO } from '@/lib/paleta'
import { typePillBackground } from '@/lib/design-map'

/**
 * Rejilla de colores de la paleta fija.
 *
 * NO es un `input type="color"` a propósito. El color de un tipo o de una
 * etiqueta se guarda como un hex único que se pinta igual en tema claro y en
 * oscuro, así que un valor libre puede quedar ilegible en uno de los dos y el
 * admin no lo ve hasta que otra persona abre el tablero con el otro tema. Los
 * doce de la paleta están calculados para superar 3:1 en ambos — ver lib/paleta.ts.
 *
 * ACCESIBILIDAD
 *
 * Es un `radiogroup`: flechas para moverse, no tab por cada uno de los doce.
 * El seleccionado se marca con un anillo Y con un tilde, no solo con el anillo:
 * en un selector DE colores, distinguir la selección por color sería circular.
 * Cada botón lleva el nombre del color en `aria-label`, porque "swatch 7" no le
 * dice nada a nadie.
 */
export function SelectorColor({
  valor,
  onChange,
  etiqueta,
  disabled = false,
}: {
  valor: string
  onChange: (hex: string) => void
  etiqueta: string
  disabled?: boolean
}) {
  const indice = PALETA_CATALOGO.findIndex((c) => c.hex === valor)

  /** Flechas: mueven la selección, que es lo que se espera en un radiogroup. */
  function alTeclado(e: React.KeyboardEvent) {
    const paso =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0

    if (paso === 0 || disabled) return

    e.preventDefault()
    const base = indice < 0 ? 0 : indice
    const siguiente = (base + paso + PALETA_CATALOGO.length) % PALETA_CATALOGO.length
    onChange(PALETA_CATALOGO[siguiente].hex)
  }

  return (
    <div
      className="paleta-rejilla"
      role="radiogroup"
      aria-label={etiqueta}
      onKeyDown={alTeclado}
    >
      {PALETA_CATALOGO.map((color, i) => {
        const elegido = color.hex === valor

        return (
          <button
            key={color.hex}
            type="button"
            role="radio"
            aria-checked={elegido}
            aria-label={color.nombre}
            title={color.nombre}
            disabled={disabled}
            // Solo el elegido es tabbable: el grupo entero es UNA parada de tab.
            // Sin foco todavía, la primera muestra recibe el tab.
            tabIndex={elegido || (indice < 0 && i === 0) ? 0 : -1}
            className="paleta-muestra"
            data-elegido={elegido ? 'si' : undefined}
            style={{
              background: typePillBackground(color.hex),
              // El anillo se dibuja con box-shadow y no con border: un border
              // de 2px al seleccionar movería las otras once muestras.
              boxShadow: elegido ? `0 0 0 2px ${color.hex}` : undefined,
            }}
            onClick={() => onChange(color.hex)}
          >
            <span className="paleta-punto" style={{ background: color.hex }}>
              {elegido && (
                <svg viewBox="0 0 14 14" width="10" height="10" aria-hidden="true">
                  <path
                    d="M3 7.4l2.6 2.6L11 4.6"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
