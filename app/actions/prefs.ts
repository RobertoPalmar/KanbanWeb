'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSesion } from '@/lib/auth'

/**
 * Tema y densidad son por usuario; el campo de peso es de la organización
 * (tabla `settings`, una sola fila) y solo el admin lo cambia. RLS lo vuelve a
 * verificar: acá se corta antes para no mostrar un error después de tocar.
 */

export async function guardarTema(theme: 'claro' | 'oscuro') {
  const { actor } = await requireSesion()
  const supabase = await createClient()

  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: actor.id, theme, updated_at: new Date().toISOString() })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

export async function guardarDensidad(density: 'compacta' | 'comoda') {
  const { actor } = await requireSesion()
  const supabase = await createClient()

  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: actor.id, density, updated_at: new Date().toISOString() })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

export async function guardarPeso(activo: boolean) {
  const { actor } = await requireSesion()
  if (actor.role !== 'admin') {
    return { error: 'El campo de peso lo configura un admin.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('settings')
    .update({ estimation_enabled: activo, updated_at: new Date().toISOString() })
    .eq('id', true)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

export async function guardarNotificaciones(prefs: {
  on_assigned: boolean
  on_mention: boolean
  daily_digest: boolean
}) {
  const { actor } = await requireSesion()
  const supabase = await createClient()

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: actor.id, ...prefs, updated_at: new Date().toISOString() })

  if (error) return { error: error.message }

  revalidatePath('/ajustes')
  return {}
}
