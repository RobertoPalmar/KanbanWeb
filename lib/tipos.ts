/**
 * Formas que viajan del servidor al cliente.
 *
 * PostgREST devuelve las relaciones anidadas (`labels:issue_labels(label:labels(...))`),
 * y eso es incómodo de consumir en la UI. `aplanarTicket` lo normaliza una vez,
 * en el servidor, y los componentes reciben `Ticket`.
 */

import type { StateKey } from '@/lib/states'
import type { Role } from '@/lib/permissions'

export interface Persona {
  id: string
  name: string
  email?: string
  avatar_url?: string | null
  role?: Role
}

export interface Tipo {
  id: string
  name: string
  abbrev: string
  color: string
}

export interface Prioridad {
  id: string
  name: string
  color: string
  order?: number
}

export interface Etiqueta {
  id: string
  name: string
  color?: string
}

export interface Ticket {
  id: string
  number: number
  title: string
  description: string | null
  state: StateKey
  weight: number | null
  due_date: string | null
  created_at: string
  updated_at: string
  imported: boolean
  owner_id: string
  created_by: string
  tipo: Tipo
  prioridad: Prioridad | null
  owner: Persona
  creador: Persona | null
  etiquetas: Etiqueta[]
  apoyos: Persona[]
}

export interface Catalogos {
  tipos: Tipo[]
  prioridades: Prioridad[]
  personas: Persona[]
  etiquetas: Etiqueta[]
}

/** Contexto mínimo que el cliente necesita para decidir qué habilita. */
export interface CtxSesion {
  id: string
  role: Role
  pesoActivo: boolean
}

type FilaCruda = {
  id: string
  number: number
  title: string
  description: string | null
  state: string
  weight: number | null
  due_date: string | null
  created_at: string
  updated_at: string
  imported: boolean
  owner_id: string
  created_by: string
  type: { id: string; name: string; color: string; abbrev: string } | null
  priority: { id: string; name: string; color: string; order?: number } | null
  owner: { id: string; name: string; email?: string; avatar_url: string | null } | null
  creator?: { id: string; name: string; avatar_url: string | null } | null
  labels?: Array<{ label: { id: string; name: string; color: string } | null }> | null
  supporters?: Array<{ user: { id: string; name: string; avatar_url: string | null } | null }> | null
}

export function aplanarTicket(fila: unknown): Ticket {
  const f = fila as FilaCruda

  return {
    id: f.id,
    number: Number(f.number),
    title: f.title,
    description: f.description,
    state: f.state as StateKey,
    weight: f.weight == null ? null : Number(f.weight),
    due_date: f.due_date,
    created_at: f.created_at,
    updated_at: f.updated_at,
    imported: f.imported,
    owner_id: f.owner_id,
    created_by: f.created_by,
    // El tipo es NOT NULL en la base; el fallback existe para que un select
    // parcial nunca haga caer el render.
    tipo: f.type ?? { id: '', name: 'Sin tipo', abbrev: '··', color: '#8A9099' },
    prioridad: f.priority ?? null,
    owner: f.owner ?? { id: f.owner_id, name: '—' },
    creador: f.creator ?? null,
    etiquetas: (f.labels ?? []).flatMap((l): Etiqueta[] => (l.label ? [l.label] : [])),
    apoyos: (f.supporters ?? []).flatMap((s): Persona[] => (s.user ? [s.user] : [])),
  }
}
