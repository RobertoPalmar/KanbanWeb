/**
 * Sesión y contexto del usuario para los Server Components.
 *
 * `requireSession` es la puerta de todas las vistas: si no hay sesión redirige
 * a /login. El perfil (`public.users`) es lo que decide el rol; `auth.users`
 * solo autentica.
 */

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Actor, Role } from '@/lib/permissions'

export interface Preferencias {
  theme: 'claro' | 'oscuro'
  density: 'compacta' | 'comoda'
}

export interface Sesion {
  actor: Actor
  perfil: {
    id: string
    name: string
    email: string
    role: Role
    job_title: string | null
    capacity: number
    avatar_url: string | null
  }
  prefs: Preferencias
  settings: {
    estimation_enabled: boolean
    org_name: string
    logo_url: string | null
  }
}

/** `cache` la deduplica: el layout y la página la piden en el mismo render. */
export const getSesion = cache(async function getSesion(): Promise<Sesion | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const [{ data: perfil }, { data: prefs }, { data: settings }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, role, job_title, capacity, avatar_url, active')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('user_preferences').select('theme, density').eq('user_id', user.id).maybeSingle(),
    supabase.from('settings').select('estimation_enabled, org_name, logo_url').maybeSingle(),
  ])

  // Autenticado sin perfil: el alta de miembros no se completó. Mejor tratarlo
  // como sin sesión que renderizar la app con un actor a medias.
  if (!perfil) return null

  // Acceso revocado por un admin. El token de auth sigue siendo válido —no hay
  // service role para banear en `auth`— así que el corte es acá y en RLS.
  if (perfil.active === false) return null

  return {
    actor: { id: perfil.id, role: perfil.role as Role },
    perfil: perfil as Sesion['perfil'],
    prefs: {
      theme: (prefs?.theme as Preferencias['theme']) ?? 'claro',
      density: (prefs?.density as Preferencias['density']) ?? 'comoda',
    },
    settings: {
      estimation_enabled: settings?.estimation_enabled ?? true,
      org_name: settings?.org_name ?? 'Comunicación',
      logo_url: settings?.logo_url ?? null,
    },
  }
})

export async function requireSesion(): Promise<Sesion> {
  const sesion = await getSesion()
  if (!sesion) redirect('/login')
  return sesion
}
