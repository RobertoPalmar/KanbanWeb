import { redirect } from 'next/navigation'
import { getSesion } from '@/lib/auth'
import { FormularioRegistro } from './FormularioRegistro'

export default async function RegistroPage() {
  const sesion = await getSesion()
  if (sesion) redirect('/tickets')

  // El código solo se pide si está configurado: si no, el registro es abierto a
  // quien tenga la URL, y eso lo decide quien despliega, no el formulario.
  return (
    <main className="login">
      <FormularioRegistro pideCodigo={Boolean(process.env.REGISTRO_CODIGO)} />
    </main>
  )
}
