import Link from 'next/link'
import { getSesion } from '@/lib/auth'
import { IconoCalendario, IconoPanel, IconoTickets } from '@/components/ui/iconos'

/**
 * Portada pública.
 *
 * Existe por una razón concreta: un formulario de login sin contexto no dice a
 * qué se está entrando. Tres líneas y un botón — no es una página de marketing.
 */
export default async function Portada() {
  const sesion = await getSesion()

  return (
    <main className="portada">
      <div className="portada-caja">
        <div className="nav-marca" style={{ padding: 0 }}>
          <span className="nav-marca-cuadro" aria-hidden="true">
            C
          </span>
          <span className="nav-marca-texto" style={{ color: 'var(--tinta)' }}>
            {sesion?.settings.org_name ?? 'Comunicación'}
          </span>
        </div>

        <h1 className="portada-titulo">Gestión de trabajo</h1>

        <p className="portada-bajada">
          El tablero interno del departamento de comunicación social y mercadeo. Una sola cola
          de trabajo: quién lo hace, en qué estado está y cuándo vence.
        </p>

        <ul className="portada-lista">
          <li>
            <IconoTickets />
            <div>
              <strong>Tickets</strong>
              <span>Kanban de seis estados y tabla densa sobre los mismos datos.</span>
            </div>
          </li>
          <li>
            <IconoPanel />
            <div>
              <strong>Panel</strong>
              <span>Carga del equipo, vencimientos y tiempo de ciclo. Sin métricas de vanidad.</span>
            </div>
          </li>
          <li>
            <IconoCalendario />
            <div>
              <strong>Calendario</strong>
              <span>El mes por fecha de vencimiento, para ver la semana que viene.</span>
            </div>
          </li>
        </ul>

        <div className="portada-acciones">
          {sesion ? (
            <>
              <Link className="btn-primario" style={{ height: 34 }} href="/tickets">
                Ir al tablero
              </Link>
              <span className="mono-sm" style={{ color: 'var(--tinta-3)' }}>
                sesión de {sesion.perfil.name}
              </span>
            </>
          ) : (
            <>
              <Link className="btn-primario" style={{ height: 34 }} href="/login">
                Entrar
              </Link>
              <Link className="btn-secundario" style={{ height: 34 }} href="/registro">
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
