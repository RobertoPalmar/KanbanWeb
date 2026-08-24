-- =============================================================================
-- MVP 1 · Invitaciones por correo, con el rol dentro de la invitación
--
-- QUÉ CAMBIA Y POR QUÉ
--
-- El flujo anterior era: el admin generaba un código legible, se lo pasaba a
-- mano por el canal que fuese, y la persona lo tipeaba en /registro. La
-- invitación no otorgaba rol —nacía `member` y un admin lo promovía después—
-- justamente porque un código que viaja por WhatsApp puede filtrarse, y un
-- código filtrado que otorgue `admin` es una escalada de privilegios.
--
-- Ahora el correo lo manda Supabase Auth (`inviteUserByEmail`). Eso cambia el
-- modelo de amenaza: el enlace del correo NO es un secreto compartido dictado
-- por teléfono, es un token de un solo uso emitido por el servidor de Auth y
-- entregado a la bandeja de ese correo concreto. Quien lo abre demostró control
-- del buzón. Sobre esa base sí se puede hacer viajar el rol.
--
-- LAS TRES REGLAS QUE SOSTIENE ESTA MIGRACIÓN
--
-- 1. EL ROL VIVE EN LA FILA DE `invitations`, NO EN EL METADATA DE AUTH. El
--    metadata (`raw_user_meta_data`) es entrada del cliente en cualquier flujo
--    de signUp, y ya nos costó un agujero una vez (ver
--    20260823000100_self_registration.sql). La aceptación lee el rol de la
--    tabla, buscando por correo, y nunca acepta un rol como parámetro.
--
-- 2. LA ACEPTACIÓN ES ATÓMICA. Una sola función marca la invitación usada y
--    escribe el rol en `users`. Si algo falla, no queda ni la invitación quemada
--    sin rol aplicado ni el rol aplicado con la invitación reutilizable.
--
-- 3. LA INVITACIÓN CADUCA Y ES DE UN SOLO USO. `expires_at` (14 días) más el
--    `accepted_at is null` del `for update` en la función: dos aceptaciones
--    concurrentes de la misma fila serializan y la segunda no encuentra nada.
--
-- SOBRE `code`: la columna se queda. Sigue siendo `not null unique` y la
-- seguimos rellenando con un valor aleatorio, pero ya no se muestra a nadie ni
-- se tipea en ningún formulario. Es un identificador interno. No se borra en
-- esta migración porque `not null unique` sobre una tabla con filas históricas
-- se limpia mejor en una migración aparte, cuando ya no queden invitaciones
-- emitidas con el flujo viejo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. El rol que el admin eligió al invitar
--
-- `user_role` y no texto libre: es el mismo enum que usa `users.role`, así que
-- una invitación no puede llevar un rol que no exista, y `viewer|member|admin`
-- se mantienen en un solo lugar.
--
-- Default `member`: es el rol de menor privilegio que sigue pudiendo trabajar, y
-- es lo que recibían todas las invitaciones del flujo anterior. Las filas
-- históricas quedan con el comportamiento que ya tenían.
-- -----------------------------------------------------------------------------

alter table invitations
  add column if not exists role user_role not null default 'member';

comment on column invitations.role is
  'Rol con el que entra quien acepta. Fuente de verdad del rol: NO se toma del metadata de auth, que es entrada del cliente.';

-- Cuándo se mandó el último correo. Sirve para dos cosas concretas en la UI:
-- decirle al admin "ya se lo mandaste hace dos minutos" antes de que choque con
-- el límite de envío del SMTP por defecto de Supabase, y mostrar el estado real
-- de una invitación reenviada.
alter table invitations
  add column if not exists last_sent_at timestamptz not null default now();

comment on column invitations.last_sent_at is
  'Último envío del correo de invitación. El SMTP por defecto de Supabase limita a unos pocos correos por hora: la UI usa esto para avisar antes de chocar.';

comment on column invitations.code is
  'OBSOLETO como secreto compartido. Ya no se muestra ni se tipea: el correo de Supabase Auth lleva el token. Se conserva como identificador interno.';

-- -----------------------------------------------------------------------------
-- 2. El guard de rol tiene que dejar pasar la aceptación de invitación
--
-- `guard_role_change` bloquea cualquier cambio de rol que no venga de un admin
-- o del service role (`auth.uid() is null`). En la aceptación hay sesión —la del
-- invitado, que no es admin— así que el guard levantaría
-- "Solo un admin puede cambiar roles" y la invitación nunca se aplicaría.
--
-- La salida no es debilitar el guard: es darle una señal que solo puede activar
-- código de la base. `invitation_aceptar_por_email` es `security definer`, así
-- que puede fijar un GUC local que el guard reconoce; nadie desde el REST puede
-- fijarlo, porque `set_config` con `is_local => true` requiere estar dentro de
-- la misma transacción y `guard_role_change` solo lo lee.
-- -----------------------------------------------------------------------------

create or replace function guard_role_change()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $fn$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- Sin sesión de usuario: service role o migración.
  if auth.uid() is null then
    return new;
  end if;

  -- Aceptación de invitación: el rol viene de la fila de `invitations`, no del
  -- cliente. Solo `invitation_aceptar_por_email` puede fijar este flag.
  if coalesce(current_setting('app.aceptando_invitacion', true), 'off') = 'on' then
    return new;
  end if;

  if not is_admin() then
    raise exception 'Solo un admin puede cambiar roles' using errcode = '42501';
  end if;

  -- Si el último admin se degrada, el workspace queda sin nadie que apruebe
  -- borradores ni asigne roles.
  if old.id = auth.uid() and old.role = 'admin' and new.role <> 'admin'
     and (select count(*) from users where role = 'admin') <= 1 then
    raise exception 'No podés quitarte el rol de admin: sos el único que queda'
      using errcode = '23514';
  end if;

  return new;
end;
$fn$;

revoke execute on function guard_role_change() from public, anon, authenticated;

-----------------------------------------------------------------------------
-- 3. Aceptación de la invitación
--
-- `invitation_aceptar_por_email(p_email)` reemplaza a
-- `invitation_aceptar(p_email, p_code)`. La firma cambia porque el código dejó
-- de existir para el usuario: quien acepta ya tiene sesión (el callback de auth
-- canjeó el token del correo), así que lo único que hace falta es su correo.
--
-- `security definer` porque la función escribe `users.role`, y quien acaba de
-- entrar no es admin y no puede tocar esa columna por RLS. Es exactamente el
-- caso para el que existe `security definer`.
--
-- POR QUÉ NO ACEPTA UN ROL COMO PARÁMETRO: si lo aceptara, cualquiera con sesión
-- podría llamar a /rest/v1/rpc/invitation_aceptar_por_email pasando 'admin' y
-- promoverse. El rol sale del `select` sobre la propia invitación, y de ningún
-- otro lugar.
--
-- POR QUÉ TAMPOCO CONFÍA EN `p_email` A CIEGAS: la función compara contra el
-- correo de `auth.uid()`. Si alguien con sesión llama con el correo de otra
-- persona invitada como admin, no coincide y no pasa nada. Sin este check, el
-- correo sería un parámetro del cliente y el rol volvería a ser elegible.
-----------------------------------------------------------------------------

create or replace function invitation_aceptar_por_email(p_email text)
returns user_role
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid        uuid := auth.uid();
  v_email_real text;
  v_id         uuid;
  v_role       user_role;
begin
  -- Sin sesión no hay nada que aceptar: el rol se escribe sobre una fila de
  -- `users`, y sin `auth.uid()` no se sabe sobre cuál.
  if v_uid is null then
    return null;
  end if;

  select lower(email) into v_email_real from users where id = v_uid;

  if v_email_real is null then
    -- Autenticado sin perfil: el trigger `handle_new_auth_user` todavía no
    -- corrió, o falló. No se inventa la fila desde acá.
    return null;
  end if;

  -- El correo tiene que ser el de la sesión. `p_email` se acepta solo para que
  -- quien llama sea explícito; no es una credencial.
  if lower(p_email) <> v_email_real then
    return null;
  end if;

  -- `for update` sobre la fila pendiente: dos aceptaciones concurrentes
  -- serializan, y la segunda no encuentra fila. Un solo uso garantizado por la
  -- base, no por la aplicación.
  select id, role into v_id, v_role
    from invitations
   where lower(email) = v_email_real
     and accepted_at is null
     and expires_at > now()
   order by created_at desc
   limit 1
     for update;

  if v_id is null then
    return null;
  end if;

  update invitations
     set accepted_at = now(),
         accepted_by = v_uid
   where id = v_id;

  -- `is_local => true`: el flag muere al terminar esta transacción, así que no
  -- puede quedar encendido para una petición posterior del mismo pool.
  perform set_config('app.aceptando_invitacion', 'on', true);

  update users
     set role       = v_role,
         updated_at = now()
   where id = v_uid;

  perform set_config('app.aceptando_invitacion', 'off', true);

  return v_role;
end;
$fn$;

comment on function invitation_aceptar_por_email(text) is
  'Acepta la invitación pendiente del usuario de la sesión y le aplica el rol que eligió el admin. Atómica y de un solo uso. El rol sale de la fila de invitations, NUNCA de un parámetro del cliente.';

-- -----------------------------------------------------------------------------
-- 4. Grants
--
-- Solo `authenticated`: la aceptación ocurre después de que el callback de auth
-- canjeó el token, así que ya hay sesión. `anon` no tiene nada que hacer aquí, y
-- dársela sería un oráculo para preguntar "¿tiene invitación pendiente este
-- correo?" sin autenticarse.
-- -----------------------------------------------------------------------------

revoke execute on function invitation_aceptar_por_email(text) from public, anon;
grant  execute on function invitation_aceptar_por_email(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Las funciones del flujo viejo se retiran
--
-- `invitation_valida` e `invitation_aceptar` existían para que /registro validara
-- un código tipeado sin sesión. Ese formulario ya no pide código, así que ambas
-- quedan sin llamadores. Se les revoca el execute a `anon` y `authenticated` en
-- lugar de borrarlas: un `drop function` en producción rompería cualquier
-- despliegue anterior que todavía las llame durante el rollout, y revocarlas ya
-- cierra el endpoint /rest/v1/rpc/.
-- -----------------------------------------------------------------------------

do $bloque$
begin
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'invitation_valida'
  ) then
    revoke execute on function invitation_valida(text, text) from public, anon, authenticated;
    comment on function invitation_valida(text, text) is
      'OBSOLETA. El flujo de código de invitación se reemplazó por el correo de Supabase Auth. Sin llamadores; execute revocado. Borrar en una migración futura.';
  end if;

  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'invitation_aceptar'
  ) then
    revoke execute on function invitation_aceptar(text, text) from public, anon, authenticated;
    comment on function invitation_aceptar(text, text) is
      'OBSOLETA. Reemplazada por invitation_aceptar_por_email(text), que aplica además el rol de la invitación. Sin llamadores; execute revocado.';
  end if;
end
$bloque$;
