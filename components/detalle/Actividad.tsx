'use client'

import { useMemo, useState } from 'react'
import { STATES, isStateKey } from '@/lib/states'
import { momento } from '@/lib/format'
import { Avatar } from '@/components/ui/piezas'
import { Linea } from './Markdown'
import type { Comentario, Evento } from './cargar'

/**
 * Comentarios e historial intercalados cronológicamente, en jerarquías
 * tipográficas distintas.
 *
 * Es la decisión clave del panel: un evento ocupa una línea, un comentario un
 * bloque con fondo. Así cincuenta eventos de historial no ahogan tres
 * comentarios, y el orden cronológico se conserva.
 */
export function Actividad({
  comentarios,
  eventos,
}: {
  comentarios: Comentario[]
  eventos: Evento[]
}) {
  const [tab, setTab] = useState<'todo' | 'com' | 'hist'>('todo')

  const entradas = useMemo(() => {
    const lista: Array<
      | { clase: 'com'; cuando: string; dato: Comentario }
      | { clase: 'hist'; cuando: string; dato: Evento }
    > = []

    if (tab !== 'hist') {
      comentarios.forEach((c) => lista.push({ clase: 'com', cuando: c.created_at, dato: c }))
    }
    if (tab !== 'com') {
      eventos.forEach((e) => lista.push({ clase: 'hist', cuando: e.created_at, dato: e }))
    }

    return lista.sort((a, b) => a.cuando.localeCompare(b.cuando))
  }, [comentarios, eventos, tab])

  return (
    <section className="seccion">
      <div className="seccion-cab">
        <span className="mono-xs">Actividad</span>
        <span className="segmentado" style={{ marginLeft: 'auto', height: 24 }}>
          {(
            [
              ['todo', 'Todo'],
              ['com', 'Comentarios'],
              ['hist', 'Historial'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              style={{ height: 20, fontSize: 11 }}
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </span>
      </div>

      {entradas.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--tinta-3)', margin: 0 }}>
          Todavía no hay actividad en este ticket.
        </p>
      )}

      {entradas.map((e) =>
        e.clase === 'com' ? (
          <ComentarioItem key={`c-${e.dato.id}`} comentario={e.dato} />
        ) : (
          <EventoItem key={`h-${e.dato.id}`} evento={e.dato} />
        ),
      )}
    </section>
  )
}

function ComentarioItem({ comentario }: { comentario: Comentario }) {
  const autor = comentario.author ?? { id: 'sistema', name: 'Sistema' }

  return (
    <div className="actividad-item">
      <Avatar persona={autor} size={22} />
      <div className="actividad-com" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span className="actividad-autor">{autor.name}</span>
          <span className="mono-sm" style={{ color: 'var(--tinta-3)' }}>
            {momento(comentario.created_at)}
          </span>
          {comentario.system_reason && (
            <span className="badge-ext" title="Motivo registrado por el sistema">
              {comentario.system_reason}
            </span>
          )}
        </div>
        <div className="actividad-cuerpo">
          <Linea texto={comentario.body} />
        </div>
      </div>
    </div>
  )
}

function EventoItem({ evento }: { evento: Evento }) {
  const actor = evento.actor ?? { id: 'sistema', name: 'Sistema' }

  return (
    <div className="actividad-item">
      <Avatar persona={actor} size={22} />
      <div className="actividad-hist" style={{ flex: 1, minWidth: 0 }}>
        <span className="actividad-autor">{actor.name}</span>
        <span className="mono-sm" style={{ color: 'var(--tinta-3)', margin: '0 6px' }}>
          {momento(evento.created_at)}
        </span>
        <span className="actividad-cuerpo" style={{ display: 'inline' }}>
          {textoEvento(evento)}
        </span>
      </div>
    </div>
  )
}

/** `<autor> cambió <campo> de <valor anterior> a <valor nuevo>`. */
function textoEvento(evento: Evento): string {
  const campo = NOMBRE_CAMPO[evento.field] ?? evento.field
  const de = legible(evento.old_value)
  const a = legible(evento.new_value)

  if (evento.field === 'created') return 'creó el ticket'
  if (!evento.old_value) return `definió ${campo} en ${a}`
  return `cambió ${campo} de ${de} a ${a}`
}

const NOMBRE_CAMPO: Record<string, string> = {
  state: 'Estado',
  priority_id: 'Prioridad',
  type_id: 'Tipo',
  owner_id: 'Dueño',
  weight: 'Peso',
  due_date: 'Vence',
  title: 'Título',
  description: 'Descripción',
}

function legible(valor: string | null): string {
  if (!valor) return '—'
  if (isStateKey(valor)) return STATES[valor].label
  return valor
}
