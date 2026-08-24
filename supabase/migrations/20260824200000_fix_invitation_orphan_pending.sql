-- =============================================================================
-- Invitaciones que quedaban PENDIENTES para siempre
--
-- SÍNTOMA: un usuario fue invitado, aceptó, entró a la app con el rol correcto
-- (`member`)... y su fila en `invitations` seguía con accepted_at null. En la
-- bandeja del admin figuraba como pendiente una invitación ya usada, y
-- reenviarla no tenía sentido porque la cuenta ya existía.
--
-- CAUSA: había DOS caminos por los que un invitado obtiene su rol, y solo uno
-- marcaba la invitación.
--
--   1. El trigger de alta (`handle_new_auth_user`) lee `invited_role` del
--      metadata que Supabase copia al invitar, y aplica el rol al crear la fila
--      de `users`. Corre SIEMPRE, incluso si la persona acepta el enlace desde
--      la pantalla de Supabase sin pasar por la app.
--   2. La RPC `invitation_aceptar_por_email`, que llama `/auth/callback`, marca
--      la invitación y aplica el rol. Corre SOLO si el enlace se abre en la app.
--
-- Como el camino 1 ya dejaba el rol bien puesto, nadie notaba que el 2 no había
-- corrido. La invitación quedaba huérfana.
--
-- ARREGLO: el trigger de alta también cierra la invitación. Así el estado de la
-- tabla depende de que la cuenta exista, no de por qué ruta se creó.
-- =============================================================================

create or replace function close_invitation_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  -- La invitación más reciente sin aceptar para ese correo. Se marca aunque
  -- esté vencida: la cuenta existe, así que la invitación cumplió su función y
  -- dejarla "pendiente" solo genera ruido en la bandeja del admin.
  update invitations
     set accepted_at = now(),
         accepted_by = new.id
   where id = (
     select id from invitations
      where lower(email) = lower(new.email)
        and accepted_at is null
      order by created_at desc
      limit 1
   );

  return new;
end;
$fn$;

-- AFTER INSERT sobre `users`, no sobre `auth.users`: necesita que la fila de
-- `users` ya exista para que accepted_by tenga a quién apuntar.
create trigger users_close_invitation
  after insert on users
  for each row execute function close_invitation_on_signup();

revoke execute on function close_invitation_on_signup() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Backfill: cerrar las que ya quedaron huérfanas.
-- -----------------------------------------------------------------------------

update invitations i
   set accepted_at = coalesce(au.confirmed_at, u.created_at, now()),
       accepted_by = u.id
  from users u
  join auth.users au on au.id = u.id
 where lower(u.email) = lower(i.email)
   and i.accepted_at is null;
