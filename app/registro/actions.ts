'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Registro propio.
 *
 * El rol NO viaja en el formulario ni en el metadata: lo decide el trigger
 * `handle_new_auth_user` en la base (primer usuario admin, el resto member). Si
 * el rol se pudiera pedir desde acá, cualquiera se registraría como admin.
 *
 * `REGISTRO_CODIGO` es un código compartido opcional. La herramienta es interna,
 * y sin código cualquiera con la URL entra al tablero del equipo: si la variable
 * está definida, el formulario lo exige.
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

  // El código puede ser el compartido del equipo (REGISTRO_CODIGO) o una
  // invitación personal emitida por un admin para este correo. Cualquiera de los
  // dos habilita el alta; ninguno otorga rol.
  const esperado = process.env.REGISTRO_CODIGO
  let porInvitacion = false

  if (codigo) {
    const { data: valida } = await supabase.rpc('invitation_valida', {
      p_email: email,
      p_code: codigo,
    })
    porInvitacion = valida === true
  }

  if (esperado && !porInvitacion && codigo !== esperado) {
    return {
      error:
        'El código no es correcto, o la invitación no corresponde a este correo. Pedile uno nuevo a quien administra el tablero.',
    }
  }

  // El dominio solo se exige a quien entra por el código compartido: una
  // invitación personal es una decisión explícita del admin sobre ese correo.
  const dominio = process.env.REGISTRO_DOMINIO
  if (dominio && !porInvitacion && !email.endsWith(`@${dominio}`)) {
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

  // La invitación se marca usada recién ahora: si el signUp fallaba antes, el
  // código tenía que seguir sirviendo.
  if (porInvitacion) {
    await supabase.rpc('invitation_aceptar', { p_email: email, p_code: codigo })
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
