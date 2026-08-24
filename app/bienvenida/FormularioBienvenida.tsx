'use client'

import { useActionState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import type { Role } from '@/lib/permissions'
import { completarAlta, type EstadoBienvenida } from './actions'

/** Qué puede hacer cada rol, en una línea. Para que sepa a qué entró. */
const QUE_PUEDE: Record<Role, string> = {
  admin: 'Como admin aprobás borradores, reasignás dueños y administrás el equipo.',
  member: 'Como miembro creás tickets, tomás trabajo propio y comentás en el de los demás.',
  viewer: 'Con acceso de solo lectura ves todo el tablero, sin escribir.',
}

/**
 * El rol llega como prop solo para mostrarlo. No es un campo del formulario ni
 * viaja en el submit: ya está escrito en la base y esta pantalla no lo cambia.
 */
export function FormularioBienvenida({
  email,
  nombreActual,
  rol,
}: {
  email: string
  nombreActual: string
  rol: Role
}) {
  const [estado, accion, pendiente] = useActionState<EstadoBienvenida, FormData>(
    completarAlta,
    {},
  )

  return (
    <form action={accion} className="login-caja" style={{ width: 400 }}>
      <div className="nav-marca" style={{ padding: 0, marginBottom: 2 }}>
        <span className="nav-marca-cuadro">C</span>
        <span className="nav-marca-texto" style={{ color: 'var(--tinta)' }}>
          Comunicación
        </span>
      </div>

      <p className="subtitulo" style={{ margin: 0 }}>
        Te invitaron al tablero. {QUE_PUEDE[rol]} Elegí una contraseña para poder volver a entrar.
      </p>

      {estado.error && <p className="error-caja">{estado.error}</p>}

      <div className="grupo-campo">
        <label htmlFor="email">Correo</label>
        <input id="email" className="campo" value={email} disabled readOnly />
      </div>

      <div className="grupo-campo">
        <label htmlFor="nombre">Nombre y apellido</label>
        <input
          id="nombre"
          name="nombre"
          required
          autoComplete="name"
          className="campo"
          defaultValue={nombreActual.includes(' ') ? nombreActual : ''}
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

      <button type="submit" className="btn-primario" style={{ height: 36 }} disabled={pendiente}>
        {pendiente && <Spinner label="Entrando al tablero" />}
        {pendiente ? 'Entrando…' : 'Entrar al tablero'}
      </button>
    </form>
  )
}
