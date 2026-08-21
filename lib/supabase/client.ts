/**
 * Cliente Supabase para componentes de navegador.
 *
 * Usa la clave publicable: es segura en el cliente porque todo el acceso lo
 * gobierna RLS. Cada query lleva el JWT del usuario, y las políticas deciden
 * qué filas devuelve.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
