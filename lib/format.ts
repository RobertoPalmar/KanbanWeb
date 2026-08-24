/**
 * Formato de fechas y números, en español y sin dependencias.
 *
 * Todo lo numérico y categórico va en Plex Mono (clase `.mono-sm`), así que
 * estas funciones devuelven cadenas cortas y de ancho estable: "22 ago",
 * "hoy 12:20", "2 d de atraso".
 */

export const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

export const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

export const DIAS_LARGOS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

/** `date` de Postgres viene como 'YYYY-MM-DD'; se parsea local, no UTC. */
export function parseFecha(iso: string | null): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function fechaCorta(iso: string | null): string {
  const d = parseFecha(iso)
  if (!d) return '—'
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]}`
}

/**
 * Fecha completa en español: "24 de agosto de 2026".
 *
 * Existe por el campo VENCE del panel. Un `<input type="date">` dibuja su
 * placeholder según el locale del NAVEGADOR, no según el `lang` del documento:
 * en un Chrome en inglés se lee "mm/dd/yyyy" dentro de una aplicación en
 * español, y no hay atributo ni CSS que lo cambie. La salida es leer la fecha
 * en texto cuando el campo no está enfocado, que además es más claro que
 * cualquier máscara numérica: "24 de agosto de 2026" no se puede malinterpretar
 * como día 8 del mes 24.
 */
export function fechaLarga(iso: string | null): string {
  const d = parseFecha(iso)
  if (!d) return '—'
  return `${d.getDate()} de ${MESES_LARGOS[d.getMonth()]} de ${d.getFullYear()}`
}

export function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Días entre hoy y la fecha: negativo = vencido. */
export function diasHasta(iso: string | null, hoy = new Date()): number | null {
  const d = parseFecha(iso)
  if (!d) return null
  const t = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((d.getTime() - t.getTime()) / 86_400_000)
}

/** Texto relativo para "Próximos vencimientos" del Panel. */
export function vencimientoRelativo(iso: string | null): string {
  const dias = diasHasta(iso)
  if (dias === null) return 'sin fecha'
  if (dias < 0) return `${Math.abs(dias)} d de atraso`
  if (dias === 0) return 'vence hoy'
  if (dias === 1) return 'en 1 d'
  return `en ${dias} d`
}

/** Marca de tiempo de comentarios e historial. */
export function momento(iso: string): string {
  const d = new Date(iso)
  const hoy = new Date()
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const mismoDia =
    d.getFullYear() === hoy.getFullYear() &&
    d.getMonth() === hoy.getMonth() &&
    d.getDate() === hoy.getDate()

  if (mismoDia) return `hoy ${hora}`

  const ayer = new Date(hoy)
  ayer.setDate(ayer.getDate() - 1)
  const esAyer =
    d.getFullYear() === ayer.getFullYear() &&
    d.getMonth() === ayer.getMonth() &&
    d.getDate() === ayer.getDate()

  if (esAyer) return `ayer ${hora}`

  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${hora}`
}

/** Concordancia de número: "1 vencido" / "3 vencidos". */
export function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`
}

export function tamanoArchivo(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

/** Suma de pesos: entera cuando puede, para no mostrar "21.0". */
export function suma(pesos: Array<number | null>): number {
  const total = pesos.reduce<number>((acc, p) => acc + (p ?? 0), 0)
  return Math.round(total * 10) / 10
}

/** Lunes de la semana de `d`. La semana arranca en lunes en el calendario. */
export function lunesDe(d: Date): Date {
  const copia = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dia = (copia.getDay() + 6) % 7
  copia.setDate(copia.getDate() - dia)
  return copia
}
