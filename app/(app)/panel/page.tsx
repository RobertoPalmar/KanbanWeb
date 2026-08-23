import Link from 'next/link'
import { requireSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listIssues } from '@/lib/queries/issues'
import { getIssueTypes, getUsers } from '@/lib/queries/catalog'
import { getAgingWip, agingColor, getMemberWip } from '@/lib/queries/metrics'
import { aplanarTicket } from '@/lib/tipos'
import { ORDERED_STATES, STATES, isOpen } from '@/lib/states'
import { avatarColor, dueTone, loadBarColor } from '@/lib/design-map'
import { DIAS_LARGOS, MESES_LARGOS, diasHasta, lunesDe, plural, suma, vencimientoRelativo } from '@/lib/format'
import { Header } from '@/components/shell/Header'
import { Avatar, ChipEstado, NumeroTicket } from '@/components/ui/piezas'
import {
  BarraSegmentada,
  BarrasCreadosCerrados,
  BarrasHorizontales,
  Dona,
  SerieCicloP85,
  etiquetaSemana,
  type PuntoCiclo,
  type SemanaBarras,
} from '@/components/panel/graficas'

/**
 * Panel.
 *
 * Sin tarjetas de estadística con número grande y flechita verde: las gráficas
 * muestran distribución y tendencia. Las tres piezas que el handoff no dibujó
 * —cycle time p85, aging WIP y el resumen— salen de las vistas de Postgres, no
 * de cálculos en JavaScript.
 */
export default async function PanelPage() {
  const sesion = await requireSesion()
  const supabase = await createClient()

  const [crudos, tipos, personas, aging, wip, resumen, ciclo] = await Promise.all([
    listIssues(supabase),
    getIssueTypes(supabase),
    getUsers(supabase),
    getAgingWip(supabase),
    getMemberWip(supabase),
    supabase.rpc('dashboard_summary'),
    supabase.from('weekly_cycle_time').select('*').order('week_start', { ascending: true }),
  ])

  const tickets = crudos.map(aplanarTicket)
  const s = (resumen.data ?? {}) as Record<string, number | null>

  const abiertos = tickets.filter((t) => isOpen(t.state))

  // Ocho semanas, la última incluida. Los creados se cuentan acá porque no hay
  // vista para eso: es un group by sobre created_at y el conjunto es chico.
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
      cerrados: tickets.filter((t) => t.state === 'done' && dentro(t.updated_at)).length,
    })
  }

  const puntosCiclo: PuntoCiclo[] = semanas.map((sem) => {
    const fila = (ciclo.data ?? []).find((c) => etiquetaSemana(String(c.week_start)) === sem.semana)
    return {
      semana: sem.semana,
      p85: fila?.p85_days == null ? null : Number(fila.p85_days),
      muestra: Number(fila?.sample_size ?? 0),
    }
  })

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
    .sort((a, b) => b.valor - a.valor)

  const proximos = abiertos
    .filter((t) => t.due_date)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    .slice(0, 6)

  const hoy = new Date()
  const saludo = `${DIAS_LARGOS[hoy.getDay()]} ${hoy.getDate()} de ${MESES_LARGOS[hoy.getMonth()]}`
  const miosSemana = abiertos.filter(
    (t) => t.owner_id === sesion.actor.id && (diasHasta(t.due_date) ?? 99) <= 7,
  ).length

  const estancados = aging.filter((a) => a.aging_level !== 'normal')

  return (
    <>
      <Header vista="Panel" orgName={sesion.settings.org_name} />

      <div className="vista-scroll">
        <div className="pagina">
          <h1 className="saludo">Hola, {sesion.perfil.name.split(' ')[0]}</h1>
          <p className="subtitulo">
            {saludo} ·{' '}
            {miosSemana > 0
              ? `${plural(miosSemana, 'ticket tuyo vence', 'tickets tuyos vencen')} esta semana`
              : 'nada tuyo vence esta semana'}
            {Number(s.overdue_count ?? 0) > 0 && (
              <>
                {' · '}
                <span className="vencido">
                  {plural(Number(s.overdue_count), 'vencido en el equipo', 'vencidos en el equipo')}
                </span>
              </>
            )}
          </p>

          <div className="rejilla rejilla-2">
            <section className="tarjeta-panel">
              <h3 className="mono-xs">Creados y cerrados por semana</h3>
              <BarrasCreadosCerrados semanas={semanas} />
            </section>

            <section className="tarjeta-panel">
              <h3 className="mono-xs">Estado de la cartera</h3>
              <Dona
                segmentos={porEstado.filter((p) => isOpen(p.clave))}
                centro={abiertos.length}
                pie={`${Number(s.wip_count ?? 0)} en curso · ${suma(abiertos.map((t) => t.weight))} puntos abiertos`}
              />
            </section>
          </div>

          <div className="rejilla rejilla-2-iguales">
            <section className="tarjeta-panel">
              <h3 className="mono-xs">Tiempo de ciclo · percentil 85</h3>
              <SerieCicloP85 puntos={puntosCiclo} />
              <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--tinta-3)' }}>
                Percentil 85 y no promedio: el promedio lo distorsiona un ticket olvidado tres meses.
                Barra punteada = menos de tres cierres esa semana.
              </p>
            </section>

            <section className="tarjeta-panel">
              <h3 className="mono-xs">Trabajo estancado</h3>
              {estancados.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--tinta-2)', margin: 0 }}>
                  Nada lleva más de tres días sin moverse.
                </p>
              ) : (
                <>
                  {estancados.slice(0, 6).map((a) => (
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
                          background: agingColor(a.aging_level as 'normal' | 'atencion' | 'alerta' | 'critico'),
                          // Crítico lleva además borde punteado: nunca solo color.
                          border: a.aging_level === 'critico' ? '1px dashed var(--alerta)' : undefined,
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
                          color: agingColor(a.aging_level as 'normal' | 'atencion' | 'alerta' | 'critico'),
                        }}
                      >
                        {a.days_idle} d
                      </span>
                    </Link>
                  ))}
                  <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--tinta-3)' }}>
                    Umbrales 3 / 7 / 14 días, definidos en la vista `aging_wip`.
                  </p>
                </>
              )}
            </section>
          </div>

          <div className="rejilla">
            <section className="tarjeta-panel">
              <h3 className="mono-xs">Volumen por tipo de trabajo</h3>
              <BarrasHorizontales filas={porTipo} />
            </section>
          </div>

          <div className="rejilla rejilla-3">
            <section className="tarjeta-panel">
              <h3 className="mono-xs">Próximos vencimientos</h3>
              {proximos.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--tinta-2)', margin: 0 }}>
                  Ningún ticket abierto tiene fecha.
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
                      <Avatar persona={t.owner} size={20} />
                    </Link>
                  )
                })
              )}
            </section>

            <section className="tarjeta-panel">
              <h3 className="mono-xs">Distribución por estado</h3>
              <BarraSegmentada segmentos={porEstado} />
            </section>

            <section className="tarjeta-panel">
              <h3 className="mono-xs">Carga del equipo</h3>
              {wip.map((m) => {
                const persona = { id: String(m.user_id), name: String(m.name) }
                const carga = Number(m.wip_weight ?? 0)
                // La capacidad es por persona (columna `users.capacity`), no una
                // constante: el diseño la hardcodea en 20 y la base la deja mover.
                const capacidad = Number(
                  personas.find((p) => p.id === m.user_id)?.capacity ?? 20,
                )
                return (
                  <div
                    key={String(m.user_id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}
                  >
                    <Avatar persona={persona} size={22} />
                    <span className="riel">
                      <span
                        style={{
                          width: `${Math.min(100, (carga / capacidad) * 100)}%`,
                          background: loadBarColor(carga, capacidad, avatarColor(persona.id)),
                        }}
                      />
                    </span>
                    <span className="mono-sm" style={{ flex: 'none', color: 'var(--tinta-2)' }}>
                      {carga}/{capacidad}
                    </span>
                  </div>
                )
              })}
              <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--tinta-3)' }}>
                Solo cuenta lo que está en curso: ocho puntos ≈ una semana de trabajo.
              </p>
            </section>
          </div>

          {Number(s.pending_drafts ?? 0) > 0 && sesion.actor.role === 'admin' && (
            <div className="rejilla">
              <section className="tarjeta-panel" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ChipEstado estado="draft" />
                <span style={{ flex: 1, fontSize: 13 }}>
                  {plural(
                    Number(s.pending_drafts),
                    'solicitud espera tu aprobación',
                    'solicitudes esperan tu aprobación',
                  )}
                  . Hasta que las apruebes, ese trabajo no entró en ninguna cola.
                </span>
                <Link className="btn-primario" href="/borradores">
                  Ver bandeja
                </Link>
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
