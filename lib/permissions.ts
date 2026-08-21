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

export const canApproveDrafts = (a: Actor) => isAdmin(a)
export const canViewReports = (a: Actor) => isAdmin(a)
export const canAccessSettings = (a: Actor) => isAdmin(a)
export const canImport = (a: Actor) => isAdmin(a)

/** Límite duro de adjuntos: 25 MB. Validado también en servidor y en el check de la tabla. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
