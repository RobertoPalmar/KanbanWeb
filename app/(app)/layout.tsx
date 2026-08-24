import { cookies } from 'next/headers'
import { requireSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getAssignableUsers, getIssueTypes, getLabels, getPriorities } from '@/lib/queries/catalog'
import { soloVivos } from '@/lib/queries/issues'
import { COOKIE_NAV, MenuLateralProvider } from '@/components/shell/MenuLateral'
import { NuevoTicketProvider } from '@/components/nuevo/NuevoTicketProvider'

/**
 * Shell de la aplicación: barra lateral permanente + contenido.
 *
 * La barra la monta `MenuLateralProvider` junto con `.app`/`.contenido`: su
 * ancho depende del estado contraída/expandida, y ese estado es de cliente.
 *
 * Los catálogos (tipos, prioridades, personas, etiquetas) se cargan acá una
 * sola vez: los usa el modal de creación y varios selectores del detalle, y son
 * tablas de ocho filas que no vale la pena volver a pedir por vista.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requireSesion()
  const supabase = await createClient()

  // El estado de la barra lateral se lee acá y no en el cliente: así el primer
  // HTML ya sale con el ancho correcto y no hay salto al hidratar. Por defecto
  // expandida — la primera vez conviene que se lean las etiquetas.
  const contraidoInicial = (await cookies()).get(COOKIE_NAV)?.value === 'min'

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
        contraidoInicial={contraidoInicial}
      >
        {children}
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

  // Los tres son vistas de presente: un ticket borrado no está en ninguna
  // pantalla a la que estos contadores llevan, así que contarlo mandaría al
  // usuario a una lista con menos filas que el badge.
  const [mios, vencidos, borradores] = await Promise.all([
    soloVivos(
      supabase
        .from('issues')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .in('state', ['todo', 'in_progress', 'in_review']),
    ),
    soloVivos(
      supabase
        .from('issues')
        .select('id', { count: 'exact', head: true })
        .lt('due_date', hoy)
        .in('state', ['todo', 'in_progress', 'in_review']),
    ),
    soloVivos(
      supabase.from('issues').select('id', { count: 'exact', head: true }).eq('state', 'draft'),
    ),
  ])

  return {
    mios: mios.count ?? 0,
    vencidos: vencidos.count ?? 0,
    borradores: esAdmin ? (borradores.count ?? 0) : 0,
  }
}
