-- =============================================================================
-- MVP 1 · Gestión de miembros: bloqueo e invitaciones
--
-- Dos decisiones que conviene dejar escritas:
--
-- 1. SACAR A ALGUIEN NO ES BORRARLO. `users` está referenciada por issues,
--    comentarios, adjuntos y activity log: borrar la fila se llevaría —o
--    bloquearía— años de historia, y los reportes dejarían de cuadrar. En su
--    lugar hay `active`: la persona deja de entrar, y todo lo que hizo sigue
--    atribuido a su nombre.
--
-- 2. LA INVITACIÓN NO OTORGA ROL. El código habilita el registro y nada más;
--    quien entra nace `member` como cualquiera, y un admin promueve después.
--    Si el rol viniera en la invitación, una invitación filtrada sería una
--    escalada de privilegios.
-- =============================================================================

alter table users
  add column if not exists active boolean not null default true;

comment on column users.active is
  'false = sin acceso. No se borran usuarios: la historia de issues los referencia.';

-- -----------------------------------------------------------------------------
-- Invitaciones
-- -----------------------------------------------------------------------------

create table if not exists invitations (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code        text not null unique,
  created_by  uuid not null references users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references users(id)
);

create unique index if not exists invitations_email_pendiente
  on invitations (lower(email))
  where accepted_at is null;

alter table invitations enable row level security;

-- Solo el admin ve y administra invitaciones. El registro no consulta la tabla:
-- pasa por la función de abajo, que es la única puerta para anon.
drop policy if exists invitations_admin on invitations;
create policy invitations_admin on invitations
  for all
  to authenticated
  using (exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin'));

-- -----------------------------------------------------------------------------
-- Canje de invitación
--
-- `security definer` porque quien se registra todavía no tiene sesión. Devuelve
-- un booleano y nunca datos de la invitación: si devolviera la fila, sería un
-- oráculo para enumerar códigos y correos invitados.
-- -----------------------------------------------------------------------------

create or replace function invitation_valida(p_email text, p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
      from invitations i
     where i.code = p_code
       and lower(i.email) = lower(p_email)
       and i.accepted_at is null
       and i.expires_at > now()
  );
$fn$;

create or replace function invitation_aceptar(p_email text, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id uuid;
begin
  select id into v_id
    from invitations
   where code = p_code
     and lower(email) = lower(p_email)
     and accepted_at is null
     and expires_at > now()
   for update;

  if v_id is null then
    return false;
  end if;

  update invitations
     set accepted_at = now(),
         accepted_by = (select id from users where lower(email) = lower(p_email))
   where id = v_id;

  return true;
end;
$fn$;

revoke execute on function invitation_valida(text, text) from public;
revoke execute on function invitation_aceptar(text, text) from public;
grant  execute on function invitation_valida(text, text) to anon, authenticated;
grant  execute on function invitation_aceptar(text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Un admin no puede quedarse sin pares: bloquear al último admin dejaría el
-- workspace sin nadie que apruebe borradores ni gestione roles.
-- -----------------------------------------------------------------------------

create or replace function guard_last_admin()
returns trigger
language plpgsql
as $fn$
begin
  if (old.role = 'admin' and old.active)
     and (new.role <> 'admin' or not new.active)
     and not exists (
       select 1 from users
        where role = 'admin' and active and id <> old.id
     )
  then
    raise exception 'No se puede quitar al último admin activo del workspace';
  end if;

  return new;
end;
$fn$;

drop trigger if exists guard_last_admin_trg on users;
create trigger guard_last_admin_trg
  before update of role, active on users
  for each row
  execute function guard_last_admin();

-- -----------------------------------------------------------------------------
-- El bloqueo vale también contra la API
--
-- El token de auth de alguien bloqueado sigue siendo válido —no hay service role
-- para banear en `auth`—, así que la puerta tiene que estar en las funciones que
-- usan las políticas RLS, no solo en la interfaz.
-- -----------------------------------------------------------------------------

create or replace function can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select active and role in ('member', 'admin') from users where id = auth.uid()),
    false
  );
$fn$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select active and role = 'admin' from users where id = auth.uid()),
    false
  );
$fn$;
