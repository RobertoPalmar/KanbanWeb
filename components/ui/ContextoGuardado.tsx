'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * Estado de guardado compartido por una vista entera.
 *
 * Lo usan Ajustes y Mi perfil, y por eso vive en `components/ui/`: no es una
 * pieza de una ruta, es el indicador de guardado de la aplicación.
 *
 * Ajustes no tiene un formulario: tiene una docena de controles sueltos
 * (interruptores, segmentados, campos que guardan al salir del foco) repartidos
 * en secciones distintas. Antes cada sección tenía su propio `useTransition` y
 * pintaba el spinner en UN botón fijo, así que tocar el tema mostraba el giro en
 * el botón de notificaciones: el indicador quedaba en la sección equivocada.
 *
 * Se resuelve con un contexto en vez de props porque el indicador vive en el
 * borde de la pantalla y quien guarda está a dos o tres niveles de anidamiento
 * (`Ajustes` > sección > `Fila`, `Equipo` > lista > fila de miembro). Bajar un
 * `reportar()` por props obligaría a atravesar componentes que no tienen nada
 * que ver con el guardado, y cada control nuevo tendría que volver a cablearlo.
 *
 * Se cuenta cuántos guardados hay en vuelo, no un booleano: dos controles
 * tocados seguidos no pueden apagar el indicador cuando termina el primero.
 */

type Estado = 'quieto' | 'guardando' | 'guardado' | 'error'

interface Valor {
  /**
   * Corre una acción de guardado reportando su estado al indicador global.
   * Devuelve `true` si salió bien, para que quien llama decida si refresca o
   * limpia su propio borrador.
   *
   * `etiqueta` reemplaza el "Guardando…" genérico mientras la acción corre.
   * Sirve para las operaciones que tardan de verdad —subir una foto de 2 MB,
   * no marcar un interruptor—, donde un texto genérico varios segundos se lee
   * como que algo se colgó. Si se omite, se usa el texto por defecto.
   */
  guardar: (
    accion: () => Promise<{ error?: string } | { ok: boolean; error?: string }>,
    etiqueta?: string,
  ) => Promise<boolean>
  estado: Estado
  mensaje: string | null
}

const Contexto = createContext<Valor | null>(null)

/** Cuánto queda visible el "Guardado" antes de desaparecer solo. */
const MS_EXITO = 2200

export function ProveedorGuardado({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('quieto')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [etiquetaEnCurso, setEtiquetaEnCurso] = useState<string | null>(null)
  const enVuelo = useRef(0)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    },
    [],
  )

  const guardar = useCallback<Valor['guardar']>(async (accion, etiqueta) => {
    if (temporizador.current) {
      clearTimeout(temporizador.current)
      temporizador.current = null
    }

    enVuelo.current += 1
    setEstado('guardando')
    setMensaje(null)
    // Con varios guardados en vuelo gana el que trae etiqueta propia: es el
    // caso raro y el que tarda, así que es el que hay que explicar.
    if (etiqueta) setEtiquetaEnCurso(etiqueta)

    let error: string | null = null
    try {
      const res = await accion()
      if (res && 'ok' in res && !res.ok) error = res.error ?? 'No se pudo aplicar el cambio.'
      else if (res && 'error' in res && res.error) error = res.error
    } catch {
      error = 'No se pudo guardar. Revisá la conexión y probá de nuevo.'
    }

    enVuelo.current -= 1

    if (enVuelo.current === 0) setEtiquetaEnCurso(null)

    // El error se queda hasta el próximo guardado: es información que hay que
    // leer, no un destello. El éxito sí se va solo.
    if (error) {
      setEstado('error')
      setMensaje(error)
      return false
    }

    if (enVuelo.current === 0) {
      setEstado('guardado')
      setMensaje(null)
      temporizador.current = setTimeout(() => {
        setEstado('quieto')
        temporizador.current = null
      }, MS_EXITO)
    }

    return true
  }, [])

  return (
    <Contexto.Provider value={{ guardar, estado, mensaje }}>
      <IndicadorGuardado estado={estado} mensaje={mensaje} etiqueta={etiquetaEnCurso} />
      {children}
    </Contexto.Provider>
  )
}

export function useGuardado(): Valor {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useGuardado necesita estar dentro de <ProveedorGuardado>')
  return ctx
}

/**
 * Píldora flotante abajo a la derecha.
 *
 * No es la `BarraProgreso` de 2px de arriba porque esa ya significa otra cosa
 * en esta aplicación —"la ruta está cambiando"— y porque una barra no puede
 * decir "salió mal". No es un overlay porque estos guardados tardan 200ms y
 * tapar la pantalla en cada clic de un interruptor molesta más de lo que informa.
 *
 * `role="status"` + `aria-live="polite"` en el contenedor, que está SIEMPRE en
 * el árbol: si el nodo apareciera junto con el texto, muchos lectores de
 * pantalla no anunciarían el primer cambio.
 */
function IndicadorGuardado({
  estado,
  mensaje,
  etiqueta,
}: {
  estado: Estado
  mensaje: string | null
  etiqueta: string | null
}) {
  return (
    <div className="indicador-guardado-zona" role="status" aria-live="polite">
      {estado !== 'quieto' && (
        <div className={`indicador-guardado indicador-guardado-${estado}`}>
          {estado === 'guardando' && (
            <>
              <span className="spinner" aria-hidden="true" />
              {etiqueta ?? 'Guardando…'}
            </>
          )}
          {estado === 'guardado' && (
            <>
              <span className="indicador-guardado-tilde" aria-hidden="true" />
              Guardado
            </>
          )}
          {estado === 'error' && (mensaje ?? 'No se pudo guardar.')}
        </div>
      )}
    </div>
  )
}
