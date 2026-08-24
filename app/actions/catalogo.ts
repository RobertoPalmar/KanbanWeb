'use server'

/**
 * Catálogo del workspace: tipos de ticket y etiquetas. Solo admin.
 *
 * TRES REGLAS QUE LA BASE TAMBIÉN SOSTIENE
 *
 * 1. ARCHIVAR ES EL CAMINO NORMAL; BORRAR ES LA EXCEPCIÓN, Y NO ES SIMÉTRICA
 *    ENTRE LOS DOS CATÁLOGOS. `issues.type_id` es NOT NULL con
 *    `on delete restrict`: un tipo CON tickets no se puede borrar ni queriendo,
 *    la base lo rechaza. Un tipo SIN tickets sí, y ahí borrar es lo correcto —
 *    un tipo que nunca se usó no es historia, es basura del catálogo. Por eso
 *    `borrarTipo` cuenta los tickets ANTES y devuelve un mensaje que empuja a
 *    archivar en vez de dejar salir un error de constraint.
 *
 *    Las etiquetas son otra cosa: `issue_labels` cascadea, así que borrar una
 *    etiqueta en uso SÍ funciona y se lleva las asignaciones con ella. No hay
 *    nada que la base impida, así que la salvaguarda es de interfaz: se cuenta
 *    cuántos tickets la perderían y se avisa antes de confirmar.
 *
 * 2. EL COLOR SALE DE LA PALETA, NO DEL CLIENTE. Se valida contra
 *    `PALETA_CATALOGO` y no con un regex de forma: ver lib/paleta.ts.
 *
 * 3. LA UNICIDAD LA GARANTIZA LA BASE, NO EL SELECT PREVIO. Los chequeos de
 *    estas acciones existen para dar un mensaje accionable; entre el SELECT y
 *    el UPDATE otro admin puede tomar el nombre o la sigla. Los índices únicos
 *    son la garantía real y `traducir()` convierte su 23505 en algo legible.
 *
 * OJO — este archivo lleva 'use server': solo puede exportar funciones async.
 * La paleta y los helpers viven en lib/paleta.ts a propósito. Exportar acá una
 * constante produce un módulo roto de Webpack en runtime (el famoso
 * "__webpack_modules__[moduleId] is not a function"), que ya pasó una vez en
 * este proyecto y no da error de compilación.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSesion } from '@/lib/auth'
import { normalizarColor } from '@/lib/paleta'
import { plural } from '@/lib/format'

type Resultado = { ok: true } | { ok: false; error: string }

async function requireAdmin() {
  const sesion = await requireSesion()
  return sesion.actor.role === 'admin' ? sesion : null
}

/**
 * Revalida el layout y no solo /ajustes: los tipos y las etiquetas alimentan
 * los selectores del modal de ticket nuevo y la barra de filtros, que se
 * renderizan en otras rutas.
 */
function revalidarCatalogo() {
  revalidatePath('/', 'layout')
}

/** Normaliza para comparar: sin tildes y en minúsculas. */
function plano(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Traduce los errores de constraint a algo que el admin pueda accionar.
 *
 * Los chequeos de arriba cubren el caso normal, pero no son atómicos: entre el
 * SELECT y el INSERT otro admin puede haber tomado el nombre o la sigla. Los
 * índices únicos de la base son la garantía real, y acá se traduce su error.
 */
function traducir(mensaje: string, codigo?: string): string {
  // OJO CON LOS NOMBRES DE ÍNDICE. La base tiene desplegados
  // `issue_types_abbrev_activos_key` y `labels_name_lower_key`, mientras que
  // 20260824000100_catalogo_editable.sql declara `issue_types_abbrev_activa` y
  // `labels_nombre_unico`. Son los mismos índices con nombres distintos: la
  // base se migró antes de que el archivo quedara con su nombre final. El
  // patrón de abajo cubre las DOS formas a propósito —`abbrev_activ` es el
  // prefijo común de "activa" y "activos"— porque un regex que solo cubra una
  // deja salir el 23505 crudo de Postgres al usuario, que es exactamente lo
  // que esta función existe para evitar.
  if (/issue_types_abbrev_activ|issue_types_abbrev_activos_key/.test(mensaje)) {
    return 'Otro tipo activo ya usa esa sigla. Elegí otra.'
  }
  if (/issue_types_abbrev_len/.test(mensaje)) {
    return 'La sigla tiene que tener 1 a 3 caracteres.'
  }
  if (/issue_types_name_key/.test(mensaje)) {
    return 'Ya existe un tipo con ese nombre. Revisá si está archivado más abajo.'
  }
  if (/labels_name_lower_key|labels_nombre_unico|labels_name_key/.test(mensaje)) {
    return 'Ya existe una etiqueta con ese nombre, sin distinguir mayúsculas.'
  }
  if (codigo === '23505' || /duplicate key|unique/i.test(mensaje)) {
    return 'Ya existe uno con ese nombre. Revisá si está archivado más abajo.'
  }
  // `on delete restrict` de issues.type_id. No debería llegar acá —`borrarTipo`
  // cuenta los tickets antes— pero si dos admin borran a la vez, este es el
  // error que llega, y "violates foreign key constraint" no le dice nada a nadie.
  if (codigo === '23503' || /foreign key|viola/i.test(mensaje)) {
    return 'Tiene tickets que lo usan, así que no se puede borrar. Archivalo.'
  }
  return mensaje
}

/**
 * Cuenta los tickets de un tipo. Es lo que decide si la interfaz ofrece
 * "Borrar" o "Archivar", y lo que `borrarTipo` chequea antes de intentar.
 *
 * `head: true` con `count: 'exact'`: no se necesitan las filas, solo cuántas
 * son, y algunos tipos podrían tener miles.
 */
async function contarTickets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  typeId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from('issues')
    .select('id', { count: 'exact', head: true })
    .eq('type_id', typeId)

  return error ? null : (count ?? 0)
}

/* -------------------------------------------------------------------------- */
/* Tipos de ticket                                                            */
/* -------------------------------------------------------------------------- */

export async function crearTipo(datos: {
  nombre: string
  sigla: string
  color: string
}): Promise<Resultado> {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false, error: 'Solo un admin administra los tipos.' }

  const nombre = datos.nombre.trim().replace(/\s+/g, ' ')
  const sigla = datos.sigla.trim().toUpperCase()
  const color = normalizarColor(datos.color)

  if (!nombre) return { ok: false, error: 'El nombre no puede estar vacío.' }
  if (nombre.length > 40) return { ok: false, error: 'El nombre no puede pasar de 40 caracteres.' }
  if (!sigla) return { ok: false, error: 'La sigla no puede estar vacía.' }
  // El CHECK de la base admite 1 a 3; el diseño reserva 2 y la píldora mide
  // 19px de alto en la fila compacta. Se aceptan 1 a 3 y se sugieren 2.
  if (!/^[A-Z0-9]{1,3}$/.test(sigla)) {
    return { ok: false, error: 'La sigla son 1 a 3 letras o números, sin espacios.' }
  }
  if (!color) return { ok: false, error: 'Elegí un color de la paleta.' }

  const supabase = await createClient()

  // Se comparan los nombres y las siglas ya existentes —archivados incluidos—
  // antes de insertar. Los índices únicos de la base son la garantía real; este
  // chequeo existe para dar un mensaje útil ("ya existe, archivado: desarchivalo")
  // en vez de un error de constraint que no dice qué hacer.
  const { data: existentes, error: errorLectura } = await supabase
    .from('issue_types')
    .select('name, abbrev, archived, order')

  if (errorLectura) return { ok: false, error: errorLectura.message }

  const choqueNombre = (existentes ?? []).find((t) => plano(t.name) === plano(nombre))
  if (choqueNombre) {
    return {
      ok: false,
      error: choqueNombre.archived
        ? `Ya existe el tipo "${choqueNombre.name}", archivado. Desarchivalo en vez de crear otro.`
        : `Ya existe el tipo "${choqueNombre.name}".`,
    }
  }

  const choqueSigla = (existentes ?? []).find((t) => t.abbrev.toUpperCase() === sigla)
  if (choqueSigla) {
    return {
      ok: false,
      error: `La sigla ${sigla} ya la usa "${choqueSigla.name}". Elegí otra: la sigla es lo que se lee en la fila compacta.`,
    }
  }

  // Al final de la lista. El primer tipo (order = 1) es el default del
  // formulario de ticket nuevo, así que un tipo nuevo nunca se mete adelante.
  const orden = Math.max(0, ...(existentes ?? []).map((t) => t.order)) + 1

  const { error } = await supabase
    .from('issue_types')
    .insert({ name: nombre, abbrev: sigla, color, order: orden })

  if (error) return { ok: false, error: traducir(error.message, error.code) }

  revalidarCatalogo()
  return { ok: true }
}

/**
 * Archiva o desarchiva un tipo. Nunca borra: ver la cabecera del archivo.
 *
 * Archivar el último tipo activo dejaría el formulario de ticket nuevo sin
 * ninguna opción, así que se corta acá.
 */
export async function archivarTipo(id: string, archivado: boolean): Promise<Resultado> {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false, error: 'Solo un admin administra los tipos.' }

  const supabase = await createClient()

  if (archivado) {
    const { data: activos, error: errorLectura } = await supabase
      .from('issue_types')
      .select('id')
      .eq('archived', false)

    if (errorLectura) return { ok: false, error: errorLectura.message }
    if ((activos ?? []).length <= 1) {
      return {
        ok: false,
        error:
          'Es el único tipo activo: sin ninguno, no se podrían crear tickets. Creá otro primero.',
      }
    }
  }

  const { error } = await supabase.from('issue_types').update({ archived: archivado }).eq('id', id)

  // Desarchivar puede chocar con el índice de sigla única entre activos: otro
  // tipo pudo tomar esa sigla mientras este estaba archivado.
  if (error) return { ok: false, error: traducir(error.message, error.code) }

  revalidarCatalogo()
  return { ok: true }
}

/** Recolorear un tipo existente: el color no es dato histórico, la identidad sí. */
export async function cambiarColorTipo(id: string, color: string): Promise<Resultado> {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false, error: 'Solo un admin administra los tipos.' }

  const hex = normalizarColor(color)
  if (!hex) return { ok: false, error: 'Ese color no está en la paleta.' }

  const supabase = await createClient()
  const { error } = await supabase.from('issue_types').update({ color: hex }).eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidarCatalogo()
  return { ok: true }
}

/**
 * Edita nombre, sigla y color de un tipo existente, en una sola operación.
 *
 * POR QUÉ UNA ACCIÓN Y NO TRES
 *
 * `cambiarColorTipo` existe aparte porque recolorear es un clic en la rejilla y
 * no tiene nada que validar contra el resto del catálogo. El nombre y la sigla
 * sí: los dos son únicos, así que si se guardaran por separado, cambiar
 * "Campaña / CA" por "Cliente / CL" podría dejar el tipo con nombre nuevo y
 * sigla vieja si el segundo update falla. Un solo UPDATE es atómico.
 *
 * SE EXCLUYE A SÍ MISMO DE LOS CHEQUEOS DE UNICIDAD
 *
 * `.neq('id', id)` en la comparación: sin eso, guardar el tipo sin tocar el
 * nombre chocaría consigo mismo y la edición sería imposible. Vale también para
 * cambiar solo las mayúsculas ("campaña" → "Campaña"), que es un caso real.
 */
export async function editarTipo(
  id: string,
  datos: { nombre: string; sigla: string; color: string },
): Promise<Resultado> {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false, error: 'Solo un admin administra los tipos.' }

  const nombre = datos.nombre.trim().replace(/\s+/g, ' ')
  const sigla = datos.sigla.trim().toUpperCase()
  const color = normalizarColor(datos.color)

  if (!nombre) return { ok: false, error: 'El nombre no puede estar vacío.' }
  if (nombre.length > 40) return { ok: false, error: 'El nombre no puede pasar de 40 caracteres.' }
  if (!sigla) return { ok: false, error: 'La sigla no puede estar vacía.' }
  if (!/^[A-Z0-9]{1,3}$/.test(sigla)) {
    return { ok: false, error: 'La sigla son 1 a 3 letras o números, sin espacios.' }
  }
  if (!color) return { ok: false, error: 'Elegí un color de la paleta.' }

  const supabase = await createClient()

  const { data: otros, error: errorLectura } = await supabase
    .from('issue_types')
    .select('id, name, abbrev, archived')
    .neq('id', id)

  if (errorLectura) return { ok: false, error: errorLectura.message }

  const choqueNombre = (otros ?? []).find((t) => plano(t.name) === plano(nombre))
  if (choqueNombre) {
    return {
      ok: false,
      error: choqueNombre.archived
        ? `Ya existe el tipo "${choqueNombre.name}", archivado. Cambiale el nombre a ese o elegí otro.`
        : `Ya existe el tipo "${choqueNombre.name}".`,
    }
  }

  // La sigla solo tiene que ser única entre ACTIVOS: el índice de la base es
  // parcial (`where archived = false`). Un tipo archivado puede compartir sigla
  // sin romper nada, y bloquearlo agotaría el espacio de siglas con el tiempo.
  const choqueSigla = (otros ?? []).find(
    (t) => !t.archived && t.abbrev.toUpperCase() === sigla,
  )
  if (choqueSigla) {
    return {
      ok: false,
      error: `La sigla ${sigla} ya la usa "${choqueSigla.name}". Elegí otra: la sigla es lo que se lee en la fila compacta.`,
    }
  }

  const { error } = await supabase
    .from('issue_types')
    .update({ name: nombre, abbrev: sigla, color })
    .eq('id', id)

  if (error) return { ok: false, error: traducir(error.message, error.code) }

  revalidarCatalogo()
  return { ok: true }
}

/**
 * Borra un tipo, pero SOLO si no tiene ni un ticket.
 *
 * `issues.type_id` es `on delete restrict`, así que con tickets la base lo
 * rechaza de todos modos. La cuenta previa no está para hacer posible lo
 * imposible: está para que el admin lea "tiene 3 tickets, archivalo" en vez de
 * "update or delete on table violates foreign key constraint".
 *
 * También se corta el borrado del último tipo activo, por la misma razón que
 * `archivarTipo`: sin ningún tipo no se puede crear un ticket. Y ahí la
 * salida no es archivar —archivar deja el mismo agujero— sino crear otro primero.
 */
export async function borrarTipo(id: string): Promise<Resultado> {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false, error: 'Solo un admin administra los tipos.' }

  const supabase = await createClient()

  const { data: tipo, error: errorTipo } = await supabase
    .from('issue_types')
    .select('name, archived')
    .eq('id', id)
    .maybeSingle()

  if (errorTipo) return { ok: false, error: errorTipo.message }
  if (!tipo) return { ok: false, error: 'Ese tipo ya no existe. Recargá la pantalla.' }

  const tickets = await contarTickets(supabase, id)
  if (tickets === null) {
    return { ok: false, error: 'No se pudo verificar si tiene tickets. Probá de nuevo.' }
  }
  if (tickets > 0) {
    return {
      ok: false,
      error: `"${tipo.name}" tiene ${plural(tickets, 'ticket', 'tickets')} y no se puede borrar: los reportes lo siguen necesitando. Archivalo en vez de borrarlo.`,
    }
  }

  // Solo importa si el tipo está activo: borrar uno archivado no cambia lo que
  // el formulario de ticket nuevo ofrece.
  if (!tipo.archived) {
    const { data: activos, error: errorActivos } = await supabase
      .from('issue_types')
      .select('id')
      .eq('archived', false)

    if (errorActivos) return { ok: false, error: errorActivos.message }
    if ((activos ?? []).length <= 1) {
      return {
        ok: false,
        error:
          'Es el único tipo activo: sin ninguno, no se podrían crear tickets. Creá otro primero.',
      }
    }
  }

  const { error } = await supabase.from('issue_types').delete().eq('id', id)
  if (error) return { ok: false, error: traducir(error.message, error.code) }

  revalidarCatalogo()
  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/* Etiquetas                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Las etiquetas NO llevan sigla: el chip muestra el nombre completo, así que
 * una abreviatura no tendría dónde verse. Por eso el formulario es nombre +
 * color y nada más.
 */
export async function crearEtiqueta(datos: { nombre: string; color: string }): Promise<Resultado> {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false, error: 'Solo un admin administra las etiquetas.' }

  const nombre = datos.nombre.trim().replace(/\s+/g, ' ')
  const color = normalizarColor(datos.color)

  if (!nombre) return { ok: false, error: 'El nombre no puede estar vacío.' }
  // El chip de etiqueta no recorta: mide lo que mide el texto, y en la celda de
  // la tabla conviven hasta dos más un "+N".
  if (nombre.length > 24) {
    return { ok: false, error: 'El nombre no puede pasar de 24 caracteres: el chip no lo recorta.' }
  }
  if (!color) return { ok: false, error: 'Elegí un color de la paleta.' }

  const supabase = await createClient()

  const { data: existentes, error: errorLectura } = await supabase
    .from('labels')
    .select('name, archived')

  if (errorLectura) return { ok: false, error: errorLectura.message }

  const choque = (existentes ?? []).find((l) => plano(l.name) === plano(nombre))
  if (choque) {
    return {
      ok: false,
      error: choque.archived
        ? `Ya existe la etiqueta "${choque.name}", archivada. Desarchivala en vez de crear otra.`
        : `Ya existe la etiqueta "${choque.name}".`,
    }
  }

  const { error } = await supabase.from('labels').insert({ name: nombre, color })

  if (error) return { ok: false, error: traducir(error.message, error.code) }

  revalidarCatalogo()
  return { ok: true }
}

/**
 * Archiva o desarchiva una etiqueta.
 *
 * A diferencia de los tipos, acá no hay mínimo: un tablero sin ninguna etiqueta
 * activa funciona perfectamente, las etiquetas son opcionales en el ticket.
 */
export async function archivarEtiqueta(id: string, archivado: boolean): Promise<Resultado> {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false, error: 'Solo un admin administra las etiquetas.' }

  const supabase = await createClient()
  const { error } = await supabase.from('labels').update({ archived: archivado }).eq('id', id)

  if (error) return { ok: false, error: traducir(error.message, error.code) }

  revalidarCatalogo()
  return { ok: true }
}

export async function cambiarColorEtiqueta(id: string, color: string): Promise<Resultado> {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false, error: 'Solo un admin administra las etiquetas.' }

  const hex = normalizarColor(color)
  if (!hex) return { ok: false, error: 'Ese color no está en la paleta.' }

  const supabase = await createClient()
  const { error } = await supabase.from('labels').update({ color: hex }).eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidarCatalogo()
  return { ok: true }
}

/**
 * Edita nombre y color de una etiqueta. Sin sigla: el chip muestra el nombre
 * completo, ver `crearEtiqueta`.
 *
 * La unicidad es case-insensitive porque el índice de la base es
 * `lower(name)`. El chequeo previo compara además sin tildes, que el índice no
 * hace: "orgánico" y "organico" pasarían el índice y son la misma etiqueta para
 * cualquiera que las lea. Se excluye a sí misma con `.neq('id', id)`, sin lo
 * cual cambiar "email" a "Email" —solo la mayúscula— sería imposible.
 */
export async function editarEtiqueta(
  id: string,
  datos: { nombre: string; color: string },
): Promise<Resultado> {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false, error: 'Solo un admin administra las etiquetas.' }

  const nombre = datos.nombre.trim().replace(/\s+/g, ' ')
  const color = normalizarColor(datos.color)

  if (!nombre) return { ok: false, error: 'El nombre no puede estar vacío.' }
  if (nombre.length > 24) {
    return { ok: false, error: 'El nombre no puede pasar de 24 caracteres: el chip no lo recorta.' }
  }
  if (!color) return { ok: false, error: 'Elegí un color de la paleta.' }

  const supabase = await createClient()

  const { data: otras, error: errorLectura } = await supabase
    .from('labels')
    .select('id, name, archived')
    .neq('id', id)

  if (errorLectura) return { ok: false, error: errorLectura.message }

  const choque = (otras ?? []).find((l) => plano(l.name) === plano(nombre))
  if (choque) {
    return {
      ok: false,
      error: choque.archived
        ? `Ya existe la etiqueta "${choque.name}", archivada. Cambiale el nombre a ella o elegí otro.`
        : `Ya existe la etiqueta "${choque.name}".`,
    }
  }

  const { error } = await supabase.from('labels').update({ name: nombre, color }).eq('id', id)

  if (error) return { ok: false, error: traducir(error.message, error.code) }

  revalidarCatalogo()
  return { ok: true }
}

/**
 * Borra una etiqueta de verdad, y con ella sus asignaciones.
 *
 * ACÁ SÍ SE BORRA, Y NO ES UN DESCUIDO
 *
 * `issue_labels` cascadea, así que el borrado funciona incluso con la etiqueta
 * en uso: los tickets simplemente dejan de tenerla. No hay dato histórico que
 * se rompa —una etiqueta no aparece en ningún reporte agregado como el tipo— y
 * a diferencia de `issues.type_id`, nada queda apuntando al vacío.
 *
 * Lo irreversible es qué tickets la tenían: eso no se puede reconstruir. Por eso
 * la interfaz confirma con el conteo a la vista, y por eso esta acción devuelve
 * cuántas asignaciones se llevó — el indicador de guardado no lo muestra, pero
 * sirve para que quien llama pueda decirlo si hace falta.
 */
export async function borrarEtiqueta(
  id: string,
): Promise<{ ok: true; usos: number } | { ok: false; error: string }> {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false, error: 'Solo un admin administra las etiquetas.' }

  const supabase = await createClient()

  const { data: etiqueta, error: errorEtiqueta } = await supabase
    .from('labels')
    .select('name')
    .eq('id', id)
    .maybeSingle()

  if (errorEtiqueta) return { ok: false, error: errorEtiqueta.message }
  if (!etiqueta) return { ok: false, error: 'Esa etiqueta ya no existe. Recargá la pantalla.' }

  // Se cuenta ANTES del delete: después la cascada ya se las llevó y el conteo
  // daría cero siempre.
  const { count } = await supabase
    .from('issue_labels')
    .select('issue_id', { count: 'exact', head: true })
    .eq('label_id', id)

  const { error } = await supabase.from('labels').delete().eq('id', id)
  if (error) return { ok: false, error: traducir(error.message, error.code) }

  revalidarCatalogo()
  return { ok: true, usos: count ?? 0 }
}
