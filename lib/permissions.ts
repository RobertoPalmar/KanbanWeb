/**
 * Permisos de rol.
 *
 * ESTO NO ES LA CAPA DE SEGURIDAD. Los permisos reales son las políticas RLS de
 * Supabase (supabase/migrations/*_rls.sql). Este archivo existe solo para que
 * la UI oculte lo que el usuario no puede hacer, en lugar de mostrárselo y
 * fallar al guardar.
 *
 * Alcance y secuencia son dos reglas independientes:
 *   · Este archivo define SOBRE QUÉ TICKETS actúa cada rol.
 *   · lib/transitions.ts define CÓMO se mueve cualquier ticket.
 * El admin tiene alcance total, no exención de secuencia.
 */

export type Role = 'viewer' | 'member' | 'admin'

export interface Actor {
  id: string
  role: Role
}

export interface IssueRef {
  ownerId: string
  createdBy: string
  state: string
}

const isAdmin = (a: Actor) => a.role === 'admin'
const canWrite = (a: Actor) => a.role === 'member' || a.role === 'admin'

/** Todos ven todos los tickets, borradores incluidos. */
export const canViewIssues = () => true

export const canCreateIssue = (a: Actor) => canWrite(a)

/** Un member puede crear para otro; el ticket nace en `draft`. */
export const canAssignToOther = (a: Actor) => canWrite(a)

/**
 * Editar campos del ticket. El creador conserva la edición mientras el ticket
 * está en borrador; después queda como cualquier otro.
 */
export function canEditIssue(a: Actor, issue: IssueRef): boolean {
  if (!canWrite(a)) return false
  if (isAdmin(a)) return true
  if (issue.ownerId === a.id) return true
  return issue.state === 'draft' && issue.createdBy === a.id
}

/** Mover de estado: owner o admin. Los apoyos no mueven el ticket. */
export function canMoveIssue(a: Actor, issue: IssueRef): boolean {
  if (!canWrite(a)) return false
  return isAdmin(a) || issue.ownerId === a.id
}

/** Reasignar owner es exclusivo del admin. */
export const canReassignOwner = (a: Actor) => isAdmin(a)

/** Comentar y adjuntar en cualquier ticket: así los apoyos participan. */
export const canComment = (a: Actor) => canWrite(a)
export const canAttach = (a: Actor) => canWrite(a)

/** Gestionar apoyos: el owner del ticket o el admin. */
export function canManageSupporters(a: Actor, issue: IssueRef): boolean {
  if (!canWrite(a)) return false
  return isAdmin(a) || issue.ownerId === a.id
}

/**
 * Borrar un ticket. SOLO admin — ni el dueño ni el creador de un borrador.
 *
 * Borrar es SOFT-DELETE (`issues.deleted_at`, migración 20260824000400): el
 * ticket sale de todas las vistas de presente y conserva su `issue_activity`,
 * que es la FUENTE de `issue_timings`, `weekly_cycle_time` y `aging_wip`. Un
 * DELETE real cascadearía ese log y le sacaría su cycle time al histórico,
 * cambiando series de semanas ya reportadas; por eso no hay política FOR DELETE
 * sobre `issues`.
 *
 * SIGUE SIENDO SOLO ADMIN aunque ya no destruya nada, y no es asimetría por
 * descuido con `canEditIssue`: un ticket que desaparece del tablero sin dejar
 * rastro visible es una decisión sobre el trabajo de todos. El member que
 * quiere sacarse un ticket de encima tiene `cancelled`, que lo deja a la vista
 * con el motivo escrito. Borrar es para lo que nunca debió existir —un
 * duplicado, una prueba, un import mal hecho— y eso lo decide un admin.
 *
 * OJO, ESTE HELPER NO ES LA DEFENSA. Es de interfaz. La defensa real es el
 * trigger `issues_guard_soft_delete`: al ser un UPDATE, `issues_update_owner`
 * dejaría a un member fijar `deleted_at` en su propio ticket si solo hubiera
 * políticas RLS de por medio.
 */
export const canDeleteIssue = (a: Actor) => isAdmin(a)

export const canApproveDrafts = (a: Actor) => isAdmin(a)
export const canViewReports = (a: Actor) => isAdmin(a)
export const canAccessSettings = (a: Actor) => isAdmin(a)
export const canImport = (a: Actor) => isAdmin(a)

/** Límite duro de adjuntos: 25 MB. Validado también en servidor y en el check de la tabla. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
