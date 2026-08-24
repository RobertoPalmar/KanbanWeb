import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  /*
   * Red de seguridad final. updateSession ya captura sus propios errores, pero
   * si algo se escapa (un fallo al inicializar el módulo, un cambio futuro que
   * introduzca un throw) el resultado en Edge sería un 500
   * MIDDLEWARE_INVOCATION_FAILED en todas las rutas del dominio: la app entera
   * caída, sin acceso ni al login. Un middleware nunca debe ser el punto de
   * fallo total, así que ante lo inesperado se deja pasar la request.
   */
  try {
    return await updateSession(request)
  } catch (error) {
    console.error('[middleware] Error no controlado:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Todo excepto assets estáticos e imágenes: refrescar la sesión en cada
     * request de un .svg no aporta nada y suma latencia.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
