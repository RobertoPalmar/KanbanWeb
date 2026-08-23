'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  cambiarAcceso,
  cambiarCapacidad,
  cambiarRol,
  invitar,
  revocarInvitacion,
} from '@/app/actions/equipo'
import { guardarNombreEquipo } from '@/app/actions/perfil'
import { fechaCorta, plural } from '@/lib/format'
import type { Role } from '@/lib/permissions'
import { Avatar } from '@/components/ui/piezas'
import { IconoCerrar } from '@/components/ui/iconos'
import { Spinner } from '@/components/ui/Spinner'

export interface Miembro {
  id: string
  name: string
  email: string
  role: Role
  job_title: string | null
  capacity: number
  active: boolean
  avatar_url: string | null
}

export interface Invitacion {
  id: string
  email: string
  code: string
  created_at: string
  expires_at: string
  accepted_at: string | null
}

const ROLES: Array<{ valor: Role; label: string; detalle: string }> = [
  { valor: 'admin', label: 'Admin', detalle: 'Aprueba borradores, reasigna dueños, administra el equipo' },
  { valor: 'member', label: 'Miembro', detalle: 'Crea tickets y mueve los propios' },
  { valor: 'viewer', label: 'Solo lectura', detalle: 'Ve el tablero, no escribe' },
]

/**
 * Administración del equipo.
 *
 * Sacar a alguien lo deja sin acceso, no lo borra: sus tickets, comentarios e
 * historial siguen atribuidos a su nombre. Borrar la fila dejaría los reportes
 * sin autor y rompería años de historia por un cambio de personal.
 */
export function Equipo({
  miembros,
  invitaciones,
  nombreEquipo,
  yoId,
}: {
  miembros: Miembro[]
  invitaciones: Invitacion[]
  nombreEquipo: string
  yoId: string
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState(nombreEquipo)
  const [correoInvitado, setCorreoInvitado] = useState('')
  const [codigoNuevo, setCodigoNuevo] = useState<string | null>(null)

  const activos = miembros.filter((m) => m.active)
  const bloqueados = miembros.filter((m) => !m.active)
  const pendientes = invitaciones.filter((i) => !i.accepted_at)

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null)
      const res = await accion()
      if (!res.ok) setError(res.error ?? 'No se pudo aplicar el cambio.')
      else router.refresh()
    })
  }

  return (
    <>
      <section className="tarjeta-panel" style={{ marginBottom: 14 }}>
        <h3 className="mono-xs">Nombre del equipo</h3>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--tinta-2)' }}>
          Es lo que se ve en la barra lateral y en la migaja del encabezado. Hasta 60 caracteres:
          la barra mide 196px y el resto se recorta.
        </p>

        {error && <p className="error-caja" style={{ marginBottom: 10 }}>{error}</p>}

        <div className="fila-guardar">
          <input
            className="campo"
            value={nombre}
            maxLength={60}
            onChange={(e) => setNombre(e.target.value)}
            aria-label="Nombre del equipo"
          />
          <button
            type="button"
            className="btn-primario"
            disabled={pendiente || nombre.trim() === nombreEquipo || !nombre.trim()}
            onClick={() => correr(() => guardarNombreEquipo(nombre))}
          >
            {pendiente && <Spinner label="Guardando" />}
            Guardar
          </button>
        </div>
      </section>

      <section className="tarjeta-panel" style={{ marginBottom: 14 }}>
        <h3 className="mono-xs">
          Miembros · {plural(activos.length, 'activo', 'activos')}
          {bloqueados.length > 0 && ` · ${plural(bloqueados.length, 'sin acceso', 'sin acceso')}`}
        </h3>

        {miembros.map((m) => (
          <div className="fila-ajuste" key={m.id} style={{ gap: 10, alignItems: 'center' }}>
            <Avatar persona={m} size={32} />

            <span className="fila-ajuste-texto">
              <strong style={{ textDecoration: m.active ? undefined : 'line-through' }}>
                {m.name}
                {m.id === yoId && (
                  <span className="mono-sm" style={{ color: 'var(--tinta-3)', marginLeft: 6 }}>
                    vos
                  </span>
                )}
              </strong>
              <span>
                {m.email}
                {m.job_title ? ` · ${m.job_title}` : ''}
              </span>
            </span>

            <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="mono-xs" style={{ color: 'var(--tinta-3)' }}>
                cap
              </span>
              <input
                type="number"
                min={1}
                max={200}
                defaultValue={m.capacity}
                className="campo campo-capacidad mono"
                disabled={pendiente}
                aria-label={`Capacidad de ${m.name}`}
                onBlur={(e) => {
                  const v = Number(e.target.value)
                  if (v !== m.capacity) correr(() => cambiarCapacidad(m.id, v))
                }}
              />
            </label>

            <div className="segmentado" role="group" aria-label={`Rol de ${m.name}`}>
              {ROLES.map((r) => (
                <button
                  key={r.valor}
                  type="button"
                  title={r.detalle}
                  style={{ fontSize: 11, padding: '0 8px' }}
                  aria-pressed={m.role === r.valor}
                  disabled={pendiente || !m.active}
                  onClick={() => m.role !== r.valor && correr(() => cambiarRol(m.id, r.valor))}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn-secundario"
              style={{
                height: 26,
                color: m.active ? 'var(--alerta)' : undefined,
                borderColor: m.active ? 'var(--alerta)' : undefined,
              }}
              disabled={pendiente || m.id === yoId}
              title={
                m.id === yoId
                  ? 'No podés quitarte el acceso a vos mismo'
                  : m.active
                    ? 'Deja de entrar. Su historial se conserva.'
                    : 'Le devuelve el acceso'
              }
              onClick={() => correr(() => cambiarAcceso(m.id, !m.active))}
            >
              {m.active ? 'Quitar acceso' : 'Reactivar'}
            </button>

            <Link
              className="btn-secundario"
              style={{ height: 26 }}
              href={`/personas/${m.id}`}
              title="Ver ficha con métricas"
            >
              Ficha
            </Link>
          </div>
        ))}

        <p style={{ margin: '12px 0 0', fontSize: 11.5, color: 'var(--tinta-3)' }}>
          Quitar el acceso no borra a la persona: sus tickets, comentarios e historial siguen a su
          nombre. Al último admin activo no se le puede quitar el rol ni el acceso.
        </p>
      </section>

      <section className="tarjeta-panel">
        <h3 className="mono-xs">Invitaciones</h3>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--tinta-2)' }}>
          La invitación genera un código para ese correo, válido 14 días. Se lo pasás por el canal
          que prefieras y lo usa al registrarse. El código habilita el alta, no otorga rol: entra
          como miembro y lo promovés desde acá.
        </p>

        <div className="fila-guardar" style={{ marginBottom: 12 }}>
          <input
            className="campo"
            type="email"
            value={correoInvitado}
            placeholder="persona@organizacion.com"
            aria-label="Correo a invitar"
            onChange={(e) => setCorreoInvitado(e.target.value)}
          />
          <button
            type="button"
            className="btn-primario"
            disabled={pendiente || !correoInvitado.trim()}
            onClick={() =>
              startTransition(async () => {
                setError(null)
                const res = await invitar(correoInvitado)
                if (!res.ok) setError(res.error)
                else {
                  setCodigoNuevo(res.codigo)
                  setCorreoInvitado('')
                  router.refresh()
                }
              })
            }
          >
            {pendiente && <Spinner label="Generando invitación" />}
            Invitar
          </button>
        </div>

        {codigoNuevo && (
          <p
            className="error-caja"
            style={{ borderColor: 'var(--e5-fg)', background: 'var(--e5-bg)', color: 'var(--e5-fg)' }}
          >
            Código generado: <strong className="mono">{codigoNuevo}</strong> — copialo ahora y
            mandáselo. Queda listado abajo mientras esté pendiente.
          </p>
        )}

        {pendientes.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--tinta-3)', margin: 0 }}>
            Sin invitaciones pendientes.
          </p>
        ) : (
          <div className="lista-borde">
            {pendientes.map((i) => (
              <div className="adjunto" key={i.id} style={{ height: 36 }}>
                <span className="mono" style={{ fontSize: 11.5 }}>
                  {i.code}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i.email}
                </span>
                <span
                  className="mono-sm"
                  style={{ marginLeft: 'auto', color: 'var(--tinta-2)', flex: 'none' }}
                >
                  vence {fechaCorta(i.expires_at.slice(0, 10))}
                </span>
                <button
                  type="button"
                  className="btn-icono"
                  style={{ flex: 'none' }}
                  aria-label={`Revocar invitación de ${i.email}`}
                  disabled={pendiente}
                  onClick={() => correr(() => revocarInvitacion(i.id))}
                >
                  <IconoCerrar size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
