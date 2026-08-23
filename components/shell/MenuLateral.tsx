'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
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
  IconoPanel,
  IconoPersonas,
  IconoTickets,
  IconoUsuario,
} from '@/components/ui/iconos'

/**
 * Navegación en cajón lateral, abierta desde el header.
 *
 * Antes era una barra fija de 196px. Con siete destinos y una herramienta que se
 * mira ocho horas por día, esos 196px son ancho que le falta a la tabla: el
 * cajón los devuelve y el destino se elige en un gesto.
 *
 * Se cierra al navegar, con Escape y al tocar fuera. El foco vuelve al botón.
 */

interface Datos {
  perfil: { id: string; name: string; role: string; job_title: string | null; avatar_url: string | null }
  orgName: string
  conteos: { mios: number; vencidos: number; borradores: number }
}

interface Ctx extends Datos {
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
  children,
}: Datos & { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const pathname = usePathname()

  const abrir = useCallback(() => setAbierto(true), [])
  const cerrar = useCallback(() => setAbierto(false), [])

  // Cambió la ruta: el cajón ya cumplió su función.
  useEffect(() => {
    setAbierto(false)
  }, [pathname])

  useEffect(() => {
    if (!abierto) return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setAbierto(false)
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [abierto])

  const valor = useMemo<Ctx>(
    () => ({ perfil, orgName, conteos, abierto, abrir, cerrar }),
    [perfil, orgName, conteos, abierto, abrir, cerrar],
  )

  return (
    <MenuCtx.Provider value={valor}>
      {children}
      <Cajon />
    </MenuCtx.Provider>
  )
}

/** Botón del header. Vive acá para compartir el contexto con el cajón. */
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

function Cajon() {
  const { abierto, cerrar, perfil, orgName, conteos } = useMenuLateral()
  const pathname = usePathname()
  const [pendiente, startTransition] = useTransition()

  if (!abierto) return null

  const esAdmin = perfil.role === 'admin'
  const activo = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className="cajon-overlay" onPointerDown={(e) => e.target === e.currentTarget && cerrar()}>
      <nav className="cajon" role="dialog" aria-modal="true" aria-label="Navegación">
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
            onClick={cerrar}
          >
            <IconoCerrar />
          </button>
        </div>

        {ITEMS.map(({ href, label, Icono }) => (
          <Link
            key={href}
            href={href}
            className="nav-item"
            aria-current={activo(href) ? 'page' : undefined}
          >
            <Icono />
            <span className="nav-label">{label}</span>
          </Link>
        ))}

        {esAdmin && (
          <Link
            href="/borradores"
            className="nav-item"
            aria-current={activo('/borradores') ? 'page' : undefined}
          >
            <IconoBandeja />
            <span className="nav-label">Borradores</span>
            {conteos.borradores > 0 && <span className="nav-badge">{conteos.borradores}</span>}
          </Link>
        )}

        <div className="nav-seccion">Vistas</div>

        <Link href="/tickets?mios=1" className="nav-item" style={{ fontSize: 12.5 }}>
          <span className="nav-label">Mis tickets</span>
          <span className="nav-item-cuenta">{conteos.mios}</span>
        </Link>

        <Link href="/tickets?vencidos=1" className="nav-item" style={{ fontSize: 12.5 }}>
          <span className="nav-label">Vencidos</span>
          <span
            className="nav-item-cuenta"
            style={{ color: conteos.vencidos ? 'var(--alerta)' : undefined }}
          >
            {conteos.vencidos}
          </span>
        </Link>

        <div className="nav-pie">
          <Link href="/perfil" className="nav-item" aria-current={activo('/perfil') ? 'page' : undefined}>
            <IconoUsuario />
            <span className="nav-label">Mi perfil</span>
          </Link>

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
        </div>
      </nav>
    </div>
  )
}

function etiquetaRol(role: string) {
  if (role === 'admin') return 'Admin'
  if (role === 'viewer') return 'Solo lectura'
  return 'Miembro'
}
