'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { entrar, type EstadoLogin } from './actions'

export function FormularioLogin() {
  const [estado, accion, pendiente] = useActionState<EstadoLogin, FormData>(entrar, {})

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

      {estado.error && <p className="error-caja">{estado.error}</p>}

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
