/**
 * Piezas de dominio compartidas por todas las vistas.
 *
 * Ninguna tiene estado: son la traducción visual de un dato de la base. Los
 * colores de tipo, prioridad y persona llegan por style inline porque son datos
 * (columna `color`), no tokens de tema.
 */

import { STATES, type StateKey } from '@/lib/states'
import { fechaCorta } from '@/lib/format'
import {
  dueTone,
  STATE_MARKS,
  avatarColor,
  initials,
  priorityCircleBackground,
  stateVars,
  typePillBackground,
  PRIORITY_ICONS,
  PRIORITY_ROTATED,
} from '@/lib/design-map'

/* -------------------------------------------------------------------------- */
/* Avatar                                                                      */
/* -------------------------------------------------------------------------- */

export interface Persona {
  id: string
  name: string
  avatar_url?: string | null
}

export function Avatar({
  persona,
  size = 21,
  apilado = false,
  title,
}: {
  persona: Persona
  size?: number
  apilado?: boolean
  title?: string
}) {
  // Con foto se muestra la foto; las iniciales son el respaldo y siguen siendo
  // lo que ve la mayoría, porque subir imagen es opcional.
  if (persona.avatar_url) {
    return (
      <img
        className={`avatar${apilado ? ' avatar-apilado' : ''}`}
        src={persona.avatar_url}
        alt=""
        title={title ?? persona.name}
        aria-label={persona.name}
        style={{ width: size, height: size, objectFit: 'cover' }}
      />
    )
  }

  return (
    <span
      className={`avatar${apilado ? ' avatar-apilado' : ''}`}
      title={title ?? persona.name}
      aria-label={persona.name}
      style={{
        width: size,
        height: size,
        background: avatarColor(persona.id),
        fontSize: Math.max(8, Math.round(size * 0.42)),
      }}
    >
      {initials(persona.name)}
    </span>
  )
}

/** Hasta dos avatares apilados + `+N`; guion si no hay apoyos. */
export function Apoyos({ personas, size = 21 }: { personas: Persona[]; size?: number }) {
  if (!personas.length) return <span style={{ color: 'var(--tinta-3)' }}>—</span>

  const visibles = personas.slice(0, 2)
  const resto = personas.length - visibles.length

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', paddingRight: 6 }}>
      {visibles.map((p) => (
        <Avatar key={p.id} persona={p} size={size} apilado />
      ))}
      {resto > 0 && (
        <span
          className="mono-sm"
          style={{ marginLeft: 9, color: 'var(--tinta-2)' }}
          title={personas
            .slice(2)
            .map((p) => p.name)
            .join(', ')}
        >
          +{resto}
        </span>
      )}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Estado                                                                      */
/* -------------------------------------------------------------------------- */

export function ChipEstado({ estado, titulo }: { estado: StateKey; titulo?: string }) {
  const { fg, bg } = stateVars(estado)
  const marca = STATE_MARKS[estado]

  return (
    <span
      className="chip-estado ui-xs"
      data-borde={marca.dashedBorder ? 'dashed' : 'solid'}
      style={{ color: fg, background: bg }}
      title={titulo ?? STATES[estado].description}
    >
      {marca.glyph && <span aria-hidden="true">{marca.glyph}</span>}
      {STATES[estado].label}
    </span>
  )
}

/** Número del ticket: tachado si está cancelado (marca no cromática). */
export function NumeroTicket({
  numero,
  estado,
  className = 'mono-sm',
}: {
  numero: number
  estado: StateKey
  className?: string
}) {
  const tachado = STATE_MARKS[estado].strikeNumber
  return (
    <span
      className={`${className}${tachado ? ' num-cancelado' : ''}`}
      style={{ color: 'var(--tinta-3)' }}
      title={tachado ? `Ticket ${numero} — cancelado` : `Ticket ${numero}`}
    >
      {numero}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Tipo                                                                        */
/* -------------------------------------------------------------------------- */

export interface Tipo {
  id: string
  name: string
  abbrev: string
  color: string
}

export function PillTipo({ tipo }: { tipo: Tipo }) {
  return (
    <span
      className="pill-tipo"
      style={{ background: typePillBackground(tipo.color), color: tipo.color }}
      title={tipo.name}
    >
      <span className="punto" style={{ background: tipo.color }} />
      {tipo.abbrev}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Prioridad                                                                   */
/* -------------------------------------------------------------------------- */

export interface Prioridad {
  id: string
  name: string
  color: string
}

function IconoPrioridad({ nombre, size = 14 }: { nombre: string; size?: number }) {
  const def = PRIORITY_ICONS[nombre] ?? PRIORITY_ICONS.Media
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={def.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={def.path} transform={PRIORITY_ROTATED.has(nombre) ? 'rotate(180 7 7)' : undefined} />
    </svg>
  )
}

/** Solo el círculo con el ícono: es lo que va en la tabla. */
export function CirculoPrioridad({ prioridad }: { prioridad: Prioridad | null }) {
  if (!prioridad) return <span style={{ color: 'var(--tinta-3)' }}>—</span>

  return (
    <span
      className="prio-circulo"
      style={{
        background: priorityCircleBackground(prioridad.color),
        color: prioridad.color,
      }}
      title={`Prioridad ${prioridad.name}`}
      aria-label={`Prioridad ${prioridad.name}`}
    >
      <IconoPrioridad nombre={prioridad.name} />
    </span>
  )
}

/** Ícono + palabra: tarjetas kanban y formularios. */
export function PillPrioridad({ prioridad }: { prioridad: Prioridad | null }) {
  if (!prioridad) return null

  return (
    <span
      className="pill-prio"
      style={{ background: priorityCircleBackground(prioridad.color), color: prioridad.color }}
      title={`Prioridad ${prioridad.name}`}
    >
      <span className="prio-circulo" style={{ width: 16, height: 16 }}>
        <IconoPrioridad nombre={prioridad.name} size={12} />
      </span>
      {prioridad.name}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Etiquetas y peso                                                            */
/* -------------------------------------------------------------------------- */

export function Etiquetas({
  etiquetas,
  max = 2,
}: {
  etiquetas: Array<{ id: string; name: string }>
  max?: number
}) {
  if (!etiquetas.length) return <span style={{ color: 'var(--tinta-3)' }}>—</span>

  const visibles = etiquetas.slice(0, max)
  const resto = etiquetas.length - visibles.length

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      {visibles.map((e) => (
        <span key={e.id} className="chip-etiqueta">
          {e.name}
        </span>
      ))}
      {resto > 0 && (
        <span className="mono-sm" style={{ color: 'var(--tinta-3)' }}>
          +{resto}
        </span>
      )}
    </span>
  )
}

/**
 * Fecha de vencimiento.
 *
 * El diseño decide NO pintar la fila entera: solo esta celda lleva el rojo, con
 * un `• ` delante para no depender del color. Diez vencidos son diez fechas
 * rojas discretas, no diez bandas rojas.
 */
export function Vencimiento({ iso }: { iso: string | null }) {
  const tono = dueTone(iso)
  const marcado = tono === 'overdue' || tono === 'today'

  return (
    <span
      className="mono-sm"
      style={{ color: marcado ? 'var(--alerta)' : 'var(--tinta-2)' }}
      title={marcado ? (tono === 'overdue' ? 'Vencido' : 'Vence hoy') : undefined}
    >
      {marcado && <span aria-hidden="true">• </span>}
      {fechaCorta(iso)}
    </span>
  )
}
