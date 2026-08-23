import { redirect } from 'next/navigation'
import { getSesion } from '@/lib/auth'
import { FormularioLogin } from './FormularioLogin'

export default async function LoginPage() {
  const sesion = await getSesion()
  if (sesion) redirect('/tickets')

  return (
    <main className="login">
      <FormularioLogin />
    </main>
  )
}
