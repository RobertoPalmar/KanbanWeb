'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSesion } from '@/lib/auth'
import type { Role } from '@/lib/permissions'

/**
 * Gestión del equipo. Solo admin.
 *
 * Tres decisiones que la base también sostiene:
 *
 * · Sacar a alguien no lo borra: `users.active = false`. La historia de issues,
 *   comentarios y activity log lo referencia, y borrarlo dejaría los reportes
 *   sin autor.
 * · Al último admin activo no se lo puede degradar ni bloquear — lo impide el
 *   trigger `guard_last_admin`, y acá se corta antes para dar un mensaje claro.
 * · La invitación no otorga rol: habilita el registro y nada más. Quien entra
 *   nace `member` y un admin lo promueve después.
 */

async function requireAdmin() {
  const sesion = await requireSesion()
  if (sesion.actor.role !== 'admin') return null
  return sesion
}

export async function cambiarRol(userId: string, role: Role) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin cambia roles.' }

  if (userId === sesion.actor.id && role !== 'admin') {
    return {
      ok: false as const,
      error: 'No podés quitarte a vos mismo el rol de admin. Pedile a otro admin que lo haga.',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return { ok: false as const, error: traducir(error.message) }

  revalidatePath('/', 'layout')
  return { ok: true as const }
}

export async function cambiarAcceso(userId: string, activo: boolean) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin da o quita acceso.' }

  if (userId === sesion.actor.id && !activo) {
    return { ok: false as const, error: 'No podés quitarte el acceso a vos mismo.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ active: activo, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return { ok: false as const, error: traducir(error.message) }

  revalidatePath('/', 'layout')
  return { ok: true as const }
}

export async function cambiarCapacidad(userId: string, capacidad: number) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin cambia la capacidad.' }

  if (!Number.isFinite(capacidad) || capacidad < 1 || capacidad > 200) {
    return { ok: false as const, error: 'La capacidad va de 1 a 200 puntos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ capacity: capacidad, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/', 'layout')
  return { ok: true as const }
}

/** Genera el código de invitación. Se muestra una vez y se comparte a mano. */
export async function invitar(email: string) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin invita.' }

  const limpio = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpio)) {
    return { ok: false as const, error: 'Ese correo no parece válido.' }
  }

  const supabase = await createClient()

  const { data: existente } = await supabase
    .from('users')
    .select('id')
    .eq('email', limpio)
    .maybeSingle()

  if (existente) {
    return { ok: false as const, error: 'Esa persona ya tiene cuenta en el tablero.' }
  }

  const codigo = generarCodigo()

  const { error } = await supabase
    .from('invitations')
    .insert({ email: limpio, code: codigo, created_by: sesion.actor.id })

  if (error) {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
      return { ok: false as const, error: 'Ya hay una invitación pendiente para ese correo.' }
    }
    return { ok: false as const, error: error.message }
  }

  revalidatePath('/ajustes')
  return { ok: true as const, codigo }
}

export async function revocarInvitacion(id: string) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin revoca invitaciones.' }

  const supabase = await createClient()
  const { error } = await supabase.from('invitations').delete().eq('id', id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/ajustes')
  return { ok: true as const }
}

/**
 * Código legible: se dicta por teléfono o se pega en un mensaje. Sin caracteres
 * ambiguos (0/O, 1/I) porque alguien lo va a transcribir a mano.
 */
function generarCodigo(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)

  const crudo = Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')
  return `${crudo.slice(0, 4)}-${crudo.slice(4, 8)}-${crudo.slice(8, 12)}`
}

function traducir(mensaje: string): string {
  if (/último admin/i.test(mensaje)) {
    return 'No se puede: quedaría el workspace sin ningún admin activo. Nombrá otro admin primero.'
  }
  return mensaje
}
