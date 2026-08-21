/**
 * Clientes Supabase para el servidor (Server Components, Route Handlers,
 * Server Actions).
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * Cliente con la sesión del usuario. Respeta RLS.
 * Es el que se usa para casi todo.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Llamado desde un Server Component: el middleware ya refresca la
            // sesión, así que se puede ignorar.
          }
        },
      },
    },
  )
}

/**
 * Cliente con service role. SE SALTA RLS POR COMPLETO.
 *
 * Solo para operaciones que la seguridad a nivel de fila no puede expresar:
 *   · el import CSV/XLSX, que necesita `set local app.importing = 'on'`
 *     para saltarse la validación de secuencia de estados
 *   · el alta de miembros con rol asignado
 *
 * Nunca importar este módulo desde código que llegue al navegador.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no está definida. Se obtiene en el dashboard de Supabase, Project Settings > API Keys.',
    )
  }

  const { createClient: createSupabaseClient } = require('@supabase/supabase-js')

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
