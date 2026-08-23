import { requireSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listIssues, type IssueFilters } from '@/lib/queries/issues'
import { getIssueTypes, getLabels, getPriorities, getUsers } from '@/lib/queries/catalog'
import { aplanarTicket, type Ticket } from '@/lib/tipos'
import { isStateKey, type StateKey } from '@/lib/states'
import { hoyISO } from '@/lib/format'
import { Header } from '@/components/shell/Header'
import { TicketsVista } from '@/components/tickets/TicketsVista'
import { PanelDetalle } from '@/components/detalle/PanelDetalle'
import { cargarDetalle } from '@/components/detalle/cargar'

/**
 * Vista de Tickets: tabla y kanban sobre el mismo conjunto de datos.
 *
 * Los filtros y el ticket abierto viven en la URL, no en estado del cliente: un
 * enlace tiene que reproducir exactamente lo que la otra persona está viendo.
 */

interface Params {
  modo?: string
  agrupar?: string
  q?: string
  tipo?: string
  dueno?: string
  estado?: string
  prio?: string
  etiqueta?: string
  desde?: string
  hasta?: string
  mios?: string
  vencidos?: string
  ticket?: string
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  const sp = await searchParams
  const sesion = await requireSesion()
  const supabase = await createClient()

  const filtros: IssueFilters = {}
  if (sp.tipo) filtros.typeId = sp.tipo
  if (sp.prio) filtros.priorityId = sp.prio
  if (sp.q) filtros.search = sp.q
  if (sp.desde) filtros.dueFrom = sp.desde
  if (sp.hasta) filtros.dueTo = sp.hasta
  if (sp.estado && isStateKey(sp.estado)) filtros.state = [sp.estado as StateKey]
  if (sp.mios === '1') filtros.ownerId = sesion.actor.id
  else if (sp.dueno) filtros.ownerId = sp.dueno
  if (sp.vencidos === '1') filtros.dueTo = hoyISO()

  const [crudos, tipos, prioridades, personas, etiquetas] = await Promise.all([
    listIssues(supabase, filtros),
    getIssueTypes(supabase),
    getPriorities(supabase),
    getUsers(supabase),
    getLabels(supabase),
  ])

  let tickets: Ticket[] = crudos.map(aplanarTicket)

  // Etiqueta: PostgREST no filtra por tabla puente sin un `!inner` que además
  // recorta las demás etiquetas del ticket. Con un equipo de ocho personas el
  // conjunto es chico, así que se filtra acá y la fila conserva sus etiquetas.
  if (sp.etiqueta) {
    tickets = tickets.filter((t) => t.etiquetas.some((e) => e.id === sp.etiqueta))
  }

  // "Vencidos" es una vista, no un filtro de fecha suelta: solo cuenta el
  // trabajo abierto. Un ticket finalizado tarde no está vencido, está hecho.
  if (sp.vencidos === '1') {
    tickets = tickets.filter(
      (t) => t.state === 'todo' || t.state === 'in_progress' || t.state === 'in_review',
    )
  }

  const detalle = sp.ticket ? await cargarDetalle(supabase, sp.ticket) : null

  return (
    <>
      <Header vista="Tickets" conmutador orgName={sesion.settings.org_name} />

      <TicketsVista
        tickets={tickets}
        catalogos={{ tipos, prioridades, personas, etiquetas }}
        sesion={{
          id: sesion.actor.id,
          role: sesion.actor.role,
          pesoActivo: sesion.settings.estimation_enabled,
        }}
      />

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
