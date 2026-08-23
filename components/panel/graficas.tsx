/**
 * Gráficas del Panel.
 *
 * Todas son SVG o divs con ancho porcentual: ninguna librería. Muestran
 * distribución y tendencia, nunca un número grande con flechita verde — con ocho
 * personas, la métrica que importa es dónde está atascado el trabajo.
 */

import { MESES } from '@/lib/format'

/* -------------------------------------------------------------------------- */
/* Barras dobles: creados y cerrados por semana                                */
/* -------------------------------------------------------------------------- */

export interface SemanaBarras {
  semana: string
  creados: number
  cerrados: number
}

const AZUL = '#0A73E8'
const VERDE = '#0F9D58'

export function BarrasCreadosCerrados({ semanas }: { semanas: SemanaBarras[] }) {
  const max = Math.max(1, ...semanas.flatMap((s) => [s.creados, s.cerrados]))

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
        <Leyenda color={AZUL} texto="Creados" />
        <Leyenda color={VERDE} texto="Cerrados" />
      </div>

      <div className="grafica-scroll">
        <div
          className="grafica-barras"
          style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130 }}
        >
        {semanas.map((s) => (
          <div
            key={s.semana}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 130 }}>
              <Barra valor={s.creados} max={max} color={AZUL} etiqueta={`${s.creados} creados`} />
              <Barra valor={s.cerrados} max={max} color={VERDE} etiqueta={`${s.cerrados} cerrados`} />
            </div>
            <span className="mono-xs" style={{ color: 'var(--tinta-3)' }}>
              {s.semana}
            </span>
          </div>
        ))}
        </div>
      </div>
    </div>
  )
}

function Barra({
  valor,
  max,
  color,
  etiqueta,
}: {
  valor: number
  max: number
  color: string
  etiqueta: string
}) {
  const alto = valor === 0 ? 2 : Math.max(4, Math.round((valor / max) * 126))

  return (
    <span
      title={etiqueta}
      style={{
        width: 16,
        height: alto,
        background: valor === 0 ? 'var(--superficie-2)' : color,
        borderRadius: '6px 6px 2px 2px',
        transition: 'height .3s',
      }}
    />
  )
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--tinta-2)' }}>
      <span className="punto" style={{ background: color }} />
      {texto}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Dona: estado de la cartera                                                  */
/* -------------------------------------------------------------------------- */

export interface Segmento {
  clave: string
  etiqueta: string
  valor: number
  color: string
}

export function Dona({ segmentos, centro, pie }: { segmentos: Segmento[]; centro: number; pie: string }) {
  const total = segmentos.reduce((a, s) => a + s.valor, 0)
  let acumulado = 0

  return (
    <div className="grafica-dona">
      <div style={{ position: 'relative', width: 112, height: 112, flex: 'none' }}>
        <svg viewBox="0 0 42 42" width={112} height={112} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--superficie-2)" strokeWidth="7" />
          {total > 0 &&
            segmentos
              .filter((s) => s.valor > 0)
              .map((s) => {
                const porcion = (s.valor / total) * 100
                const dash = `${porcion} ${100 - porcion}`
                const offset = 100 - acumulado
                acumulado += porcion

                return (
                  <circle
                    key={s.clave}
                    cx="21"
                    cy="21"
                    r="15.9"
                    fill="none"
                    stroke={s.color}
                    strokeWidth="7"
                    strokeDasharray={dash}
                    strokeDashoffset={offset}
                  >
                    <title>{`${s.etiqueta}: ${s.valor}`}</title>
                  </circle>
                )
              })}
        </svg>

        <span
          className="mono"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontSize: 22,
            fontWeight: 600,
          }}
        >
          {centro}
        </span>
      </div>

      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        {segmentos.map((s) => (
          <div
            key={s.clave}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', fontSize: 12 }}
          >
            <span className="punto" style={{ background: s.color }} />
            <span style={{ flex: 1, color: 'var(--tinta-2)' }}>{s.etiqueta}</span>
            <span className="mono-sm">{s.valor}</span>
          </div>
        ))}
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--tinta-3)' }}>{pie}</p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Barras horizontales: volumen por tipo                                       */
/* -------------------------------------------------------------------------- */

export function BarrasHorizontales({
  filas,
}: {
  filas: Array<{ clave: string; etiqueta: string; valor: number; color: string }>
}) {
  const max = Math.max(1, ...filas.map((f) => f.valor))

  return (
    <div>
      {filas.map((f) => (
        <div key={f.clave} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
          <span
            className="barra-h-etiqueta"
            style={{
              width: 130,
              flex: 'none',
              fontSize: 12,
              color: 'var(--tinta-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={f.etiqueta}
          >
            {f.etiqueta}
          </span>
          <span className="riel" style={{ height: 16, borderRadius: 99 }}>
            <span
              style={{
                width: `${(f.valor / max) * 100}%`,
                background: f.color,
                borderRadius: 99,
                display: 'block',
                height: '100%',
              }}
            />
          </span>
          <span className="mono-sm" style={{ width: 26, textAlign: 'right', flex: 'none' }}>
            {f.valor}
          </span>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Barra segmentada: distribución por estado                                   */
/* -------------------------------------------------------------------------- */

export function BarraSegmentada({ segmentos }: { segmentos: Segmento[] }) {
  const total = segmentos.reduce((a, s) => a + s.valor, 0) || 1

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height: 10, marginBottom: 12 }}>
        {segmentos
          .filter((s) => s.valor > 0)
          .map((s) => (
            <span
              key={s.clave}
              title={`${s.etiqueta}: ${s.valor}`}
              style={{
                flex: s.valor,
                background: s.color,
                borderRadius: 99,
                transition: 'flex .3s',
              }}
            />
          ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {segmentos.map((s) => (
          <span
            key={s.clave}
            className="chip-etiqueta"
            style={{ gap: 5, display: 'inline-flex', alignItems: 'center' }}
          >
            <span className="punto" style={{ background: s.color }} />
            {s.etiqueta}
            <span className="mono-sm">{s.valor}</span>
          </span>
        ))}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--tinta-3)' }}>
        {total} tickets en total, borradores incluidos.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Serie de cycle time p85                                                     */
/* -------------------------------------------------------------------------- */

export interface PuntoCiclo {
  semana: string
  p85: number | null
  muestra: number
}

/**
 * Un p85 de 6 días no dice nada; que haya pasado de 3 a 6 en cinco semanas, sí.
 * Por eso es una serie y no un número, y por eso cada barra declara su tamaño de
 * muestra: con dos tickets cerrados, el percentil es anecdótico.
 */
export function SerieCicloP85({ puntos }: { puntos: PuntoCiclo[] }) {
  const max = Math.max(1, ...puntos.map((p) => p.p85 ?? 0))
  const ultimo = [...puntos].reverse().find((p) => p.p85 != null)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <span className="mono" style={{ fontSize: 22, fontWeight: 600 }}>
          {ultimo?.p85 ?? '—'}
        </span>
        <span style={{ fontSize: 12, color: 'var(--tinta-2)' }}>
          días, percentil 85 de la última semana con cierres
        </span>
      </div>

      <div className="grafica-scroll">
        <div
          className="grafica-barras"
          style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}
        >
        {puntos.map((p) => {
          const alto = p.p85 == null ? 2 : Math.max(4, Math.round((p.p85 / max) * 86))
          const pocaMuestra = p.muestra > 0 && p.muestra < 3

          return (
            <div
              key={p.semana}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
            >
              <span
                title={
                  p.p85 == null
                    ? 'Sin cierres esa semana'
                    : `${p.p85} días · ${p.muestra} ticket${p.muestra === 1 ? '' : 's'}`
                }
                style={{
                  width: 16,
                  height: alto,
                  borderRadius: '6px 6px 2px 2px',
                  background: p.p85 == null ? 'var(--superficie-2)' : 'var(--e4-fg)',
                  // Muestra chica: borde punteado. La marca no cromática evita
                  // leer como tendencia lo que es un solo ticket.
                  border: pocaMuestra ? '1px dashed var(--tinta-3)' : undefined,
                  transition: 'height .3s',
                }}
              />
              <span className="mono-xs" style={{ color: 'var(--tinta-3)' }}>
                {p.semana}
              </span>
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}

/** Etiqueta corta de semana: "18 ago". */
export function etiquetaSemana(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return `${d.getDate()} ${MESES[d.getMonth()]}`
}
