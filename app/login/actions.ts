'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface EstadoLogin {
  error?: string
}

export async function entrar(_prev: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Completá el correo y la contraseña.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // El mensaje de Supabase viene en inglés; se traduce el caso común y el
    // resto se muestra tal cual para no ocultar fallas de configuración.
    const msg = /invalid login credentials/i.test(error.message)
      ? 'Correo o contraseña incorrectos.'
      : error.message
    return { error: msg }
  }

  // Acceso revocado: las credenciales son válidas, el perfil no está activo.
  // Se cierra la sesión acá mismo para no dejarla dando vueltas.
  const { data: perfil } = await supabase
    .from('users')
    .select('active')
    .eq('email', email)
    .maybeSingle()

  if (perfil && perfil.active === false) {
    await supabase.auth.signOut()
    return {
      error: 'Tu acceso al tablero fue desactivado. Hablá con quien lo administra.',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/tickets')
}

export async function salir() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
