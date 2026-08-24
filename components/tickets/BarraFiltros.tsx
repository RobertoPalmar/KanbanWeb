'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ORDERED_STATES, STATES } from '@/lib/states'
import type { Catalogos } from '@/lib/tipos'
import { IconoBuscar, IconoCaret, IconoCerrar, IconoMas } from '@/components/ui/iconos'
import { MenuFlotante } from '@/components/ui/MenuFlotante'
import { Avatar } from '@/components/ui/piezas'
import { BarraProgreso } from '@/components/ui/Spinner'

/**
 * Barra de filtros de 36px en una sola línea, más la fila de chips que solo
 * existe cuando hay filtros aplicados: cero filtros, cero fila.
 *
 * Los filtros viven en la URL. El menú es de teclado primero — se escribe "ana"
 * y salta a "Dueño: Ana".
 */

type Campo = 'tipo' | 'dueno' | 'estado' | 'prio' | 'etiqueta' | 'desde' | 'hasta'

const NOMBRE_CAMPO: Record<Campo, string> = {
  tipo: 'Tipo',
  dueno: 'Dueño',
  estado: 'Estado',
  prio: 'Prioridad',
  etiqueta: 'Etiqueta',
  desde: 'Vence desde',
  hasta: 'Vence hasta',
}

export function BarraFiltros({
  catalogos,
  agrupar,
  total,
  sesionId,
  resaltarPropios,
  onResaltarPropios,
}: {
  catalogos: Catalogos
  agrupar: 'estado' | 'dueno' | 'tipo'
  total: number
  sesionId: string
  /** Preferencia de visualización, no filtro: vive fuera de la URL. */
  resaltarPropios: boolean
  onResaltarPropios: (valor: boolean) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [menuAbierto, setMenuAbierto] = useState<'filtro' | 'agrupar' | 'vista' | 'dueno' | null>(null)
  const [busquedaMenu, setBusquedaMenu] = useState('')
  const [texto, setTexto] = useState(params.get('q') ?? '')

  const [navegando, empezarNavegacion] = useTransition()

  const btnVista = useRef<HTMLButtonElement>(null)
  const btnFiltro = useRef<HTMLButtonElement>(null)
  const btnAgrupar = useRef<HTMLButtonElement>(null)
  const btnDueno = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setTexto(params.get('q') ?? '')
  }, [params])

  // Debounce de la búsqueda: escribir no puede disparar una consulta por letra.
  useEffect(() => {
    const actual = params.get('q') ?? ''
    if (texto === actual) return

    const id = setTimeout(() => {
      navegar({ q: texto || null })
    }, 260)

    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto])

  // El cierre por clic fuera y por Escape lo maneja MenuFlotante.

  function navegar(cambios: Record<string, string | null>) {
    const q = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null || v === '') q.delete(k)
      else q.set(k, v)
    }
    // Cambiar de filtro con un ticket abierto dejaría el panel apuntando a algo
    // que quizá ya no está en la lista.
    q.delete('ticket')
    empezarNavegacion(() => {
      router.replace(`${pathname}?${q.toString()}`, { scroll: false })
    })
  }

  const aplicados = useMemo(() => {
    const lista: Array<{ campo: Campo; valor: string; etiqueta: string }> = []

    const push = (campo: Campo, valor: string | null, etiqueta: string | undefined) => {
      if (valor && etiqueta) lista.push({ campo, valor, etiqueta })
    }

    push('tipo', params.get('tipo'), catalogos.tipos.find((t) => t.id === params.get('tipo'))?.name)
    // `mios=1` es un filtro por persona con otro nombre: aparece como chip para
    // que el contador de filtros aplicados no lo deje afuera.
    const duenoId = params.get('mios') === '1' ? sesionId : params.get('dueno')
    push('dueno', duenoId, catalogos.personas.find((p) => p.id === duenoId)?.name)
    const est = params.get('estado')
    push('estado', est, est && est in STATES ? STATES[est as keyof typeof STATES].label : undefined)
    push('prio', params.get('prio'), catalogos.prioridades.find((p) => p.id === params.get('prio'))?.name)
    push(
      'etiqueta',
      params.get('etiqueta'),
      catalogos.etiquetas.find((e) => e.id === params.get('etiqueta'))?.name,
    )
    push('desde', params.get('desde'), params.get('desde') ?? undefined)
    push('hasta', params.get('hasta'), params.get('hasta') ?? undefined)

    return lista
  }, [params, catalogos, sesionId])

  const vista = params.get('mios') === '1' ? 'Mis tickets' : params.get('vencidos') === '1' ? 'Vencidos' : 'Todos los tickets'

  /**
   * El control de persona y la vista "Mis tickets" son el mismo filtro visto de
   * dos maneras: `mios=1` es un atajo a `dueno=<yo>`. Se muestran unificados
   * para que la barra nunca diga "Todas" mientras la lista trae solo las mías.
   */
  const duenoActivo = params.get('mios') === '1' ? sesionId : params.get('dueno')

  const personaActiva = useMemo(
    () => catalogos.personas.find((p) => p.id === duenoActivo) ?? null,
    [catalogos.personas, duenoActivo],
  )

  // Yo primero: es la elección más frecuente y ahorra recorrer la lista.
  const personasOrdenadas = useMemo(() => {
    const yo = catalogos.personas.filter((p) => p.id === sesionId)
    const resto = catalogos.personas.filter((p) => p.id !== sesionId)
    return [...yo, ...resto]
  }, [catalogos.personas, sesionId])

  /** Elegir persona limpia `mios`: si no, el atajo pisaría la elección. */
  function elegirDueno(id: string | null) {
    navegar({ dueno: id, mios: null })
    setMenuAbierto(null)
  }

  const opciones = useMemo(() => {
    const items: Array<{ campo: Campo; valor: string; texto: string; color?: string }> = []
    catalogos.tipos.forEach((t) =>
      items.push({ campo: 'tipo', valor: t.id, texto: `Tipo: ${t.name}`, color: t.color }),
    )
    catalogos.personas.forEach((p) => items.push({ campo: 'dueno', valor: p.id, texto: `Dueño: ${p.name}` }))
    ORDERED_STATES.forEach((s) =>
      items.push({ campo: 'estado', valor: s, texto: `Estado: ${STATES[s].label}` }),
    )
    catalogos.prioridades.forEach((p) =>
      items.push({ campo: 'prio', valor: p.id, texto: `Prioridad: ${p.name}`, color: p.color }),
    )
    catalogos.etiquetas.forEach((e) =>
      items.push({ campo: 'etiqueta', valor: e.id, texto: `Etiqueta: ${e.name}` }),
    )

    const q = busquedaMenu.trim().toLowerCase()
    return q ? items.filter((i) => i.texto.toLowerCase().includes(q)) : items
  }, [catalogos, busquedaMenu])

  return (
    <>
      <BarraProgreso visible={navegando} />
      <div className="barra-filtros">
        <button
          type="button"
          ref={btnVista}
          className="nombre-vista"
          aria-expanded={menuAbierto === 'vista'}
          onClick={() => setMenuAbierto(menuAbierto === 'vista' ? null : 'vista')}
        >
          {vista}
          {aplicados.length > 0 && <span style={{ color: 'var(--acento)' }}> ·</span>}
          <IconoCaret />
        </button>

        <span className="separador-v" />

        <button
          type="button"
          ref={btnFiltro}
          className="chip-filtro chip-filtro-vacio"
          aria-expanded={menuAbierto === 'filtro'}
          onClick={() => {
            setMenuAbierto(menuAbierto === 'filtro' ? null : 'filtro')
            setBusquedaMenu('')
          }}
        >
          <IconoMas size={11} />
          Filtro
        </button>

        <button
          type="button"
          ref={btnDueno}
          className="chip-filtro"
          data-activo={duenoActivo ? true : undefined}
          aria-expanded={menuAbierto === 'dueno'}
          onClick={() => setMenuAbierto(menuAbierto === 'dueno' ? null : 'dueno')}
        >
          {personaActiva ? (
            <>
              <Avatar persona={personaActiva} size={16} />
              <strong style={{ fontWeight: 500, color: 'var(--tinta)' }}>
                {personaActiva.id === sesionId ? 'Yo' : personaActiva.name}
              </strong>
            </>
          ) : (
            <>Asignado a: <strong style={{ fontWeight: 500, color: 'var(--tinta)' }}>Todas</strong></>
          )}
          <IconoCaret />
        </button>

        <button
          type="button"
          ref={btnAgrupar}
          className="chip-filtro"
          aria-expanded={menuAbierto === 'agrupar'}
          onClick={() => setMenuAbierto(menuAbierto === 'agrupar' ? null : 'agrupar')}
        >
          Agrupar: <strong style={{ fontWeight: 500, color: 'var(--tinta)' }}>{NOMBRE_AGRUPAR[agrupar]}</strong>
          <IconoCaret />
        </button>

        <MenuFlotante
          ancla={btnVista}
          abierto={menuAbierto === 'vista'}
          onCerrar={() => setMenuAbierto(null)}
          ancho={220}
        >
          <div className="menu-titulo">Vistas</div>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              navegar({ mios: null, vencidos: null })
              setMenuAbierto(null)
            }}
          >
            Todos los tickets
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              navegar({ mios: '1', vencidos: null })
              setMenuAbierto(null)
            }}
          >
            Mis tickets
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              navegar({ vencidos: '1', mios: null })
              setMenuAbierto(null)
            }}
          >
            Vencidos
          </button>
        </MenuFlotante>

        <MenuFlotante
          ancla={btnFiltro}
          abierto={menuAbierto === 'filtro'}
          onCerrar={() => setMenuAbierto(null)}
          ancho={260}
        >
          <input
            autoFocus
            value={busquedaMenu}
            onChange={(e) => setBusquedaMenu(e.target.value)}
            placeholder="Escribí para filtrar…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && opciones[0]) {
                navegar({ [opciones[0].campo]: opciones[0].valor })
                setMenuAbierto(null)
              }
            }}
          />
          {opciones.length === 0 && <div className="menu-titulo">Sin coincidencias</div>}
          {opciones.map((o) => (
            <button
              key={`${o.campo}-${o.valor}`}
              type="button"
              className="menu-item"
              onClick={() => {
                navegar({ [o.campo]: o.valor })
                setMenuAbierto(null)
              }}
            >
              {o.color && <span className="punto" style={{ background: o.color }} />}
              {o.texto}
            </button>
          ))}
        </MenuFlotante>

        <MenuFlotante
          ancla={btnDueno}
          abierto={menuAbierto === 'dueno'}
          onCerrar={() => setMenuAbierto(null)}
          ancho={240}
        >
          <div className="menu-titulo">Asignado a</div>
          <button
            type="button"
            className="menu-item"
            data-activo={!duenoActivo}
            onClick={() => elegirDueno(null)}
          >
            Todas las personas
          </button>
          {personasOrdenadas.map((p) => (
            <button
              key={p.id}
              type="button"
              className="menu-item"
              data-activo={duenoActivo === p.id}
              onClick={() => elegirDueno(p.id)}
            >
              <Avatar persona={p} size={18} />
              {p.name}
              {p.id === sesionId && (
                <span className="mono-xs" style={{ marginLeft: 'auto', color: 'var(--tinta-3)' }}>
                  yo
                </span>
              )}
            </button>
          ))}
        </MenuFlotante>

        <MenuFlotante
          ancla={btnAgrupar}
          abierto={menuAbierto === 'agrupar'}
          onCerrar={() => setMenuAbierto(null)}
          ancho={180}
        >
          <div className="menu-titulo">Agrupar por</div>
          {(['estado', 'dueno', 'tipo'] as const).map((g) => (
            <button
              key={g}
              type="button"
              className="menu-item"
              data-activo={agrupar === g}
              onClick={() => {
                navegar({ agrupar: g })
                setMenuAbierto(null)
              }}
            >
              {NOMBRE_AGRUPAR[g]}
            </button>
          ))}
        </MenuFlotante>

        <label className="check-resaltar" title="Destaca tus tickets sin ocultar los demás">
          <input
            type="checkbox"
            checked={resaltarPropios}
            onChange={(e) => onResaltarPropios(e.target.checked)}
          />
          Resaltar tickets propios
        </label>

        <label className="buscador">
          <IconoBuscar size={12} />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por título"
            aria-label="Buscar tickets por título"
          />
        </label>
      </div>

      {aplicados.length > 0 && (
        <div className="fila-chips">
          {aplicados.map((f) => (
            <span key={`${f.campo}-${f.valor}`} className="chip-aplicado">
              <em>{NOMBRE_CAMPO[f.campo]}:</em> {f.etiqueta}
              <button
                type="button"
                aria-label={`Quitar filtro ${NOMBRE_CAMPO[f.campo]}`}
                onClick={() =>
                  navegar(f.campo === 'dueno' ? { dueno: null, mios: null } : { [f.campo]: null })
                }
              >
                <IconoCerrar size={10} />
              </button>
            </span>
          ))}

          <span style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="mono-sm" style={{ color: 'var(--tinta-3)' }}>
              {total} {total === 1 ? 'ticket' : 'tickets'}
            </span>
            <button
              type="button"
              className="btn-texto"
              onClick={() =>
                navegar({
                  tipo: null,
                  dueno: null,
                  mios: null,
                  estado: null,
                  prio: null,
                  etiqueta: null,
                  desde: null,
                  hasta: null,
                })
              }
            >
              Quitar todos
            </button>
          </span>
        </div>
      )}
    </>
  )
}

const NOMBRE_AGRUPAR = { estado: 'Estado', dueno: 'Dueño', tipo: 'Tipo' } as const
