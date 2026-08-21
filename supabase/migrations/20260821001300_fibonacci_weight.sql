-- =============================================================================
-- MVP 1 · Escala de estimación: Fibonacci (decisión confirmada)
--
-- El diseño SUMA pesos en tres lugares —cabecera de grupo de la tabla, cabecera
-- de columna kanban y barra de carga de Personas— así que el peso tiene que ser
-- numérico y de un conjunto acotado. Sin validación, alguien escribe 7 y la
-- suma sigue funcionando, pero la estimación deja de ser comparable entre
-- personas, que es todo el punto de estimar.
--
-- La escala t-shirt queda descartada para MVP 1: no se puede sumar.
-- =============================================================================

create or replace function valid_weight(w numeric)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $fn$
  select w is null or w in (1, 2, 3, 5, 8, 13);
$fn$;

alter table issues
  add constraint issues_weight_fibonacci check (valid_weight(weight));

revoke execute on function valid_weight(numeric) from public, anon;
grant  execute on function valid_weight(numeric) to authenticated;

-- El toggle queda encendido: el diseño muestra la columna de peso por defecto
-- (data-peso="si") y la carga de Personas depende de ella.
update settings set estimation_enabled = true, estimation_scale = 'fibonacci';
