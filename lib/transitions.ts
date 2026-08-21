/**
 * Reglas de transición de estado.
 *
 * Espejo exacto de la tabla `state_transitions` en Postgres. Se valida en tres
 * capas y esta es solo la primera:
 *
 *   1. Kanban: deshabilita visualmente las columnas destino no permitidas
 *      DURANTE el drag — con 6 columnas y 2-3 destinos válidos, el feedback
 *      tiene que ser previo, no un error después de soltar.
 *   2. Formulario del ticket: solo lista los estados válidos.
 *   3. Trigger de Postgres: rechaza el UPDATE ilegal.
 *
 * La tercera no es opcional: es la única que no se puede evadir desde el
 * cliente. Si este archivo y la tabla SQL divergen, manda la tabla.
 *
 * Regla universal: ±1 posición en el orden. NINGÚN rol salta estados, incluido
 * el admin — el admin decide QUÉ tickets mueve (todos), no CÓMO se mueven.
 */

import { STATES, type StateKey } from './states'

/** Destinos alcanzables desde cada estado, sin considerar rol. */
export const TRANSITIONS: Record<StateKey, StateKey[]> = {
  draft: ['todo', 'cancelled'],
  todo: ['in_progress', 'cancelled'],
  in_progress: ['todo', 'in_review', 'cancelled'],
  in_review: ['in_progress', 'done', 'cancelled'],
  done: ['in_review'], // solo admin — reapertura
  cancelled: [], // terminal: si el trabajo revive, se crea un ticket nuevo
}

/**
 * Transiciones reservadas al admin.
 *
 * - draft -> todo: aprobación del borrador.
 * - done -> in_review: reapertura. Restringida para que el throughput semanal
 *   no sea un número móvil que cambia hacia atrás. Si se decide que el owner
 *   también pueda reabrir, hay que quitarlo de aquí Y correr el UPDATE sobre
 *   state_transitions — las métricas dejan de ser estables.
 */
export const ADMIN_ONLY: Array<[StateKey, StateKey]> = [
  ['draft', 'todo'],
  ['done', 'in_review'],
]

/** Transiciones que exigen un comentario explicando el motivo. */
export const REQUIRES_COMMENT: StateKey[] = ['cancelled']

export function isAdminOnly(from: StateKey, to: StateKey): boolean {
  return ADMIN_ONLY.some(([f, t]) => f === from && t === to)
}

export function requiresComment(to: StateKey): boolean {
  return REQUIRES_COMMENT.includes(to)
}

export function canTransition(
  from: StateKey,
  to: StateKey,
  isAdmin: boolean,
): boolean {
  if (from === to) return false
  if (!TRANSITIONS[from].includes(to)) return false
  if (isAdminOnly(from, to) && !isAdmin) return false
  return true
}

/**
 * Destinos válidos para pintar el kanban y el selector del formulario.
 *
 * `canMove` distingue alcance de secuencia: un member solo mueve tickets donde
 * es owner (alcance), pero cuando los mueve sigue las mismas reglas de
 * secuencia que el admin.
 */
export function allowedTargets(
  from: StateKey,
  opts: { isAdmin: boolean; isOwner: boolean },
): StateKey[] {
  const canMove = opts.isAdmin || opts.isOwner
  if (!canMove) return []
  return TRANSITIONS[from].filter((to) => canTransition(from, to, opts.isAdmin))
}

export interface TransitionCheck {
  allowed: boolean
  /** Motivo del rechazo, listo para mostrar al usuario. */
  reason?: string
  /** El cliente debe pedir un comentario antes de confirmar el movimiento. */
  needsComment: boolean
}

export function checkTransition(
  from: StateKey,
  to: StateKey,
  opts: { isAdmin: boolean; isOwner: boolean },
): TransitionCheck {
  const needsComment = requiresComment(to)

  if (from === to) {
    return { allowed: false, reason: 'El ticket ya está en ese estado', needsComment }
  }

  if (!opts.isAdmin && !opts.isOwner) {
    return {
      allowed: false,
      reason: 'Solo el responsable del ticket o un admin pueden moverlo',
      needsComment,
    }
  }

  if (!TRANSITIONS[from].includes(to)) {
    return {
      allowed: false,
      reason: `No se puede pasar de "${STATES[from].label}" a "${STATES[to].label}": solo se avanza o retrocede una posición, o se cancela`,
      needsComment,
    }
  }

  if (isAdminOnly(from, to) && !opts.isAdmin) {
    const label =
      from === 'draft' ? 'Aprobar un borrador' : 'Reabrir un ticket finalizado'
    return { allowed: false, reason: `${label} es una acción de admin`, needsComment }
  }

  return { allowed: true, needsComment }
}

/**
 * Estado inicial según quién crea (sección 4).
 *
 * Los tickets propios no pasan por aprobación: si lo hicieran, el admin sería
 * cuello de botella de todo y la herramienta se abandonaría. El control existe
 * solo para asignarle trabajo a otro.
 *
 * El servidor recalcula esto en un trigger — aquí es solo para que el
 * formulario muestre el estado correcto antes de guardar.
 */
export function initialState(opts: {
  creatorIsAdmin: boolean
  creatorId: string
  ownerId: string
}): StateKey {
  if (opts.creatorIsAdmin) return 'todo'
  return opts.creatorId === opts.ownerId ? 'todo' : 'draft'
}
