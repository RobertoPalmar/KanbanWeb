'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  archivarEtiqueta,
  archivarTipo,
  borrarEtiqueta,
  borrarTipo,
  crearEtiqueta,
  crearTipo,
  editarEtiqueta,
  editarTipo,
} from '@/app/actions/catalogo'
import { COLOR_PALETA_DEFECTO, nombreColor, siglaSugerida } from '@/lib/paleta'
import { plural } from '@/lib/format'
import { typePillBackground } from '@/lib/design-map'
import { useGuardado } from '@/components/ui/ContextoGuardado'
import { SelectorColor } from './SelectorColor'

/**
 * Tipos de ticket y etiquetas: alta, edición, archivado, desarchivado y borrado.
 *
 * TIPOS Y ETIQUETAS NO SON LO MISMO, Y EL FORMULARIO LO REFLEJA
 *
 * El tipo lleva SIGLA porque su representación en la fila compacta de 28px es
 * la píldora "PB", donde el nombre no entra. La etiqueta se dibuja con el
 * nombre completo en el chip, así que una sigla no tendría dónde verse: su
 * formulario es nombre + color y nada más.
 *
 * POR QUÉ LA EDICIÓN ES UNA FILA QUE SE EXPANDE, Y NO BOTONES NI UN MODAL
 *
 * Con 8 tipos y 15 etiquetas, poner "Editar · Archivar · Borrar" en cada fila
 * son casi 70 botones en una tarjeta, y la sección se vuelve una pared de
 * acciones donde ya no se leen los nombres, que es lo que el admin viene a
 * mirar. Un modal por elemento resuelve el ruido pero rompe la comparación: la
 * sigla se elige MIRANDO las otras siete, y el color se elige viendo qué tonos
 * ya están tomados; un diálogo que tapa la lista esconde justo el contexto que
 * hace falta para decidir.
 *
 * La fila expandible mantiene las dos cosas. En reposo cada fila muestra lo
 * mínimo —píldora, nombre, color, conteo de tickets— y UN botón "Editar". Al
 * abrirla, los campos aparecen en el lugar de la fila, dentro de la misma
 * lista, con el resto de los elementos todavía a la vista arriba y abajo. Solo
 * una fila abierta a la vez (`abierto` es un id, no un set): dos formularios
 * simultáneos en la misma tarjeta compiten por el indicador de guardado global,
 * que es único por pantalla, y no hay ningún caso real de editar dos tipos a la
 * vez.
 *
 * Archivar y borrar viven DENTRO del panel abierto, no en la fila en reposo.
 * Son las acciones destructivas o semi-destructivas, y esconderlas un clic más
 * adentro es deliberado: nadie archiva un tipo por error de puntería.
 *
 * BORRAR NO SIGNIFICA LO MISMO EN LOS DOS CATÁLOGOS
 *
 * Un tipo CON tickets no se puede borrar: `issues.type_id` es `on delete
 * restrict` y la base lo rechaza. Por eso el panel de un tipo con tickets no
 * muestra "Borrar" en absoluto —ofrecer un botón que la base va a rechazar es
 * mentirle al admin— y explica en su lugar por qué, con el conteo a la vista.
 * Solo un tipo con 0 tickets ofrece "Borrar". Una etiqueta siempre se puede
 * borrar, porque `issue_labels` cascadea; lo que cambia según el uso es la
 * confirmación, que dice cuántos tickets la van a perder.
 */

export interface TipoCatalogo {
  id: string
  name: string
  abbrev: string
  color: string
  archived: boolean
  /** Tickets que lo usan. Decide si el panel ofrece borrar o solo archivar. */
  tickets: number
}

export interface EtiquetaCatalogo {
  id: string
  name: string
  color: string
  archived: boolean
  /** Tickets que la tienen puesta. Solo alimenta la advertencia al borrar. */
  usos: number
}

export function Catalogo({
  tipos,
  etiquetas,
  esAdmin,
}: {
  tipos: TipoCatalogo[]
  etiquetas: EtiquetaCatalogo[]
  esAdmin: boolean
}) {
  return (
    <>
      <SeccionTipos tipos={tipos} esAdmin={esAdmin} />
      <SeccionEtiquetas etiquetas={etiquetas} esAdmin={esAdmin} />
    </>
  )
}

/** Texto del conteo. "sin tickets" se lee mejor que "0 tickets". */
function textoUso(n: number, vacio: string): string {
  return n === 0 ? vacio : plural(n, 'ticket', 'tickets')
}

/* -------------------------------------------------------------------------- */
/* Tipos de ticket                                                            */
/* -------------------------------------------------------------------------- */

function SeccionTipos({ tipos, esAdmin }: { tipos: TipoCatalogo[]; esAdmin: boolean }) {
  const router = useRouter()
  // El estado de guardado y el mensaje de error son de la pantalla, no de esta
  // sección: los pinta el indicador global que monta `ProveedorGuardado`.
  const { guardar, estado } = useGuardado()
  const pendiente = estado === 'guardando'

  const [nombre, setNombre] = useState('')
  const [sigla, setSigla] = useState('')
  // La sigla se autogenera del nombre MIENTRAS no se haya tocado a mano. En
  // cuanto el admin la edita, deja de sobreescribirse: si siguiera derivándose,
  // corregir la sigla de "Video / Reel" a "VR" se perdería al ajustar el nombre.
  const [siglaManual, setSiglaManual] = useState(false)
  const [color, setColor] = useState(COLOR_PALETA_DEFECTO)
  /** Id del tipo con el panel de edición abierto, o null. Uno a la vez. */
  const [abierto, setAbierto] = useState<string | null>(null)

  const activos = tipos.filter((t) => !t.archived)
  const archivados = tipos.filter((t) => t.archived)
  // La sigla solo tiene que ser única entre ACTIVOS: el índice de la base es
  // parcial (`where archived = false`).
  const siglasActivas = activos.map((t) => t.abbrev.toUpperCase())

  const siglaEfectiva = siglaManual ? sigla : siglaSugerida(nombre)
  const puedeGuardar = nombre.trim().length > 0 && siglaEfectiva.length > 0 && !pendiente

  function alCambiarNombre(v: string) {
    setNombre(v)
    if (!siglaManual) setSigla(siglaSugerida(v))
  }

  // El formulario se limpia SOLO si el alta salió bien: con un nombre repetido,
  // el admin corrige una palabra en vez de escribirlo todo de nuevo.
  async function crear() {
    if (await guardar(() => crearTipo({ nombre, sigla: siglaEfectiva, color }))) {
      setNombre('')
      setSigla('')
      setSiglaManual(false)
      setColor(COLOR_PALETA_DEFECTO)
      router.refresh()
    }
  }

  async function archivar(id: string, archivado: boolean) {
    if (await guardar(() => archivarTipo(id, archivado))) {
      setAbierto(null)
      router.refresh()
    }
  }

  return (
    <section className="tarjeta-panel" style={{ marginBottom: 14 }}>
      <h3 className="mono-xs">Tipos de ticket</h3>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--tinta-2)' }}>
        Un tipo con tickets se archiva y no se borra: un tipo con tickets históricos que desaparece
        rompe los reportes, y la base misma lo impide. Solo un tipo que nunca se usó se puede
        borrar. La sigla es lo que se lee en la fila compacta.
        {!esAdmin && ' Los administra un admin.'}
      </p>

      {activos.map((t) =>
        esAdmin && abierto === t.id ? (
          <PanelEdicionTipo
            key={t.id}
            tipo={t}
            siglasOcupadas={siglasActivas.filter((s) => s !== t.abbrev.toUpperCase())}
            nombresOcupados={tipos.filter((o) => o.id !== t.id).map((o) => o.name)}
            ultimoActivo={activos.length <= 1}
            onCerrar={() => setAbierto(null)}
          />
        ) : (
          <div className="catalogo-fila" key={t.id}>
            <PillTipoPrevia abbrev={t.abbrev} nombre={t.name} color={t.color} />
            <span style={{ fontSize: 12.5 }}>{t.name}</span>
            <span className="mono-sm" style={{ color: 'var(--tinta-3)' }}>
              {nombreColor(t.color)}
            </span>
            <span className="catalogo-uso" title="Tickets que usan este tipo">
              {textoUso(t.tickets, 'sin tickets')}
            </span>

            {esAdmin && (
              <div className="catalogo-fila-acciones">
                <button
                  type="button"
                  className="btn-texto"
                  disabled={pendiente}
                  aria-expanded={false}
                  onClick={() => setAbierto(t.id)}
                >
                  Editar
                </button>
              </div>
            )}
          </div>
        ),
      )}

      {archivados.length > 0 && (
        <>
          <p className="mono-xs" style={{ margin: '14px 0 4px', color: 'var(--tinta-3)' }}>
            Archivados · {archivados.length}
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 11.5, color: 'var(--tinta-3)' }}>
            No aparecen al crear un ticket. Los tickets que ya los usan los siguen mostrando.
            Desarchivar puede fallar si otro tipo activo tomó su sigla mientras estaba archivado:
            en ese caso cambiale la sigla acá primero.
          </p>

          {archivados.map((t) =>
            esAdmin && abierto === t.id ? (
              <PanelEdicionTipo
                key={t.id}
                tipo={t}
                siglasOcupadas={siglasActivas}
                nombresOcupados={tipos.filter((o) => o.id !== t.id).map((o) => o.name)}
                ultimoActivo={false}
                onCerrar={() => setAbierto(null)}
              />
            ) : (
              <div className="catalogo-fila" key={t.id} style={{ opacity: 0.6 }}>
                <PillTipoPrevia abbrev={t.abbrev} nombre={t.name} color={t.color} />
                <span style={{ fontSize: 12.5, textDecoration: 'line-through' }}>{t.name}</span>
                <span className="catalogo-uso">{textoUso(t.tickets, 'sin tickets')}</span>

                {esAdmin && (
                  <div className="catalogo-fila-acciones">
                    <button
                      type="button"
                      className="btn-texto"
                      disabled={pendiente}
                      onClick={() => void archivar(t.id, false)}
                    >
                      Desarchivar
                    </button>
                    <button
                      type="button"
                      className="btn-texto"
                      disabled={pendiente}
                      onClick={() => setAbierto(t.id)}
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            ),
          )}
        </>
      )}

      {esAdmin && (
        <div className="catalogo-alta">
          <label className="catalogo-campo catalogo-campo-nombre">
            <span>Nombre</span>
            <input
              className="campo"
              value={nombre}
              maxLength={40}
              placeholder="Newsletter"
              disabled={pendiente}
              onChange={(e) => alCambiarNombre(e.target.value)}
            />
          </label>

          <label className="catalogo-campo">
            <span>Sigla</span>
            <input
              className="campo campo-sigla"
              value={siglaEfectiva}
              maxLength={3}
              placeholder="NW"
              disabled={pendiente}
              onChange={(e) => {
                setSiglaManual(true)
                setSigla(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
              }}
            />
          </label>

          <div className="catalogo-campo">
            <span>Color</span>
            <SelectorColor
              valor={color}
              onChange={setColor}
              etiqueta="Color del tipo"
              disabled={pendiente}
            />
          </div>

          <div className="catalogo-campo">
            <span>Se verá así</span>
            <div className="catalogo-previa">
              <PillTipoPrevia
                abbrev={siglaEfectiva || '··'}
                nombre={nombre || 'Tipo nuevo'}
                color={color}
              />
            </div>
          </div>

          <button
            type="button"
            className="btn-primario"
            disabled={!puedeGuardar}
            onClick={() => void crear()}
          >
            Crear tipo
          </button>
        </div>
      )}
    </section>
  )
}

/**
 * Panel de edición de un tipo, en el lugar de su fila.
 *
 * Ocupa el mismo hueco de la lista que la fila cerrada, así que los tipos de
 * arriba y de abajo no se mueven al abrirlo: el admin no pierde de vista las
 * siglas y los colores con los que está comparando.
 *
 * `siglasOcupadas` y `nombresOcupados` llegan desde la sección y no se
 * consultan acá. El chequeo real lo hace la acción de servidor contra la base
 * —es el único atómico—, pero avisar mientras se escribe evita un viaje de ida
 * y vuelta para descubrir que "DG" estaba tomada.
 */
function PanelEdicionTipo({
  tipo,
  siglasOcupadas,
  nombresOcupados,
  ultimoActivo,
  onCerrar,
}: {
  tipo: TipoCatalogo
  siglasOcupadas: string[]
  nombresOcupados: string[]
  ultimoActivo: boolean
  onCerrar: () => void
}) {
  const router = useRouter()
  const { guardar, estado } = useGuardado()
  const pendiente = estado === 'guardando'

  const [nombre, setNombre] = useState(tipo.name)
  const [sigla, setSigla] = useState(tipo.abbrev.toUpperCase())
  const [color, setColor] = useState(tipo.color)
  /** El borrado confirma en la misma fila: ver el comentario de `catalogo-confirma`. */
  const [confirmando, setConfirmando] = useState(false)

  const siglaChoca = siglasOcupadas.includes(sigla.trim().toUpperCase())
  const nombreChoca = nombresOcupados.some(
    (n) => n.trim().toLowerCase() === nombre.trim().toLowerCase(),
  )
  const sinCambios =
    nombre.trim() === tipo.name &&
    sigla.trim().toUpperCase() === tipo.abbrev.toUpperCase() &&
    color === tipo.color

  const puedeGuardar =
    nombre.trim().length > 0 &&
    sigla.trim().length > 0 &&
    !siglaChoca &&
    !nombreChoca &&
    !sinCambios &&
    !pendiente

  // Un tipo con tickets NO se puede borrar: `issues.type_id` es on delete
  // restrict. Y el último activo tampoco, aunque no tenga tickets: dejaría el
  // formulario de ticket nuevo sin ninguna opción.
  const sePuedeBorrar = tipo.tickets === 0 && !(ultimoActivo && !tipo.archived)

  async function aplicar() {
    if (await guardar(() => editarTipo(tipo.id, { nombre, sigla, color }))) {
      onCerrar()
      router.refresh()
    }
  }

  async function archivar(archivado: boolean) {
    if (await guardar(() => archivarTipo(tipo.id, archivado))) {
      onCerrar()
      router.refresh()
    }
  }

  async function borrar() {
    if (await guardar(() => borrarTipo(tipo.id))) {
      onCerrar()
      router.refresh()
    }
  }

  return (
    <div className="catalogo-editor">
      <div className="catalogo-editor-campos">
        <label className="catalogo-campo catalogo-campo-nombre">
          <span>Nombre</span>
          <input
            className="campo"
            value={nombre}
            maxLength={40}
            autoFocus
            disabled={pendiente}
            aria-invalid={nombreChoca || undefined}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>

        <label className="catalogo-campo">
          <span>Sigla</span>
          <input
            className="campo campo-sigla"
            value={sigla}
            maxLength={3}
            disabled={pendiente}
            aria-invalid={siglaChoca || undefined}
            onChange={(e) => setSigla(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
        </label>

        <div className="catalogo-campo">
          <span>Color</span>
          <SelectorColor
            valor={color}
            onChange={setColor}
            etiqueta={`Color de ${tipo.name}`}
            disabled={pendiente}
          />
        </div>

        <div className="catalogo-campo">
          <span>Se verá así</span>
          <div className="catalogo-previa">
            <PillTipoPrevia abbrev={sigla || '··'} nombre={nombre || tipo.name} color={color} />
          </div>
        </div>
      </div>

      {siglaChoca && (
        <p className="catalogo-aviso" role="alert">
          La sigla {sigla} ya la usa otro tipo activo. La píldora de la fila compacta dejaría de
          identificar una sola cosa.
        </p>
      )}

      {nombreChoca && (
        <p className="catalogo-aviso" role="alert">
          Ya existe otro tipo con ese nombre.
        </p>
      )}

      <div className="catalogo-editor-acciones">
        <button
          type="button"
          className="btn-primario"
          style={{ height: 30 }}
          disabled={!puedeGuardar}
          onClick={() => void aplicar()}
        >
          Guardar cambios
        </button>

        <button
          type="button"
          className="btn-secundario"
          style={{ height: 30 }}
          disabled={pendiente}
          onClick={onCerrar}
        >
          Cancelar
        </button>

        <div className="catalogo-editor-peligro">
          {/* Archivar está siempre: es la salida para el tipo que no se puede
              borrar, y la reversible para el que sí. */}
          {!tipo.archived ? (
            <button
              type="button"
              className="btn-texto"
              disabled={pendiente || ultimoActivo}
              title={
                ultimoActivo
                  ? 'Es el único tipo activo: sin ninguno no se podrían crear tickets'
                  : 'Lo saca de los selectores. Los tickets que ya lo usan lo siguen mostrando.'
              }
              onClick={() => void archivar(true)}
            >
              Archivar
            </button>
          ) : (
            <button
              type="button"
              className="btn-texto"
              disabled={pendiente}
              title="Vuelve a aparecer al crear un ticket"
              onClick={() => void archivar(false)}
            >
              Desarchivar
            </button>
          )}

          {sePuedeBorrar &&
            (confirmando ? (
              <span className="catalogo-confirma">
                <span>¿Borrar «{tipo.name}» para siempre?</span>
                <button
                  type="button"
                  className="btn-texto btn-texto-peligro"
                  disabled={pendiente}
                  onClick={() => void borrar()}
                >
                  Sí, borrar
                </button>
                <button
                  type="button"
                  className="btn-texto"
                  disabled={pendiente}
                  onClick={() => setConfirmando(false)}
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn-texto btn-texto-peligro"
                disabled={pendiente}
                title="Nunca se usó en ningún ticket, así que borrarlo no rompe ningún reporte"
                onClick={() => setConfirmando(true)}
              >
                Borrar
              </button>
            ))}

          {tipo.tickets > 0 && (
            <span className="catalogo-nota">
              No se puede borrar: {plural(tipo.tickets, 'ticket lo usa', 'tickets lo usan')} y los
              reportes lo siguen contando. Archivalo.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Etiquetas                                                                  */
/* -------------------------------------------------------------------------- */

function SeccionEtiquetas({
  etiquetas,
  esAdmin,
}: {
  etiquetas: EtiquetaCatalogo[]
  esAdmin: boolean
}) {
  const router = useRouter()
  // El estado de guardado y el mensaje de error son de la pantalla, no de esta
  // sección: los pinta el indicador global que monta `ProveedorGuardado`.
  const { guardar, estado } = useGuardado()
  const pendiente = estado === 'guardando'

  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLOR_PALETA_DEFECTO)
  const [abierto, setAbierto] = useState<string | null>(null)

  const activas = etiquetas.filter((e) => !e.archived)
  const archivadas = etiquetas.filter((e) => e.archived)

  async function crear() {
    if (await guardar(() => crearEtiqueta({ nombre, color }))) {
      setNombre('')
      setColor(COLOR_PALETA_DEFECTO)
      router.refresh()
    }
  }

  async function archivar(id: string, archivado: boolean) {
    if (await guardar(() => archivarEtiqueta(id, archivado))) {
      setAbierto(null)
      router.refresh()
    }
  }

  return (
    <section className="tarjeta-panel" style={{ marginBottom: 14 }}>
      <h3 className="mono-xs">Etiquetas</h3>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--tinta-2)' }}>
        Transversales al tipo: un ticket lleva las que haga falta, o ninguna. No llevan sigla — el
        chip muestra el nombre completo. A diferencia de los tipos, una etiqueta sí se puede borrar:
        los tickets la pierden y no queda nada roto. Archivarla es la opción reversible.
        {!esAdmin && ' Las administra un admin.'}
      </p>

      {activas.length === 0 && archivadas.length === 0 && (
        <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--tinta-3)' }}>
          Todavía no hay ninguna.
        </p>
      )}

      {activas.map((e) =>
        esAdmin && abierto === e.id ? (
          <PanelEdicionEtiqueta
            key={e.id}
            etiqueta={e}
            nombresOcupados={etiquetas.filter((o) => o.id !== e.id).map((o) => o.name)}
            onCerrar={() => setAbierto(null)}
          />
        ) : (
          <div className="catalogo-fila" key={e.id}>
            <ChipEtiquetaPrevia nombre={e.name} color={e.color} />
            <span className="mono-sm" style={{ color: 'var(--tinta-3)' }}>
              {nombreColor(e.color)}
            </span>
            <span className="catalogo-uso" title="Tickets que la tienen puesta">
              {textoUso(e.usos, 'sin usar')}
            </span>

            {esAdmin && (
              <div className="catalogo-fila-acciones">
                <button
                  type="button"
                  className="btn-texto"
                  disabled={pendiente}
                  aria-expanded={false}
                  onClick={() => setAbierto(e.id)}
                >
                  Editar
                </button>
              </div>
            )}
          </div>
        ),
      )}

      {archivadas.length > 0 && (
        <>
          <p className="mono-xs" style={{ margin: '14px 0 8px', color: 'var(--tinta-3)' }}>
            Archivadas · {archivadas.length}
          </p>

          {archivadas.map((e) =>
            esAdmin && abierto === e.id ? (
              <PanelEdicionEtiqueta
                key={e.id}
                etiqueta={e}
                nombresOcupados={etiquetas.filter((o) => o.id !== e.id).map((o) => o.name)}
                onCerrar={() => setAbierto(null)}
              />
            ) : (
              <div className="catalogo-fila" key={e.id} style={{ opacity: 0.6 }}>
                <ChipEtiquetaPrevia nombre={e.name} color={e.color} />
                <span className="catalogo-uso">{textoUso(e.usos, 'sin usar')}</span>

                {esAdmin && (
                  <div className="catalogo-fila-acciones">
                    <button
                      type="button"
                      className="btn-texto"
                      disabled={pendiente}
                      onClick={() => void archivar(e.id, false)}
                    >
                      Desarchivar
                    </button>
                    <button
                      type="button"
                      className="btn-texto"
                      disabled={pendiente}
                      onClick={() => setAbierto(e.id)}
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            ),
          )}
        </>
      )}

      {esAdmin && (
        <div className="catalogo-alta">
          <label className="catalogo-campo catalogo-campo-nombre">
            <span>Nombre</span>
            <input
              className="campo"
              value={nombre}
              maxLength={24}
              placeholder="Urgente cliente"
              disabled={pendiente}
              onChange={(ev) => setNombre(ev.target.value)}
            />
          </label>

          <div className="catalogo-campo">
            <span>Color</span>
            <SelectorColor
              valor={color}
              onChange={setColor}
              etiqueta="Color de la etiqueta"
              disabled={pendiente}
            />
          </div>

          <div className="catalogo-campo">
            <span>Se verá así</span>
            <div className="catalogo-previa">
              <ChipEtiquetaPrevia nombre={nombre || 'Etiqueta nueva'} color={color} />
            </div>
          </div>

          <button
            type="button"
            className="btn-primario"
            disabled={!nombre.trim() || pendiente}
            onClick={() => void crear()}
          >
            Crear etiqueta
          </button>
        </div>
      )}
    </section>
  )
}

/**
 * Panel de edición de una etiqueta.
 *
 * La confirmación de borrado dice cuántos tickets la perderían, con el número
 * que llegó del servidor en el render. Es lo único irreversible del panel: la
 * etiqueta se puede volver a crear con el mismo nombre y el mismo color, pero
 * cuáles eran los tickets que la tenían no se reconstruye.
 */
function PanelEdicionEtiqueta({
  etiqueta,
  nombresOcupados,
  onCerrar,
}: {
  etiqueta: EtiquetaCatalogo
  nombresOcupados: string[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const { guardar, estado } = useGuardado()
  const pendiente = estado === 'guardando'

  const [nombre, setNombre] = useState(etiqueta.name)
  const [color, setColor] = useState(etiqueta.color)
  const [confirmando, setConfirmando] = useState(false)

  // El índice de la base es `lower(name)`, así que la comparación de acá también
  // ignora mayúsculas: si no, el aviso llegaría recién desde el servidor.
  const nombreChoca = nombresOcupados.some(
    (n) => n.trim().toLowerCase() === nombre.trim().toLowerCase(),
  )
  const sinCambios = nombre.trim() === etiqueta.name && color === etiqueta.color
  const puedeGuardar = nombre.trim().length > 0 && !nombreChoca && !sinCambios && !pendiente

  async function aplicar() {
    if (await guardar(() => editarEtiqueta(etiqueta.id, { nombre, color }))) {
      onCerrar()
      router.refresh()
    }
  }

  async function archivar(archivado: boolean) {
    if (await guardar(() => archivarEtiqueta(etiqueta.id, archivado))) {
      onCerrar()
      router.refresh()
    }
  }

  async function borrar() {
    if (await guardar(() => borrarEtiqueta(etiqueta.id))) {
      onCerrar()
      router.refresh()
    }
  }

  return (
    <div className="catalogo-editor">
      <div className="catalogo-editor-campos">
        <label className="catalogo-campo catalogo-campo-nombre">
          <span>Nombre</span>
          <input
            className="campo"
            value={nombre}
            maxLength={24}
            autoFocus
            disabled={pendiente}
            aria-invalid={nombreChoca || undefined}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>

        <div className="catalogo-campo">
          <span>Color</span>
          <SelectorColor
            valor={color}
            onChange={setColor}
            etiqueta={`Color de ${etiqueta.name}`}
            disabled={pendiente}
          />
        </div>

        <div className="catalogo-campo">
          <span>Se verá así</span>
          <div className="catalogo-previa">
            <ChipEtiquetaPrevia nombre={nombre || etiqueta.name} color={color} />
          </div>
        </div>
      </div>

      {nombreChoca && (
        <p className="catalogo-aviso" role="alert">
          Ya existe una etiqueta con ese nombre. No se distinguen mayúsculas.
        </p>
      )}

      <div className="catalogo-editor-acciones">
        <button
          type="button"
          className="btn-primario"
          style={{ height: 30 }}
          disabled={!puedeGuardar}
          onClick={() => void aplicar()}
        >
          Guardar cambios
        </button>

        <button
          type="button"
          className="btn-secundario"
          style={{ height: 30 }}
          disabled={pendiente}
          onClick={onCerrar}
        >
          Cancelar
        </button>

        <div className="catalogo-editor-peligro">
          <button
            type="button"
            className="btn-texto"
            disabled={pendiente}
            title={
              etiqueta.archived
                ? 'Vuelve a aparecer al etiquetar un ticket'
                : 'La saca del selector. Los tickets que la tienen la siguen mostrando.'
            }
            onClick={() => void archivar(!etiqueta.archived)}
          >
            {etiqueta.archived ? 'Desarchivar' : 'Archivar'}
          </button>

          {confirmando ? (
            <span className="catalogo-confirma">
              <span>
                {etiqueta.usos === 0
                  ? `¿Borrar «${etiqueta.name}» para siempre?`
                  : `La van a perder ${plural(etiqueta.usos, 'ticket', 'tickets')}. No se puede deshacer.`}
              </span>
              <button
                type="button"
                className="btn-texto btn-texto-peligro"
                disabled={pendiente}
                onClick={() => void borrar()}
              >
                Sí, borrar
              </button>
              <button
                type="button"
                className="btn-texto"
                disabled={pendiente}
                onClick={() => setConfirmando(false)}
              >
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="btn-texto btn-texto-peligro"
              disabled={pendiente}
              title={
                etiqueta.usos === 0
                  ? 'No la usa ningún ticket'
                  : `${plural(etiqueta.usos, 'ticket la tiene', 'tickets la tienen')} puesta y la van a perder`
              }
              onClick={() => setConfirmando(true)}
            >
              Borrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Previas                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Misma píldora que `PillTipo` de piezas.tsx pero con el nombre al lado de la
 * sigla: en Ajustes hay ancho de sobra y el admin necesita ver los dos juntos
 * para decidir si la sigla se entiende.
 */
function PillTipoPrevia({
  abbrev,
  nombre,
  color,
}: {
  abbrev: string
  nombre: string
  color: string
}) {
  return (
    <span
      className="pill-tipo"
      style={{ background: typePillBackground(color), color, height: 24 }}
      title={nombre}
    >
      <span className="punto" style={{ background: color }} />
      {abbrev}
    </span>
  )
}

/**
 * El chip de etiqueta de la tabla es neutro (borde `--linea`, texto
 * `--tinta-2`) y no usa `labels.color`. Acá sí se pinta: es la pantalla donde
 * el color se elige, y sin verlo el selector no tendría sentido. El borde y el
 * texto van del color, y el fondo al 12 %, igual que la píldora de tipo.
 */
function ChipEtiquetaPrevia({ nombre, color }: { nombre: string; color: string }) {
  return (
    <span
      className="chip-etiqueta"
      style={{
        height: 22,
        background: typePillBackground(color),
        borderColor: color,
        color,
      }}
      title={nombre}
    >
      {nombre}
    </span>
  )
}
