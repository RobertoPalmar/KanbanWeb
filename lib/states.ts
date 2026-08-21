/**
 * Única fuente de verdad de los estados.
 *
 * Los estados NO son configurables por el admin: viven aquí y como enum
 * `issue_state` en Postgres. Eso elimina una tabla, un CRUD y una sección
 * entera de configuración.
 *
 * La CATEGORÍA es lo que consulta el código. El label es solo etiqueta visible:
 * ninguna query filtra por nombre de estado.
 *
 * Agregar un estado = una línea aquí + una migración de enum.
 */

export const STATE_KEYS = [
  'draft',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'cancelled',
] as const

export type StateKey = (typeof STATE_KEYS)[number]

export type StateCategory =
  | 'draft'
  | 'unstarted'
  | 'started'
  | 'completed'
  | 'cancelled'

export interface StateDef {
  label: string
  category: StateCategory
  order: number
  /** Token de color; el valor final lo resuelve el design system del front. */
  color: string
  description: string
}

export const STATES: Record<StateKey, StateDef> = {
  draft: {
    label: 'Borrador',
    category: 'draft',
    order: 1,
    color: '#9ca3af',
    description: 'Asignado a otra persona, esperando aprobación del admin',
  },
  todo: {
    label: 'Por hacer',
    category: 'unstarted',
    order: 2,
    color: '#6b7280',
    description: 'Aprobado y en cola',
  },
  in_progress: {
    label: 'En progreso',
    category: 'started',
    order: 3,
    color: '#f59e0b',
    description: 'Trabajo activo — arranca el cycle time',
  },
  in_review: {
    label: 'En revisión',
    category: 'started',
    order: 4,
    // Es 'started' a propósito: el material esperando aprobación es el cuello
    // de botella típico del departamento. Si el cronómetro se detuviera aquí,
    // el problema se volvería invisible.
    color: '#8b5cf6',
    description: 'Esperando aprobación — el cronómetro sigue corriendo',
  },
  done: {
    label: 'Finalizado',
    category: 'completed',
    order: 5,
    color: '#10b981',
    description: 'Completado — cuenta en throughput',
  },
  cancelled: {
    label: 'Cancelado',
    category: 'cancelled',
    order: 6,
    color: '#ef4444',
    description: 'Descartado — excluido de throughput',
  },
}

/** Estados en orden de tablero (columnas del kanban de izquierda a derecha). */
export const ORDERED_STATES: StateKey[] = [...STATE_KEYS].sort(
  (a, b) => STATES[a].order - STATES[b].order,
)

export function categoryOf(state: StateKey): StateCategory {
  return STATES[state].category
}

/** Solo la categoría 'started' cuenta en WIP. */
export function countsInWip(state: StateKey): boolean {
  return STATES[state].category === 'started'
}

/** Los borradores están excluidos de WIP, throughput, cycle time y reportes. */
export function isExcludedFromMetrics(state: StateKey): boolean {
  return STATES[state].category === 'draft'
}

/** Cuenta como abierto: todo lo que no está terminado ni cancelado ni en borrador. */
export function isOpen(state: StateKey): boolean {
  const c = STATES[state].category
  return c === 'unstarted' || c === 'started'
}

/** Cuenta en throughput: completados. Los cancelados no. */
export function countsInThroughput(state: StateKey): boolean {
  return STATES[state].category === 'completed'
}

export function isStateKey(value: string): value is StateKey {
  return (STATE_KEYS as readonly string[]).includes(value)
}
