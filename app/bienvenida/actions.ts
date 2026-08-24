'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Alta de quien llegó por invitación.
 *
 * Guarda nombre y contraseña. NO guarda el rol: el rol ya lo escribió
 * `invitation_aceptar_por_email` en el callback de auth, leyéndolo de la fila de
 * `invitations`. Este formulario no tiene campo de rol y esta acción no lo
 * leería aunque el navegador lo mandara.
 */

export interface EstadoBienvenida {
  error?: string
}

const MIN_PASSWORD = 8

export async function completarAlta(
  _prev: EstadoBienvenida,
  formData: FormData,
): Promise<EstadoBienvenida> {
  const nombre = String(formData.get('nombre') ?? '').trim()
  const cargo = String(formData.get('cargo') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const repetir = String(formData.get('repetir') ?? '')

  if (!nombre || !password) {
    return { error: 'Completá tu nombre y una contraseña.' }
  }

  if (nombre.split(/\s+/).length < 2) {
    return { error: 'Escribí nombre y apellido: las iniciales del avatar salen de ahí.' }
  }

  if (password.length < MIN_PASSWORD) {
    return { error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` }
  }

  if (password !== repetir) {
    return { error: 'Las contraseñas no coinciden.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Se cerró la sesión. Volvé a abrir el enlace del correo.' }
  }

  // `updateUser` sobre la sesión propia: la contraseña la fija la persona, no un
  // admin, y el service role no interviene.
  const { error: errorAuth } = await supabase.auth.updateUser({
    password,
    // `alta_completa` es la marca que usa `/bienvenida` para no volver a
    // pedirle esto. Es metadata y por eso NO decide nada de permisos.
    data: { alta_completa: true, name: nombre, job_title: cargo || null },
  })

  if (errorAuth) {
    if (/should be different|same as the old/i.test(errorAuth.message)) {
      return { error: 'Elegí una contraseña distinta a la anterior.' }
    }
    return { error: errorAuth.message }
  }

  // El perfil se actualiza aparte: `handle_new_auth_user` solo corre al crear la
  // cuenta, no en cada `updateUser`.
  const { error: errorPerfil } = await supabase
    .from('users')
    .update({
      name: nombre,
      job_title: cargo || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (errorPerfil) return { error: errorPerfil.message }

  revalidatePath('/', 'layout')
  redirect('/tickets')
}
