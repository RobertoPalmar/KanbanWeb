import { requireSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getAssignableUsers, getIssueTypes, getLabels, getPriorities } from '@/lib/queries/catalog'
import { MenuLateralProvider } from '@/components/shell/MenuLateral'
import { NuevoTicketProvider } from '@/components/nuevo/NuevoTicketProvider'

/**
 * Shell de la aplicación: barra lateral + contenido.
 *
 * Los catálogos (tipos, prioridades, personas, etiquetas) se cargan acá una
 * sola vez: los usa el modal de creación y varios selectores del detalle, y son
 * tablas de ocho filas que no vale la pena volver a pedir por vista.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requireSesion()
  const supabase = await createClient()

  const [tipos, prioridades, personas, etiquetas, conteos] = await Promise.all([
    getIssueTypes(supabase),
    getPriorities(supabase),
    getAssignableUsers(supabase),
    getLabels(supabase),
    contarVistas(supabase, sesion.actor.id, sesion.actor.role === 'admin'),
  ])

  return (
    <NuevoTicketProvider
      tipos={tipos}
      prioridades={prioridades}
      personas={personas}
      etiquetas={etiquetas}
      sesion={{ id: sesion.actor.id, role: sesion.actor.role, pesoActivo: sesion.settings.estimation_enabled }}
    >
      <MenuLateralProvider
        perfil={sesion.perfil}
        orgName={sesion.settings.org_name}
        conteos={conteos}
      >
        <div className="app">
          <div className="contenido">{children}</div>
        </div>
      </MenuLateralProvider>
    </NuevoTicketProvider>
  )
}

/**
 * Conteos de las vistas fijadas en la barra lateral.
 *
 * El handoff lista "Sin dueño" como vista fijada, pero `issues.owner_id` es NOT
 * NULL: un ticket sin dueño no existe en este modelo. Se reemplaza por
 * "Borradores", que es la cola real que se acumula invisible.
 */
async function contarVistas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  esAdmin: boolean,
) {
  const hoy = new Date().toISOString().slice(0, 10)

  const [mios, vencidos, borradores] = await Promise.all([
    supabase
      .from('issues')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .in('state', ['todo', 'in_progress', 'in_review']),
    supabase
      .from('issues')
      .select('id', { count: 'exact', head: true })
      .lt('due_date', hoy)
      .in('state', ['todo', 'in_progress', 'in_review']),
    supabase.from('issues').select('id', { count: 'exact', head: true }).eq('state', 'draft'),
  ])

  return {
    mios: mios.count ?? 0,
    vencidos: vencidos.count ?? 0,
    borradores: esAdmin ? (borradores.count ?? 0) : 0,
  }
}
