-- =============================================================================
-- MVP 1 · Registro propio de miembros
--
-- El sistema es interno y el equipo se da de alta solo. Eso obliga a dos cosas:
--
-- 1. CERRAR la escalada de privilegios del trigger anterior. `handle_new_auth_user`
--    leía el rol de `raw_user_meta_data ->> 'role'`, y en un signUp desde el
--    navegador ese objeto lo controla quien se registra: bastaba mandar
--    `{"role":"admin"}` para nacer admin. El rol ya no sale nunca del metadata.
--
-- 2. Guardar el cargo (`job_title`) que la persona escribe en el formulario. Es
--    descriptivo ("Producción y eventos") y no tiene nada que ver con permisos.
--
-- Regla que queda: el primer usuario del workspace es admin porque alguien tiene
-- que poder aprobar borradores y asignar roles. Todos los demás nacen `member`,
-- y solo un admin puede promoverlos (guard_role_change sigue vigente).
-- =============================================================================

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_role user_role;
begin
  -- El primer usuario es admin. El resto, member: el rol NO se toma del
  -- metadata, que es entrada del cliente.
  if not exists (select 1 from users) then
    v_role := 'admin';
  else
    v_role := 'member';
  end if;

  insert into users (id, name, email, avatar_url, role, job_title)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url',
    v_role,
    nullif(trim(new.raw_user_meta_data ->> 'job_title'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$fn$;

comment on function handle_new_auth_user() is
  'Espeja auth.users -> users. El rol nunca se toma del metadata del cliente: '
  'primer usuario admin, el resto member.';
