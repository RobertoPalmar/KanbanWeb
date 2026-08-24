'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { salir } from '@/app/login/actions'
import { Avatar } from '@/components/ui/piezas'
import {
  IconoAjustes,
  IconoBandeja,
  IconoCalendario,
  IconoCerrar,
  IconoMarcador,
  IconoPanel,
  IconoPanelLateral,
  IconoPersonas,
  IconoReloj,
  IconoTickets,
  IconoUsuario,
} from '@/components/ui/iconos'

/**
 * Barra lateral permanente que se contrae y se expande.
 *
 * Antes era un cajón que solo existía cuando estaba abierto: cerrada, la
 * navegación no se veía en pantalla y la única pista de que existía era un
 * ícono de 14px en el header. Nadie descubría la barra.
 *
 * Ahora la barra está SIEMPRE en el layout en escritorio:
 *   · contraída (56px): solo los íconos, siempre a la vista
 *   · expandida (236px): íconos + etiquetas
 *
 * En pantallas de hasta 900px vuelve a ser un cajón superpuesto: 56px fijos son
 * una tajada cara en un teléfono, y ahí el ancho de la tabla vale más que el
 * atajo permanente.
 *
 * El estado vive en la cookie `nav`. La lee el layout en el servidor y la pasa
 * como prop, así que el primer HTML ya sale con el ancho correcto: no hay
 * parpadeo de hidratación. La escribe el cliente al alternar, sin ida y vuelta
 * al servidor.
 */

export const COOKIE_NAV = 'nav'

interface Datos {
  perfil: { id: string; name: string; role: string; job_title: string | null; avatar_url: string | null }
  orgName: string
  conteos: { mios: number; vencidos: number; borradores: number }
  /** Estado inicial leído de la cookie en el servidor. */
  contraidoInicial: boolean
}

interface Ctx extends Omit<Datos, 'contraidoInicial'> {
  contraido: boolean
  alternar: () => void
  /** Cajón móvil: solo se usa por debajo de 900px. */
  abierto: boolean
  abrir: () => void
  cerrar: () => void
}

const MenuCtx = createContext<Ctx | null>(null)

export function useMenuLateral() {
  const ctx = useContext(MenuCtx)
  if (!ctx) throw new Error('useMenuLateral fuera del provider')
  return ctx
}

const ITEMS = [
  { href: '/panel', label: 'Panel', Icono: IconoPanel },
  { href: '/tickets', label: 'Tickets', Icono: IconoTickets },
  { href: '/calendario', label: 'Calendario', Icono: IconoCalendario },
  { href: '/personas', label: 'Personas', Icono: IconoPersonas },
  { href: '/ajustes', label: 'Ajustes', Icono: IconoAjustes },
]

export function MenuLateralProvider({
  perfil,
  orgName,
  conteos,
  contraidoInicial,
  children,
}: Datos & { children: React.ReactNode }) {
  const [contraido, setContraido] = useState(contraidoInicial)
  const [abierto, setAbierto] = useState(false)
  const pathname = usePathname()

  const alternar = useCallback(() => {
    setContraido((v) => {
      const siguiente = !v
      // Un año: es una preferencia de interfaz, no un dato de sesión.
      // `SameSite=Lax` alcanza — no hay nada que proteger acá.
      document.cookie = `${COOKIE_NAV}=${siguiente ? 'min' : 'max'}; path=/; max-age=31536000; samesite=lax`
      return siguiente
    })
  }, [])

  const abrir = useCallback(() => setAbierto(true), [])
  const cerrar = useCallback(() => setAbierto(false), [])

  // Cambió la ruta: el cajón móvil ya cumplió su función. La barra permanente
  // no se toca — su estado es una preferencia, no algo por navegación.
  useEffect(() => {
    setAbierto(false)
  }, [pathname])

  const valor = useMemo<Ctx>(
    () => ({ perfil, orgName, conteos, contraido, alternar, abierto, abrir, cerrar }),
    [perfil, orgName, conteos, contraido, alternar, abierto, abrir, cerrar],
  )

  return (
    <MenuCtx.Provider value={valor}>
      <div className="app">
        <BarraLateral />
        <div className="contenido">{children}</div>
      </div>
      <CajonMovil />
    </MenuCtx.Provider>
  )
}

/**
 * Botón del header. Solo se ve por debajo de 900px, donde la navegación sigue
 * siendo un cajón: en escritorio la barra está a la vista y el botón sobra.
 * Conserva el punto de borradores, que es la única señal de cola pendiente que
 * se ve sin abrir nada.
 */
export function BotonMenu() {
  const { abrir, orgName, conteos } = useMenuLateral()
  const pendientes = conteos.borradores

  return (
    <button
      type="button"
      className="btn-menu"
      aria-label="Abrir menú de navegación"
      aria-haspopup="dialog"
      onClick={abrir}
    >
      <span className="nav-marca-cuadro" aria-hidden="true">
        {orgName.trim().charAt(0).toUpperCase() || 'C'}
      </span>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
        <path d="M2 4h10M2 7h10M2 10h10" />
      </svg>
      {pendientes > 0 && <span className="btn-menu-punto" aria-hidden="true" />}
    </button>
  )
}

/** La barra permanente de escritorio. */
function BarraLateral() {
  const { contraido, alternar, orgName } = useMenuLateral()

  return (
    <aside className="barra-lateral" data-contraido={contraido ? 'true' : undefined}>
      <div className="nav-marca">
        <span className="nav-marca-cuadro" aria-hidden="true">
          {orgName.trim().charAt(0).toUpperCase() || 'C'}
        </span>
        {!contraido && (
          <span className="nav-marca-texto" title={orgName}>
            {orgName}
          </span>
        )}
      </div>

      <Destinos contraido={contraido} />

      <button
        type="button"
        className="nav-alternar"
        aria-expanded={!contraido}
        aria-label={contraido ? 'Expandir barra de navegación' : 'Contraer barra de navegación'}
        title={contraido ? 'Expandir barra de navegación' : 'Contraer barra de navegación'}
        onClick={alternar}
      >
        <IconoPanelLateral contraido={contraido} />
        {!contraido && <span className="nav-label">Contraer</span>}
      </button>
    </aside>
  )
}

/**
 * El cajón de móvil. Se sigue montando solo cuando está abierto —es un diálogo
 * modal— y mantiene Escape, clic afuera, trampa de foco y retorno del foco.
 * Siempre expandido: en un overlay no hay ancho que ahorrar.
 */
function CajonMovil() {
  const { abierto, cerrar } = useMenuLateral()
  const cajon = useRef<HTMLElement>(null)
  const previo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!abierto) return

    previo.current = document.activeElement as HTMLElement | null
    // Al primer enlace, no al contenedor: así la primera flecha ya navega.
    cajon.current?.querySelector<HTMLElement>('a, button')?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        cerrar()
        return
      }

      if (e.key !== 'Tab') return

      // Trampa de foco: el cajón es `aria-modal`, el tabulador no debe salir.
      const foco = cajon.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      if (!foco || foco.length === 0) return

      const primero = foco[0]
      const ultimo = foco[foco.length - 1]

      if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      } else if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    const volver = previo.current
    return () => {
      document.removeEventListener('keydown', onKey, true)
      volver?.focus()
    }
  }, [abierto, cerrar])

  if (!abierto) return null

  return (
    <div className="cajon-overlay" onPointerDown={(e) => e.target === e.currentTarget && cerrar()}>
      <nav ref={cajon} className="cajon" role="dialog" aria-modal="true" aria-label="Navegación">
        <Marca alCerrar={cerrar} />
        <Destinos contraido={false} />
      </nav>
    </div>
  )
}

function Marca({ alCerrar }: { alCerrar: () => void }) {
  const { orgName } = useMenuLateral()

  return (
    <div className="nav-marca">
      <span className="nav-marca-cuadro" aria-hidden="true">
        {orgName.trim().charAt(0).toUpperCase() || 'C'}
      </span>
      <span className="nav-marca-texto" title={orgName}>
        {orgName}
      </span>
      <button
        type="button"
        className="btn-circular"
        style={{ marginLeft: 'auto', background: 'transparent', borderColor: 'transparent', color: 'var(--nav-fg)' }}
        aria-label="Cerrar menú"
        onClick={alCerrar}
      >
        <IconoCerrar />
      </button>
    </div>
  )
}

/**
 * Los destinos, compartidos por la barra y el cajón.
 *
 * Contraído, cada ícono lleva `title` + `aria-label`: el globo nativo no lo
 * recorta el `overflow: hidden` de `.app`/`.contenido` —lo dibuja el navegador
 * fuera del documento— y no cuesta un portal ni listeners por fila. `Pista` es
 * para explicar un concepto y se abre con clic; acá el clic tiene que navegar,
 * así que no encaja.
 */
function Destinos({ contraido }: { contraido: boolean }) {
  const { perfil, conteos } = useMenuLateral()
  const pathname = usePathname()
  const [pendiente, startTransition] = useTransition()

  const esAdmin = perfil.role === 'admin'
  const activo = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  // Contraído el texto no se ve: la etiqueta accesible pasa al atributo.
  const rotulo = (label: string) =>
    contraido ? { title: label, 'aria-label': label } : {}

  return (
    <nav className="nav-destinos" aria-label="Secciones">
      <ul className="nav-lista">
        {ITEMS.map(({ href, label, Icono }) => (
          <li key={href}>
            <Link
              href={href}
              className="nav-item"
              aria-current={activo(href) ? 'page' : undefined}
              {...rotulo(label)}
            >
              <Icono />
              {!contraido && <span className="nav-label">{label}</span>}
            </Link>
          </li>
        ))}

        {esAdmin && (
          <li>
            <Link
              href="/borradores"
              className="nav-item"
              aria-current={activo('/borradores') ? 'page' : undefined}
              {...rotulo(
                conteos.borradores > 0 ? `Borradores (${conteos.borradores})` : 'Borradores',
              )}
            >
              <IconoBandeja />
              {!contraido && <span className="nav-label">Borradores</span>}
              {conteos.borradores > 0 &&
                (contraido ? (
                  <span className="nav-punto" aria-hidden="true" />
                ) : (
                  <span className="nav-badge">{conteos.borradores}</span>
                ))}
            </Link>
          </li>
        )}
      </ul>

      {contraido ? (
        <div className="nav-separador" role="presentation" />
      ) : (
        <div className="nav-seccion">Vistas</div>
      )}

      <ul className="nav-lista">
        <li>
          <Link
            href="/tickets?mios=1"
            className="nav-item"
            {...rotulo(`Mis tickets (${conteos.mios})`)}
          >
            <IconoMarcador />
            {!contraido && (
              <>
                <span className="nav-label">Mis tickets</span>
                <span className="nav-item-cuenta">{conteos.mios}</span>
              </>
            )}
          </Link>
        </li>
        <li>
          <Link
            href="/tickets?vencidos=1"
            className="nav-item"
            {...rotulo(`Vencidos (${conteos.vencidos})`)}
          >
            <IconoReloj />
            {!contraido && (
              <>
                <span className="nav-label">Vencidos</span>
                <span
                  className="nav-item-cuenta"
                  style={{ color: conteos.vencidos ? 'var(--alerta)' : undefined }}
                >
                  {conteos.vencidos}
                </span>
              </>
            )}
          </Link>
        </li>
      </ul>

      <div className="nav-pie">
        <ul className="nav-lista">
          <li>
            <Link
              href="/perfil"
              className="nav-item"
              aria-current={activo('/perfil') ? 'page' : undefined}
              {...rotulo('Mi perfil')}
            >
              <IconoUsuario />
              {!contraido && <span className="nav-label">Mi perfil</span>}
            </Link>
          </li>
        </ul>

        {contraido ? (
          <div className="nav-pref" style={{ justifyContent: 'center', padding: 0, height: 34 }}>
            <Avatar
              persona={perfil}
              size={22}
              title={`${perfil.name} · ${etiquetaRol(perfil.role)}`}
            />
          </div>
        ) : (
          <div className="nav-pref" style={{ height: 34, gap: 8 }}>
            <Avatar persona={perfil} size={22} title={perfil.name} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {perfil.name.split(' ')[0]} · {etiquetaRol(perfil.role)}
            </span>
            <button
              type="button"
              style={{ marginLeft: 'auto' }}
              disabled={pendiente}
              onClick={() => startTransition(() => void salir())}
            >
              Salir
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

function etiquetaRol(role: string) {
  if (role === 'admin') return 'Admin'
  if (role === 'viewer') return 'Solo lectura'
  return 'Miembro'
}
