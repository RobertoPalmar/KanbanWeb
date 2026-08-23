'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { aprobarBorrador, rechazarBorrador } from '@/app/actions/drafts'
import { typePillBackground } from '@/lib/design-map'
import { fechaCorta, plural } from '@/lib/format'
import { Avatar } from '@/components/ui/piezas'
import { DialogoMotivo } from '@/components/tickets/DialogoMotivo'
import { Spinner } from '@/components/ui/Spinner'

export interface FilaBorrador {
  issue_id: string
  number: number
  title: string
  created_at: string
  due_date: string | null
  weight: number | null
  type_name: string
  type_abbrev: string
  type_color: string
  priority_name: string | null
  creator_id: string
  creator_name: string
  owner_id: string
  owner_name: string
  days_waiting: number
}

/**
 * Un contenedor único, no tarjetas sueltas: el trabajo de esta pantalla es
 * comparar filas entre sí, y las tarjetas separadas lo entorpecen.
 *
 * Las columnas no se mueven nunca, igual que en la tabla.
 */
export function BandejaBorradores({
  filas,
  pesoActivo,
}: {
  filas: FilaBorrador[]
  pesoActivo: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [rechazando, setRechazando] = useState<FilaBorrador | null>(null)
  const [enCurso, setEnCurso] = useState<string | null>(null)

  const masVieja = filas.reduce((max, f) => Math.max(max, f.days_waiting), 0)
  const dias = Math.floor(masVieja)

  async function aprobar(f: FilaBorrador) {
    setEnCurso(f.issue_id)
    setError(null)
    const res = await aprobarBorrador(f.issue_id)
    setEnCurso(null)
    if (!res.ok) setError(res.error)
    else router.refresh()
  }

  return (
    <>
      <h1 className="titulo-vista" style={{ fontSize: 24 }}>
        Borradores
      </h1>
      <p className="subtitulo">
        {filas.length === 0 ? (
          'Nada esperando aprobación.'
        ) : (
          <>
            {plural(filas.length, 'solicitud esperando aprobación', 'solicitudes esperando aprobación')}
            {' · la más antigua '}
            <span
              style={{
                color: dias >= 7 ? 'var(--alerta)' : dias >= 3 ? 'var(--e4-fg)' : 'var(--tinta-2)',
                fontWeight: dias >= 3 ? 500 : 400,
              }}
            >
              {dias === 0 ? 'de hoy' : `hace ${plural(dias, 'día', 'días')}`}
            </span>
          </>
        )}
      </p>

      {error && <p className="error-caja" style={{ marginBottom: 14 }}>{error}</p>}

      {filas.length === 0 ? (
        <div className="vacio">
          <h2>La bandeja está vacía</h2>
          <p>
            Cuando alguien cree un ticket y se lo asigne a otra persona, va a aparecer acá esperando
            tu aprobación. Hasta entonces, ese trabajo no entra en ninguna cola.
          </p>
          <Link className="btn-primario" href="/tickets">
            Ir a Tickets
          </Link>
        </div>
      ) : (
        <div className="bandeja">
          <div className="bandeja-cab mono-xs">
            <span />
            <span>Nº</span>
            <span>Título</span>
            <span>Tipo</span>
            <span>De / para</span>
            <span data-col="peso" style={{ textAlign: 'right' }}>
              Peso
            </span>
            <span>Esperando</span>
          </div>

          {filas.map((f) => {
            const d = Math.floor(f.days_waiting)
            const tono = d >= 7 ? 'var(--alerta)' : d >= 3 ? 'var(--e4-fg)' : 'var(--tinta-2)'

            return (
              <div className="bandeja-fila" key={f.issue_id}>
                <span className="tira-estado" style={{ background: 'var(--e1-fg)' }} />

                <span className="mono-sm" style={{ color: 'var(--tinta-3)' }}>
                  {f.number}
                </span>

                <Link
                  href={`/tickets?ticket=${f.issue_id}`}
                  className="celda"
                  style={{ fontSize: 13 }}
                  title={f.title}
                >
                  {f.title}
                </Link>

                <span className="celda">
                  <span
                    className="pill-tipo"
                    style={{ background: typePillBackground(f.type_color), color: f.type_color }}
                    title={f.type_name}
                  >
                    <span className="punto" style={{ background: f.type_color }} />
                    {f.type_abbrev}
                  </span>
                </span>

                {/* El dato central: quién pidió el trabajo y para quién. */}
                <span className="celda" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Avatar persona={{ id: f.creator_id, name: f.creator_name }} size={18} />
                  <span style={{ fontSize: 11.5, color: 'var(--tinta-3)' }}>→</span>
                  <Avatar persona={{ id: f.owner_id, name: f.owner_name }} size={18} />
                  <span
                    style={{
                      fontSize: 11.5,
                      color: 'var(--tinta-2)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.owner_name.split(' ')[0]}
                  </span>
                </span>

                <span className="celda mono-sm" data-col="peso" style={{ textAlign: 'right' }}>
                  {pesoActivo ? (f.weight ?? '—') : null}
                </span>

                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="mono-sm" style={{ color: tono, flex: 'none', width: 42 }} title={`Creado ${fechaCorta(f.created_at.slice(0, 10))}`}>
                    {d === 0 ? 'hoy' : `${d} d`}
                  </span>
                  <button
                    type="button"
                    className="btn-primario"
                    style={{ height: 24, padding: '0 10px' }}
                    disabled={enCurso === f.issue_id}
                    onClick={() => void aprobar(f)}
                  >
                    {enCurso === f.issue_id && <Spinner label="Aprobando" />}
                    Aprobar
                  </button>
                  <button
                    type="button"
                    className="btn-secundario"
                    style={{ height: 24, padding: '0 10px' }}
                    disabled={enCurso === f.issue_id}
                    onClick={() => setRechazando(f)}
                  >
                    Rechazar
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {rechazando && (
        <DialogoMotivo
          titulo={`Rechazar “${rechazando.title}”`}
          descripcion="Rechazar cancela el ticket, y el motivo queda en su historial. Es lo que le explica a quien lo pidió por qué este trabajo no va."
          onCancelar={() => setRechazando(null)}
          onConfirmar={async (motivo) => {
            const f = rechazando
            setRechazando(null)
            const res = await rechazarBorrador(f.issue_id, motivo)
            if (!res.ok) setError(res.error)
            else router.refresh()
          }}
        />
      )}
    </>
  )
}
