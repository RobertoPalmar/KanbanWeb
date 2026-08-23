'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSesion } from '@/lib/auth'

/**
 * Perfil propio.
 *
 * Lo que se puede cambiar de uno mismo es lo descriptivo: nombre, cargo y foto.
 * El rol no: lo cambia un admin y `guard_role_change` lo verifica en la base.
 * La capacidad tampoco, porque define la carga que el equipo ve.
 */

export async function guardarPerfil(input: { nombre: string; cargo: string }) {
  const { actor } = await requireSesion()

  const nombre = input.nombre.trim()
  if (nombre.split(/\s+/).filter(Boolean).length < 2) {
    return { ok: false as const, error: 'Escribí nombre y apellido: de ahí salen las iniciales.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({
      name: nombre,
      job_title: input.cargo.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', actor.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/', 'layout')
  return { ok: true as const }
}

/** La subida la hace el navegador; acá solo se registra la URL resultante. */
export async function guardarAvatar(url: string | null) {
  const { actor } = await requireSesion()
  const supabase = await createClient()

  const { error } = await supabase
    .from('users')
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq('id', actor.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/', 'layout')
  return { ok: true as const }
}

/** Nombre del equipo: lo que se ve en la marca y en la migaja. Solo admin. */
export async function guardarNombreEquipo(nombre: string) {
  const { actor } = await requireSesion()
  if (actor.role !== 'admin') {
    return { ok: false as const, error: 'El nombre del equipo lo cambia un admin.' }
  }

  const limpio = nombre.trim()
  if (!limpio) return { ok: false as const, error: 'El nombre no puede quedar vacío.' }
  if (limpio.length > 60) {
    return { ok: false as const, error: 'Máximo 60 caracteres: la barra lateral mide 196px.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('settings')
    .update({ org_name: limpio, updated_at: new Date().toISOString() })
    .eq('id', true)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/', 'layout')
  return { ok: true as const }
}
