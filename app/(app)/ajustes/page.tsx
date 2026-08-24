import { requireSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  getIssueTypeTicketCounts,
  getIssueTypes,
  getLabelUsageCounts,
  getLabels,
} from '@/lib/queries/catalog'
import { Header } from '@/components/shell/Header'
import { Ajustes } from '@/components/ajustes/Ajustes'
import { Catalogo } from '@/components/ajustes/Catalogo'
import { Equipo, type Invitacion, type Miembro } from '@/components/ajustes/Equipo'
import { ProveedorGuardado } from '@/components/ui/ContextoGuardado'

export default async function AjustesPage() {
  const sesion = await requireSesion()
  const supabase = await createClient()

  const esAdmin = sesion.actor.role === 'admin'

  // Los conteos solo los necesita el admin: es el único que ve los botones de
  // borrar y archivar que dependen de ellos. Para un miembro son dos consultas
  // sobre `issues` y `issue_labels` que no cambiarían nada de lo que ve.
  const [tipos, etiquetas, conteoTipos, usosEtiquetas, notif, miembros, invitaciones] =
    await Promise.all([
      getIssueTypes(supabase, true),
      getLabels(supabase, true),
      esAdmin
        ? getIssueTypeTicketCounts(supabase)
        : Promise.resolve<Record<string, number>>({}),
      esAdmin ? getLabelUsageCounts(supabase) : Promise.resolve<Record<string, number>>({}),
      supabase
        .from('notification_preferences')
        .select('on_assigned, on_mention, daily_digest')
        .eq('user_id', sesion.actor.id)
        .maybeSingle(),
      esAdmin
        ? supabase
            .from('users')
            .select('id, name, email, role, job_title, capacity, active, avatar_url')
            .order('active', { ascending: false })
            .order('name', { ascending: true })
        : Promise.resolve({ data: null }),
      esAdmin
        ? supabase
            .from('invitations')
            .select('id, email, role, created_at, expires_at, last_sent_at, accepted_at')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: null }),
    ])

  return (
    <>
      <Header vista="Ajustes" orgName={sesion.settings.org_name} />

      <div className="vista-scroll">
        <div className="pagina-ajustes">
          {/* Un solo indicador de guardado para las dos secciones: el provider
              las envuelve a ambas para que `Equipo` y `Ajustes` reporten al
              mismo sitio. */}
          <ProveedorGuardado>
            <Ajustes
              prefs={sesion.prefs}
              pesoActivo={sesion.settings.estimation_enabled}
              esAdmin={esAdmin}
              notif={{
                on_assigned: notif.data?.on_assigned ?? true,
                on_mention: notif.data?.on_mention ?? true,
                daily_digest: notif.data?.daily_digest ?? false,
              }}
            />

            <Catalogo
              tipos={tipos.map((t) => ({
                id: t.id,
                name: t.name,
                abbrev: t.abbrev,
                color: t.color,
                archived: t.archived,
                tickets: conteoTipos[t.id] ?? 0,
              }))}
              etiquetas={etiquetas.map((e) => ({
                id: e.id,
                name: e.name,
                color: e.color,
                archived: e.archived,
                usos: usosEtiquetas[e.id] ?? 0,
              }))}
              esAdmin={esAdmin}
            />

            {esAdmin && (
              <Equipo
                miembros={(miembros.data ?? []) as Miembro[]}
                invitaciones={(invitaciones.data ?? []) as Invitacion[]}
                nombreEquipo={sesion.settings.org_name}
                yoId={sesion.actor.id}
              />
            )}
          </ProveedorGuardado>
        </div>
      </div>
    </>
  )
}
