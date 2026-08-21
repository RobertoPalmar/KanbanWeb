/**
 * Parseo y validación del import CSV/XLSX.
 *
 * El flujo tiene dos pasos por diseño: primero `parseImportFile` produce un
 * preview con errores y advertencias, y solo si el usuario confirma se llama al
 * endpoint que escribe. Importar a ciegas un archivo de 200 filas mal mapeadas
 * es exactamente lo que arruina la confianza en la herramienta el primer día.
 */

import * as XLSX from 'xlsx'
import { STATE_KEYS, type StateKey, isStateKey, STATES } from '@/lib/states'

/** Columnas reconocidas. La clave es el nombre en el archivo, en minúsculas. */
const COLUMN_ALIASES: Record<string, string> = {
  'id externo': 'external_id',
  'external_id': 'external_id',
  'id': 'external_id',
  'titulo': 'title',
  'título': 'title',
  'title': 'title',
  'descripcion': 'description',
  'descripción': 'description',
  'description': 'description',
  'tipo': 'type',
  'type': 'type',
  'estado': 'state',
  'state': 'state',
  'responsable': 'owner',
  'owner': 'owner',
  'asignado': 'owner',
  'prioridad': 'priority',
  'priority': 'priority',
  'peso': 'weight',
  'weight': 'weight',
  'vencimiento': 'due_date',
  'fecha de vencimiento': 'due_date',
  'due_date': 'due_date',
  'etiquetas': 'labels',
  'labels': 'labels',
}

/** Etiqueta visible → clave de estado. El archivo trae "En progreso", no "in_progress". */
const LABEL_TO_STATE: Record<string, StateKey> = Object.fromEntries(
  STATE_KEYS.map((k) => [STATES[k].label.toLowerCase(), k]),
) as Record<string, StateKey>

export interface ImportRow {
  rowNumber: number
  external_id?: string
  title: string
  description?: string
  type?: string
  state: StateKey
  owner?: string
  priority?: string
  weight?: number
  due_date?: string
  labels?: string[]
}

export interface ImportIssue {
  rowNumber: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface ImportPreview {
  rows: ImportRow[]
  problems: ImportIssue[]
  /** Filas que ya existen por external_id: se actualizarán en vez de duplicar. */
  willUpdate: number
  willCreate: number
  canProceed: boolean
}

function normalizeHeader(h: string): string | null {
  const key = h.trim().toLowerCase()
  return COLUMN_ALIASES[key] ?? null
}

function parseDate(value: unknown): string | null {
  if (!value) return null

  // Excel guarda fechas como número de serie.
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }

  const s = String(value).trim()
  if (!s) return null

  // dd/mm/yyyy — el formato que escribe la gente acá.
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]

  return null
}

export function parseImportFile(
  buffer: ArrayBuffer,
  knownExternalIds: Set<string> = new Set(),
): ImportPreview {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

  const rows: ImportRow[] = []
  const problems: ImportIssue[] = []
  let willUpdate = 0
  let willCreate = 0

  if (raw.length === 0) {
    problems.push({
      rowNumber: 0,
      field: '-',
      message: 'El archivo no tiene filas de datos',
      severity: 'error',
    })
    return { rows, problems, willUpdate, willCreate, canProceed: false }
  }

  // Mapear encabezados una sola vez.
  const headerMap = new Map<string, string>()
  for (const h of Object.keys(raw[0])) {
    const mapped = normalizeHeader(h)
    if (mapped) headerMap.set(h, mapped)
  }

  if (!Array.from(headerMap.values()).includes('title')) {
    problems.push({
      rowNumber: 0,
      field: 'titulo',
      message:
        'No se encontró la columna de título. Debe llamarse "Título", "Titulo" o "Title".',
      severity: 'error',
    })
    return { rows, problems, willUpdate, willCreate, canProceed: false }
  }

  const seenExternalIds = new Set<string>()

  raw.forEach((r, i) => {
    // +2: la fila 1 son los encabezados y las hojas se numeran desde 1.
    const rowNumber = i + 2
    const get = (field: string): unknown => {
      for (const [orig, mapped] of headerMap) {
        if (mapped === field) return r[orig]
      }
      return null
    }

    const title = String(get('title') ?? '').trim()
    if (!title) {
      problems.push({
        rowNumber,
        field: 'titulo',
        message: 'El título está vacío — la fila se omite',
        severity: 'error',
      })
      return
    }

    // Estado: acepta clave o etiqueta visible. Sin estado, va a "Por hacer".
    let state: StateKey = 'todo'
    const rawState = String(get('state') ?? '').trim()
    if (rawState) {
      const lower = rawState.toLowerCase()
      if (isStateKey(lower)) {
        state = lower
      } else if (LABEL_TO_STATE[lower]) {
        state = LABEL_TO_STATE[lower]
      } else {
        problems.push({
          rowNumber,
          field: 'estado',
          message: `Estado "${rawState}" no reconocido — se importa como "Por hacer"`,
          severity: 'warning',
        })
      }
    }

    const externalId = String(get('external_id') ?? '').trim() || undefined

    if (externalId) {
      if (seenExternalIds.has(externalId)) {
        problems.push({
          rowNumber,
          field: 'id externo',
          message: `El ID "${externalId}" está repetido dentro del archivo — se omite esta fila`,
          severity: 'error',
        })
        return
      }
      seenExternalIds.add(externalId)

      if (knownExternalIds.has(externalId)) willUpdate++
      else willCreate++
    } else {
      willCreate++
      problems.push({
        rowNumber,
        field: 'id externo',
        message:
          'Sin ID externo: si volvés a importar este archivo, esta fila se duplicará',
        severity: 'warning',
      })
    }

    const rawWeight = get('weight')
    let weight: number | undefined
    if (rawWeight !== null && rawWeight !== '') {
      const n = Number(rawWeight)
      if (Number.isFinite(n)) weight = n
      else
        problems.push({
          rowNumber,
          field: 'peso',
          message: `Peso "${rawWeight}" no es un número — se ignora`,
          severity: 'warning',
        })
    }

    const rawDue = get('due_date')
    const dueDate = parseDate(rawDue)
    if (rawDue && !dueDate) {
      problems.push({
        rowNumber,
        field: 'vencimiento',
        message: `No se pudo interpretar la fecha "${rawDue}" — se ignora. Formatos válidos: dd/mm/aaaa o aaaa-mm-dd`,
        severity: 'warning',
      })
    }

    const rawLabels = String(get('labels') ?? '').trim()

    rows.push({
      rowNumber,
      external_id: externalId,
      title,
      description: String(get('description') ?? '').trim() || undefined,
      type: String(get('type') ?? '').trim() || undefined,
      state,
      owner: String(get('owner') ?? '').trim() || undefined,
      priority: String(get('priority') ?? '').trim() || undefined,
      weight,
      due_date: dueDate ?? undefined,
      labels: rawLabels ? rawLabels.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : undefined,
    })
  })

  return {
    rows,
    problems,
    willUpdate,
    willCreate,
    canProceed: rows.length > 0,
  }
}
