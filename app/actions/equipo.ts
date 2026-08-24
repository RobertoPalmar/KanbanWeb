'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
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
 * · La invitación SÍ otorga rol, y el rol vive en la fila de `invitations`. El
 *   admin elige el rol al invitar; `invitation_aceptar_por_email` lo aplica al
 *   aceptar, leyéndolo de la base. Nunca sale del metadata de auth ni de un
 *   parámetro que controle el cliente: eso sería una escalada de privilegios.
 */

/** Lista cerrada de roles. El enum de la base es la garantía; esto da el mensaje. */
const ROLES_VALIDOS: Role[] = ['viewer', 'member', 'admin']

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

/**
 * Invitaciones por correo.
 *
 * El admin escribe el correo y elige el rol. El correo lo manda Supabase Auth
 * (`inviteUserByEmail`), y el enlace del correo cae en `/auth/callback`, que
 * canjea el token, acepta la invitación y aplica el rol.
 *
 * EL ROL VIAJA EN LA FILA DE `invitations`, NO EN EL METADATA. `inviteUserByEmail`
 * acepta `data` y eso termina en `raw_user_meta_data`, que es entrada del cliente
 * en otros flujos de auth. El rol se manda ahí solo para que la plantilla del
 * correo pueda decir "te invitaron como miembro"; quien lo aplica es
 * `invitation_aceptar_por_email`, leyendo la tabla.
 *
 * ORDEN DE LAS DOS ESCRITURAS: primero la fila de `invitations`, después el
 * correo. Si el correo falla, la fila se borra y el admin puede reintentar. Al
 * revés —correo primero— quedaría alguien con un enlace válido y ninguna
 * invitación en la base que le diera rol: entraría como `member` por el default
 * del trigger y nadie se enteraría.
 */
export async function invitar(email: string, role: Role) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin invita.' }

  const limpio = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpio)) {
    return { ok: false as const, error: 'Ese correo no parece válido.' }
  }

  // El rol se valida contra la lista cerrada: llega del cliente, y de acá pasa a
  // una fila que después otorga privilegios. Que el enum de la base lo rechazaría
  // igual no quita que el mensaje de error tenga que ser legible.
  if (!ROLES_VALIDOS.includes(role)) {
    return { ok: false as const, error: 'Ese rol no existe.' }
  }

  const supabase = await createClient()

  const { data: existente } = await supabase
    .from('users')
    .select('id, active')
    .eq('email', limpio)
    .maybeSingle()

  if (existente) {
    return {
      ok: false as const,
      error: existente.active
        ? 'Esa persona ya tiene cuenta en el tablero.'
        : 'Esa persona ya tuvo cuenta y está sin acceso. Reactivala en la lista de arriba en lugar de invitarla otra vez.',
    }
  }

  const { data: fila, error: errorFila } = await supabase
    .from('invitations')
    .insert({
      email: limpio,
      // `code` sigue siendo `not null unique` en la tabla y ya no se muestra a
      // nadie: es un identificador interno hasta que una migración lo quite.
      code: crypto.randomUUID(),
      role,
      created_by: sesion.actor.id,
      last_sent_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (errorFila) {
    if (errorFila.code === '23505' || /duplicate|unique/i.test(errorFila.message)) {
      return {
        ok: false as const,
        error: 'Ya hay una invitación pendiente para ese correo. Reenviala o revocala desde la lista.',
      }
    }
    return { ok: false as const, error: errorFila.message }
  }

  const envio = await enviarCorreoInvitacion(limpio, role)

  if (!envio.ok) {
    // El correo no salió: la invitación no sirve para nada, y dejarla ahí
    // bloquearía el índice único parcial y el reintento del admin.
    await supabase.from('invitations').delete().eq('id', fila.id)
    return envio
  }

  revalidatePath('/ajustes')
  return { ok: true as const }
}

/**
 * Reenvía el correo de una invitación pendiente sin tocar su rol ni su
 * vencimiento: el admin ya decidió esas dos cosas al crearla.
 */
export async function reenviarInvitacion(id: string) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin reenvía invitaciones.' }

  const supabase = await createClient()

  const { data: fila } = await supabase
    .from('invitations')
    .select('email, role, accepted_at, expires_at')
    .eq('id', id)
    .maybeSingle()

  if (!fila) return { ok: false as const, error: 'Esa invitación ya no existe.' }

  if (fila.accepted_at) {
    return { ok: false as const, error: 'Esa invitación ya se usó: la persona tiene cuenta.' }
  }

  if (new Date(fila.expires_at) <= new Date()) {
    return {
      ok: false as const,
      error: 'Esa invitación venció. Revocala y volvé a invitar para emitir una nueva.',
    }
  }

  const envio = await enviarCorreoInvitacion(fila.email, fila.role)
  if (!envio.ok) return envio

  await supabase
    .from('invitations')
    .update({ last_sent_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/ajustes')
  return { ok: true as const }
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
 * El envío en sí. Vive aparte porque `invitar` y `reenviarInvitacion` mandan el
 * mismo correo y solo se diferencian en lo que escriben en la base.
 *
 * `createServiceClient` porque `admin.inviteUserByEmail` exige la service key.
 * Este módulo es `'use server'` y nunca llega al navegador.
 */
async function enviarCorreoInvitacion(
  email: string,
  role: Role,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = urlBase()
  if (!base) {
    return {
      ok: false,
      error:
        'Falta configurar la URL pública del sitio (NEXT_PUBLIC_SITE_URL) para poder armar el enlace del correo.',
    }
  }

  const admin = createServiceClient()

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${base}/auth/callback?next=/bienvenida`,
    // Informativo, para la plantilla del correo. El rol que se aplica de verdad
    // sale de la fila de `invitations`.
    data: { invited_role: role },
  })

  if (!error) return { ok: true }

  return { ok: false, error: traducirEnvio(error.message, error.status) }
}

/**
 * La URL pública del sitio. El enlace del correo se abre en otro dispositivo, así
 * que tiene que ser absoluta y apuntar al despliegue, no a localhost.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` es el respaldo para que en Vercel funcione sin
 * configurar nada; en local hay que definir `NEXT_PUBLIC_SITE_URL`.
 */
function urlBase(): string | null {
  const explicita = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicita) return explicita.replace(/\/+$/, '')

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`

  return null
}

/**
 * Los errores de `inviteUserByEmail` llegan en inglés y sin contexto. Los tres
 * que se ven en la práctica:
 *
 * · 429 / "rate limit": el SMTP por defecto de Supabase manda unos pocos correos
 *   por hora en total, no por destinatario. Es el error más frecuente al invitar
 *   a varias personas seguidas, y el admin no tiene forma de adivinarlo.
 * · "already been registered": el correo ya existe en `auth.users` aunque no
 *   tenga perfil en `users` — típico de alguien que empezó un registro y no lo
 *   terminó.
 * · fallo de SMTP propio mal configurado.
 */
function traducirEnvio(mensaje: string, status?: number): string {
  if (status === 429 || /rate limit|too many requests/i.test(mensaje)) {
    return (
      'Supabase no deja mandar más correos por ahora: el servidor de correo de prueba ' +
      'permite unos pocos por hora para todo el proyecto. Esperá un rato y reenviá la ' +
      'invitación desde la lista, o configurá un SMTP propio en Supabase (Authentication > Emails) ' +
      'para no tener este límite.'
    )
  }

  if (/already.*registered|already exists|email_exists/i.test(mensaje)) {
    return (
      'Ese correo ya está registrado en el sistema de cuentas, aunque no aparezca en la ' +
      'lista de miembros. Puede ser un registro a medio terminar: pedile que entre con ' +
      '«Olvidé mi contraseña» desde el login.'
    )
  }

  if (/smtp|sending|mail/i.test(mensaje)) {
    return `No se pudo enviar el correo: ${mensaje}. Revisá la configuración de correo en Supabase (Authentication > Emails).`
  }

  return `No se pudo enviar la invitación: ${mensaje}`
}

function traducir(mensaje: string): string {
  if (/último admin/i.test(mensaje)) {
    return 'No se puede: quedaría el workspace sin ningún admin activo. Nombrá otro admin primero.'
  }
  return mensaje
}
