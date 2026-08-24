'use client'

// useState / useRouter / guardarNotificaciones solo los usaba la seccion de
// Notificaciones, desactivada mas abajo. Se reactivan al descomentarla.
// import { useState } from 'react'
// import { useRouter } from 'next/navigation'
import {
  guardarDensidad,
  // guardarNotificaciones,
  guardarPeso,
  guardarTema,
} from '@/app/actions/prefs'
import { FIBONACCI_WEIGHTS } from '@/lib/queries/catalog'
import { useGuardado } from '@/components/ui/ContextoGuardado'

// Forma de las preferencias de notificacion. Se sigue recibiendo por props
// desde app/(app)/ajustes/page.tsx para no romper la firma; el consumidor esta
// desactivado (ver seccion de Notificaciones mas abajo).
interface Notif {
  on_assigned: boolean
  on_mention: boolean
  daily_digest: boolean
}

export function Ajustes({
  prefs,
  pesoActivo,
  esAdmin,
  notif: _notif,
}: {
  prefs: { theme: 'claro' | 'oscuro'; density: 'compacta' | 'comoda' }
  pesoActivo: boolean
  esAdmin: boolean
  notif: Notif
}) {
  // El estado de guardado es de la pantalla, no de esta sección: lo pinta el
  // indicador global que monta `ProveedorGuardado`.
  const { guardar, estado } = useGuardado()

  const pendiente = estado === 'guardando'

  // Estado local de la seccion de Notificaciones (desactivada mas abajo):
  // const router = useRouter()
  // const [borrador, setBorrador] = useState<Notif>(_notif)
  // const sucio = JSON.stringify(borrador) !== JSON.stringify(_notif)

  return (
    <>
      <h1 className="titulo-vista" style={{ fontSize: 22 }}>
        Ajustes
      </h1>
      <p className="subtitulo">
        La visualización es tuya. El campo de peso y los tipos de trabajo son del equipo, y los
        cambia un admin.
      </p>

      <section className="tarjeta-panel" style={{ marginBottom: 14 }}>
        <h3 className="mono-xs">Visualización</h3>

        <div className="fila-ajuste">
          <span className="fila-ajuste-texto">
            <strong>Densidad</strong>
            <span>Cambia la altura de fila. Las columnas nunca se mueven.</span>
          </span>
          <div className="segmentado" role="group" aria-label="Densidad">
            <button
              type="button"
              aria-pressed={prefs.density === 'compacta'}
              disabled={pendiente}
              onClick={() => void guardar(() => guardarDensidad('compacta'))}
            >
              Compacta
            </button>
            <button
              type="button"
              aria-pressed={prefs.density === 'comoda'}
              disabled={pendiente}
              onClick={() => void guardar(() => guardarDensidad('comoda'))}
            >
              Cómoda
            </button>
          </div>
        </div>

        <div className="fila-ajuste">
          <span className="fila-ajuste-texto">
            <strong>Tema</strong>
            <span>La barra lateral queda oscura en los dos.</span>
          </span>
          <div className="segmentado" role="group" aria-label="Tema">
            <button
              type="button"
              aria-pressed={prefs.theme === 'claro'}
              disabled={pendiente}
              onClick={() => void guardar(() => guardarTema('claro'))}
            >
              Claro
            </button>
            <button
              type="button"
              aria-pressed={prefs.theme === 'oscuro'}
              disabled={pendiente}
              onClick={() => void guardar(() => guardarTema('oscuro'))}
            >
              Oscuro
            </button>
          </div>
        </div>

        <div className="fila-ajuste">
          <span className="fila-ajuste-texto">
            <strong>Campo de peso</strong>
            <span>
              Escala Fibonacci: {FIBONACCI_WEIGHTS.join(' · ')}. Al desactivarlo, el ancho liberado
              va al título y el dato histórico se conserva.
              {!esAdmin && ' Lo configura un admin.'}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            className="interruptor"
            aria-checked={pesoActivo}
            aria-label="Campo de peso"
            disabled={pendiente || !esAdmin}
            onClick={() => void guardar(() => guardarPeso(!pesoActivo))}
          >
            <span />
          </button>
        </div>
      </section>

      {/* Tipos de ticket y etiquetas viven en <Catalogo>, que la página monta
          aparte: son catálogos del equipo con alta y archivado propios, no
          preferencias de visualización. */}

      {/* Notificaciones: sección desactivada. El MVP 1 no envía nada todavía,
          así que los interruptores prometían algo que no pasa. Se reactiva
          junto con el envío, descomentando también los hooks de arriba y el
          componente Fila de abajo.

      <section className="tarjeta-panel">
        <h3 className="mono-xs">Notificaciones</h3>

        <Fila
          titulo="Me asignan un ticket"
          detalle="Correo y aviso en la aplicación."
          valor={borrador.on_assigned}
          onChange={(v) => setBorrador({ ...borrador, on_assigned: v })}
        />
        <Fila
          titulo="Comentan o me mencionan"
          detalle="Solo aviso en la aplicación."
          valor={borrador.on_mention}
          onChange={(v) => setBorrador({ ...borrador, on_mention: v })}
        />
        <Fila
          titulo="Resumen diario a las 8:00"
          detalle="Lo tuyo abierto y lo que vence esa semana."
          valor={borrador.daily_digest}
          onChange={(v) => setBorrador({ ...borrador, daily_digest: v })}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            className="btn-primario"
            disabled={!sucio || pendiente}
            onClick={async () => {
              if (await guardar(() => guardarNotificaciones(borrador))) router.refresh()
            }}
          >
            Guardar cambios
          </button>
          <button
            type="button"
            className="btn-secundario"
            disabled={!sucio || pendiente}
            onClick={() => setBorrador(notif)}
          >
            Descartar
          </button>
        </div>
      </section>
      */}
    </>
  )
}

/*
  Fila: interruptor de una preferencia. Solo lo usaba la seccion de
  Notificaciones, desactivada arriba. Se reactiva al descomentarla.

function Fila({
  titulo,
  detalle,
  valor,
  onChange,
}: {
  titulo: string
  detalle: string
  valor: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="fila-ajuste">
      <span className="fila-ajuste-texto">
        <strong>{titulo}</strong>
        <span>{detalle}</span>
      </span>
      <button
        type="button"
        role="switch"
        className="interruptor"
        aria-checked={valor}
        aria-label={titulo}
        onClick={() => onChange(!valor)}
      >
        <span />
      </button>
    </div>
  )
}
*/
