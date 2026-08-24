'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Auto-registro.
 *
 * Es una puerta distinta de la invitación y sigue existiendo: alguien con la URL
 * se da de alta solo, sin que un admin haga nada. Las invitaciones por correo NO
 * pasan por acá —esas caen en `/auth/callback` y después en `/bienvenida`—.
 *
 * El rol NO viaja en el formulario ni en el metadata: lo decide el trigger
 * `handle_new_auth_user` en la base (primer usuario admin, el resto member). Si
 * el rol se pudiera pedir desde acá, cualquiera se registraría como admin.
 *
 * `REGISTRO_CODIGO` es el código compartido del despliegue, y `REGISTRO_DOMINIO`
 * el dominio permitido. Las dos siguen vigentes: son la cerradura del
 * auto-registro, no del flujo de invitaciones. El código de invitación personal
 * —que se validaba acá contra `invitation_valida`— sí desapareció: ahora la
 * invitación llega por correo y no se tipea en ningún formulario.
 */

export interface EstadoRegistro {
  error?: string
  aviso?: string
}

const MIN_PASSWORD = 8

export async function registrarse(
  _prev: EstadoRegistro,
  formData: FormData,
): Promise<EstadoRegistro> {
  const nombre = String(formData.get('nombre') ?? '').trim()
  const cargo = String(formData.get('cargo') ?? '').trim()
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const password = String(formData.get('password') ?? '')
  const repetir = String(formData.get('repetir') ?? '')
  const codigo = String(formData.get('codigo') ?? '').trim()

  if (!nombre || !email || !password) {
    return { error: 'Completá nombre, correo y contraseña.' }
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

  // El código compartido del despliegue. Ya no hay códigos de invitación
  // personales que aceptar acá: quien fue invitado entra por el enlace del
  // correo, no por este formulario.
  const esperado = process.env.REGISTRO_CODIGO

  if (esperado && codigo !== esperado) {
    return {
      error:
        'El código de acceso no es correcto. Pedíselo a quien administra el tablero, o pedile que te invite por correo.',
    }
  }

  const dominio = process.env.REGISTRO_DOMINIO
  if (dominio && !email.endsWith(`@${dominio}`)) {
    return { error: `El registro está limitado a correos @${dominio}.` }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: nombre, job_title: cargo || null } },
  })

  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return { error: 'Ese correo ya tiene cuenta. Entrá con tu contraseña o pedí un restablecimiento.' }
    }
    return { error: error.message }
  }

  // Con confirmación de correo activada, signUp no devuelve sesión: la cuenta
  // existe pero todavía no puede entrar.
  if (!data.session) {
    return {
      aviso:
        'Cuenta creada. Te mandamos un correo de confirmación: abrilo y después entrá con tu contraseña.',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/tickets')
}
