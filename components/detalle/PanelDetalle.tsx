'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { STATES, ORDERED_STATES, type StateKey } from '@/lib/states'
import { allowedTargets, checkTransition, requiresComment } from '@/lib/transitions'
import {
  canAttach,
  canComment,
  canEditIssue,
  canManageSupporters,
  canMoveIssue,
  canReassignOwner,
} from '@/lib/permissions'
import { FIBONACCI_WEIGHTS } from '@/lib/queries/catalog'
import { fechaCorta } from '@/lib/format'
import {
  actualizarTicket,
  comentar,
  guardarApoyos,
  guardarEtiquetas,
  moverEstado,
} from '@/app/actions/issues'
import type { Catalogos, CtxSesion } from '@/lib/tipos'
import {
  Apoyos,
  Avatar,
  ChipEstado,
  CirculoPrioridad,
  Etiquetas,
  NumeroTicket,
  PillTipo,
  Vencimiento,
} from '@/components/ui/piezas'
import { IconoAbrir, IconoCerrar } from '@/components/ui/iconos'
import { Spinner } from '@/components/ui/Spinner'
import { DialogoMotivo } from '@/components/tickets/DialogoMotivo'
import { SelectorEnSitio } from './SelectorEnSitio'
import { Actividad } from './Actividad'
import { Adjuntos } from './Adjuntos'
import { Markdown } from './Markdown'
import type { Detalle } from './cargar'

/**
 * Panel lateral, no página completa.
 *
 * El trabajo real es triage: abrir, cambiar dos campos, cerrar. Perder el
 * contexto de la lista en cada ticket cuesta más de lo que aporta el ancho, así
 * que el panel flota SOBRE la tabla y no la comprime. Para la edición larga hay
 * "Abrir en página".
 */
export function PanelDetalle({
  detalle,
  catalogos,
  sesion,
  comoPagina = false,
}: {
  detalle: Detalle
  catalogos: Catalogos
  sesion: CtxSesion
  comoPagina?: boolean
}) {
  const { ticket } = detalle
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const actor = { id: sesion.id, role: sesion.role }
  const ref = { ownerId: ticket.owner_id, createdBy: ticket.created_by, state: ticket.state }

  const puedeEditar = canEditIssue(actor, ref)
  const puedeMover = canMoveIssue(actor, ref)
  const puedeApoyos = canManageSupporters(actor, ref)
  const puedeReasignar = canReassignOwner(actor)

  const [editandoDescripcion, setEditandoDescripcion] = useState(false)
  const [descripcion, setDescripcion] = useState(ticket.description ?? '')
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [motivo, setMotivo] = useState<StateKey | null>(null)
  const [comentando, setComentando] = useState(false)
  const titulo = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    setDescripcion(ticket.description ?? '')
    setEditandoDescripcion(false)
  }, [ticket.id, ticket.description])

  function cerrar() {
    if (comoPagina) {
      router.push('/tickets')
      return
    }
    const q = new URLSearchParams(params.toString())
    q.delete('ticket')
    router.replace(`${pathname}?${q.toString()}`, { scroll: false })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !comoPagina) cerrar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, comoPagina])

  async function aplicar(patch: Parameters<typeof actualizarTicket>[1]) {
    setError(null)
    const res = await actualizarTicket(ticket.id, patch)
    if (!res.ok) setError(res.error)
    else router.refresh()
  }

  async function cambiarEstado(hacia: StateKey, comentarioMotivo?: string) {
    setError(null)

    const check = checkTransition(ticket.state, hacia, {
      isAdmin: sesion.role === 'admin',
      isOwner: ticket.owner_id === sesion.id,
    })

    if (!check.allowed) {
      setError(check.reason ?? 'Transición no permitida.')
      return
    }

    if (check.needsComment && !comentarioMotivo) {
      setMotivo(hacia)
      return
    }

    const res = await moverEstado(ticket.id, hacia, comentarioMotivo)
    if (!res.ok) {
      if (res.needsComment) setMotivo(hacia)
      else setError(res.error ?? 'No se pudo cambiar el estado.')
      return
    }
    router.refresh()
  }

  async function enviarComentario() {
    if (!comentario.trim() || comentando) return
    setComentando(true)
    const res = await comentar(ticket.id, comentario)
    setComentando(false)
    if (!res.ok) setError(res.error)
    else {
      setComentario('')
      router.refresh()
    }
  }

  const destinos = allowedTargets(ticket.state, {
    isAdmin: sesion.role === 'admin',
    isOwner: ticket.owner_id === sesion.id,
  })

  const contenedor = comoPagina
    ? { className: 'panel', style: { position: 'relative' as const, width: '100%', minWidth: 0, boxShadow: 'none' } }
    : { className: 'panel' }

  return (
    <aside role="complementary" aria-label={`Ticket ${ticket.number}`} {...contenedor}>
      <div className="panel-cab">
        <NumeroTicket numero={ticket.number} estado={ticket.state} />
        <PillTipo tipo={ticket.tipo} />
        <ChipEstado estado={ticket.state} />

        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {!comoPagina && (
            <Link className="btn-secundario" style={{ height: 24 }} href={`/tickets/${ticket.id}`}>
              <IconoAbrir size={12} />
              Abrir en página
            </Link>
          )}
          <button type="button" className="btn-circular" onClick={cerrar} aria-label="Cerrar panel">
            <IconoCerrar />
          </button>
        </span>
      </div>

      <div className="panel-cuerpo">
        {error && <p className="error-caja" style={{ marginBottom: 12 }}>{error}</p>}

        <h1
          ref={titulo}
          className="panel-titulo"
          contentEditable={puedeEditar}
          suppressContentEditableWarning
          onBlur={(e) => {
            const nuevo = e.currentTarget.textContent?.trim() ?? ''
            if (nuevo && nuevo !== ticket.title) void aplicar({ title: nuevo })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
        >
          {ticket.title}
        </h1>

        <div className="panel-campos">
          <span className="panel-etiqueta">Estado</span>
          <SelectorEnSitio
            etiqueta="Estado"
            valorVisible={<ChipEstado estado={ticket.state} />}
            editable={puedeMover && destinos.length > 0}
            ayudaBloqueo={
              ticket.state === 'cancelled'
                ? 'Cancelado es terminal: si el trabajo revive, se crea un ticket nuevo.'
                : 'Solo el responsable del ticket o un admin lo mueven.'
            }
            seleccionado={ticket.state}
            opciones={ORDERED_STATES.filter((s) => s !== ticket.state).map((s) => {
              const check = checkTransition(ticket.state, s, {
                isAdmin: sesion.role === 'admin',
                isOwner: ticket.owner_id === sesion.id,
              })
              return {
                valor: s,
                texto: STATES[s].label + (requiresComment(s) ? ' (pide motivo)' : ''),
                deshabilitada: !check.allowed,
                ayuda: check.reason,
              }
            })}
            onElegir={(v) => void cambiarEstado(v as StateKey)}
          />

          <span className="panel-etiqueta">Prioridad</span>
          <SelectorEnSitio
            etiqueta="Prioridad"
            valorVisible={
              <>
                <CirculoPrioridad prioridad={ticket.prioridad} />
                <span>{ticket.prioridad?.name ?? 'Sin prioridad'}</span>
              </>
            }
            editable={puedeEditar}
            ayudaBloqueo="Solo el dueño o un admin editan los campos."
            seleccionado={ticket.prioridad?.id ?? null}
            opciones={catalogos.prioridades.map((p) => ({
              valor: p.id,
              texto: p.name,
              color: p.color,
            }))}
            onElegir={(v) => void aplicar({ priorityId: v })}
          />

          <span className="panel-etiqueta">Tipo</span>
          <SelectorEnSitio
            etiqueta="Tipo"
            valorVisible={
              <>
                <PillTipo tipo={ticket.tipo} />
                <span>{ticket.tipo.name}</span>
              </>
            }
            editable={puedeEditar}
            ayudaBloqueo="Solo el dueño o un admin editan los campos."
            seleccionado={ticket.tipo.id}
            opciones={catalogos.tipos.map((t) => ({ valor: t.id, texto: t.name, color: t.color }))}
            onElegir={(v) => void aplicar({ typeId: v })}
          />

          <span className="panel-etiqueta">Dueño</span>
          <SelectorEnSitio
            etiqueta="Dueño"
            valorVisible={
              <>
                <Avatar persona={ticket.owner} size={20} />
                <span>{ticket.owner.name}</span>
              </>
            }
            editable={puedeReasignar}
            ayudaBloqueo="Reasignar el dueño es una acción de admin."
            seleccionado={ticket.owner_id}
            opciones={catalogos.personas
              .filter((p) => p.role !== 'viewer')
              .map((p) => ({ valor: p.id, texto: p.name }))}
            onElegir={(v) => void aplicar({ ownerId: v })}
          />

          <span className="panel-etiqueta">Apoyos</span>
          <SelectorEnSitio
            etiqueta="Apoyos"
            valorVisible={<Apoyos personas={ticket.apoyos} size={20} />}
            editable={puedeApoyos}
            ayudaBloqueo="Los apoyos los gestiona el dueño del ticket o un admin."
            multiple
            seleccionados={ticket.apoyos.map((a) => a.id)}
            opciones={catalogos.personas
              .filter((p) => p.id !== ticket.owner_id && p.role !== 'viewer')
              .map((p) => ({ valor: p.id, texto: p.name }))}
            onElegirVarios={(ids) => {
              const antes = [...ticket.apoyos.map((a) => a.id)].sort().join()
              if (antes === [...ids].sort().join()) return
              void guardarApoyos(ticket.id, ids).then((r) => {
                if (!r.ok) setError(r.error)
                else router.refresh()
              })
            }}
          />

          <span className="panel-etiqueta">Etiquetas</span>
          <SelectorEnSitio
            etiqueta="Etiquetas"
            valorVisible={<Etiquetas etiquetas={ticket.etiquetas} max={3} />}
            editable={puedeEditar}
            ayudaBloqueo="Solo el dueño o un admin editan los campos."
            multiple
            seleccionados={ticket.etiquetas.map((e) => e.id)}
            opciones={catalogos.etiquetas.map((e) => ({ valor: e.id, texto: e.name }))}
            onElegirVarios={(ids) => {
              const antes = [...ticket.etiquetas.map((e) => e.id)].sort().join()
              if (antes === [...ids].sort().join()) return
              void guardarEtiquetas(ticket.id, ids).then((r) => {
                if (!r.ok) setError(r.error)
                else router.refresh()
              })
            }}
          />

          {sesion.pesoActivo && (
            <>
              <span className="panel-etiqueta" data-col="peso">
                Peso
              </span>
              <div data-col="peso">
                <SelectorEnSitio
                  etiqueta="Peso"
                  valorVisible={
                    <span className="mono-sm">
                      {ticket.weight != null ? `${ticket.weight} pt` : 'Sin estimar'}
                    </span>
                  }
                  editable={puedeEditar}
                  ayudaBloqueo="Solo el dueño o un admin editan los campos."
                  seleccionado={ticket.weight != null ? String(ticket.weight) : null}
                  opciones={FIBONACCI_WEIGHTS.map((w) => ({ valor: String(w), texto: `${w} pt` }))}
                  onElegir={(v) => void aplicar({ weight: Number(v) })}
                />
              </div>
            </>
          )}

          <span className="panel-etiqueta">Vence</span>
          {puedeEditar ? (
            <input
              type="date"
              className="panel-valor mono-sm"
              value={ticket.due_date ?? ''}
              onChange={(e) => void aplicar({ dueDate: e.target.value || null })}
            />
          ) : (
            <span className="panel-valor" aria-disabled="true">
              <Vencimiento iso={ticket.due_date} />
            </span>
          )}

          <span className="panel-etiqueta">Creado</span>
          <span className="panel-valor mono-sm" style={{ cursor: 'default', color: 'var(--tinta-2)' }}>
            {ticket.creador?.name ?? '—'} · {fechaCorta(ticket.created_at.slice(0, 10))}
            {ticket.imported && ' · importado'}
          </span>
        </div>

        <section className="seccion">
          <div className="seccion-cab">
            <span className="mono-xs">Descripción</span>
            {puedeEditar && (
              <button
                type="button"
                className="btn-texto btn-texto-acento"
                style={{ marginLeft: 'auto' }}
                onClick={() => {
                  if (editandoDescripcion) void aplicar({ description: descripcion || null })
                  setEditandoDescripcion(!editandoDescripcion)
                }}
              >
                {editandoDescripcion ? 'Guardar' : 'Editar'}
              </button>
            )}
          </div>

          {editandoDescripcion ? (
            <textarea
              autoFocus
              className="campo"
              style={{ height: 140 }}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Contexto, entregables, referencias. Acepta markdown."
            />
          ) : ticket.description ? (
            <Markdown fuente={ticket.description} />
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--tinta-3)', margin: 0 }}>Sin descripción.</p>
          )}
        </section>

        <Adjuntos
          issueId={ticket.id}
          adjuntos={detalle.adjuntos}
          usuarioId={sesion.id}
          puedeAdjuntar={canAttach(actor)}
        />

        <Actividad comentarios={detalle.comentarios} eventos={detalle.eventos} />

        {canComment(actor) && (
          <div className="caja-comentario">
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Escribí un comentario. Markdown y @menciones."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void enviarComentario()
                }
              }}
            />
            <div className="caja-comentario-pie">
              <span className="mono-sm" style={{ color: 'var(--tinta-3)' }}>
                ⌘↵ para enviar
              </span>
              <button
                type="button"
                className="btn-primario"
                style={{ marginLeft: 'auto', height: 24 }}
                disabled={!comentario.trim() || comentando}
                onClick={() => void enviarComentario()}
              >
                {comentando && <Spinner label="Enviando comentario" />}
                Comentar
              </button>
            </div>
          </div>
        )}
      </div>

      {motivo && (
        <DialogoMotivo
          titulo={`Cancelar “${ticket.title}”`}
          descripcion="Cancelar exige un motivo. Queda en el historial y es lo que explica, meses después, por qué este trabajo no se hizo."
          onCancelar={() => setMotivo(null)}
          onConfirmar={async (texto) => {
            const hacia = motivo
            setMotivo(null)
            await cambiarEstado(hacia, texto)
          }}
        />
      )}
    </aside>
  )
}
