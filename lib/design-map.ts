/**
 * Puente entre el handoff de diseño y el modelo de la base.
 *
 * El prototipo usa claves propias (`porhacer`, `progreso`, `final`) y la base
 * usa el enum `issue_state` (`todo`, `in_progress`, `done`). Las ETIQUETAS
 * visibles coinciden exactamente, así que la divergencia es solo de claves.
 *
 * Regla: el enum de la base es la fuente de verdad. Este archivo existe para
 * leer el prototipo, no para que las claves del diseño entren al código.
 */

import type { StateKey } from './states'

/** Clave del prototipo → clave del enum. Solo para portar el diseño. */
export const DESIGN_STATE_TO_DB: Record<string, StateKey> = {
  borrador: 'draft',
  porhacer: 'todo',
  progreso: 'in_progress',
  revision: 'in_review',
  final: 'done',
  cancelado: 'cancelled',
}

/**
 * Variable CSS del estado (`--e1`…`--e6`).
 *
 * El índice sigue el orden del tablero, que es el mismo `order` de states.ts,
 * así que el mapeo es posicional y no hay que tocar el CSS del handoff.
 */
export const STATE_CSS_INDEX: Record<StateKey, number> = {
  draft: 1,
  todo: 2,
  in_progress: 3,
  in_review: 4,
  done: 5,
  cancelled: 6,
}

export function stateVars(state: StateKey) {
  const i = STATE_CSS_INDEX[state]
  return { fg: `var(--e${i}-fg)`, bg: `var(--e${i}-bg)` }
}

/**
 * Marca no cromática de cada estado.
 *
 * La interfaz nunca depende solo del color: con seis columnas y usuarios que
 * miran la pantalla todo el día, la forma tiene que distinguir tanto como el
 * tono. Además cubre daltonismo.
 */
export interface StateMark {
  /** Prefijo del chip. */
  glyph?: string
  /** El chip de Borrador lleva borde punteado. */
  dashedBorder?: boolean
  /** El número de un ticket cancelado va tachado. */
  strikeNumber?: boolean
}

export const STATE_MARKS: Record<StateKey, StateMark> = {
  draft: { dashedBorder: true },
  todo: {},
  in_progress: { glyph: '●' },
  in_review: { glyph: '●' },
  done: { glyph: '✓' },
  cancelled: { strikeNumber: true },
}

/**
 * Íconos de prioridad del handoff, en viewBox 0 0 14 14.
 *
 * Se indexan por NOMBRE y no por número: el prototipo numera 1=Baja..4=Urgente
 * y la base ordena 1=Urgente..4=Baja. Usar el número de cualquiera de los dos
 * lados invita a que se crucen.
 */
export const PRIORITY_ICONS: Record<string, { path: string; strokeWidth: number }> = {
  Baja: {
    path: 'M7 11V3M4 6l3-3 3 3',
    strokeWidth: 1.7,
  },
  Media: {
    path: 'M3 7h8',
    strokeWidth: 1.7,
  },
  Alta: {
    path: 'M7 11V3M4 6l3-3 3 3',
    strokeWidth: 1.7,
  },
  Urgente: {
    // El HTML hifi usa 5.4 / 10.6; el README dice 5.2 / 10.8. Manda el HTML.
    path: 'M7 3v5.4M7 10.6v.6',
    strokeWidth: 1.9,
  },
}

/** "Baja" se dibuja rotando el ícono de "Alta" 180°. */
export const PRIORITY_ROTATED = new Set(['Baja'])

/** Fondo de la píldora de tipo: color del tipo al 12 %. */
export function typePillBackground(hex: string): string {
  return `${hex}1f`
}

/** Círculo de prioridad: color al 13 %. */
export function priorityCircleBackground(hex: string): string {
  return `${hex}22`
}

/** Fondo del cuerpo de columna kanban: color del estado al 27 %. */
export function kanbanColumnBackground(state: StateKey): string {
  const i = STATE_CSS_INDEX[state]
  return `color-mix(in srgb, var(--e${i}-bg) 27%, transparent)`
}

/**
 * Avatares: color por persona.
 *
 * El prototipo los hardcodea por iniciales (AN, MG, JR…). Con usuarios reales
 * hay que derivarlo del id para que sea estable: el mismo usuario tiene que
 * tener siempre el mismo color, en cualquier sesión y dispositivo.
 */
export const AVATAR_COLORS = [
  '#0A73E8',
  '#7B3FD4',
  '#0F9D58',
  '#F2542D',
  '#00A9C7',
  '#E5197F',
  '#F5A300',
  '#8A9099',
] as const

export function avatarColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Umbrales de la barra de carga en la vista Personas.
 * Sobre 70 % ámbar, sobre 90 % rojo — antes de que la persona esté sobrecargada,
 * no después.
 */
export function loadBarColor(load: number, capacity: number, personColor: string) {
  const pct = capacity > 0 ? load / capacity : 0
  if (pct > 0.9) return 'var(--alerta)'
  if (pct > 0.7) return '#F5A300'
  return personColor
}

/**
 * Tono de una fecha de vencimiento.
 * El diseño decide NO pintar la fila entera de rojo: solo la celda de fecha y
 * el recuento del grupo. Con muchos vencidos, una tabla roja deja de comunicar.
 */
export type DueTone = 'overdue' | 'today' | 'soon' | 'normal'

export function dueTone(due: string | null, today = new Date()): DueTone {
  if (!due) return 'normal'

  const d = new Date(due + 'T00:00:00')
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((d.getTime() - t.getTime()) / 86_400_000)

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 3) return 'soon'
  return 'normal'
}

export function dueToneColor(tone: DueTone): string {
  switch (tone) {
    case 'overdue':
    case 'today':
      return 'var(--alerta)'
    case 'soon':
      return '#E07100'
    default:
      return 'var(--tinta-2)'
  }
}
