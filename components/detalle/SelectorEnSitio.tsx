'use client'

import { useEffect, useRef, useState } from 'react'

export interface Opcion {
  valor: string
  texto: string
  color?: string
  deshabilitada?: boolean
  ayuda?: string
}

/**
 * Edición en sitio de un campo del detalle.
 *
 * Cuando el usuario no puede editar, el valor se renderiza con el token de
 * deshabilitado en lugar de ofrecer un control que la base va a rechazar: los
 * apoyos ven el panel completo, pero no lo editan.
 */
export function SelectorEnSitio({
  etiqueta,
  valorVisible,
  opciones,
  seleccionado,
  editable,
  multiple = false,
  seleccionados,
  onElegir,
  onElegirVarios,
  ayudaBloqueo,
}: {
  etiqueta: string
  valorVisible: React.ReactNode
  opciones: Opcion[]
  seleccionado?: string | null
  editable: boolean
  multiple?: boolean
  seleccionados?: string[]
  onElegir?: (valor: string) => void
  onElegirVarios?: (valores: string[]) => void
  ayudaBloqueo?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [borrador, setBorrador] = useState<string[]>(seleccionados ?? [])
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => setBorrador(seleccionados ?? []), [seleccionados])

  useEffect(() => {
    if (!abierto) return

    function fuera(e: PointerEvent) {
      if (caja.current?.contains(e.target as Node)) return
      if (multiple && onElegirVarios) onElegirVarios(borrador)
      setAbierto(false)
    }

    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto, borrador, multiple, onElegirVarios])

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <button
        type="button"
        className="panel-valor"
        disabled={!editable}
        title={editable ? `Editar ${etiqueta.toLowerCase()}` : ayudaBloqueo}
        aria-label={`${etiqueta}: editar`}
        onClick={() => editable && setAbierto(!abierto)}
      >
        {valorVisible}
      </button>

      {abierto && (
        <div className="menu" style={{ top: 28, left: 0 }}>
          {opciones.length === 0 && <div className="menu-titulo">Sin opciones disponibles</div>}

          {opciones.map((o) => {
            const marcado = multiple ? borrador.includes(o.valor) : seleccionado === o.valor

            return (
              <button
                key={o.valor}
                type="button"
                className="menu-item"
                data-activo={marcado}
                disabled={o.deshabilitada}
                title={o.ayuda}
                onClick={() => {
                  if (multiple) {
                    setBorrador((b) =>
                      b.includes(o.valor) ? b.filter((x) => x !== o.valor) : [...b, o.valor],
                    )
                    return
                  }
                  onElegir?.(o.valor)
                  setAbierto(false)
                }}
              >
                {o.color && <span className="punto" style={{ background: o.color }} />}
                <span style={{ flex: 1 }}>{o.texto}</span>
                {marcado && <span aria-hidden="true">✓</span>}
              </button>
            )
          })}

          {multiple && (
            <button
              type="button"
              className="menu-item"
              style={{ color: 'var(--acento)' }}
              onClick={() => {
                onElegirVarios?.(borrador)
                setAbierto(false)
              }}
            >
              Guardar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
