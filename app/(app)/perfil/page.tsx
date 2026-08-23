import { requireSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listIssues } from '@/lib/queries/issues'
import { aplanarTicket } from '@/lib/tipos'
import { countsInWip, isOpen } from '@/lib/states'
import { suma } from '@/lib/format'
import { Header } from '@/components/shell/Header'
import { Perfil } from '@/components/perfil/Perfil'

/**
 * Perfil propio: lo descriptivo se edita, lo que define permisos o carga no.
 */
export default async function PerfilPage() {
  const sesion = await requireSesion()
  const supabase = await createClient()

  const crudos = await listIssues(supabase, { ownerId: sesion.actor.id })
  const tickets = crudos.map(aplanarTicket)

  return (
    <>
      <Header vista="Mi perfil" orgName={sesion.settings.org_name} />

      <div className="vista-scroll">
        <div className="pagina-angosta">
          <Perfil
            perfil={{
              id: sesion.perfil.id,
              name: sesion.perfil.name,
              email: sesion.perfil.email,
              role: sesion.perfil.role,
              job_title: sesion.perfil.job_title,
              capacity: sesion.perfil.capacity,
              avatar_url: sesion.perfil.avatar_url,
            }}
            resumen={{
              abiertos: tickets.filter((t) => isOpen(t.state)).length,
              enCurso: tickets.filter((t) => countsInWip(t.state)).length,
              cerrados: tickets.filter((t) => t.state === 'done').length,
              puntosEnCurso: suma(tickets.filter((t) => countsInWip(t.state)).map((t) => t.weight)),
            }}
          />
        </div>
      </div>
    </>
  )
}
