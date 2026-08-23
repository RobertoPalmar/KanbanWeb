'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  guardarDensidad,
  guardarNotificaciones,
  guardarPeso,
  guardarTema,
} from '@/app/actions/prefs'
import { FIBONACCI_WEIGHTS } from '@/lib/queries/catalog'
import { typePillBackground } from '@/lib/design-map'
import { Spinner } from '@/components/ui/Spinner'

interface Tipo {
  id: string
  name: string
  abbrev: string
  color: string
  archived: boolean
}

interface Notif {
  on_assigned: boolean
  on_mention: boolean
  daily_digest: boolean
}

export function Ajustes({
  tipos,
  prefs,
  pesoActivo,
  esAdmin,
  notif,
}: {
  tipos: Tipo[]
  prefs: { theme: 'claro' | 'oscuro'; density: 'compacta' | 'comoda' }
  pesoActivo: boolean
  esAdmin: boolean
  notif: Notif
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [borrador, setBorrador] = useState<Notif>(notif)
  const [error, setError] = useState<string | null>(null)

  const sucio = JSON.stringify(borrador) !== JSON.stringify(notif)

  return (
    <>
      <h1 className="titulo-vista" style={{ fontSize: 22 }}>
        Ajustes
      </h1>
      <p className="subtitulo">
        La visualización es tuya. El campo de peso y los tipos de trabajo son del equipo, y los
        cambia un admin.
      </p>

      {error && <p className="error-caja" style={{ marginBottom: 14 }}>{error}</p>}

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
              onClick={() => startTransition(() => void guardarDensidad('compacta'))}
            >
              Compacta
            </button>
            <button
              type="button"
              aria-pressed={prefs.density === 'comoda'}
              disabled={pendiente}
              onClick={() => startTransition(() => void guardarDensidad('comoda'))}
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
              onClick={() => startTransition(() => void guardarTema('claro'))}
            >
              Claro
            </button>
            <button
              type="button"
              aria-pressed={prefs.theme === 'oscuro'}
              disabled={pendiente}
              onClick={() => startTransition(() => void guardarTema('oscuro'))}
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
            onClick={() =>
              startTransition(async () => {
                const res = await guardarPeso(!pesoActivo)
                if (res.error) setError(res.error)
              })
            }
          >
            <span />
          </button>
        </div>
      </section>

      <section className="tarjeta-panel" style={{ marginBottom: 14 }}>
        <h3 className="mono-xs">Tipos de ticket</h3>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--tinta-2)' }}>
          Los tipos se archivan, nunca se borran: un tipo con tickets históricos que desaparece
          rompe los reportes.
        </p>
        <div className="fila-opciones">
          {tipos.map((t) => (
            <span
              key={t.id}
              className="pill-tipo"
              style={{
                background: typePillBackground(t.color),
                color: t.color,
                height: 24,
                opacity: t.archived ? 0.45 : 1,
                textDecoration: t.archived ? 'line-through' : undefined,
              }}
              title={t.archived ? `${t.name} (archivado)` : t.name}
            >
              <span className="punto" style={{ background: t.color }} />
              {t.abbrev} · {t.name}
            </span>
          ))}
        </div>
      </section>

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
            onClick={() =>
              startTransition(async () => {
                const res = await guardarNotificaciones(borrador)
                if (res.error) setError(res.error)
                else router.refresh()
              })
            }
          >
            {pendiente && <Spinner label="Guardando" />}
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
    </>
  )
}

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
