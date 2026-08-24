'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { guardarAvatar, guardarPerfil } from '@/app/actions/perfil'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/piezas'
import { IconoSubir } from '@/components/ui/iconos'
import { useGuardado } from '@/components/ui/ContextoGuardado'

const MAX_BYTES = 2 * 1024 * 1024
const TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

interface Datos {
  id: string
  name: string
  email: string
  role: string
  job_title: string | null
  capacity: number
  avatar_url: string | null
}

/**
 * Perfil propio.
 *
 * Nombre, cargo y foto son editables. Correo, rol y capacidad se muestran pero
 * no se tocan acá: el correo es la identidad de la cuenta, el rol lo asigna un
 * admin y la capacidad define la carga que el equipo ve en el tablero.
 *
 * La foto va al bucket `avatars`, en una carpeta con el uid propio: las
 * políticas de Storage solo permiten escribir ahí.
 *
 * Guardar, quitar la foto y subirla comparten el indicador global que monta
 * `ProveedorGuardado`. Antes había un `useTransition` único cuyo `pending` se
 * pintaba como `<Spinner>` en DOS botones, así que guardar los datos también
 * encendía el giro en "Quitar foto".
 */
export function Perfil({
  perfil,
  resumen,
}: {
  perfil: Datos
  resumen: { abiertos: number; enCurso: number; cerrados: number; puntosEnCurso: number }
}) {
  const router = useRouter()
  // El estado de guardado es de la pantalla, no de cada botón: lo pinta el
  // indicador global que monta `ProveedorGuardado`.
  const { guardar, estado } = useGuardado()
  const [nombre, setNombre] = useState(perfil.name)
  const [cargo, setCargo] = useState(perfil.job_title ?? '')

  const pendiente = estado === 'guardando'

  const sucio = nombre.trim() !== perfil.name || cargo.trim() !== (perfil.job_title ?? '')

  /**
   * Subir la foto también reporta al indicador global: es un guardado más, y
   * tener dos sitios donde mirar el resultado era justamente el problema. Lo
   * que sí cambia es el texto —"Subiendo foto…"— porque son dos tramos (el
   * archivo al bucket y después la URL a la base) sobre hasta 2 MB: un
   * "Guardando…" genérico durante varios segundos se lee como que algo se colgó.
   *
   * Las validaciones de tipo y tamaño no tocan la red, pero igual salen por
   * `guardar()`: si no, el único error que el usuario ve en otro lugar de la
   * pantalla sería justo este.
   */
  async function subirFoto(file: File | undefined) {
    if (!file) return

    if (!TIPOS.includes(file.type)) {
      await guardar(() =>
        Promise.resolve({ error: 'La foto tiene que ser PNG, JPG, WEBP o GIF.' }),
      )
      return
    }
    if (file.size > MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1)
      await guardar(() => Promise.resolve({ error: `La foto pesa ${mb} MB y el límite es 2 MB.` }))
      return
    }

    const ok = await guardar(async () => {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      // Ruta estable + `upsert`: cambiar la foto no deja archivos huérfanos.
      const path = `${perfil.id}/avatar.${ext}`

      const { error: subida } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (subida) return { error: subida.message }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // El query param rompe la caché del navegador: la URL pública no cambia
      // entre subidas y sin esto seguirías viendo la foto vieja.
      return guardarAvatar(`${data.publicUrl}?v=${Date.now()}`)
    }, 'Subiendo foto…')

    if (ok) router.refresh()
  }

  return (
    <>
      <h1 className="titulo-vista" style={{ fontSize: 22 }}>
        Mi perfil
      </h1>
      <p className="subtitulo">
        Tu nombre y tu foto son cómo te ve el resto del equipo en cada ticket. El rol y la
        capacidad los administra un admin.
      </p>

      <section className="tarjeta-panel" style={{ marginBottom: 14 }}>
        <h3 className="mono-xs">Foto</h3>

        <div className="perfil-foto">
          <Avatar persona={perfil} size={72} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--tinta-2)' }}>
              PNG, JPG, WEBP o GIF. Hasta 2 MB. Sin foto se usan tus iniciales, que es lo que ve
              la mayoría del equipo.
            </span>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label className="btn-secundario" style={{ cursor: 'pointer' }}>
                <IconoSubir size={13} />
                {perfil.avatar_url ? 'Cambiar foto' : 'Subir foto'}
                <input
                  type="file"
                  accept={TIPOS.join(',')}
                  hidden
                  disabled={pendiente}
                  onChange={(e) => void subirFoto(e.target.files?.[0])}
                />
              </label>

              {perfil.avatar_url && (
                <button
                  type="button"
                  className="btn-secundario"
                  disabled={pendiente}
                  onClick={async () => {
                    if (await guardar(() => guardarAvatar(null))) router.refresh()
                  }}
                >
                  Quitar foto
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="tarjeta-panel" style={{ marginBottom: 14 }}>
        <h3 className="mono-xs">Datos</h3>

        <div className="fila-ajuste">
          <span className="fila-ajuste-texto">
            <strong>Nombre y apellido</strong>
            <span>De acá salen las iniciales del avatar.</span>
          </span>
          <input
            className="campo campo-ajuste"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            aria-label="Nombre y apellido"
          />
        </div>

        <div className="fila-ajuste">
          <span className="fila-ajuste-texto">
            <strong>Cargo</strong>
            <span>Descriptivo, no permisos. Se ve en Personas.</span>
          </span>
          <input
            className="campo campo-ajuste"
            value={cargo}
            placeholder="Producción y eventos"
            onChange={(e) => setCargo(e.target.value)}
            aria-label="Cargo"
          />
        </div>

        <div className="fila-ajuste">
          <span className="fila-ajuste-texto">
            <strong>Correo</strong>
            <span>Es la identidad de tu cuenta y no se cambia desde acá.</span>
          </span>
          <input className="campo campo-ajuste" value={perfil.email} readOnly />
        </div>

        <div className="fila-ajuste">
          <span className="fila-ajuste-texto">
            <strong>Rol</strong>
            <span>Lo asigna un admin.</span>
          </span>
          <span className="chip-etiqueta" style={{ height: 24 }}>
            {etiquetaRol(perfil.role)}
          </span>
        </div>

        <div className="fila-ajuste">
          <span className="fila-ajuste-texto">
            <strong>Capacidad</strong>
            <span>Ocho puntos ≈ una semana de trabajo.</span>
          </span>
          <span className="mono-sm">{perfil.capacity} pt</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            className="btn-primario"
            disabled={!sucio || pendiente}
            onClick={async () => {
              if (await guardar(() => guardarPerfil({ nombre, cargo }))) router.refresh()
            }}
          >
            Guardar cambios
          </button>
          <button
            type="button"
            className="btn-secundario"
            disabled={!sucio || pendiente}
            onClick={() => {
              setNombre(perfil.name)
              setCargo(perfil.job_title ?? '')
            }}
          >
            Descartar
          </button>
        </div>
      </section>

      <section className="tarjeta-panel">
        <h3 className="mono-xs">Tu trabajo</h3>
        <div className="perfil-datos">
          <Dato valor={resumen.abiertos} etiqueta="abiertos" />
          <Dato valor={resumen.enCurso} etiqueta="en curso" />
          <Dato valor={resumen.puntosEnCurso} etiqueta="puntos en curso" />
          <Dato valor={resumen.cerrados} etiqueta="cerrados" />
        </div>
      </section>
    </>
  )
}

function Dato({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
        {valor}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--tinta-2)' }}>{etiqueta}</span>
    </span>
  )
}

function etiquetaRol(role: string) {
  if (role === 'admin') return 'Admin'
  if (role === 'viewer') return 'Solo lectura'
  return 'Miembro'
}
