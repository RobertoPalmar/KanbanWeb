'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { entrar, type EstadoLogin } from './actions'

/**
 * Traduce los códigos de error que Supabase manda en el fragmento de la URL.
 *
 * Son los mismos que documenta Supabase Auth; acá solo se les pone un texto que
 * diga qué hacer, en lugar de "Email link is invalid or has expired".
 */
function mensajeDeError(code: string | null, description: string | null): string {
  switch (code) {
    case 'otp_expired':
      return 'El enlace del correo ya venció o se usó. Si ya creaste tu contraseña, entrá con ella; si no, pedí que te reenvíen la invitación.'
    case 'access_denied':
      return 'El enlace no es válido. Pedí que te reenvíen la invitación.'
    default:
      return (
        description ??
        'No se pudo validar el enlace del correo. Pedí que te reenvíen la invitación.'
      )
  }
}

/**
 * Lee el error que Supabase deja en el FRAGMENTO de la URL (`#error=...`).
 *
 * Es la parte que el navegador NO manda al servidor, así que `/auth/callback`
 * no puede verla: desde el servidor un enlace vencido es indistinguible de uno
 * sin token, y termina mostrando "el enlace no trae el token" cuando en
 * realidad lo traía y estaba vencido.
 *
 * El fragmento se limpia de la barra de direcciones después de leerlo, para que
 * recargar no reviva un error ya resuelto.
 */
function useErrorDelFragmento(): string | undefined {
  const [error, setError] = useState<string>()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash.length < 2) return

    const params = new URLSearchParams(hash.slice(1))
    const code = params.get('error_code')
    const description = params.get('error_description')

    if (!params.get('error') && !code) return

    setError(mensajeDeError(code, description?.replace(/\+/g, ' ') ?? null))

    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    )
  }, [])

  return error
}

/**
 * `avisoInicial` es el mensaje que trae `/auth/callback` en la URL cuando un
 * enlace de correo falló. Se muestra en el mismo hueco que el error del login: es
 * el mismo tipo de información y competir por dos cajas distintas no ayuda.
 */
export function FormularioLogin({ avisoInicial }: { avisoInicial?: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoLogin, FormData>(entrar, {})
  const errorFragmento = useErrorDelFragmento()

  // El del fragmento gana sobre `avisoInicial`: cuando los dos están presentes,
  // el genérico del servidor ("no trae el token") es justamente el que no sabe
  // lo que pasó.
  const mensaje = estado.error ?? errorFragmento ?? avisoInicial

  return (
    <form action={accion} className="login-caja">
      <div className="nav-marca" style={{ padding: 0, marginBottom: 4 }}>
        <span className="nav-marca-cuadro">C</span>
        <span className="nav-marca-texto" style={{ color: 'var(--tinta)' }}>
          Comunicación
        </span>
      </div>

      <p className="subtitulo" style={{ margin: 0 }}>
        Gestión de trabajo del departamento.
      </p>

      {mensaje && <p className="error-caja">{mensaje}</p>}

      <div className="grupo-campo">
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="campo"
          placeholder="nombre@organizacion.com"
        />
      </div>

      <div className="grupo-campo">
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="campo"
        />
      </div>

      <button type="submit" className="btn-primario" style={{ height: 36 }} disabled={pendiente}>
        {pendiente && <Spinner label="Entrando" />}
        {pendiente ? 'Entrando…' : 'Entrar'}
      </button>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--tinta-2)' }}>
        ¿Sos nuevo en el equipo?{' '}
        <Link href="/registro" style={{ color: 'var(--acento)' }}>
          Creá tu cuenta
        </Link>
      </p>
    </form>
  )
}
