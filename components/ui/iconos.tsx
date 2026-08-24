/**
 * Íconos SVG inline, viewBox 0 0 14 14, trazo 1.4.
 *
 * No hay librería externa: son doce formas y el grosor óptico es parte del
 * diseño. Los cuatro de prioridad viven en lib/design-map.ts porque sus formas
 * son datos (se indexan por nombre de prioridad, no por posición).
 */

interface Props {
  size?: number
  className?: string
  strokeWidth?: number
}

function Svg({
  size = 14,
  className,
  strokeWidth = 1.4,
  children,
}: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconoPanel = (p: Props) => (
  <Svg {...p}>
    <rect x="1.5" y="7" width="2.6" height="5.5" rx="1" />
    <rect x="5.7" y="4" width="2.6" height="8.5" rx="1" />
    <rect x="9.9" y="1.5" width="2.6" height="11" rx="1" />
  </Svg>
)

export const IconoTickets = (p: Props) => (
  <Svg {...p}>
    <path d="M2 4h10M2 7h10M2 10h7" />
  </Svg>
)

export const IconoCalendario = (p: Props) => (
  <Svg {...p}>
    <rect x="1.8" y="2.8" width="10.4" height="9.4" rx="2" />
    <path d="M1.8 5.6h10.4M4.6 1.8v2M9.4 1.8v2" />
  </Svg>
)

export const IconoPersonas = (p: Props) => (
  <Svg {...p}>
    <circle cx="7" cy="5" r="2.4" />
    <path d="M2.6 12c0-2.4 2-4 4.4-4s4.4 1.6 4.4 4" />
  </Svg>
)

export const IconoAjustes = (p: Props) => (
  <Svg {...p}>
    <path d="M2 4.6h10M2 9.4h10" />
    <circle cx="5.4" cy="4.6" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="9" cy="9.4" r="1.5" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconoSistema = (p: Props) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="5.2" />
    <path d="M7 1.8v10.4" />
  </Svg>
)

export const IconoBandeja = (p: Props) => (
  <Svg {...p}>
    <path d="M1.8 8.6h3l.9 1.6h2.6l.9-1.6h3" />
    <path d="M3.4 2.4h7.2l1.6 6.2v2.2a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V8.6z" />
  </Svg>
)

export const IconoMas = (p: Props) => (
  <Svg {...p} strokeWidth={p.strokeWidth ?? 1.7}>
    <path d="M7 2.6v8.8M2.6 7h8.8" />
  </Svg>
)

export const IconoCerrar = (p: Props) => (
  <Svg {...p} strokeWidth={p.strokeWidth ?? 1.6}>
    <path d="M3.4 3.4l7.2 7.2M10.6 3.4l-7.2 7.2" />
  </Svg>
)

export const IconoBuscar = (p: Props) => (
  <Svg {...p}>
    <circle cx="6.2" cy="6.2" r="3.6" />
    <path d="M9 9l3 3" />
  </Svg>
)

export const IconoCaret = ({ abierto = true, ...p }: Props & { abierto?: boolean }) => (
  <Svg {...p} size={p.size ?? 12}>
    {abierto ? <path d="M3.5 5.5L7 9l3.5-3.5" /> : <path d="M5.5 3.5L9 7l-3.5 3.5" />}
  </Svg>
)

export const IconoUsuario = (p: Props) => (
  <Svg {...p}>
    <circle cx="7" cy="5.2" r="2.2" />
    <path d="M3 11.6c0-2 1.8-3.2 4-3.2s4 1.2 4 3.2" />
  </Svg>
)

export const IconoComentario = (p: Props) => (
  <Svg {...p}>
    <path d="M2 3.4h10v6H7.4L4.6 11.8V9.4H2z" />
  </Svg>
)

export const IconoElipsis = (p: Props) => (
  <Svg {...p}>
    <circle cx="3.2" cy="7" r=".9" fill="currentColor" stroke="none" />
    <circle cx="7" cy="7" r=".9" fill="currentColor" stroke="none" />
    <circle cx="10.8" cy="7" r=".9" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconoTema = (p: Props) => (
  <Svg {...p}>
    <path d="M7 1.8a5.2 5.2 0 1 0 5.2 5.2A3.9 3.9 0 0 1 7 1.8z" />
  </Svg>
)

export const IconoSubir = (p: Props) => (
  <Svg {...p} size={p.size ?? 16}>
    <path d="M7 10V3.4M4.4 6l2.6-2.6L9.6 6" />
    <path d="M2.4 11.4h9.2" />
  </Svg>
)

export const IconoEnlace = (p: Props) => (
  <Svg {...p}>
    <path d="M5.6 8.4l2.8-2.8" />
    <path d="M6.4 3.8l1-1a2.3 2.3 0 0 1 3.3 3.3l-1 1" />
    <path d="M7.6 10.2l-1 1a2.3 2.3 0 0 1-3.3-3.3l1-1" />
  </Svg>
)

export const IconoAbrir = (p: Props) => (
  <Svg {...p}>
    <path d="M8 2.4h3.6V6" />
    <path d="M11.6 2.4L6.8 7.2" />
    <path d="M11 8.6v2.4a.8.8 0 0 1-.8.8H3.2a.8.8 0 0 1-.8-.8V3.8a.8.8 0 0 1 .8-.8h2.4" />
  </Svg>
)

export const IconoCheck = (p: Props) => (
  <Svg {...p} strokeWidth={p.strokeWidth ?? 1.7}>
    <path d="M2.8 7.4l2.8 2.8 5.6-6" />
  </Svg>
)

/* Acciones de fila del catálogo. Mismo viewBox y trazo que el resto: las tres
   se ven juntas en una fila de 28px y cualquier diferencia de grosor se lee
   como que una está deshabilitada cuando no lo está. */

export const IconoLapiz = (p: Props) => (
  <Svg {...p}>
    <path d="M9.4 1.9l2.7 2.7-6.6 6.6-3.2.5.5-3.2z" />
    <path d="M8.1 3.2l2.7 2.7" />
  </Svg>
)

export const IconoPapelera = (p: Props) => (
  <Svg {...p}>
    <path d="M2.2 3.9h9.6" />
    <path d="M5.4 3.9V2.6a.7.7 0 0 1 .7-.7h1.8a.7.7 0 0 1 .7.7v1.3" />
    <path d="M3.5 3.9l.5 7.2a1 1 0 0 0 1 .9h4a1 1 0 0 0 1-.9l.5-7.2" />
    <path d="M5.9 6.1v3.6M8.1 6.1v3.6" />
  </Svg>
)

/** Caja con tapa: archivar. Se distingue de la papelera por la banda superior. */
export const IconoArchivar = (p: Props) => (
  <Svg {...p}>
    <rect x="1.7" y="2.1" width="10.6" height="2.8" rx=".8" />
    <path d="M2.8 4.9v6a1 1 0 0 0 1 1h6.4a1 1 0 0 0 1-1v-6" />
    <path d="M5.6 7.4h2.8" />
  </Svg>
)

/** Flecha saliendo de la caja: desarchivar. */
export const IconoDesarchivar = (p: Props) => (
  <Svg {...p}>
    <rect x="1.7" y="6.4" width="10.6" height="5.7" rx="1" />
    <path d="M7 4.6V1.4M5.2 3.2L7 1.4l1.8 1.8" />
  </Svg>
)

/** Círculo con una `i`: abre la explicación de un campo. */
export const IconoInfo = (p: Props) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="5.4" />
    <path d="M7 6.3v3.4" />
    <path d="M7 4.35v.1" />
  </Svg>
)
