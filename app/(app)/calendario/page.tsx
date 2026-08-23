import { requireSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listIssues } from '@/lib/queries/issues'
import { getIssueTypes, getLabels, getPriorities, getUsers } from '@/lib/queries/catalog'
import { aplanarTicket } from '@/lib/tipos'
import { Header } from '@/components/shell/Header'
import { Calendario } from '@/components/calendario/Calendario'
import { PanelDia } from '@/components/calendario/PanelDia'
import { PanelDetalle } from '@/components/detalle/PanelDetalle'
import { cargarDetalle } from '@/components/detalle/cargar'

/**
 * Calendario mensual por fecha de vencimiento.
 *
 * El mes vive en la URL (`?mes=2026-08`) para que un enlace apunte al mes que se
 * estaba mirando.
 */
export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ticket?: string; dia?: string }>
}) {
  const sp = await searchParams
  const sesion = await requireSesion()
  const supabase = await createClient()

  const hoy = new Date()
  const [anio, mes] = (sp.mes ?? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`)
    .split('-')
    .map(Number)

  // Se piden seis semanas completas: la retícula muestra días del mes anterior y
  // del siguiente, y un ticket que cae ahí tiene que aparecer.
  const desde = new Date(anio, mes - 1, 1)
  desde.setDate(desde.getDate() - 7)
  const hasta = new Date(anio, mes, 0)
  hasta.setDate(hasta.getDate() + 14)

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const [crudos, tipos, prioridades, personas, etiquetas] = await Promise.all([
    listIssues(supabase, { dueFrom: iso(desde), dueTo: iso(hasta) }),
    getIssueTypes(supabase),
    getPriorities(supabase),
    getUsers(supabase),
    getLabels(supabase),
  ])

  const detalle = sp.ticket ? await cargarDetalle(supabase, sp.ticket) : null
  const tickets = crudos.map(aplanarTicket)

  // El detalle de un ticket manda sobre el panel del día: los dos ocupan el
  // mismo lugar y abrir un ticket es la acción más específica.
  const delDia =
    sp.dia && !detalle ? tickets.filter((t) => t.due_date?.slice(0, 10) === sp.dia) : null

  return (
    <>
      <Header vista="Calendario" orgName={sesion.settings.org_name} />

      <div className="vista-scroll">
        <div className="pagina">
          {/* La retícula conserva sus siete columnas y scrollea dentro de su caja:
              una semana partida en dos filas deja de ser una semana. */}
          <Calendario anio={anio} mes={mes} tickets={tickets} />
        </div>
      </div>

      {delDia && sp.dia && <PanelDia dia={sp.dia} tickets={delDia} />}

      {detalle && (
        <PanelDetalle
          detalle={detalle}
          catalogos={{ tipos, prioridades, personas, etiquetas }}
          sesion={{
            id: sesion.actor.id,
            role: sesion.actor.role,
            pesoActivo: sesion.settings.estimation_enabled,
          }}
        />
      )}
    </>
  )
}
