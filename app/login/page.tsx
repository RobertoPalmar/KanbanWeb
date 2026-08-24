import { redirect } from 'next/navigation'
import { getSesion } from '@/lib/auth'
import { FormularioLogin } from './FormularioLogin'

/**
 * `?error=` lo pone `/auth/callback` cuando el enlace de un correo no sirve
 * (vencido, ya usado, sin token). Sin esto la persona volvía al login sin saber
 * por qué su invitación no funcionó.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sesion = await getSesion()
  if (sesion) redirect('/tickets')

  const { error } = await searchParams

  return (
    <main className="login">
      <FormularioLogin avisoInicial={error} />
    </main>
  )
}
