-- =============================================================================
-- MVP 1 · Cierre de escalada de privilegios vía app.importing
--
-- VULNERABILIDAD (verificada explotable antes del fix):
-- `is_importing()` solo leía `current_setting('app.importing')`, y cualquier rol
-- puede llamar a set_config() sobre una variable de usuario. Un member que
-- consiguiera ejecutar SQL arbitrario podía hacer:
--
--   select set_config('app.importing', 'on', true);
--   update issues set state = 'done' where id = <un ticket suyo>;
--
-- y saltarse la validación de secuencia entera — falseando throughput y cycle
-- time, que es justo la manipulación que la regla de secuencia existe para
-- impedir. La prueba confirmó que el ticket quedaba en `done` desde `todo`.
--
-- Apoyarse en que "PostgREST no expone set_config" es un supuesto sobre la capa
-- de transporte, no una garantía de la base. El bypass ahora exige DOS
-- condiciones: la bandera activa Y un actor con permiso real de importar.
-- =============================================================================

create or replace function is_importing()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select
    coalesce(current_setting('app.importing', true), 'off') = 'on'
    and (
      -- Service role / migración: no hay sesión de usuario.
      auth.uid() is null
      -- O un admin, que es quien puede importar.
      or coalesce((select role = 'admin' from users where id = auth.uid()), false)
    );
$fn$;

revoke execute on function is_importing() from public, anon, authenticated;
