import type { Metadata } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import { getSesion } from '@/lib/auth'
import './globals.css'

/**
 * El eje de ancho de Archivo es parte de la identidad: el `font-stretch: 80%`
 * de los encabezados no se puede simular con otra familia.
 */
const archivo = Archivo({
  subsets: ['latin'],
  // Peso variable + eje de ancho: `font-stretch: 80%` es parte de la identidad
  // de los encabezados y sin el eje wdth no existe.
  axes: ['wdth'],
  weight: 'variable',
  variable: '--fuente-archivo',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--fuente-plex',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Gestión de trabajo',
  description: 'Herramienta interna de gestión de trabajo — Comunicación social y mercadeo',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // El tema y la densidad se resuelven en el servidor para que no haya un
  // parpadeo de tema claro antes de hidratar.
  const sesion = await getSesion()

  return (
    <html
      lang="es"
      data-tema={sesion?.prefs.theme ?? 'claro'}
      data-densidad={sesion?.prefs.density ?? 'comoda'}
      data-peso={sesion?.settings.estimation_enabled === false ? 'no' : 'si'}
      className={`${archivo.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
