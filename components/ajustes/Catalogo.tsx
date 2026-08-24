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
import { MiniModal } from '@/components/ui/MiniModal'
import {
  IconoArchivar,
  IconoDesarchivar,
  IconoLapiz,
  IconoMas,
  IconoPapelera,
} from '@/components/ui/iconos'
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
 * EL MAPA DE INTERACCIÓN
 *
 *   Cabecera de sección → botón "+"  → MINI MODAL de alta.
 *   Fila                → lápiz      → panel de edición EN EL SITIO de la fila.
 *   Fila                → caja       → archiva / desarchiva, directo.
 *   Fila                → papelera   → MINI MODAL de confirmación de borrado.
 *
 * POR QUÉ EL ALTA ES UN MODAL Y LA EDICIÓN NO
 *
 * Son dos tareas distintas y el contexto que necesitan es el opuesto. El alta
 * pasa una vez por elemento, y su formulario permanente al pie ocupaba cuatro
 * campos y un botón SIEMPRE, empujando la lista hacia arriba: la sección se
 * leía como un formulario con una lista de adorno, cuando el 95 % de las
 * visitas viene a mirar los ocho tipos que ya existen. Detrás de un "+" la
 * sección vuelve a ser la lista.
 *
 * La edición es lo contrario: la sigla se elige MIRANDO las otras siete y el
 * color viendo qué tonos ya están tomados. Un overlay taparía exactamente la
 * lista que hace falta para decidir, así que el lápiz abre el panel en el hueco
 * de la fila —los elementos de arriba y abajo no se mueven— y sigue siendo UN
 * clic desde la fila, que era el pedido. Solo una fila abierta a la vez
 * (`abierto` es un id, no un set): dos formularios simultáneos compiten por el
 * indicador de guardado global, que es único por pantalla.
 *
 * POR QUÉ ARCHIVAR ES UN TERCER ICONO EN LA FILA Y NO VIVE DENTRO DE LA EDICIÓN
 *
 * Los ocho tipos activos tienen tickets, así que para todos ellos archivar es
 * la ÚNICA salida posible: borrar lo rechaza la base. Dejar la acción real
 * enterrada un clic adentro del lápiz mientras la acción imposible tiene su
 * propio botón a la vista sería exactamente al revés de lo que hace falta. El
 * icono es una caja con tapa y no una segunda papelera, y su `title` dice qué
 * cambia: archivar y borrar no se distinguen solos en un icono de 14px.
 *
 * BORRAR NO SIGNIFICA LO MISMO EN LOS DOS CATÁLOGOS
 *
 * Un tipo CON tickets no se puede borrar: `issues.type_id` es `on delete
 * restrict` y la base lo rechaza. Antes la interfaz OCULTABA el botón en ese
 * caso; ahora lo muestra DESACTIVADO con el motivo y el conteo en el `title`.
 * Esconderlo dejaba al admin buscando una acción que sí existe en el producto y
 * que en otras filas aparece; el botón atenuado enseña las dos cosas, que la
 * acción existe y por qué no aplica acá. Una etiqueta siempre se puede borrar,
 * porque `issue_labels` cascadea; lo que cambia según el uso es el texto de la
 * confirmación, que dice cuántos tickets la van a perder.
 */

export interface TipoCatalogo {
  id: string
  name: string
  abbrev: string
  color: string
  archived: boolean
  /** Tickets que lo usan. Decide si la papelera de la fila está habilitada. */
  tickets: number
}

export interface EtiquetaCatalogo {
  id: string
  name: string
  color: string
  archived: boolean
  /** Tickets que la tienen puesta. Alimenta la advertencia al borrar. */
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

/** Motivo genérico de un icono deshabilitado mientras hay un guardado en vuelo. */
const MOTIVO_PENDIENTE = 'Esperá a que termine el guardado en curso'

/* -------------------------------------------------------------------------- */
/* Piezas compartidas de la fila                                              */
/* -------------------------------------------------------------------------- */

/**
 * Botón de una sola acción de fila.
 *
 * SIEMPRE lleva `aria-label` y `title`: el contenido es un SVG con
 * `aria-hidden`, así que sin la etiqueta el botón se anuncia como "botón" y
 * nada más. El `title` además es lo que explica por qué está deshabilitado, y
 * en ese caso el texto es distinto del de la acción activa.
 *
 * Cuando está deshabilitado se pone `aria-disabled` ADEMÁS de `disabled`: hay
 * lectores de pantalla que saltean los `disabled` al navegar por controles, y
 * este botón desactivado es información —"esto no se puede borrar"—, no ruido.
 */
function BotonFila({
  etiqueta,
  motivo,
  disabled = false,
  peligro = false,
  onClick,
  children,
}: {
  /** Qué hace. Es el `aria-label` y el `title` cuando está activo. */
  etiqueta: string
  /** Por qué no se puede. Reemplaza al `title` cuando está deshabilitado. */
  motivo?: string
  disabled?: boolean
  peligro?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const texto = disabled && motivo ? `${etiqueta} — ${motivo}` : etiqueta

  return (
    <button
      type="button"
      className={`btn-accion-fila${peligro ? ' btn-accion-fila-peligro' : ''}`}
      aria-label={texto}
      title={texto}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Cabecera de sección con el "+" que abre el alta. */
function CabeceraSeccion({
  titulo,
  accion,
  onAgregar,
  mostrarAgregar,
  disabled,
}: {
  titulo: string
  /** `aria-label` del "+". "Nuevo" solo no dice nuevo QUÉ, y hay dos secciones. */
  accion: string
  onAgregar: () => void
  mostrarAgregar: boolean
  disabled: boolean
}) {
  return (
    <div className="catalogo-cabecera">
      <h3 className="mono-xs">{titulo}</h3>
      {mostrarAgregar && (
        <button
          type="button"
          className="btn-icono catalogo-agregar"
          aria-label={accion}
          title={accion}
          disabled={disabled}
          aria-disabled={disabled || undefined}
          onClick={onAgregar}
        >
          <IconoMas />
        </button>
      )}
    </div>
  )
}

/** Pie de los mini modales de alta y de borrado. Mismo orden en los cuatro. */
function PieModal({
  confirmar,
  onConfirmar,
  onCancelar,
  puedeConfirmar,
  peligro = false,
}: {
  confirmar: string
  onConfirmar: () => void
  onCancelar: () => void
  puedeConfirmar: boolean
  peligro?: boolean
}) {
  return (
    <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
      <button type="button" className="btn-secundario" onClick={onCancelar}>
        Cancelar
      </button>
      <button
        type="button"
        className={peligro ? 'btn-primario btn-primario-peligro' : 'btn-primario'}
        disabled={!puedeConfirmar}
        onClick={onConfirmar}
      >
        {confirmar}
      </button>
    </span>
  )
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

  /** Id del tipo con el panel de edición abierto, o null. Uno a la vez. */
  const [abierto, setAbierto] = useState<string | null>(null)
  const [altaAbierta, setAltaAbierta] = useState(false)
  /** Tipo pendiente de confirmar el borrado, o null. */
  const [borrando, setBorrando] = useState<TipoCatalogo | null>(null)

  const activos = tipos.filter((t) => !t.archived)
  const archivados = tipos.filter((t) => t.archived)
  // La sigla solo tiene que ser única entre ACTIVOS: el índice de la base es
  // parcial (`where archived = false`).
  const siglasActivas = activos.map((t) => t.abbrev.toUpperCase())
  const ultimoActivo = activos.length <= 1

  async function archivar(id: string, archivado: boolean) {
    if (await guardar(() => archivarTipo(id, archivado))) {
      setAbierto(null)
      router.refresh()
    }
  }

  async function borrar(tipo: TipoCatalogo) {
    if (await guardar(() => borrarTipo(tipo.id))) {
      setBorrando(null)
      setAbierto(null)
      router.refresh()
    }
  }

  /**
   * Un tipo con tickets no se puede borrar (`on delete restrict`), y el último
   * activo tampoco aunque esté vacío: dejaría el formulario de ticket nuevo sin
   * ninguna opción. En los dos casos la papelera queda deshabilitada con el
   * motivo puesto, no oculta.
   */
  function motivoNoBorrable(t: TipoCatalogo): string | null {
    if (t.tickets > 0) {
      return `tiene ${plural(t.tickets, 'ticket', 'tickets')}: se archiva, no se borra`
    }
    if (ultimoActivo && !t.archived) {
      return 'es el único tipo activo, sin ninguno no se podrían crear tickets'
    }
    return null
  }

  function AccionesTipo({ t }: { t: TipoCatalogo }) {
    const motivo = motivoNoBorrable(t)

    return (
      <div className="catalogo-fila-acciones">
        <BotonFila
          etiqueta={`Editar ${t.name}`}
          disabled={pendiente}
          motivo={MOTIVO_PENDIENTE}
          onClick={() => setAbierto(t.id)}
        >
          <IconoLapiz />
        </BotonFila>

        {t.archived ? (
          <BotonFila
            etiqueta={`Desarchivar ${t.name}`}
            disabled={pendiente}
            motivo={MOTIVO_PENDIENTE}
            onClick={() => void archivar(t.id, false)}
          >
            <IconoDesarchivar />
          </BotonFila>
        ) : (
          <BotonFila
            etiqueta={`Archivar ${t.name}`}
            disabled={pendiente || ultimoActivo}
            motivo={
              ultimoActivo
                ? 'es el único tipo activo, sin ninguno no se podrían crear tickets'
                : MOTIVO_PENDIENTE
            }
            onClick={() => void archivar(t.id, true)}
          >
            <IconoArchivar />
          </BotonFila>
        )}

        <BotonFila
          etiqueta={`Borrar ${t.name}`}
          peligro
          disabled={pendiente || motivo !== null}
          motivo={motivo ?? MOTIVO_PENDIENTE}
          onClick={() => setBorrando(t)}
        >
          <IconoPapelera />
        </BotonFila>
      </div>
    )
  }

  return (
    <section className="tarjeta-panel" style={{ marginBottom: 14 }}>
      <CabeceraSeccion
        titulo="Tipos de ticket"
        accion="Nuevo tipo de ticket"
        onAgregar={() => setAltaAbierta(true)}
        mostrarAgregar={esAdmin}
        disabled={pendiente}
      />

      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--tinta-2)' }}>
        Un tipo con tickets se archiva y no se borra: un tipo con tickets históricos que desaparece
        rompe los reportes, y la base misma lo impide — la papelera de esas filas queda desactivada
        y dice por qué. La sigla es lo que se lee en la fila compacta.
        {!esAdmin && ' Los administra un admin.'}
      </p>

      {activos.map((t) =>
        esAdmin && abierto === t.id ? (
          <PanelEdicionTipo
            key={t.id}
            tipo={t}
            siglasOcupadas={siglasActivas.filter((s) => s !== t.abbrev.toUpperCase())}
            nombresOcupados={tipos.filter((o) => o.id !== t.id).map((o) => o.name)}
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

            {esAdmin && <AccionesTipo t={t} />}
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
                onCerrar={() => setAbierto(null)}
              />
            ) : (
              <div className="catalogo-fila" key={t.id} style={{ opacity: 0.6 }}>
                <PillTipoPrevia abbrev={t.abbrev} nombre={t.name} color={t.color} />
                <span style={{ fontSize: 12.5, textDecoration: 'line-through' }}>{t.name}</span>
                <span className="catalogo-uso">{textoUso(t.tickets, 'sin tickets')}</span>

                {esAdmin && <AccionesTipo t={t} />}
              </div>
            ),
          )}
        </>
      )}

      {altaAbierta && (
        <ModalAltaTipo
          siglasOcupadas={siglasActivas}
          nombresOcupados={tipos.map((t) => t.name)}
          onCerrar={() => setAltaAbierta(false)}
        />
      )}

      {borrando && (
        <MiniModal
          titulo={`¿Borrar «${borrando.name}»?`}
          descripcion="El tipo desaparece del catálogo para siempre. No lo usa ningún ticket, así que no rompe ningún reporte, pero volver a crearlo es escribir el nombre, la sigla y el color de nuevo."
          onCerrar={() => setBorrando(null)}
          pie={
            <PieModal
              confirmar="Sí, borrar"
              peligro
              puedeConfirmar={!pendiente}
              onCancelar={() => setBorrando(null)}
              onConfirmar={() => void borrar(borrando)}
            />
          }
        >
          <div className="catalogo-previa">
            <PillTipoPrevia
              abbrev={borrando.abbrev}
              nombre={borrando.name}
              color={borrando.color}
            />
            <span style={{ fontSize: 12.5 }}>{borrando.name}</span>
          </div>
        </MiniModal>
      )}
    </section>
  )
}

/**
 * Alta de un tipo, en mini modal.
 *
 * `siglasOcupadas` y `nombresOcupados` llegan desde la sección y no se
 * consultan acá. El chequeo real lo hace la acción de servidor contra la base
 * —es el único atómico—, pero avisar mientras se escribe evita un viaje de ida
 * y vuelta para descubrir que "DG" estaba tomada.
 */
function ModalAltaTipo({
  siglasOcupadas,
  nombresOcupados,
  onCerrar,
}: {
  siglasOcupadas: string[]
  nombresOcupados: string[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const { guardar, estado } = useGuardado()
  const pendiente = estado === 'guardando'

  const [nombre, setNombre] = useState('')
  const [sigla, setSigla] = useState('')
  // La sigla se autogenera del nombre MIENTRAS no se haya tocado a mano. En
  // cuanto el admin la edita, deja de sobreescribirse: si siguiera derivándose,
  // corregir la sigla de "Video / Reel" a "VR" se perdería al ajustar el nombre.
  const [siglaManual, setSiglaManual] = useState(false)
  const [color, setColor] = useState(COLOR_PALETA_DEFECTO)

  const siglaEfectiva = siglaManual ? sigla : siglaSugerida(nombre)
  const siglaChoca = siglasOcupadas.includes(siglaEfectiva.trim().toUpperCase())
  const nombreChoca = nombresOcupados.some(
    (n) => n.trim().toLowerCase() === nombre.trim().toLowerCase(),
  )

  const puedeGuardar =
    nombre.trim().length > 0 &&
    siglaEfectiva.length > 0 &&
    !siglaChoca &&
    !nombreChoca &&
    !pendiente

  function alCambiarNombre(v: string) {
    setNombre(v)
    if (!siglaManual) setSigla(siglaSugerida(v))
  }

  // El modal se cierra SOLO si el alta salió bien: con un nombre repetido, el
  // admin corrige una palabra en vez de escribirlo todo de nuevo.
  async function crear() {
    if (await guardar(() => crearTipo({ nombre, sigla: siglaEfectiva, color }))) {
      onCerrar()
      router.refresh()
    }
  }

  return (
    <MiniModal
      titulo="Nuevo tipo de ticket"
      descripcion="La sigla es lo que representa al tipo en la fila compacta de la tabla, donde el nombre no entra. Tiene que ser única entre los tipos activos."
      ancho={480}
      onCerrar={onCerrar}
      pie={
        <PieModal
          confirmar="Crear tipo"
          puedeConfirmar={puedeGuardar}
          onCancelar={onCerrar}
          onConfirmar={() => void crear()}
        />
      }
    >
      <div className="catalogo-editor-campos">
        <label className="catalogo-campo catalogo-campo-nombre">
          <span>Nombre</span>
          <input
            className="campo"
            value={nombre}
            maxLength={40}
            placeholder="Newsletter"
            autoFocus
            disabled={pendiente}
            aria-invalid={nombreChoca || undefined}
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
            aria-invalid={siglaChoca || undefined}
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

        <VistaPreviaTipo sigla={siglaEfectiva} nombre={nombre} color={color} />
      </div>

      {siglaChoca && (
        <p className="catalogo-aviso" role="alert">
          La sigla {siglaEfectiva} ya la usa otro tipo activo. La píldora de la fila compacta
          dejaría de identificar una sola cosa.
        </p>
      )}

      {nombreChoca && (
        <p className="catalogo-aviso" role="alert">
          Ya existe un tipo con ese nombre. Revisá si está archivado en la lista.
        </p>
      )}
    </MiniModal>
  )
}

/**
 * Panel de edición de un tipo, en el lugar de su fila.
 *
 * Ocupa el mismo hueco de la lista que la fila cerrada, así que los tipos de
 * arriba y de abajo no se mueven al abrirlo: el admin no pierde de vista las
 * siglas y los colores con los que está comparando.
 *
 * Archivar y borrar ya NO viven acá: son iconos de la fila. Este panel es
 * exclusivamente el formulario de los tres campos, y por eso su pie tiene dos
 * botones y no cinco.
 */
function PanelEdicionTipo({
  tipo,
  siglasOcupadas,
  nombresOcupados,
  onCerrar,
}: {
  tipo: TipoCatalogo
  siglasOcupadas: string[]
  nombresOcupados: string[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const { guardar, estado } = useGuardado()
  const pendiente = estado === 'guardando'

  const [nombre, setNombre] = useState(tipo.name)
  const [sigla, setSigla] = useState(tipo.abbrev.toUpperCase())
  const [color, setColor] = useState(tipo.color)

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

  async function aplicar() {
    if (await guardar(() => editarTipo(tipo.id, { nombre, sigla, color }))) {
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

        <VistaPreviaTipo
          sigla={sigla}
          nombre={nombre}
          color={color}
          respaldo={{ abbrev: tipo.abbrev, name: tipo.name }}
        />
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
  const { guardar, estado } = useGuardado()
  const pendiente = estado === 'guardando'

  const [abierto, setAbierto] = useState<string | null>(null)
  const [altaAbierta, setAltaAbierta] = useState(false)
  const [borrando, setBorrando] = useState<EtiquetaCatalogo | null>(null)

  const activas = etiquetas.filter((e) => !e.archived)
  const archivadas = etiquetas.filter((e) => e.archived)

  async function archivar(id: string, archivado: boolean) {
    if (await guardar(() => archivarEtiqueta(id, archivado))) {
      setAbierto(null)
      router.refresh()
    }
  }

  async function borrar(et: EtiquetaCatalogo) {
    if (await guardar(() => borrarEtiqueta(et.id))) {
      setBorrando(null)
      setAbierto(null)
      router.refresh()
    }
  }

  function AccionesEtiqueta({ e }: { e: EtiquetaCatalogo }) {
    return (
      <div className="catalogo-fila-acciones">
        <BotonFila
          etiqueta={`Editar ${e.name}`}
          disabled={pendiente}
          motivo={MOTIVO_PENDIENTE}
          onClick={() => setAbierto(e.id)}
        >
          <IconoLapiz />
        </BotonFila>

        <BotonFila
          etiqueta={e.archived ? `Desarchivar ${e.name}` : `Archivar ${e.name}`}
          disabled={pendiente}
          motivo={MOTIVO_PENDIENTE}
          onClick={() => void archivar(e.id, !e.archived)}
        >
          {e.archived ? <IconoDesarchivar /> : <IconoArchivar />}
        </BotonFila>

        {/* La papelera de una etiqueta NUNCA se deshabilita por los datos:
            `issue_labels` cascadea, así que el borrado siempre funciona. Lo que
            protege es la confirmación, que dice cuántos tickets la pierden. */}
        <BotonFila
          etiqueta={`Borrar ${e.name}`}
          peligro
          disabled={pendiente}
          motivo={MOTIVO_PENDIENTE}
          onClick={() => setBorrando(e)}
        >
          <IconoPapelera />
        </BotonFila>
      </div>
    )
  }

  return (
    <section className="tarjeta-panel" style={{ marginBottom: 14 }}>
      <CabeceraSeccion
        titulo="Etiquetas"
        accion="Nueva etiqueta"
        onAgregar={() => setAltaAbierta(true)}
        mostrarAgregar={esAdmin}
        disabled={pendiente}
      />

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

            {esAdmin && <AccionesEtiqueta e={e} />}
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

                {esAdmin && <AccionesEtiqueta e={e} />}
              </div>
            ),
          )}
        </>
      )}

      {altaAbierta && (
        <ModalAltaEtiqueta
          nombresOcupados={etiquetas.map((e) => e.name)}
          onCerrar={() => setAltaAbierta(false)}
        />
      )}

      {borrando && (
        <MiniModal
          titulo={`¿Borrar «${borrando.name}»?`}
          descripcion={
            borrando.usos === 0
              ? 'No la usa ningún ticket, así que no se pierde nada más que la etiqueta del catálogo. No se puede deshacer.'
              : `La van a perder ${plural(borrando.usos, 'ticket', 'tickets')}. Se puede volver a crear con el mismo nombre y el mismo color, pero cuáles eran esos tickets no se reconstruye.`
          }
          onCerrar={() => setBorrando(null)}
          pie={
            <PieModal
              confirmar="Sí, borrar"
              peligro
              puedeConfirmar={!pendiente}
              onCancelar={() => setBorrando(null)}
              onConfirmar={() => void borrar(borrando)}
            />
          }
        >
          <div className="catalogo-previa">
            <ChipEtiquetaPrevia nombre={borrando.name} color={borrando.color} />
          </div>
        </MiniModal>
      )}
    </section>
  )
}

/** Alta de una etiqueta: nombre y color, sin sigla. */
function ModalAltaEtiqueta({
  nombresOcupados,
  onCerrar,
}: {
  nombresOcupados: string[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const { guardar, estado } = useGuardado()
  const pendiente = estado === 'guardando'

  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLOR_PALETA_DEFECTO)

  const nombreChoca = nombresOcupados.some(
    (n) => n.trim().toLowerCase() === nombre.trim().toLowerCase(),
  )
  const puedeGuardar = nombre.trim().length > 0 && !nombreChoca && !pendiente

  async function crear() {
    if (await guardar(() => crearEtiqueta({ nombre, color }))) {
      onCerrar()
      router.refresh()
    }
  }

  return (
    <MiniModal
      titulo="Nueva etiqueta"
      descripcion="El chip muestra el nombre completo, así que no lleva sigla. El nombre es único sin distinguir mayúsculas."
      ancho={460}
      onCerrar={onCerrar}
      pie={
        <PieModal
          confirmar="Crear etiqueta"
          puedeConfirmar={puedeGuardar}
          onCancelar={onCerrar}
          onConfirmar={() => void crear()}
        />
      }
    >
      <div className="catalogo-editor-campos">
        <label className="catalogo-campo catalogo-campo-nombre">
          <span>Nombre</span>
          <input
            className="campo"
            value={nombre}
            maxLength={24}
            placeholder="Urgente cliente"
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
            etiqueta="Color de la etiqueta"
            disabled={pendiente}
          />
        </div>

        <VistaPreviaEtiqueta nombre={nombre} color={color} />
      </div>

      {nombreChoca && (
        <p className="catalogo-aviso" role="alert">
          Ya existe una etiqueta con ese nombre. No se distinguen mayúsculas.
        </p>
      )}
    </MiniModal>
  )
}

/**
 * Panel de edición de una etiqueta. Solo el formulario: archivar y borrar son
 * los iconos de la fila.
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

        <VistaPreviaEtiqueta nombre={nombre} color={color} respaldo={etiqueta.name} />
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
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Previas                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Vista previa de la píldora de un tipo.
 *
 * ANTES SE VEÍA VACÍA Y AHORA NO. El alta pintaba `abbrev={sigla || '··'}` con
 * `nombre={nombre || 'Tipo nuevo'}`, pero la píldora SOLO dibuja la sigla —el
 * nombre va en el `title`—, así que con el nombre en placeholder la cápsula de
 * color quedaba con un punto y dos puntitos adentro: eso es la captura del
 * usuario. El texto de relleno estaba puesto en el campo que no se ve.
 *
 * La regla ahora es: la previa se dibuja cuando hay una sigla real —escrita, o
 * derivada del nombre, o la del tipo que se está editando— y si no, en su lugar
 * va una línea que dice qué falta. Una previa ausente con su motivo se lee
 * mejor que una píldora vacía, que parece un bug del selector de color. El
 * `title` tampoco queda vacío nunca: si el nombre no se escribió todavía,
 * describe lo que se está viendo.
 */
function VistaPreviaTipo({
  sigla,
  nombre,
  color,
  respaldo,
}: {
  sigla: string
  nombre: string
  color: string
  /** Valores actuales al editar: la previa nunca queda vacía en ese caso. */
  respaldo?: { abbrev: string; name: string }
}) {
  const siglaFinal = sigla.trim().toUpperCase() || respaldo?.abbrev.toUpperCase() || ''
  const nombreFinal = nombre.trim() || respaldo?.name || ''

  return (
    <div className="catalogo-campo">
      <span>Se verá así</span>
      <div className="catalogo-previa">
        {siglaFinal ? (
          <>
            <PillTipoPrevia
              abbrev={siglaFinal}
              nombre={nombreFinal || `Sigla ${siglaFinal}, sin nombre todavía`}
              color={color}
            />
            {nombreFinal && (
              <span style={{ fontSize: 12, color: 'var(--tinta-2)' }}>{nombreFinal}</span>
            )}
          </>
        ) : (
          <span className="catalogo-previa-vacia">Escribí un nombre y aparece la píldora</span>
        )}
      </div>
    </div>
  )
}

/** Igual que la de tipo: el chip se dibuja recién cuando hay un nombre. */
function VistaPreviaEtiqueta({
  nombre,
  color,
  respaldo,
}: {
  nombre: string
  color: string
  respaldo?: string
}) {
  const nombreFinal = nombre.trim() || respaldo || ''

  return (
    <div className="catalogo-campo">
      <span>Se verá así</span>
      <div className="catalogo-previa">
        {nombreFinal ? (
          <ChipEtiquetaPrevia nombre={nombreFinal} color={color} />
        ) : (
          <span className="catalogo-previa-vacia">Escribí un nombre y aparece el chip</span>
        )}
      </div>
    </div>
  )
}

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
