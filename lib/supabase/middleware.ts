/**
 * Refresco de sesión para el middleware de Next.js.
 *
 * Los Server Components no pueden escribir cookies, así que el token de sesión
 * se refresca aquí y se propaga tanto a la request (para el render) como a la
 * response (para el navegador).
 *
 * Este módulo corre en el Edge Runtime. Dos reglas que no se pueden romper:
 *
 *  1. Nada de APIs de Node (fs, crypto de Node, Buffer...). Solo Web APIs.
 *  2. Nunca lanzar. Si el middleware lanza, Vercel responde 500
 *     MIDDLEWARE_INVOCATION_FAILED y la app entera queda inaccesible, incluido
 *     el login. Cualquier fallo tiene que degradar, no tumbar el sitio.
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

function esPublica(path: string) {
  return (
    PUBLIC_EXACT.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))
  )
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname

  /*
   * Las NEXT_PUBLIC_* se sustituyen literalmente en tiempo de build, no se leen
   * en runtime. Si no están definidas en el entorno de build de Vercel, aquí
   * llegan como `undefined` y createServerClient lanza
   * "Your project's URL and Key are required to create a Supabase client!".
   * En el middleware eso es un 500 en todas las rutas, así que se comprueba
   * antes en lugar de dejar que lance.
   */
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error(
      '[middleware] Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Hay que definirlas en las variables de entorno del proyecto en Vercel y volver a desplegar ' +
        '(al ser NEXT_PUBLIC_* se inlinean en build: no basta con añadirlas, hay que redeployar). ' +
        'Sin ellas no se puede validar la sesión; se deja pasar la request para no tumbar el sitio.',
    )
    // Sin credenciales no se puede saber si hay sesión. Se deja pasar: las
    // páginas protegidas usan el cliente de servidor y redirigen ellas mismas.
    // Peor un render degradado que un 500 en todo el dominio.
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  try {
    const supabase = createServerClient<Database>(url, anonKey, {
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
    })

    // getUser() y no getSession(): el primero valida el token contra el servidor
    // de Auth. getSession() se fía de la cookie, que el cliente puede manipular.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user && !esPublica(path)) {
      const redirect = request.nextUrl.clone()
      redirect.pathname = '/login'
      // Para volver a donde quería ir después de autenticarse.
      redirect.searchParams.set('next', path)
      return NextResponse.redirect(redirect)
    }

    if (user && path === '/login') {
      const redirect = request.nextUrl.clone()
      redirect.pathname = '/tickets'
      redirect.search = ''
      return NextResponse.redirect(redirect)
    }

    return response
  } catch (error) {
    /*
     * Aquí se cae, entre otras cosas, un fallo de red contra el servidor de Auth
     * de Supabase: getUser() hace una llamada HTTP y en Edge una excepción sin
     * capturar es un 500 en toda la app.
     *
     * En rutas públicas se deja pasar. En rutas protegidas se manda a /login,
     * que es lo que habría pasado con una sesión inválida: el usuario ve una
     * pantalla de login en vez de un error del servidor.
     */
    console.error('[middleware] Error al refrescar la sesión:', error)

    if (esPublica(path)) {
      return NextResponse.next({ request })
    }

    const redirect = request.nextUrl.clone()
    redirect.pathname = '/login'
    redirect.searchParams.set('next', path)
    return NextResponse.redirect(redirect)
  }
}
