'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { registrarse, type EstadoRegistro } from './actions'

export function FormularioRegistro({ pideCodigo }: { pideCodigo: boolean }) {
  const [estado, accion, pendiente] = useActionState<EstadoRegistro, FormData>(registrarse, {})

  return (
    <form action={accion} className="login-caja" style={{ width: 400 }}>
      <div className="nav-marca" style={{ padding: 0, marginBottom: 2 }}>
        <span className="nav-marca-cuadro">C</span>
        <span className="nav-marca-texto" style={{ color: 'var(--tinta)' }}>
          Comunicación
        </span>
      </div>

      <p className="subtitulo" style={{ margin: 0 }}>
        Sumate al equipo. Entrás como miembro: podés crear tickets, tomar trabajo propio y
        comentar en el de los demás.
      </p>

      {estado.error && <p className="error-caja">{estado.error}</p>}

      {estado.aviso && (
        <p
          className="error-caja"
          style={{
            borderColor: 'var(--e5-fg)',
            background: 'var(--e5-bg)',
            color: 'var(--e5-fg)',
          }}
        >
          {estado.aviso}
        </p>
      )}

      <div className="grupo-campo">
        <label htmlFor="nombre">Nombre y apellido</label>
        <input
          id="nombre"
          name="nombre"
          required
          autoComplete="name"
          className="campo"
          placeholder="Ana Navarro"
        />
      </div>

      <div className="grupo-campo">
        <label htmlFor="cargo">Cargo</label>
        <input
          id="cargo"
          name="cargo"
          className="campo"
          autoComplete="organization-title"
          placeholder="Producción y eventos"
        />
      </div>

      <div className="grupo-campo">
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
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
          required
          minLength={8}
          autoComplete="new-password"
          className="campo"
          placeholder="Al menos 8 caracteres"
        />
      </div>

      <div className="grupo-campo">
        <label htmlFor="repetir">Repetir contraseña</label>
        <input
          id="repetir"
          name="repetir"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="campo"
        />
      </div>

      {/* El campo aparece siempre: puede ser el código compartido del equipo o
          una invitación personal. Solo es obligatorio si el despliegue exige
          código. */}
      <div className="grupo-campo">
        <label htmlFor="codigo">
          {pideCodigo ? 'Código de acceso o invitación' : 'Código de invitación (opcional)'}
        </label>
        <input
          id="codigo"
          name="codigo"
          required={pideCodigo}
          className="campo mono"
          placeholder="ABCD-2345-EFGH"
        />
      </div>

      <button type="submit" className="btn-primario" style={{ height: 36 }} disabled={pendiente}>
        {pendiente && <Spinner label="Creando cuenta" />}
        {pendiente ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--tinta-2)' }}>
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" style={{ color: 'var(--acento)' }}>
          Entrar
        </Link>
      </p>
    </form>
  )
}
