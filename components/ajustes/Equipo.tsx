'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  cambiarAcceso,
  cambiarCapacidad,
  cambiarRol,
  invitar,
  reenviarInvitacion,
  revocarInvitacion,
} from '@/app/actions/equipo'
import { guardarNombreEquipo } from '@/app/actions/perfil'
import { fechaCorta, plural } from '@/lib/format'
import type { Role } from '@/lib/permissions'
import { Avatar } from '@/components/ui/piezas'
import { IconoCerrar } from '@/components/ui/iconos'
import { Pista } from '@/components/ui/Pista'
import { useGuardado } from '@/components/ui/ContextoGuardado'

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
  /** El rol que el admin eligió al invitar. Se aplica al aceptar. */
  role: Role
  created_at: string
  expires_at: string
  last_sent_at: string
  accepted_at: string | null
}

const ROLES: Array<{ valor: Role; label: string; detalle: string }> = [
  { valor: 'admin', label: 'Admin', detalle: 'Aprueba borradores, reasigna dueños, administra el equipo' },
  { valor: 'member', label: 'Miembro', detalle: 'Crea tickets y mueve los propios' },
  { valor: 'viewer', label: 'Solo lectura', detalle: 'Ve el tablero, no escribe' },
]

/** Rol -> etiqueta corta, para la lista de pendientes. Sale de ROLES: un solo lugar. */
const ETIQUETA_ROL = Object.fromEntries(ROLES.map((r) => [r.valor, r.label])) as Record<
  Role,
  string
>

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
  // Igual que en `Ajustes`: el feedback de guardado lo pinta el indicador
  // global. Acá hay una fila por miembro, así que un spinner por sección
  // tendría que elegir cuál de las filas lo muestra.
  const { guardar, estado } = useGuardado()
  const [nombre, setNombre] = useState(nombreEquipo)
  const [correoInvitado, setCorreoInvitado] = useState('')
  // Arranca en `member`: es el rol con el que entra casi todo el mundo, y el de
  // menor privilegio que igual puede trabajar. Que el default sea el inocuo.
  const [rolInvitado, setRolInvitado] = useState<Role>('member')

  const activos = miembros.filter((m) => m.active)
  const bloqueados = miembros.filter((m) => !m.active)
  const pendientes = invitaciones.filter((i) => !i.accepted_at)
  const pendiente = estado === 'guardando'

  // `etiqueta` reemplaza el "Guardando…" genérico. Los envíos de correo tardan
  // segundos, y un texto genérico varios segundos se lee como que algo se colgó.
  function correr(
    accion: () => Promise<{ ok: boolean; error?: string }>,
    etiqueta?: string,
  ) {
    void guardar(accion, etiqueta).then((ok) => {
      if (ok) router.refresh()
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
          <div className="fila-ajuste" key={m.id}>
            <Avatar persona={m} size={32} />

            <span className="fila-ajuste-texto fila-ajuste-texto-1linea">
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

            <div className="fila-ajuste-controles">
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <label className="mono-xs" htmlFor={`cap-${m.id}`} style={{ color: 'var(--tinta-3)' }}>
                  cap
                </label>
                <Pista
                  etiqueta="la capacidad"
                  respaldo="Puntos de trabajo que puede llevar a la vez. Ocho puntos ≈ una semana."
                >
                  Capacidad: los puntos de trabajo que la persona puede llevar a la vez. Ocho
                  puntos son más o menos una semana de trabajo. Es el tope de su barra en
                  «Carga del equipo» del panel, y ahí solo cuenta lo que está en curso.
                </Pista>
                <input
                  id={`cap-${m.id}`}
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
              </div>

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
          Escribí el correo y elegí con qué rol entra. Le llega un correo con un enlace: lo abre,
          elige su contraseña y ya está adentro con ese rol. El enlace vale 14 días y sirve una
          sola vez.
        </p>

        <div className="fila-guardar" style={{ marginBottom: 12 }}>
          <input
            className="campo"
            type="email"
            value={correoInvitado}
            placeholder="persona@organizacion.com"
            aria-label="Correo a invitar"
            disabled={pendiente}
            onChange={(e) => setCorreoInvitado(e.target.value)}
          />

          <div className="segmentado" role="group" aria-label="Rol de la invitación">
            {ROLES.map((r) => (
              <button
                key={r.valor}
                type="button"
                title={r.detalle}
                style={{ fontSize: 11, padding: '0 8px' }}
                aria-pressed={rolInvitado === r.valor}
                disabled={pendiente}
                onClick={() => setRolInvitado(r.valor)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn-primario"
            disabled={pendiente || !correoInvitado.trim()}
            onClick={() => {
              const destino = correoInvitado.trim()
              void guardar(
                () => invitar(destino, rolInvitado),
                `Enviando invitación a ${destino}…`,
              ).then((ok) => {
                if (ok) {
                  setCorreoInvitado('')
                  setRolInvitado('member')
                  router.refresh()
                }
              })
            }}
          >
            Invitar
          </button>
        </div>

        {pendientes.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--tinta-3)', margin: 0 }}>
            Sin invitaciones pendientes.
          </p>
        ) : (
          <div className="lista-borde">
            {pendientes.map((i) => {
              const vencida = new Date(i.expires_at) <= new Date()
              return (
                <div className="adjunto" key={i.id} style={{ height: 36 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {i.email}
                  </span>

                  <span className="mono-sm" style={{ color: 'var(--tinta-2)', flex: 'none' }}>
                    {ETIQUETA_ROL[i.role]}
                  </span>

                  <span
                    className="mono-sm"
                    style={{
                      marginLeft: 'auto',
                      color: vencida ? 'var(--alerta)' : 'var(--tinta-2)',
                      flex: 'none',
                    }}
                  >
                    {vencida ? 'vencida' : `vence ${fechaCorta(i.expires_at.slice(0, 10))}`}
                  </span>

                  <button
                    type="button"
                    className="btn-secundario"
                    style={{ height: 24, flex: 'none', fontSize: 11 }}
                    disabled={pendiente || vencida}
                    title={
                      vencida
                        ? 'Venció: revocala y volvé a invitar'
                        : 'Manda de nuevo el mismo correo, con el mismo rol'
                    }
                    onClick={() =>
                      correr(() => reenviarInvitacion(i.id), `Reenviando a ${i.email}…`)
                    }
                  >
                    Reenviar
                  </button>

                  <button
                    type="button"
                    className="btn-icono"
                    style={{ flex: 'none' }}
                    aria-label={`Revocar invitación de ${i.email}`}
                    title="Revocar: el enlace del correo deja de servir"
                    disabled={pendiente}
                    onClick={() => correr(() => revocarInvitacion(i.id))}
                  >
                    <IconoCerrar size={11} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <p style={{ margin: '12px 0 0', fontSize: 11.5, color: 'var(--tinta-3)' }}>
          El rol se decide acá y viaja en la invitación: quien acepta entra ya con ese rol, sin
          que tengas que promoverlo después. Revocar una invitación pendiente invalida su enlace.
        </p>
      </section>
    </>
  )
}
