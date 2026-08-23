'use client'

/**
 * Indicadores de espera.
 *
 * Dos piezas para dos situaciones distintas:
 *
 * · `Spinner` va DENTRO del botón que disparó la acción. El botón queda
 *   deshabilitado y el giro dice "esto está corriendo": el foco no se mueve y no
 *   aparece nada tapando la pantalla.
 * · `BarraProgreso` es para la navegación, que reemplaza la vista entera. Dos
 *   píxeles arriba, sin bloquear: el contenido viejo sigue usable hasta que
 *   llega el nuevo.
 *
 * Ningún overlay que bloquee todo: en una herramienta de uso sostenido, tapar la
 * pantalla por una espera de 200ms molesta más de lo que informa.
 */

export function Spinner({ label = 'Cargando' }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />
}

export function BarraProgreso({ visible }: { visible: boolean }) {
  if (!visible) return null
  return <div className="progreso-ruta" role="status" aria-label="Cargando" />
}
