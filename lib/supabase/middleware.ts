/**
 * Refresco de sesión para el middleware de Next.js.
 *
 * Los Server Components no pueden escribir cookies, así que el token de sesión
 * se refresca aquí y se propaga tanto a la request (para el render) como a la
 * response (para el navegador).
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

/** Rutas accesibles sin sesión, por prefijo. */
const PUBLIC_PREFIXES = ['/login', '/registro', '/auth/callback', '/auth/confirm']

/**
 * Rutas públicas exactas.
 *
 * La portada es una de ellas: nadie debería caer en un formulario de login sin
 * saber antes a qué está entrando.
 */
const PUBLIC_EXACT = ['/']

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() y no getSession(): el primero valida el token contra el servidor
  // de Auth. getSession() se fía de la cookie, que el cliente puede manipular.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic =
    PUBLIC_EXACT.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Para volver a donde quería ir después de autenticarse.
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  if (user && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/tickets'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
