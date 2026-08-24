/**
 * Paleta fija de catálogo: tipos de ticket y etiquetas.
 *
 * POR QUÉ UNA PALETA CERRADA Y NO UN SELECTOR DE HEX LIBRE
 *
 * El color de un tipo NO cambia entre temas: llega de la base por style inline
 * y es la excepción explícita a la regla de "ningún hex suelto" de globals.css.
 * Eso significa que un mismo valor tiene que ser legible sobre `--superficie`
 * de tema claro (#ffffff) Y de tema oscuro (#16181c). Con un input de color
 * libre el admin elige #FFEE00 y la píldora queda invisible en claro, o #22005A
 * e invisible en oscuro — y el error no se ve hasta que otra persona, con el
 * otro tema, abre el tablero.
 *
 * Los doce valores de abajo están calculados para maximizar el PEOR contraste
 * entre los dos temas: todos superan 3:1 contra `--superficie`, `--lienzo` y el
 * fondo real de la píldora (el propio color al 12 %, ver `typePillBackground`),
 * en claro y en oscuro. 3:1 es el mínimo de WCAG para texto grande o en negrita,
 * que es lo que son estas píldoras: 11px con font-weight 500 en fuente mono.
 *
 * No se pueden subir mucho más: un hex único servido a dos fondos opuestos tiene
 * un techo cerca de 3.7:1 — subir el contraste en un tema lo baja en el otro.
 * Por eso el color nunca es el único portador de significado: la píldora lleva
 * además la sigla y el punto, y el chip de etiqueta lleva el nombre.
 *
 * Los tonos salen de los que ya usaban los tipos sembrados (azul, violeta,
 * rosa, ámbar, verde, cian, gris, naranja) reajustados en luminosidad, más tres
 * hues nuevos (índigo, lima, teal) para que doce opciones se distingan entre sí.
 */

export interface ColorPaleta {
  /** Se guarda en `issue_types.color` / `labels.color`. Mayúsculas, 7 chars. */
  hex: string
  /** Para el `aria-label` y el `title` del botón de la rejilla. */
  nombre: string
}

export const PALETA_CATALOGO: readonly ColorPaleta[] = [
  { hex: '#1C74DE', nombre: 'Azul' },
  { hex: '#6366E8', nombre: 'Índigo' },
  { hex: '#9B4DE0', nombre: 'Violeta' },
  { hex: '#DB2777', nombre: 'Rosa' },
  { hex: '#DC2626', nombre: 'Rojo' },
  { hex: '#D2551F', nombre: 'Naranja' },
  { hex: '#A16207', nombre: 'Ámbar' },
  { hex: '#5F8A0B', nombre: 'Lima' },
  { hex: '#0E8A4F', nombre: 'Verde' },
  { hex: '#0D8B8B', nombre: 'Teal' },
  { hex: '#0E7C99', nombre: 'Cian' },
  { hex: '#6B7480', nombre: 'Gris' },
] as const

/** Default del formulario: el azul, mismo tono que el tipo por defecto. */
export const COLOR_PALETA_DEFECTO = PALETA_CATALOGO[0].hex

const HEX_VALIDOS = new Set(PALETA_CATALOGO.map((c) => c.hex))

/**
 * Valida contra la paleta y no contra `/^#[0-9a-f]{6}$/`.
 *
 * El server action recibe el hex del cliente, y un cliente modificado puede
 * mandar cualquier cosa. Un regex de forma aceptaría #FFFFFF, que es
 * exactamente el valor ilegible que la paleta existe para evitar.
 */
export function esColorDePaleta(hex: string): boolean {
  return HEX_VALIDOS.has(hex.toUpperCase())
}

/** Normaliza a la forma canónica de la paleta, o `null` si no pertenece. */
export function normalizarColor(hex: string): string | null {
  const arriba = hex.trim().toUpperCase()
  return HEX_VALIDOS.has(arriba) ? arriba : null
}

/** Nombre legible de un hex arbitrario; los tipos ya sembrados no están en la paleta. */
export function nombreColor(hex: string): string {
  return PALETA_CATALOGO.find((c) => c.hex === hex.toUpperCase())?.nombre ?? hex.toUpperCase()
}

/**
 * Sigla sugerida a partir del nombre.
 *
 * Dos palabras → inicial de cada una ("Diseño gráfico" → DG). Una sola palabra
 * → sus dos primeras letras ("Campaña" → CA). Se ignoran las conjunciones y la
 * barra que usan los nombres sembrados ("Publicación / Post" → PP, no P/).
 *
 * Es una SUGERENCIA: el campo queda editable porque el criterio real es que la
 * sigla se distinga de las que ya existen, y eso solo lo sabe quien las ve.
 */
export function siglaSugerida(nombre: string): string {
  const palabras = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[\s/·—–-]+/)
    .map((p) => p.replace(/[^A-Za-z0-9]/g, ''))
    .filter((p) => p.length > 0 && !['y', 'o', 'de', 'del', 'la', 'el'].includes(p.toLowerCase()))

  if (palabras.length === 0) return ''
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase()
  return (palabras[0][0] + palabras[1][0]).toUpperCase()
}
