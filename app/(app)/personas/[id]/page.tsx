import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listIssues } from '@/lib/queries/issues'
import { getIssueTypes, getUsers } from '@/lib/queries/catalog'
import { agingColor, getAgingWip, getCycleTimeP85 } from '@/lib/queries/metrics'
import { canViewReports } from '@/lib/permissions'
import { aplanarTicket } from '@/lib/tipos'
import { ORDERED_STATES, STATES, countsInWip, isOpen } from '@/lib/states'
import { avatarColor, dueTone, loadBarColor } from '@/lib/design-map'
import { lunesDe, plural, suma, vencimientoRelativo } from '@/lib/format'
import { Header } from '@/components/shell/Header'
import { Avatar, NumeroTicket } from '@/components/ui/piezas'
import {
  BarraSegmentada,
  BarrasCreadosCerrados,
  BarrasHorizontales,
  etiquetaSemana,
  type SemanaBarras,
} from '@/components/panel/graficas'

/**
 * Ficha de una persona. Solo admin.
 *
 * La carga del equipo es información sensible: sirve para repartir trabajo, no
 * para comparar personas entre sí. Un miembro ve el tablero de Personas —que es
 * agregado y público dentro del equipo— pero no la ficha individual con series
 * históricas.
 */
export default async function PersonaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await requireSesion()

  if (!canViewReports(sesion.actor)) {
    return (
      <>
        <Header vista="Personas" orgName={sesion.settings.org_name} />
        <div className="vista-scroll">
          <div className="pagina">
            <div className="vacio">
              <h2>La ficha individual es de administración</h2>
              <p>
                El tablero de Personas muestra la carga de todo el equipo y está abierto a todos.
                La ficha con series históricas por persona queda en manos de un admin.
              </p>
              <Link className="btn-primario" href="/personas">
                Volver a Personas
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  const supabase = await createClient()

  const [crudos, personas, tipos, aging, p85] = await Promise.all([
    listIssues(supabase, { ownerId: id }),
    getUsers(supabase),
    getIssueTypes(supabase),
    getAgingWip(supabase, { ownerId: id }),
    getCycleTimeP85(supabase, { ownerId: id }),
  ])

  const persona = personas.find((p) => p.id === id)
  if (!persona) notFound()

  const tickets = crudos.map(aplanarTicket)
  const abiertos = tickets.filter((t) => isOpen(t.state))
  const enCurso = tickets.filter((t) => countsInWip(t.state))
  const cerrados = tickets.filter((t) => t.state === 'done')
  const vencidos = abiertos.filter((t) => dueTone(t.due_date) === 'overdue')
  const carga = suma(enCurso.map((t) => t.weight))
  const capacidad = Number(persona.capacity ?? 20)

  const semanas: SemanaBarras[] = []
  const hoyLunes = lunesDe(new Date())
  for (let i = 7; i >= 0; i--) {
    const inicio = new Date(hoyLunes)
    inicio.setDate(inicio.getDate() - i * 7)
    const fin = new Date(inicio)
    fin.setDate(fin.getDate() + 7)
    const dentro = (iso: string) => {
      const d = new Date(iso)
      return d >= inicio && d < fin
    }

    semanas.push({
      semana: etiquetaSemana(inicio.toISOString()),
      creados: tickets.filter((t) => dentro(t.created_at)).length,
      cerrados: cerrados.filter((t) => dentro(t.updated_at)).length,
    })
  }

  const porEstado = ORDERED_STATES.map((estado, i) => ({
    clave: estado,
    etiqueta: STATES[estado].label,
    valor: tickets.filter((t) => t.state === estado).length,
    color: `var(--e${i + 1}-fg)`,
  }))

  const porTipo = tipos
    .map((t) => ({
      clave: t.id,
      etiqueta: t.name,
      valor: tickets.filter((x) => x.tipo.id === t.id).length,
      color: t.color,
    }))
    .filter((t) => t.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  const proximos = abiertos
    .filter((t) => t.due_date)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))

  return (
    <>
      <Header vista={persona.name} orgName={sesion.settings.org_name} />

      <div className="vista-scroll">
        <div className="pagina">
          <Link href="/personas" className="btn-texto" style={{ marginBottom: 14, display: 'inline-block' }}>
            ← Personas
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <Avatar persona={{ id: persona.id, name: persona.name }} size={48} />
            <div style={{ minWidth: 0 }}>
              <h1 className="saludo" style={{ fontSize: 22 }}>
                {persona.name}
              </h1>
              <p className="subtitulo" style={{ margin: 0 }}>
                {persona.job_title ?? 'Sin cargo declarado'} · {etiquetaRol(persona.role)} ·{' '}
                {persona.email}
              </p>
            </div>
          </div>

          <div className="rejilla rejilla-4">
            <Dato
              titulo="Carga en curso"
              valor={`${carga} / ${capacidad}`}
              nota={`${plural(enCurso.length, 'ticket en curso', 'tickets en curso')}`}
              barra={{ pct: capacidad > 0 ? (carga / capacidad) * 100 : 0, color: loadBarColor(carga, capacidad, avatarColor(persona.id)) }}
            />
            <Dato
              titulo="Abiertos"
              valor={String(abiertos.length)}
              nota={`${suma(abiertos.map((t) => t.weight))} puntos en cola y en curso`}
            />
            <Dato
              titulo="Vencidos"
              valor={String(vencidos.length)}
              nota={vencidos.length ? 'Requieren fecha nueva o cierre' : 'Nada atrasado'}
              tono={vencidos.length ? 'var(--alerta)' : undefined}
            />
            <Dato
              titulo="Ciclo p85"
              valor={p85 == null ? '—' : `${Math.round(Number(p85) * 10) / 10} d`}
              nota={`${plural(cerrados.length, 'ticket cerrado', 'tickets cerrados')} en total`}
            />
          </div>

          <div className="rejilla rejilla-2">
            <section className="tarjeta-panel">
              <h3 className="mono-xs">Creados y cerrados por semana</h3>
              <BarrasCreadosCerrados semanas={semanas} />
              <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--tinta-3)' }}>
                “Creados” cuenta los tickets donde esta persona es dueña, no quién los redactó.
              </p>
            </section>

            <section className="tarjeta-panel">
              <h3 className="mono-xs">Distribución por estado</h3>
              <BarraSegmentada segmentos={porEstado} />
            </section>
          </div>

          <div className="rejilla rejilla-2-iguales">
            <section className="tarjeta-panel">
              <h3 className="mono-xs">Volumen por tipo</h3>
              {porTipo.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--tinta-2)', margin: 0 }}>Sin tickets.</p>
              ) : (
                <BarrasHorizontales filas={porTipo} />
              )}
            </section>

            <section className="tarjeta-panel">
              <h3 className="mono-xs">Sin moverse</h3>
              {aging.filter((a) => a.aging_level !== 'normal').length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--tinta-2)', margin: 0 }}>
                  Nada lleva más de tres días quieto.
                </p>
              ) : (
                aging
                  .filter((a) => a.aging_level !== 'normal')
                  .map((a) => (
                    <Link
                      key={String(a.issue_id)}
                      href={`/tickets?ticket=${a.issue_id}`}
                      className="fila-lista"
                      style={{
                        background: a.aging_level === 'critico' ? 'var(--alerta-suave)' : undefined,
                      }}
                    >
                      <span
                        className="punto"
                        style={{
                          background: agingColor(
                            a.aging_level as 'normal' | 'atencion' | 'alerta' | 'critico',
                          ),
                        }}
                      />
                      <span className="mono-sm" style={{ color: 'var(--tinta-3)' }}>
                        {a.number}
                      </span>
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
                  ))
              )}
            </section>
          </div>

          <div className="rejilla">
            <section className="tarjeta-panel">
              <h3 className="mono-xs">Trabajo abierto, por fecha</h3>
              {proximos.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--tinta-2)', margin: 0 }}>
                  Sin tickets abiertos con fecha.
                </p>
              ) : (
                proximos.map((t) => {
                  const tono = dueTone(t.due_date)
                  return (
                    <Link
                      key={t.id}
                      href={`/tickets?ticket=${t.id}`}
                      className="fila-lista"
                      style={{ background: tono === 'overdue' ? 'var(--alerta-suave)' : undefined }}
                    >
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
                      <span className="ui-xs" style={{ color: 'var(--tinta-3)' }}>
                        {STATES[t.state].label}
                      </span>
                      <span
                        className="mono-sm"
                        style={{
                          color:
                            tono === 'overdue' || tono === 'today'
                              ? 'var(--alerta)'
                              : tono === 'soon'
                                ? 'var(--e4-fg)'
                                : 'var(--tinta-2)',
                        }}
                      >
                        {vencimientoRelativo(t.due_date)}
                      </span>
                    </Link>
                  )
                })
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  )
}

function Dato({
  titulo,
  valor,
  nota,
  tono,
  barra,
}: {
  titulo: string
  valor: string
  nota: string
  tono?: string
  barra?: { pct: number; color: string }
}) {
  return (
    <section className="tarjeta-panel">
      <h3 className="mono-xs" style={{ marginBottom: 8 }}>
        {titulo}
      </h3>
      <span className="mono" style={{ fontSize: 20, fontWeight: 600, color: tono }}>
        {valor}
      </span>
      {barra && (
        <span className="riel" style={{ display: 'block', margin: '8px 0 6px' }}>
          <span style={{ width: `${Math.min(100, barra.pct)}%`, background: barra.color }} />
        </span>
      )}
      <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--tinta-2)' }}>{nota}</p>
    </section>
  )
}

function etiquetaRol(role: string) {
  if (role === 'admin') return 'Admin'
  if (role === 'viewer') return 'Solo lectura'
  return 'Miembro'
}
