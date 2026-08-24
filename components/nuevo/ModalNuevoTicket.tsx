'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  actualizarTicket,
  crearTicket,
  guardarApoyos,
  guardarEtiquetas,
} from '@/app/actions/issues'
import { createClient } from '@/lib/supabase/client'
import { uploadAttachment } from '@/lib/queries/attachments'
import { FIBONACCI_WEIGHTS } from '@/lib/queries/catalog'
import { initialState } from '@/lib/transitions'
import { STATES } from '@/lib/states'
import { hoyISO, tamanoArchivo } from '@/lib/format'
import { priorityCircleBackground, typePillBackground } from '@/lib/design-map'
import type { Catalogos, CtxSesion, Ticket } from '@/lib/tipos'
import { Avatar, ChipEstado, PillPrioridad } from '@/components/ui/piezas'
import { IconoCerrar, IconoSubir } from '@/components/ui/iconos'
import { Spinner } from '@/components/ui/Spinner'
import type { Prefill } from './NuevoTicketProvider'

interface Props {
  catalogos: Catalogos
  sesion: CtxSesion
  prefill: Prefill | null
  onCerrar: () => void
  /**
   * Ticket a editar. Si viene, el modal es de EDICIÓN: mismos campos, mismo
   * layout, `actualizarTicket` en vez de `crearTicket`.
   *
   * POR QUÉ SE REUSA ESTE MODAL Y NO SE HIZO UN MODO EDICIÓN DEL PANEL
   *
   * El panel de detalle ya edita campo por campo con `SelectorEnSitio`, y eso
   * es lo correcto para el triage: cambiar la prioridad no debería abrir un
   * formulario. Lo que NO tenía era una forma de cambiar varias cosas a la vez,
   * ni de editar el título sin descubrir que el `h1` es `contentEditable`, que
   * es una afordancia que nadie encuentra sola.
   *
   * Un "modo edición" del panel entero habría sido una segunda implementación
   * de los mismos nueve campos, con el agravante de que cada uno ya tiene su
   * control funcionando: el modo edición tendría que apagarlos y dibujar otros
   * al lado. Este modal, en cambio, YA ES ese formulario —título, descripción,
   * tipo, prioridad, dueño, apoyos, vence, peso, etiquetas—, ya está validado y
   * ya tiene el focus trap. La diferencia entre crear y editar son los valores
   * iniciales y a qué acción se llama.
   *
   * LO QUE EL MODO EDICIÓN NO HACE: adjuntos y estado. Los adjuntos tienen su
   * sección en el panel, con borrado por archivo y URLs firmadas, y duplicar
   * eso acá sería la tercera copia. El estado no se toca porque moverlo tiene
   * reglas de secuencia y a veces exige un motivo: eso es `moverEstado`, no un
   * update de campos.
   */
  edicion?: Ticket | null
}

export function ModalNuevoTicket({
  catalogos,
  sesion,
  prefill,
  onCerrar,
  edicion = null,
}: Props) {
  const editando = edicion !== null
  const router = useRouter()
  const dialogo = useRef<HTMLDivElement>(null)
  const primerCampo = useRef<HTMLInputElement>(null)

  const [titulo, setTitulo] = useState(edicion?.title ?? '')
  const [descripcion, setDescripcion] = useState(edicion?.description ?? '')
  const [tipoId, setTipoId] = useState(edicion?.tipo.id ?? catalogos.tipos[0]?.id ?? '')
  const [prioridadId, setPrioridadId] = useState(
    edicion?.prioridad?.id ??
      catalogos.prioridades.find((p) => p.name === 'Media')?.id ??
      catalogos.prioridades[0]?.id ??
      '',
  )
  const [ownerId, setOwnerId] = useState(edicion?.owner_id ?? prefill?.ownerId ?? sesion.id)
  const [apoyos, setApoyos] = useState<string[]>(edicion?.apoyos.map((a) => a.id) ?? [])
  const [vence, setVence] = useState(edicion?.due_date ?? prefill?.dueDate ?? '')
  const [peso, setPeso] = useState<number | ''>(edicion?.weight ?? '')
  const [etiquetas, setEtiquetas] = useState<string[]>(edicion?.etiquetas.map((e) => e.id) ?? [])
  const [archivos, setArchivos] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Estado inicial: lo decide el trigger `set_initial_state` en la base. Acá se
  // calcula solo para mostrarlo antes de guardar, con la misma regla.
  const estadoInicial = initialState({
    creatorIsAdmin: sesion.role === 'admin',
    creatorId: sesion.id,
    ownerId,
  })

  useEffect(() => {
    primerCampo.current?.focus()
  }, [])

  // Focus trap + Escape: requisito de accesibilidad del handoff.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCerrar()
        return
      }

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        void enviar()
        return
      }

      if (e.key !== 'Tab' || !dialogo.current) return

      const focusables = dialogo.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables.length) return

      const primero = focusables[0]
      const ultimo = focusables[focusables.length - 1]

      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  })

  async function enviar() {
    if (guardando) return
    if (!titulo.trim()) {
      setError('El título es obligatorio.')
      return
    }
    if (!tipoId) {
      setError('Elegí un tipo de ticket.')
      return
    }

    setGuardando(true)
    setError(null)

    if (editando) {
      // `guardarEtiquetas` y `guardarApoyos` son acciones aparte porque son
      // tablas aparte: `actualizarTicket` toca solo columnas de `issues`.
      const res = await actualizarTicket(edicion.id, {
        title: titulo.trim(),
        description: descripcion.trim() || null,
        typeId: tipoId,
        priorityId: prioridadId || null,
        weight: peso === '' ? null : Number(peso),
        dueDate: vence || null,
        // El dueño solo viaja si cambió: `actualizarTicket` lo manda a la base y
        // ahí lo rechaza RLS si el actor no es admin. Mandarlo igual haría
        // fallar la edición entera de un member sobre su propio ticket.
        ...(ownerId !== edicion.owner_id ? { ownerId } : {}),
      })

      if (!res.ok) {
        setError(res.error)
        setGuardando(false)
        return
      }

      const etiquetasCambiaron =
        [...etiquetas].sort().join() !== [...edicion.etiquetas.map((e) => e.id)].sort().join()
      if (etiquetasCambiaron) {
        const r = await guardarEtiquetas(edicion.id, etiquetas)
        if (!r.ok) {
          setError(r.error)
          setGuardando(false)
          return
        }
      }

      const apoyosCambiaron =
        [...apoyos].sort().join() !== [...edicion.apoyos.map((a) => a.id)].sort().join()
      if (apoyosCambiaron) {
        const r = await guardarApoyos(edicion.id, apoyos)
        if (!r.ok) {
          setError(r.error)
          setGuardando(false)
          return
        }
      }

      onCerrar()
      router.refresh()
      return
    }

    const res = await crearTicket({
      title: titulo.trim(),
      description: descripcion.trim() || undefined,
      typeId: tipoId,
      ownerId,
      priorityId: prioridadId || undefined,
      weight: peso === '' ? undefined : Number(peso),
      dueDate: vence || undefined,
      labelIds: etiquetas,
      supporterIds: apoyos,
    })

    if (!res.ok) {
      setError(res.error)
      setGuardando(false)
      return
    }

    // Los adjuntos van después: necesitan el id del ticket, que es el primer
    // segmento de la ruta en Storage y lo que usan sus políticas.
    if (archivos.length) {
      const supabase = createClient()
      for (const archivo of archivos) {
        const up = await uploadAttachment(supabase, res.id, sesion.id, archivo)
        if (!up.ok) {
          setError(`Ticket ${res.number} creado, pero un adjunto falló: ${up.error}`)
          setGuardando(false)
          router.refresh()
          return
        }
      }
    }

    onCerrar()
    router.refresh()
  }

  const alternar = (lista: string[], id: string) =>
    lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]

  return (
    <div
      className="overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-nuevo-titulo"
        ref={dialogo}
      >
        <div className="modal-cab">
          <h2 id="modal-nuevo-titulo">{editando ? 'Editar ticket' : 'Nuevo ticket'}</h2>
          <span className="mono-sm" style={{ color: 'var(--tinta-3)' }}>
            {editando ? `#${edicion.number}` : 'el número lo asigna el servidor'}
          </span>
          <button
            type="button"
            className="btn-circular"
            style={{ marginLeft: 'auto' }}
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <IconoCerrar />
          </button>
        </div>

        <div className="modal-cuerpo">
          {error && <p className="error-caja">{error}</p>}

          <div className="grupo-campo">
            <label htmlFor="nt-titulo">Título</label>
            <input
              id="nt-titulo"
              ref={primerCampo}
              className="campo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Qué hay que hacer"
            />
          </div>

          <div className="grupo-campo">
            <label htmlFor="nt-desc">Descripción</label>
            <textarea
              id="nt-desc"
              className="campo"
              style={{ height: 88 }}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Contexto, entregables, referencias. Acepta markdown."
            />
          </div>

          <div className="grupo-campo">
            <label>Tipo</label>
            <div className="fila-opciones">
              {catalogos.tipos.map((t) => {
                const activo = t.id === tipoId
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="opcion"
                    aria-pressed={activo}
                    onClick={() => setTipoId(t.id)}
                    style={
                      activo
                        ? { borderColor: t.color, background: typePillBackground(t.color) }
                        : undefined
                    }
                  >
                    <span className="punto" style={{ background: t.color }} />
                    {t.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grupo-campo">
            <label>Prioridad</label>
            <div className="fila-opciones" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              {catalogos.prioridades.map((p) => {
                const activo = p.id === prioridadId
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="opcion"
                    aria-pressed={activo}
                    onClick={() => setPrioridadId(p.id)}
                    style={
                      activo
                        ? { borderColor: p.color, background: priorityCircleBackground(p.color) }
                        : undefined
                    }
                  >
                    <PillPrioridad prioridad={p} />
                  </button>
                )
              })}
            </div>
          </div>

          {!editando && (
          <div className="grupo-campo">
            <label>Estado inicial</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChipEstado estado={estadoInicial} />
              <span style={{ fontSize: 11.5, color: 'var(--tinta-2)' }}>
                {estadoInicial === 'draft'
                  ? 'Asignado a otra persona: nace en borrador y un admin lo aprueba.'
                  : 'Lo decide el servidor según quién crea y para quién.'}
              </span>
            </div>
          </div>
          )}

          <div className="grupo-campo">
            <label>Dueño</label>
            <div className="fila-opciones">
              {catalogos.personas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === ownerId}
                  onClick={() => setOwnerId(p.id)}
                  title={p.name}
                  style={{
                    border: p.id === ownerId ? '2px solid var(--acento)' : '2px solid transparent',
                    borderRadius: 99,
                    padding: 1,
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <Avatar persona={p} size={34} />
                </button>
              ))}
            </div>
          </div>

          <div className="grupo-campo">
            <label>Apoyos</label>
            <div className="fila-opciones">
              {catalogos.personas
                .filter((p) => p.id !== ownerId)
                .map((p) => {
                  const activo = apoyos.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => setApoyos(alternar(apoyos, p.id))}
                      title={p.name}
                      style={{
                        border: activo ? '2px solid var(--acento)' : '2px dashed var(--linea-fuerte)',
                        borderRadius: 99,
                        padding: 1,
                        background: 'transparent',
                        cursor: 'pointer',
                        opacity: activo ? 1 : 0.75,
                      }}
                    >
                      <Avatar persona={p} size={30} />
                    </button>
                  )
                })}
            </div>
          </div>

          <div className="tres-columnas">
            <div className="grupo-campo">
              <label htmlFor="nt-vence">Vence</label>
              <input
                id="nt-vence"
                type="date"
                className="campo"
                min={hoyISO()}
                value={vence}
                onChange={(e) => setVence(e.target.value)}
              />
            </div>

            {sesion.pesoActivo && (
              <div className="grupo-campo" data-col="peso">
                <label htmlFor="nt-peso">Peso</label>
                <div className="fila-opciones">
                  {FIBONACCI_WEIGHTS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      className="opcion mono"
                      style={{ padding: '0 9px' }}
                      aria-pressed={peso === w}
                      onClick={() => setPeso(peso === w ? '' : w)}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grupo-campo">
              <label>Etiquetas</label>
              <div className="fila-opciones">
                {catalogos.etiquetas.length === 0 && (
                  <span style={{ fontSize: 11.5, color: 'var(--tinta-3)' }}>
                    Todavía no hay etiquetas.
                  </span>
                )}
                {catalogos.etiquetas.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="opcion"
                    style={{ height: 24, fontSize: 11.5 }}
                    aria-pressed={etiquetas.includes(e.id)}
                    onClick={() => setEtiquetas(alternar(etiquetas, e.id))}
                  >
                    {e.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Adjuntos solo al crear. Editando, la sección ADJUNTOS del panel ya
              los gestiona uno por uno, con borrado y URLs firmadas. */}
          {!editando && (
          <div className="grupo-campo">
            <label>Adjuntos</label>
            <label className="zona-arrastre">
              <IconoSubir />
              <span>Arrastrá archivos o hacé clic. Máximo 25 MB por archivo.</span>
              <input
                type="file"
                multiple
                hidden
                onChange={(e) => setArchivos([...archivos, ...Array.from(e.target.files ?? [])])}
              />
            </label>
            {archivos.length > 0 && (
              <div className="lista-borde">
                {archivos.map((a, i) => (
                  <div className="adjunto" key={`${a.name}-${i}`}>
                    <span className="badge-ext">{(a.name.split('.').pop() ?? '?').slice(0, 4)}</span>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {a.name}
                    </span>
                    <span className="mono-sm" style={{ marginLeft: 'auto', color: 'var(--tinta-2)' }}>
                      {tamanoArchivo(a.size)}
                    </span>
                    <button
                      type="button"
                      className="btn-icono"
                      aria-label={`Quitar ${a.name}`}
                      onClick={() => setArchivos(archivos.filter((_, j) => j !== i))}
                    >
                      <IconoCerrar size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>

        <div className="modal-pie">
          <span className="mono-sm" style={{ color: 'var(--tinta-3)' }}>
            {editando ? '⌘↵ para guardar' : '⌘↵ para crear'}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="btn-secundario" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="button" className="btn-primario" onClick={() => void enviar()} disabled={guardando}>
              {guardando && <Spinner label={editando ? 'Guardando ticket' : 'Creando ticket'} />}
              {guardando
                ? editando
                  ? 'Guardando…'
                  : 'Creando…'
                : editando
                  ? 'Guardar cambios'
                  : 'Crear ticket'}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}

/** Etiqueta legible del estado, para tooltips del formulario. */
export const etiquetaEstado = (k: keyof typeof STATES) => STATES[k].label
