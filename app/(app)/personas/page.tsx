import Link from 'next/link'
import { requireSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listIssues } from '@/lib/queries/issues'
import { getUsers } from '@/lib/queries/catalog'
import { getAgingWip, agingColor } from '@/lib/queries/metrics'
import { aplanarTicket } from '@/lib/tipos'
import { countsInWip, isOpen } from '@/lib/states'
import { avatarColor, dueTone, loadBarColor } from '@/lib/design-map'
import { plural, suma } from '@/lib/format'
import { Header } from '@/components/shell/Header'
import { Avatar, NumeroTicket } from '@/components/ui/piezas'

/**
 * Personas.
 *
 * Es un tablero de carga, no un administrador de miembros: la pregunta que
 * responde es "quién está saturado y quién puede tomar algo más".
 */
export default async function PersonasPage() {
  const sesion = await requireSesion()
  const supabase = await createClient()

  const [crudos, personas, aging] = await Promise.all([
    listIssues(supabase),
    getUsers(supabase),
    getAgingWip(supabase),
  ])

  const tickets = crudos.map(aplanarTicket)
  const equipo = personas.filter((p) => p.role !== 'viewer')
  const esAdmin = sesion.actor.role === 'admin'

  return (
    <>
      <Header vista="Personas" orgName={sesion.settings.org_name} />

      <div className="vista-scroll">
        <div className="pagina" style={{ maxWidth: 1080 }}>
          <h1 className="titulo-vista" style={{ fontSize: 22 }}>
            Personas
          </h1>
          <p className="subtitulo">
            Ocho puntos de peso equivalen aproximadamente a una semana de trabajo. La carga cuenta
            solo lo que está en curso — lo que está en cola no ocupa a nadie todavía.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 14,
            }}
          >
            {equipo.map((p) => {
              const persona = { id: p.id, name: p.name }
              const propios = tickets.filter((t) => t.owner_id === p.id)
              const abiertos = propios.filter((t) => isOpen(t.state))
              const enCurso = propios.filter((t) => countsInWip(t.state))
              const carga = suma(enCurso.map((t) => t.weight))
              const capacidad = Number(p.capacity ?? 20)
              const vencidos = abiertos.filter((t) => dueTone(t.due_date) === 'overdue').length
              const estancados = aging.filter((a) => a.owner_id === p.id && a.aging_level !== 'normal')

              return (
                <article key={p.id} className="tarjeta-panel tarjeta-persona">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    {(() => {
                      const identidad = (
                        <>
                          <Avatar persona={persona} size={38} />
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <strong style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>
                              {p.name}
                            </strong>
                            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--tinta-2)' }}>
                              {p.job_title ??
                                (p.role === 'admin' ? 'Administra el tablero' : 'Miembro del equipo')}
                            </span>
                          </span>
                        </>
                      )

                      // Toda la fila de identidad (avatar + nombre + rol + hueco)
                      // es el destino de clic; el chip de vencidos queda fuera
                      // porque es informativo y no debe tragar el clic.
                      return esAdmin ? (
                        <Link
                          href={`/personas/${p.id}`}
                          className="cabecera-persona"
                          title="Ver ficha con métricas"
                        >
                          {identidad}
                        </Link>
                      ) : (
                        <span className="cabecera-persona" data-estatico="">
                          {identidad}
                        </span>
                      )
                    })()}
                    <span
                      className="chip-estado ui-xs"
                      style={
                        vencidos > 0
                          ? { color: 'var(--alerta)', background: 'var(--alerta-suave)' }
                          : { color: 'var(--e5-fg)', background: 'var(--e5-bg)' }
                      }
                    >
                      {vencidos > 0 ? plural(vencidos, 'vencido', 'vencidos') : 'Al día'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                    <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
                      {carga}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--tinta-2)' }}>
                      de {capacidad} puntos en curso · {plural(abiertos.length, 'ticket abierto', 'tickets abiertos')}
                    </span>
                  </div>

                  <span className="riel" style={{ height: 8, display: 'block', marginBottom: 12 }}>
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${Math.min(100, capacidad > 0 ? (carga / capacidad) * 100 : 0)}%`,
                        background: loadBarColor(carga, capacidad, avatarColor(p.id)),
                      }}
                    />
                  </span>

                  {abiertos.slice(0, 4).map((t) => (
                    <Link key={t.id} href={`/tickets?ticket=${t.id}`} className="fila-lista">
                      <span className="punto" style={{ background: t.tipo.color }} />
                      <NumeroTicket numero={t.number} estado={t.state} />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.title}
                      </span>
                      {dueTone(t.due_date) === 'overdue' && (
                        <span className="mono-sm vencido" title="Vencido">
                          •
                        </span>
                      )}
                    </Link>
                  ))}

                  {abiertos.length > 4 && (
                    <Link
                      href={`/tickets?dueno=${p.id}`}
                      className="btn-texto btn-texto-acento"
                      style={{ display: 'inline-block', marginTop: 6 }}
                    >
                      Ver los {abiertos.length}
                    </Link>
                  )}

                  {abiertos.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--tinta-3)', margin: 0 }}>
                      Sin trabajo abierto.
                    </p>
                  )}

                  {estancados.length > 0 && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 10,
                        borderTop: '1px solid var(--linea)',
                      }}
                    >
                      <span className="mono-xs" style={{ color: 'var(--tinta-3)' }}>
                        Sin moverse
                      </span>
                      {estancados.slice(0, 3).map((a) => (
                        <Link
                          key={String(a.issue_id)}
                          href={`/tickets?ticket=${a.issue_id}`}
                          className="fila-lista"
                        >
                          <span
                            className="punto"
                            style={{
                              background: agingColor(
                                a.aging_level as 'normal' | 'atencion' | 'alerta' | 'critico',
                              ),
                            }}
                          />
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {a.title}
                          </span>
                          <span
                            className="mono-sm"
                            style={{
                              color: agingColor(
                                a.aging_level as 'normal' | 'atencion' | 'alerta' | 'critico',
                              ),
                            }}
                          >
                            {a.days_idle} d
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
