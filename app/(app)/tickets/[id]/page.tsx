import { notFound } from 'next/navigation'
import { requireSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getIssueTypes, getLabels, getPriorities, getUsers } from '@/lib/queries/catalog'
import { Header } from '@/components/shell/Header'
import { PanelDetalle } from '@/components/detalle/PanelDetalle'
import { cargarDetalle } from '@/components/detalle/cargar'

/**
 * El mismo panel, a página completa.
 *
 * Existe para el caso en que el ancho sí importa: edición larga de descripción y
 * revisión de adjuntos. No es una segunda implementación del detalle.
 */
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await requireSesion()
  const supabase = await createClient()

  const [detalle, tipos, prioridades, personas, etiquetas] = await Promise.all([
    cargarDetalle(supabase, id),
    getIssueTypes(supabase),
    getPriorities(supabase),
    getUsers(supabase),
    getLabels(supabase),
  ])

  if (!detalle) notFound()

  return (
    <>
      <Header vista={`Ticket ${detalle.ticket.number}`} orgName={sesion.settings.org_name} />
      <div className="vista-scroll" style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 'min(760px, 100%)' }}>
          <PanelDetalle
            detalle={detalle}
            catalogos={{ tipos, prioridades, personas, etiquetas }}
            sesion={{
              id: sesion.actor.id,
              role: sesion.actor.role,
              pesoActivo: sesion.settings.estimation_enabled,
            }}
            comoPagina
          />
        </div>
      </div>
    </>
  )
}
