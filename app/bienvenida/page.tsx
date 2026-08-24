import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { FormularioBienvenida } from './FormularioBienvenida'

/**
 * Primer paso de quien llega por una invitación.
 *
 * El correo de Supabase deja a la persona con sesión pero sin contraseña: la
 * cuenta se creó desde el panel de admin, nadie eligió una. Si la mandáramos
 * directo al tablero, entraría bien esta vez y no podría volver a entrar nunca
 * —el login pide contraseña y no tiene ninguna—. Así que acá se le pide.
 *
 * También se le pide el nombre y apellido: `handle_new_auth_user` le puso la
 * parte del correo antes de la arroba como nombre, porque una invitación no lo
 * trae, y de ahí salen las iniciales de su avatar en todo el tablero.
 *
 * ESTA PÁGINA NO TOCA EL ROL. Ya lo aplicó `invitation_aceptar_por_email` en el
 * callback, leyéndolo de la fila de `invitations`. Acá no hay ningún campo de
 * rol, ni visible ni oculto.
 */
export default async function BienvenidaPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Sin sesión no hay invitación que completar.
  if (!user) redirect('/login')

  const sesion = await getSesion()

  // Ya completó el alta: tiene contraseña propia. `/bienvenida` no es una
  // pantalla a la que se pueda volver.
  if (user.user_metadata?.alta_completa === true) redirect('/tickets')

  return (
    <main className="login">
      <FormularioBienvenida
        email={user.email ?? ''}
        nombreActual={sesion?.perfil.name ?? ''}
        rol={sesion?.perfil.role ?? 'member'}
      />
    </main>
  )
}
