-- =============================================================================
-- MVP 1 · Alta automática de preferencias
--
-- Las filas de preferencias se crean junto con el usuario. Sin esto, el front
-- recibiría null en el primer render y tendría que decidir si eso significa
-- "sin preferencia" o "todavía no cargó".
-- =============================================================================

create or replace function create_user_preferences()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  insert into user_preferences (user_id) values (new.id)
    on conflict (user_id) do nothing;
  insert into notification_preferences (user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end;
$fn$;

create trigger users_create_preferences
  after insert on users
  for each row execute function create_user_preferences();

revoke execute on function create_user_preferences() from public, anon, authenticated;

-- Backfill, para que la migración sea idempotente si se reaplica sobre una base
-- que ya tenga usuarios.
insert into user_preferences (user_id)
select id from users on conflict (user_id) do nothing;

insert into notification_preferences (user_id)
select id from users on conflict (user_id) do nothing;
