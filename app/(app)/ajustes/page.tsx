import { requireSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getIssueTypes } from '@/lib/queries/catalog'
import { Header } from '@/components/shell/Header'
import { Ajustes } from '@/components/ajustes/Ajustes'
import { Equipo, type Invitacion, type Miembro } from '@/components/ajustes/Equipo'

export default async function AjustesPage() {
  const sesion = await requireSesion()
  const supabase = await createClient()

  const esAdmin = sesion.actor.role === 'admin'

  const [tipos, notif, miembros, invitaciones] = await Promise.all([
    getIssueTypes(supabase, true),
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
          .select('id, email, code, created_at, expires_at, accepted_at')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: null }),
  ])

  return (
    <>
      <Header vista="Ajustes" orgName={sesion.settings.org_name} />

      <div className="vista-scroll">
        <div className="pagina-angosta">
          <Ajustes
            tipos={tipos.map((t) => ({
              id: t.id,
              name: t.name,
              abbrev: t.abbrev,
              color: t.color,
              archived: t.archived,
            }))}
            prefs={sesion.prefs}
            pesoActivo={sesion.settings.estimation_enabled}
            esAdmin={esAdmin}
            notif={{
              on_assigned: notif.data?.on_assigned ?? true,
              on_mention: notif.data?.on_mention ?? true,
              daily_digest: notif.data?.daily_digest ?? false,
            }}
          />

          {esAdmin && (
            <Equipo
              miembros={(miembros.data ?? []) as Miembro[]}
              invitaciones={(invitaciones.data ?? []) as Invitacion[]}
              nombreEquipo={sesion.settings.org_name}
              yoId={sesion.actor.id}
            />
          )}
        </div>
      </div>
    </>
  )
}
