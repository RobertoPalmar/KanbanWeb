import { requireSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getDraftInbox } from '@/lib/queries/drafts'
import { canApproveDrafts } from '@/lib/permissions'
import { Header } from '@/components/shell/Header'
import { BandejaBorradores, type FilaBorrador } from '@/components/borradores/BandejaBorradores'

/**
 * Bandeja de borradores. Admin-only.
 *
 * Un borrador es trabajo que alguien pidió y que todavía no está pasando: hasta
 * que se apruebe, no entró en la cola de nadie. La decisión es binaria, así que
 * el dato central de cada fila es "de X para Y" y cuánto lleva esperando.
 */
export default async function BorradoresPage() {
  const sesion = await requireSesion()

  if (!canApproveDrafts(sesion.actor)) {
    return (
      <>
        <Header vista="Borradores" orgName={sesion.settings.org_name} />
        <div className="vista-scroll">
          <div className="pagina" style={{ maxWidth: 1080 }}>
            <div className="vacio">
              <h2>Esta bandeja es de administración</h2>
              <p>
                Aprobar borradores define qué entra en la cola del equipo, así que queda en manos
                de un admin. Tus propios borradores los ves en Tickets, en la columna Borrador.
              </p>
            </div>
          </div>
        </div>
      </>
    )
  }

  const supabase = await createClient()
  const filas = (await getDraftInbox(supabase)) as unknown as FilaBorrador[]

  return (
    <>
      <Header vista="Borradores" orgName={sesion.settings.org_name} />

      <div className="vista-scroll">
        <div className="pagina" style={{ maxWidth: 1080 }}>
          <BandejaBorradores filas={filas} pesoActivo={sesion.settings.estimation_enabled} />
        </div>
      </div>
    </>
  )
}
