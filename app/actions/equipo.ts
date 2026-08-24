'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireSesion } from '@/lib/auth'
import type { Role } from '@/lib/permissions'

/**
 * Gestión del equipo. Solo admin.
 *
 * Tres decisiones que la base también sostiene:
 *
 * · Sacar a alguien no lo borra: `users.active = false`. La historia de issues,
 *   comentarios y activity log lo referencia, y borrarlo dejaría los reportes
 *   sin autor.
 * · Al último admin activo no se lo puede degradar ni bloquear — lo impide el
 *   trigger `guard_last_admin`, y acá se corta antes para dar un mensaje claro.
 * · La invitación SÍ otorga rol, y el rol vive en la fila de `invitations`. El
 *   admin elige el rol al invitar; `invitation_aceptar_por_email` lo aplica al
 *   aceptar, leyéndolo de la base. Nunca sale del metadata de auth ni de un
 *   parámetro que controle el cliente: eso sería una escalada de privilegios.
 */

/** Lista cerrada de roles. El enum de la base es la garantía; esto da el mensaje. */
const ROLES_VALIDOS: Role[] = ['viewer', 'member', 'admin']

async function requireAdmin() {
  const sesion = await requireSesion()
  if (sesion.actor.role !== 'admin') return null
  return sesion
}

export async function cambiarRol(userId: string, role: Role) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin cambia roles.' }

  if (userId === sesion.actor.id && role !== 'admin') {
    return {
      ok: false as const,
      error: 'No podés quitarte a vos mismo el rol de admin. Pedile a otro admin que lo haga.',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return { ok: false as const, error: traducir(error.message) }

  revalidatePath('/', 'layout')
  return { ok: true as const }
}

export async function cambiarAcceso(userId: string, activo: boolean) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin da o quita acceso.' }

  if (userId === sesion.actor.id && !activo) {
    return { ok: false as const, error: 'No podés quitarte el acceso a vos mismo.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ active: activo, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return { ok: false as const, error: traducir(error.message) }

  revalidatePath('/', 'layout')
  return { ok: true as const }
}

/**
 * Elimina definitivamente a una persona ya desactivada.
 *
 * Solo si no dejó rastro: ni tickets, ni comentarios, ni adjuntos. Es el caso de
 * una invitación aceptada por error o de alguien que se fue la primera semana, y
 * sin esto esas filas se acumulan en la lista del equipo para siempre.
 *
 * Quien SÍ dejó trabajo registrado se queda desactivado, que es lo correcto:
 * borrarlo dejaría sus tickets y comentarios sin autor, y los reportes de meses
 * anteriores cambiarían hacia atrás.
 *
 * La decisión la toma la base, no este archivo: `eliminar_usuario_sin_rastro`
 * cuenta y borra en la misma transacción con FOR UPDATE. Comprobarlo acá dejaría
 * una ventana para que entre un ticket entre el conteo y el borrado.
 */
export async function eliminarUsuario(userId: string) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin elimina usuarios.' }

  if (userId === sesion.actor.id) {
    return { ok: false as const, error: 'No podés eliminarte a vos mismo.' }
  }

  // Service role: el borrado toca `auth.users`, fuera del alcance de RLS.
  const admin = createServiceClient()

  const { data, error } = await admin.rpc('eliminar_usuario_sin_rastro', {
    p_user_id: userId,
  })

  if (error) {
    console.error('[eliminarUsuario] La RPC falló:', {
      userId,
      code: error.code,
      mensaje: error.message,
    })
    return { ok: false as const, error: traducir(error.message) }
  }

  const resultado = data as {
    ok: boolean
    motivo?: string
    mensaje?: string
    issues?: number
    comentarios?: number
    adjuntos?: number
    nombre?: string
  }

  if (!resultado.ok) {
    return {
      ok: false as const,
      error: resultado.mensaje ?? 'No se pudo eliminar a esta persona.',
      motivo: resultado.motivo,
      // Para que la UI pueda decir "3 tickets y 2 comentarios" en vez de
      // "tiene historial", que no le dice al admin qué se perdería.
      historial:
        resultado.motivo === 'tiene_historial'
          ? {
              issues: resultado.issues ?? 0,
              comentarios: resultado.comentarios ?? 0,
              adjuntos: resultado.adjuntos ?? 0,
            }
          : undefined,
    }
  }

  revalidatePath('/', 'layout')
  return { ok: true as const, nombre: resultado.nombre }
}

export async function cambiarCapacidad(userId: string, capacidad: number) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin cambia la capacidad.' }

  if (!Number.isFinite(capacidad) || capacidad < 1 || capacidad > 200) {
    return { ok: false as const, error: 'La capacidad va de 1 a 200 puntos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ capacity: capacidad, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/', 'layout')
  return { ok: true as const }
}

/**
 * Invitaciones por correo.
 *
 * El admin escribe el correo y elige el rol. El correo lo manda Supabase Auth
 * (`inviteUserByEmail`), y el enlace del correo cae en `/auth/callback`, que
 * canjea el token, acepta la invitación y aplica el rol.
 *
 * EL ROL VIAJA EN LA FILA DE `invitations`, NO EN EL METADATA. `inviteUserByEmail`
 * acepta `data` y eso termina en `raw_user_meta_data`, que es entrada del cliente
 * en otros flujos de auth. El rol se manda ahí solo para que la plantilla del
 * correo pueda decir "te invitaron como miembro"; quien lo aplica es
 * `invitation_aceptar_por_email`, leyendo la tabla.
 *
 * ORDEN DE LAS DOS ESCRITURAS: primero la fila de `invitations`, después el
 * correo. La fila NO hace falta para poder enviar —`redirectTo` solo depende de
 * `NEXT_PUBLIC_SITE_URL`, y el envío solo lleva el correo y el rol informativo—,
 * así que mandar primero sería técnicamente viable. No se hace, y el motivo es
 * el modo de fallo de cada orden:
 *
 * · Correo primero, fila después: si el insert falla, alguien tiene un enlace
 *   válido y no hay fila que le dé rol. Entra con el default del trigger
 *   (`member`), nadie se entera, y si lo habían invitado como admin el rol queda
 *   mal en silencio. Fallo invisible y no reparable desde la UI.
 * · Fila primero, correo después: si el envío falla y encima falla el borrado
 *   compensatorio, queda una invitación pendiente que no sirve. Es visible en la
 *   lista de Ajustes, el admin la puede revocar, y `invitar()` la detecta y
 *   reintenta el envío sobre ella. Fallo visible y con salida.
 *
 * Se elige el fallo visible, y el borrado compensatorio se hace a prueba de
 * fallos.
 */
export async function invitar(email: string, role: Role) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin invita.' }

  const limpio = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpio)) {
    return { ok: false as const, error: 'Ese correo no parece válido.' }
  }

  // El rol se valida contra la lista cerrada: llega del cliente, y de acá pasa a
  // una fila que después otorga privilegios. Que el enum de la base lo rechazaría
  // igual no quita que el mensaje de error tenga que ser legible.
  if (!ROLES_VALIDOS.includes(role)) {
    return { ok: false as const, error: 'Ese rol no existe.' }
  }

  // La configuración se comprueba ANTES de escribir. Si falta la URL pública no
  // hay envío posible, y sin este corte se insertaría una fila solo para
  // borrarla después: trabajo de rollback por un error que ya se sabía.
  const base = urlBase()
  if (!base) return { ok: false as const, error: ERROR_SIN_SITE_URL }

  const supabase = await createClient()

  const { data: existente } = await supabase
    .from('users')
    .select('id, active')
    .eq('email', limpio)
    .maybeSingle()

  if (existente) {
    return {
      ok: false as const,
      error: existente.active
        ? 'Esa persona ya tiene cuenta en el tablero.'
        : 'Esa persona ya tuvo cuenta y está sin acceso. Reactivala en la lista de arriba en lugar de invitarla otra vez.',
    }
  }

  // Una invitación pendiente previa bloquea el índice único parcial. Antes eso
  // era un callejón sin salida: "ya hay una invitación pendiente" y nada más que
  // hacer, incluso cuando el correo de esa invitación nunca había salido. Ahora
  // se reutiliza la fila y se reintenta el envío.
  const { data: pendiente } = await supabase
    .from('invitations')
    .select('id')
    // `ilike` y no `eq`: el índice único parcial es sobre `lower(email)`, y una
    // fila histórica con mayúsculas chocaría en el insert sin aparecer acá.
    .ilike('email', limpio)
    .is('accepted_at', null)
    .maybeSingle()

  if (pendiente) return await reintentarPendiente(pendiente.id, limpio, role, base)

  const { data: fila, error: errorFila } = await supabase
    .from('invitations')
    .insert({
      email: limpio,
      // `code` sigue siendo `not null unique` en la tabla y ya no se muestra a
      // nadie: es un identificador interno hasta que una migración lo quite.
      code: crypto.randomUUID(),
      role,
      created_by: sesion.actor.id,
      last_sent_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (errorFila) {
    // Carrera: otro admin insertó la misma invitación entre el select de arriba
    // y este insert. El índice único parcial lo corta, y acá se reintenta el
    // envío sobre la fila que ganó en lugar de dejar al admin sin salida.
    if (esDuplicado(errorFila)) {
      const { data: gano } = await supabase
        .from('invitations')
        .select('id')
        // `ilike` y no `eq`: el índice único parcial es sobre `lower(email)`, y una
        // fila histórica con mayúsculas chocaría en el insert sin aparecer acá.
        .ilike('email', limpio)
        .is('accepted_at', null)
        .maybeSingle()

      if (gano) return await reintentarPendiente(gano.id, limpio, role, base)

      return {
        ok: false as const,
        error: 'Ya hay una invitación pendiente para ese correo. Reenviala o revocala desde la lista.',
      }
    }

    console.error('[invitar] No se pudo insertar la invitación:', errorFila)
    return {
      ok: false as const,
      error: `No se pudo registrar la invitación en la base: ${errorFila.message}`,
    }
  }

  // A PARTIR DE ACÁ HAY UNA FILA ESCRITA, y todo camino de salida que no sea el
  // éxito tiene que borrarla — incluida una excepción.
  //
  // ACÁ ESTABA EL BUG: `inviteUserByEmail` devuelve en `error` solo lo que sea un
  // `AuthError`; cualquier otra cosa (un fallo de red contra el endpoint de auth,
  // un `redirectTo` que hace estallar la petición) la RELANZA. Esa excepción
  // subía por encima del borrado de abajo y salía de la server action, así que la
  // fila quedaba huérfana y el cliente pintaba el catch genérico
  // ("Revisá la conexión"). El try//catch no es defensivo: es el único lugar
  // donde ese fallo se puede convertir en un rollback.
  let envio: ResultadoEnvio
  try {
    envio = await enviarCorreoInvitacion(limpio, role, base)
  } catch (e) {
    console.error('[invitar] Excepción al enviar el correo de invitación:', e)
    envio = { ok: false, error: traducirExcepcionEnvio(e) }
  }

  if (!envio.ok) {
    // El correo no salió: la invitación no sirve para nada, y dejarla ahí
    // bloquearía el índice único parcial y el reintento del admin.
    const borrada = await borrarFila(fila.id)

    if (!borrada) {
      return {
        ok: false as const,
        error:
          `${envio.error} Además no se pudo deshacer la invitación a medias: quedó una ` +
          'invitación pendiente para ese correo que nunca se envió. Revocala en la lista ' +
          'de abajo antes de volver a invitar.',
      }
    }

    return { ok: false as const, error: envio.error }
  }

  revalidatePath('/ajustes')
  return { ok: true as const }
}

/**
 * Reintenta el envío de una invitación pendiente que ya existe, sin tocar su rol
 * ni su vencimiento: el admin ya decidió esas dos cosas al crearla.
 *
 * Es la salida al estado inconsistente del bug —fila insertada, correo nunca
 * enviado—. No se comprueba contra `auth.users` si el invitado existe para
 * decidir si reintentar: eso costaría paginar `listUsers` (no hay búsqueda por
 * correo en la API de admin) y el resultado sería el mismo, porque reenviar es
 * inocuo — en el peor caso el invitado recibe el correo dos veces. Reintentar
 * siempre es más simple que averiguar antes si hace falta, y desbloquea igual.
 *
 * Si el envío falla, la fila se deja como estaba: ya existía antes de esta
 * llamada, así que borrarla sería destruir algo que no se creó acá.
 */
async function reintentarPendiente(
  id: string,
  email: string,
  role: Role,
  base: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let envio: ResultadoEnvio
  try {
    envio = await enviarCorreoInvitacion(email, role, base)
  } catch (e) {
    console.error('[invitar] Excepción al reintentar el envío:', e)
    envio = { ok: false, error: traducirExcepcionEnvio(e) }
  }

  if (!envio.ok) {
    return {
      ok: false,
      error: `Ya había una invitación pendiente para ese correo y el reenvío tampoco salió. ${envio.error}`,
    }
  }

  const supabase = await createClient()
  await supabase
    .from('invitations')
    .update({ last_sent_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/ajustes')
  return { ok: true }
}

/**
 * Borrado compensatorio. Devuelve si la fila quedó efectivamente borrada.
 *
 * Usa el service client y no el de la sesión a propósito: es la última acción de
 * una operación que ya falló, y no tiene que depender de que RLS o la sesión del
 * admin sigan cooperando. Si aun así no borra, queda una invitación pendiente
 * inservible y hay que decírselo al admin en lugar de callarlo.
 */
async function borrarFila(id: string): Promise<boolean> {
  try {
    const admin = createServiceClient()
    const { error } = await admin.from('invitations').delete().eq('id', id)
    if (error) {
      console.error('[invitar] No se pudo borrar la invitación a medias:', error)
      return false
    }
    return true
  } catch (e) {
    console.error('[invitar] Excepción al borrar la invitación a medias:', e)
    return false
  }
}

/** ¿Es una violación del índice único parcial de invitaciones pendientes? */
function esDuplicado(error: { code?: string; message: string }): boolean {
  return error.code === '23505' || /duplicate|unique/i.test(error.message)
}

/**
 * Reenvía el correo de una invitación pendiente sin tocar su rol ni su
 * vencimiento: el admin ya decidió esas dos cosas al crearla.
 */
export async function reenviarInvitacion(id: string) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin reenvía invitaciones.' }

  const supabase = await createClient()

  const { data: fila } = await supabase
    .from('invitations')
    .select('email, role, accepted_at, expires_at')
    .eq('id', id)
    .maybeSingle()

  if (!fila) return { ok: false as const, error: 'Esa invitación ya no existe.' }

  if (fila.accepted_at) {
    return { ok: false as const, error: 'Esa invitación ya se usó: la persona tiene cuenta.' }
  }

  if (new Date(fila.expires_at) <= new Date()) {
    return {
      ok: false as const,
      error: 'Esa invitación venció. Revocala y volvé a invitar para emitir una nueva.',
    }
  }

  // Mismo cuidado que en `invitar`: `inviteUserByEmail` relanza lo que no sea un
  // `AuthError`, y sin este catch la excepción sale de la server action y el
  // cliente pinta el mensaje genérico de conexión en vez del motivo real. Acá no
  // hay nada que deshacer —la fila ya existía—, solo un mensaje que dar.
  let envio: ResultadoEnvio
  try {
    envio = await enviarCorreoInvitacion(fila.email, fila.role)
  } catch (e) {
    console.error('[reenviarInvitacion] Excepción al enviar el correo:', e)
    envio = { ok: false, error: traducirExcepcionEnvio(e) }
  }

  if (!envio.ok) return { ok: false as const, error: envio.error }

  await supabase
    .from('invitations')
    .update({ last_sent_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/ajustes')
  return { ok: true as const }
}

export async function revocarInvitacion(id: string) {
  const sesion = await requireAdmin()
  if (!sesion) return { ok: false as const, error: 'Solo un admin revoca invitaciones.' }

  const supabase = await createClient()
  const { error } = await supabase.from('invitations').delete().eq('id', id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/ajustes')
  return { ok: true as const }
}

/** Lo que devuelve el envío. `invitar` distingue fallo de excepción, así que el tipo se nombra. */
type ResultadoEnvio = { ok: true } | { ok: false; error: string }

/**
 * El mensaje de la configuración que falta. Es una constante porque lo usan
 * `invitar` (que corta antes de escribir) y `enviarCorreoInvitacion` (que es la
 * última barrera si alguien la llama por otro camino).
 */
const ERROR_SIN_SITE_URL =
  'Falta configurar NEXT_PUBLIC_SITE_URL: sin ella no se puede armar el enlace absoluto ' +
  'del correo. Agregala a .env.local con la URL del sitio (en local, ' +
  'NEXT_PUBLIC_SITE_URL=http://localhost:3000) y reiniciá el servidor de desarrollo.'

/**
 * El envío en sí. Vive aparte porque `invitar` y `reenviarInvitacion` mandan el
 * mismo correo y solo se diferencian en lo que escriben en la base.
 *
 * `createServiceClient` porque `admin.inviteUserByEmail` exige la service key.
 * Este módulo es `'use server'` y nunca llega al navegador.
 *
 * `base` llega por parámetro y no se resuelve acá: quien llama tiene que haber
 * comprobado la configuración ANTES de escribir en la base, y pasarla obliga a
 * ese orden en lugar de confiar en que se acuerde.
 */
async function enviarCorreoInvitacion(
  email: string,
  role: Role,
  base?: string,
): Promise<ResultadoEnvio> {
  const url = base ?? urlBase()
  if (!url) return { ok: false, error: ERROR_SIN_SITE_URL }

  const redirectTo = `${url}/auth/callback?next=/bienvenida`

  const admin = createServiceClient()

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    // Informativo, para la plantilla del correo. El rol que se aplica de verdad
    // sale de la fila de `invitations`.
    data: { invited_role: role },
  })

  if (!error) return { ok: true }

  // El detalle crudo al log del servidor: los mensajes traducidos que ve el
  // admin son accionables pero pierden el status y el código, que son lo único
  // que sirve para diagnosticar un caso nuevo.
  console.error('[invitar] inviteUserByEmail falló:', {
    email,
    redirectTo,
    status: error.status,
    code: error.code,
    mensaje: error.message,
  })

  return { ok: false, error: traducirEnvio(error.message, error.status, redirectTo) }
}

/**
 * La URL pública del sitio. El enlace del correo se abre en otro dispositivo, así
 * que tiene que ser absoluta y apuntar al despliegue, no a localhost.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` es el respaldo para que en Vercel funcione sin
 * configurar nada; en local hay que definir `NEXT_PUBLIC_SITE_URL`.
 */
function urlBase(): string | null {
  const explicita = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicita) return explicita.replace(/\/+$/, '')

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`

  return null
}

/**
 * Los errores de `inviteUserByEmail` llegan en inglés y sin contexto. Los que se
 * ven en la práctica:
 *
 * · `redirectTo` no dado de alta en el panel: el error habla de "redirect" o de
 *   una URL no permitida. Es el más desconcertante, porque la configuración que
 *   falta no está en el código sino en el dashboard de Supabase.
 * · 429 / "rate limit": el SMTP por defecto de Supabase manda unos pocos correos
 *   por hora en total, no por destinatario. Es el error más frecuente al invitar
 *   a varias personas seguidas, y el admin no tiene forma de adivinarlo.
 * · "already been registered": el correo ya existe en `auth.users` aunque no
 *   tenga perfil en `users` — típico de alguien que empezó un registro y no lo
 *   terminó.
 * · fallo de SMTP propio mal configurado.
 */
function traducirEnvio(mensaje: string, status?: number, redirectTo?: string): string {
  if (/redirect|not allowed|url.*invalid|invalid.*url/i.test(mensaje)) {
    return (
      `Supabase rechazó la URL de retorno del correo${redirectTo ? ` (${redirectTo})` : ''}. ` +
      'Hay que darla de alta en el panel de Supabase, en Authentication > URL Configuration > ' +
      'Redirect URLs, y poner ahí la misma URL base en Site URL. En local se agrega ' +
      'http://localhost:3000/** a Redirect URLs.'
    )
  }

  if (status === 429 || /rate limit|too many requests/i.test(mensaje)) {
    return (
      'Supabase no deja mandar más correos por ahora: el servidor de correo de prueba ' +
      'permite unos pocos por hora para todo el proyecto. Esperá un rato y reenviá la ' +
      'invitación desde la lista, o configurá un SMTP propio en Supabase (Authentication > Emails) ' +
      'para no tener este límite.'
    )
  }

  if (/already.*registered|already exists|email_exists/i.test(mensaje)) {
    return (
      'Ese correo ya está registrado en el sistema de cuentas, aunque no aparezca en la ' +
      'lista de miembros. Puede ser un registro a medio terminar: pedile que entre con ' +
      '«Olvidé mi contraseña» desde el login.'
    )
  }

  if (/smtp|sending|mail/i.test(mensaje)) {
    return `No se pudo enviar el correo: ${mensaje}. Revisá la configuración de correo en Supabase (Authentication > Emails).`
  }

  if (status === 401 || status === 403 || /service_role|not authorized|jwt/i.test(mensaje)) {
    return (
      'Supabase rechazó la credencial de administración al mandar el correo. Revisá que ' +
      'SUPABASE_SERVICE_ROLE_KEY en .env.local sea la service_role del proyecto actual ' +
      '(Project Settings > API Keys) y reiniciá el servidor.'
    )
  }

  return `No se pudo enviar la invitación: ${mensaje}${status ? ` (código ${status})` : ''}. El detalle quedó en el log del servidor.`
}

/**
 * Las excepciones que `inviteUserByEmail` relanza en lugar de devolver: todo lo
 * que no sea un `AuthError`. Típicamente un fallo de red contra el endpoint de
 * auth, o la propia `createServiceClient` cuando falta la service key.
 *
 * Estas son las que dejaban la fila huérfana y pintaban el catch genérico del
 * cliente. Acá se convierten en un mensaje que dice qué revisar.
 */
function traducirExcepcionEnvio(e: unknown): string {
  const mensaje = e instanceof Error ? e.message : String(e)

  if (/SUPABASE_SERVICE_ROLE_KEY/i.test(mensaje)) {
    return (
      'Falta SUPABASE_SERVICE_ROLE_KEY en .env.local: sin ella no se puede mandar el correo ' +
      'de invitación. Se copia del panel de Supabase, en Project Settings > API Keys.'
    )
  }

  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(mensaje)) {
    return (
      'No se pudo contactar al servidor de autenticación de Supabase. Revisá que ' +
      'NEXT_PUBLIC_SUPABASE_URL en .env.local apunte al proyecto correcto y que el proyecto ' +
      `no esté pausado. Detalle: ${mensaje}`
    )
  }

  return `No se pudo enviar la invitación por un error inesperado: ${mensaje}. El detalle completo quedó en el log del servidor.`
}

function traducir(mensaje: string): string {
  if (/último admin/i.test(mensaje)) {
    return 'No se puede: quedaría el workspace sin ningún admin activo. Nombrá otro admin primero.'
  }
  return mensaje
}
