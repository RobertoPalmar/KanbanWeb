'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { STATES, ORDERED_STATES, type StateKey } from '@/lib/states'
import { allowedTargets, checkTransition, requiresComment } from '@/lib/transitions'
import {
  canAttach,
  canComment,
  canDeleteIssue,
  canEditIssue,
  canManageSupporters,
  canMoveIssue,
  canReassignOwner,
} from '@/lib/permissions'
import { FIBONACCI_WEIGHTS } from '@/lib/queries/catalog'
import { fechaCorta, fechaLarga, plural } from '@/lib/format'
import {
  actualizarTicket,
  comentar,
  eliminarTicket,
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
import { IconoAbrir, IconoCerrar, IconoLapiz, IconoPapelera } from '@/components/ui/iconos'
import { Spinner } from '@/components/ui/Spinner'
import { MiniModal } from '@/components/ui/MiniModal'
import { ModalNuevoTicket } from '@/components/nuevo/ModalNuevoTicket'
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
  const puedeBorrar = canDeleteIssue(actor)

  const [editandoDescripcion, setEditandoDescripcion] = useState(false)
  const [descripcion, setDescripcion] = useState(ticket.description ?? '')
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [motivo, setMotivo] = useState<StateKey | null>(null)
  const [comentando, setComentando] = useState(false)
  const [editandoTodo, setEditandoTodo] = useState(false)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const titulo = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    setDescripcion(ticket.description ?? '')
    setEditandoDescripcion(false)
    // El panel se reusa entre tickets sin desmontarse: sin esto, navegar de un
    // ticket al siguiente con el diálogo de borrado abierto lo dejaría abierto
    // apuntando al ticket nuevo.
    setEditandoTodo(false)
    setConfirmandoBorrado(false)
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

  async function borrar() {
    if (borrando) return
    setBorrando(true)
    setError(null)

    const res = await eliminarTicket(ticket.id)

    if (!res.ok) {
      setBorrando(false)
      setConfirmandoBorrado(false)
      setError(res.error)
      return
    }

    // No se apaga `borrando` ni se cierra el diálogo: lo que sigue es irse de
    // acá. Apagar el spinner antes de que la navegación ocurra mostraría el
    // botón habilitado sobre un ticket ya borrado.
    if (comoPagina) {
      // `replace` y no `push`: el back del navegador no debe volver a
      // /tickets/[id], que con el soft-delete aplicado ahora es un 404 —
      // `getIssue` filtra los borrados.
      router.replace('/tickets')
    } else {
      const q = new URLSearchParams(params.toString())
      q.delete('ticket')
      router.replace(`${pathname}?${q.toString()}`, { scroll: false })
    }
    router.refresh()
  }

  /**
   * Lo que se GUARDA. Antes esta lista enumeraba lo que la cascada destruía
   * —comentarios, adjuntos, historial— y era la razón de ser del diálogo. Con
   * soft-delete no se destruye ninguna de las tres cosas, así que la lista
   * cambia de signo: dice qué queda conservado, que es lo que vuelve honesto
   * el "se puede deshacer".
   */
  const loQueSeConserva = [
    detalle.comentarios.length > 0 &&
      plural(detalle.comentarios.length, 'comentario', 'comentarios'),
    detalle.adjuntos.length > 0 && plural(detalle.adjuntos.length, 'adjunto', 'adjuntos'),
    detalle.eventos.length > 0 &&
      `${plural(detalle.eventos.length, 'entrada', 'entradas')} de historial`,
  ].filter((x): x is string => Boolean(x))

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
          {/* Lápiz y papelera SIN estado deshabilitado: si el rol no alcanza, el
              botón no está. Es lo contrario del catálogo, donde la papelera
              atenuada enseña por qué un tipo con tickets no se borra —ahí el
              motivo es del DATO y cambia por fila—. Acá el motivo sería del
              USUARIO y es el mismo en los cuarenta tickets de la lista: repetir
              "no tenés permiso" en cada panel es ruido, no información. */}
          {puedeEditar && (
            <button
              type="button"
              className="btn-circular"
              onClick={() => setEditandoTodo(true)}
              aria-label="Editar ticket"
              title="Editar ticket"
            >
              <IconoLapiz size={13} />
            </button>
          )}

          {puedeBorrar && (
            <button
              type="button"
              className="btn-circular btn-circular-peligro"
              onClick={() => setConfirmandoBorrado(true)}
              aria-label="Eliminar ticket"
              title="Eliminar ticket"
            >
              <IconoPapelera size={13} />
            </button>
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
            <CampoVence
              iso={ticket.due_date}
              onCambiar={(v) => void aplicar({ dueDate: v })}
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

      {editandoTodo && (
        <ModalNuevoTicket
          catalogos={catalogos}
          sesion={sesion}
          prefill={null}
          edicion={ticket}
          onCerrar={() => setEditandoTodo(false)}
        />
      )}

      {confirmandoBorrado && (
        <MiniModal
          titulo={`¿Eliminar el ticket #${ticket.number}?`}
          descripcion={
            <>
              El ticket sale del tablero, de la tabla, del calendario y de los contadores. No se
              borra nada:{' '}
              {loQueSeConserva.length > 0
                ? `${listar(loQueSeConserva)} quedan guardados`
                : 'su historial queda guardado'}
              , y si ya se había cerrado su tiempo de ciclo sigue contando en los reportes. Un admin
              puede revertirlo.
              <br />
              <br />
              Aun así, esto no es la salida para trabajo que ya no aplica: para eso está{' '}
              <strong>cancelar</strong>, que deja el ticket a la vista con el motivo escrito.
              Eliminar es para lo que nunca debió existir — un duplicado, una prueba, un import mal
              hecho.
            </>
          }
          onCerrar={() => setConfirmandoBorrado(false)}
          pie={
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn-secundario"
                onClick={() => setConfirmandoBorrado(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primario btn-primario-peligro"
                disabled={borrando}
                onClick={() => void borrar()}
              >
                {borrando && <Spinner label="Eliminando ticket" />}
                {borrando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </span>
          }
        >
          <div className="borrado-previa">
            <NumeroTicket numero={ticket.number} estado={ticket.state} />
            <PillTipo tipo={ticket.tipo} />
            <span className="borrado-previa-titulo">{ticket.title}</span>
          </div>
        </MiniModal>
      )}
    </aside>
  )
}

/** "a, b y c" — la coma sola antes del último elemento se lee como enumeración cortada. */
function listar(partes: string[]): string {
  if (partes.length === 1) return partes[0]
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/**
 * Campo VENCE del panel.
 *
 * EL PROBLEMA. Un `<input type="date">` dibuja su propio placeholder —y el orden
 * de sus segmentos— según el locale del NAVEGADOR, no según el `lang` del
 * documento. En un Chrome configurado en inglés, este campo mostraba
 * "mm/dd/yyyy" en medio de una aplicación entera en español. No hay atributo
 * `placeholder` que valga (el elemento lo ignora) ni selector CSS que alcance
 * al shadow DOM del control de forma portable, y poner `lang="es"` en el input
 * no cambia nada en Chrome: solo Firefox lo respeta parcialmente.
 *
 * LA SALIDA. Se muestra un botón con la fecha en texto español —"24 de agosto
 * de 2026"— y el input nativo aparece al activarlo. Se gana en los dos frentes:
 * el reposo, que es el 99% del tiempo, no tiene formato ambiguo (nadie lee
 * "24 de agosto" como el mes 24), y la edición conserva el date picker nativo,
 * el teclado de fecha en móvil y la validación del navegador. Cambiar el input
 * por tres selects propios habría sido reimplementar un control que ya existe
 * y funciona.
 *
 * Se monta con `autoFocus` y se llama `showPicker()` cuando el navegador lo
 * soporta: sin eso, activar el campo obliga a un segundo clic sobre el iconito
 * del calendario para que se abra el selector.
 */
function CampoVence({
  iso,
  onCambiar,
}: {
  iso: string | null
  onCambiar: (valor: string | null) => void
}) {
  const [abierto, setAbierto] = useState(false)

  if (!abierto) {
    return (
      <button
        type="button"
        className="panel-valor"
        onClick={() => setAbierto(true)}
        title="Cambiar la fecha de vencimiento"
      >
        {iso ? (
          <Vencimiento iso={iso} />
        ) : (
          <span className="panel-valor-vacio">Sin fecha</span>
        )}
      </button>
    )
  }

  return (
    <input
      type="date"
      autoFocus
      lang="es"
      className="panel-valor mono-sm"
      aria-label="Fecha de vencimiento"
      defaultValue={iso ?? ''}
      ref={(nodo) => {
        // `showPicker` es reciente y tira si se llama sin gesto del usuario. El
        // try/catch es para el segundo caso, no para el primero.
        if (!nodo) return
        try {
          nodo.showPicker?.()
        } catch {
          /* el usuario escribe la fecha a mano */
        }
      }}
      onBlur={(e) => {
        setAbierto(false)
        const v = e.currentTarget.value || null
        if (v !== iso) onCambiar(v)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          e.currentTarget.blur()
        }
      }}
    />
  )
}
