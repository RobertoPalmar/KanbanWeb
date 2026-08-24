import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Aterrizaje de los enlaces de correo de Supabase Auth.
 *
 * Es la única ruta de API de la aplicación, y existe porque el enlace de una
 * invitación tiene que cambiar de manos en el servidor: el token del correo se
 * canjea por una sesión con cookies, y las cookies no se pueden escribir desde
 * un Server Component.
 *
 * DOS FORMAS DE LLEGAR ACÁ, porque Supabase manda una u otra según la plantilla
 * del correo y la versión del proyecto:
 *
 *  · `?code=...` — flujo PKCE. Se canjea con `exchangeCodeForSession`.
 *  · `?token_hash=...&type=invite` — enlace de verificación clásico. Se canjea
 *    con `verifyOtp`. La plantilla por defecto de Supabase usa `{{ .TokenHash }}`
 *    en algunos proyectos y `{{ .ConfirmationURL }}` en otros, así que se
 *    soportan los dos en lugar de apostar a uno.
 *
 * DESPUÉS DEL CANJE SE ACEPTA LA INVITACIÓN. `invitation_aceptar_por_email` es
 * la que aplica el rol, leyéndolo de la fila de `invitations`. Esta ruta no
 * decide ningún rol y no acepta ninguno por querystring: si lo hiciera, el
 * enlace del correo sería una escalada de privilegios a un `?role=admin` de
 * distancia.
 *
 * La aceptación es idempotente y silenciosa: si no hay invitación pendiente
 * —porque es una confirmación de correo normal, o porque el enlace se abrió dos
 * veces— la función devuelve null y no pasa nada. El usuario entra igual, con el
 * rol que ya tenga.
 */

/** A dónde va alguien que acaba de aceptar. Nunca a una URL que venga de fuera. */
function destinoSeguro(next: string | null): string {
  // Solo rutas internas: un `next` absoluto sería un open redirect servido desde
  // nuestro propio dominio, que es exactamente lo que un phishing necesita.
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  return '/tickets'
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const destino = destinoSeguro(searchParams.get('next'))

  // Supabase puede mandar el error en la propia URL (enlace vencido, ya usado).
  const errorUrl = searchParams.get('error_description') ?? searchParams.get('error')
  if (errorUrl) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorUrl)}`)
  }

  if (!code && !tokenHash) {
    /*
     * Acá no se puede saber POR QUÉ no vino el token.
     *
     * Cuando el enlace está vencido o ya se usó, Supabase manda el motivo en el
     * FRAGMENTO de la URL (`#error=access_denied&error_code=otp_expired`), y el
     * navegador nunca envía el fragmento al servidor. Desde el servidor un
     * enlace vencido es indistinguible de uno malformado.
     *
     * Por eso el mensaje no afirma cuál de los dos fue: el componente de login
     * lee el fragmento en el cliente y, si trae un motivo, lo reemplaza por uno
     * exacto. Este texto es solo el respaldo para cuando no hay fragmento.
     */
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        'No se pudo validar el enlace del correo. Si ya creaste tu contraseña, entrá con ella; si no, pedí que te reenvíen la invitación.',
      )}`,
    )
  }

  const supabase = await createClient()

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        // `invite` es el tipo del correo de invitación. Los demás tipos
        // (`recovery`, `email`) llegan acá también y se pasan tal cual.
        type: (type as 'invite' | 'recovery' | 'email' | 'signup') ?? 'invite',
      })

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        'El enlace no es válido o ya venció. Pedí que te reenvíen la invitación.',
      )}`,
    )
  }

  // Ya hay sesión. Ahora se cobra la invitación, si existe.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.email) {
    // El rol lo decide la función leyendo `invitations`. El correo que se le pasa
    // es el de la sesión recién creada, y la función además lo verifica contra
    // `auth.uid()`: no hay forma de aceptar la invitación de otra persona.
    const { error: errorAceptar } = await supabase.rpc('invitation_aceptar_por_email', {
      p_email: user.email,
    })

    if (errorAceptar) {
      // No se corta el acceso por esto: la cuenta existe y la sesión es válida.
      // La persona entra con el rol por defecto y un admin la promueve a mano,
      // que es exactamente el comportamiento del flujo anterior.
      console.error('[auth/callback] No se pudo aceptar la invitación:', errorAceptar)
    }
  }

  return NextResponse.redirect(`${origin}${destino}`)
}
