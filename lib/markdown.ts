/**
 * Markdown mínimo: párrafos, listas, negrita, cursiva y `code` inline.
 *
 * Es lo que el handoff dibuja y nada más. Se escapa primero y se transforma
 * después, así que el texto del usuario nunca puede inyectar HTML — es la razón
 * de no usar `dangerouslySetInnerHTML` con una librería completa para cuatro
 * marcas.
 */

export type Bloque =
  | { tipo: 'p'; texto: string }
  | { tipo: 'ul'; items: string[] }
  | { tipo: 'ol'; items: string[] }

export function parsearMarkdown(fuente: string): Bloque[] {
  const bloques: Bloque[] = []
  const lineas = fuente.replace(/\r\n/g, '\n').split('\n')

  let parrafo: string[] = []
  let lista: { tipo: 'ul' | 'ol'; items: string[] } | null = null

  const cerrarParrafo = () => {
    if (parrafo.length) {
      bloques.push({ tipo: 'p', texto: parrafo.join(' ') })
      parrafo = []
    }
  }

  const cerrarLista = () => {
    if (lista) {
      bloques.push({ tipo: lista.tipo, items: lista.items })
      lista = null
    }
  }

  for (const linea of lineas) {
    const t = linea.trim()

    if (!t) {
      cerrarParrafo()
      cerrarLista()
      continue
    }

    const vinieta = /^[-*]\s+(.*)$/.exec(t)
    const numerada = /^\d+[.)]\s+(.*)$/.exec(t)

    if (vinieta) {
      cerrarParrafo()
      if (lista?.tipo !== 'ul') {
        cerrarLista()
        lista = { tipo: 'ul', items: [] }
      }
      lista.items.push(vinieta[1])
      continue
    }

    if (numerada) {
      cerrarParrafo()
      if (lista?.tipo !== 'ol') {
        cerrarLista()
        lista = { tipo: 'ol', items: [] }
      }
      lista.items.push(numerada[1])
      continue
    }

    cerrarLista()
    parrafo.push(t)
  }

  cerrarParrafo()
  cerrarLista()

  return bloques
}

export type Trozo =
  | { tipo: 'texto'; valor: string }
  | { tipo: 'fuerte'; valor: string }
  | { tipo: 'enfasis'; valor: string }
  | { tipo: 'codigo'; valor: string }
  | { tipo: 'mencion'; valor: string }

/** Divide una línea en trozos con formato; sin anidamiento, que no hace falta. */
export function parsearLinea(texto: string): Trozo[] {
  const trozos: Trozo[] = []
  const patron = /(`[^`]+`)|(\*\*[^*]+\*\*)|(_[^_]+_)|(@[\wÁÉÍÓÚÑáéíóúñ.\-]+)/g

  let ultimo = 0
  let m: RegExpExecArray | null

  while ((m = patron.exec(texto)) !== null) {
    if (m.index > ultimo) trozos.push({ tipo: 'texto', valor: texto.slice(ultimo, m.index) })

    if (m[1]) trozos.push({ tipo: 'codigo', valor: m[1].slice(1, -1) })
    else if (m[2]) trozos.push({ tipo: 'fuerte', valor: m[2].slice(2, -2) })
    else if (m[3]) trozos.push({ tipo: 'enfasis', valor: m[3].slice(1, -1) })
    else if (m[4]) trozos.push({ tipo: 'mencion', valor: m[4] })

    ultimo = patron.lastIndex
  }

  if (ultimo < texto.length) trozos.push({ tipo: 'texto', valor: texto.slice(ultimo) })

  return trozos
}
