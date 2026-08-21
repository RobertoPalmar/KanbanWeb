-- =============================================================================
-- MVP 1 · Import CSV/XLSX
--
-- Los tickets importados con un estado avanzado no tienen historia de
-- transiciones. Se importan con su estado TAL CUAL, saltándose la validación de
-- secuencia, y registran un único evento `imported` en lugar de una cadena de
-- transiciones falsas.
--
-- Su started_at queda nulo, lo que los excluye automáticamente de
-- issue_cycle_times. Sin eso, un import masivo distorsionaría todas las
-- métricas del primer mes.
--
-- Idempotencia por external_id: reimportar el mismo archivo actualiza en lugar
-- de duplicar.
--
-- SECURITY DEFINER + verificación explícita de admin: la función necesita
-- activar `app.importing`. La comprobación de rol reemplaza a la RLS que se
-- está saltando.
-- =============================================================================

create or replace function import_issues(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_row          jsonb;
  v_actor        uuid := auth.uid();
  v_type_id      uuid;
  v_owner_id     uuid;
  v_priority     uuid;
  v_state        issue_state;
  v_external     text;
  v_existing     uuid;
  v_created      int := 0;
  v_updated      int := 0;
  v_skipped      int := 0;
  v_errors       jsonb := '[]'::jsonb;
  v_default_type uuid;
begin
  if v_actor is not null and not is_admin() then
    raise exception 'Importar tickets es una acción de admin' using errcode = '42501';
  end if;

  -- Activa el bypass de secuencia para el resto de la transacción.
  perform set_config('app.importing', 'on', true);

  select id into v_default_type from issue_types
   where not archived order by "order" limit 1;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    begin
      v_external := nullif(trim(v_row ->> 'external_id'), '');

      -- Tipo por nombre; si no coincide, cae al tipo por defecto.
      select id into v_type_id from issue_types
       where lower(name) = lower(trim(v_row ->> 'type')) and not archived
       limit 1;
      v_type_id := coalesce(v_type_id, v_default_type);

      -- Responsable por email o por nombre.
      select id into v_owner_id from users
       where lower(email) = lower(trim(v_row ->> 'owner'))
          or lower(name)  = lower(trim(v_row ->> 'owner'))
       limit 1;

      v_owner_id := coalesce(v_owner_id, v_actor);

      if v_owner_id is null then
        v_skipped := v_skipped + 1;
        v_errors := v_errors || jsonb_build_object(
          'row', v_row ->> 'rowNumber',
          'message', 'No se pudo determinar el responsable');
        continue;
      end if;

      select id into v_priority from priorities
       where lower(name) = lower(trim(v_row ->> 'priority')) and not archived
       limit 1;

      v_state := coalesce((v_row ->> 'state')::issue_state, 'todo');

      if v_external is not null then
        select id into v_existing from issues where external_id = v_external;
      else
        v_existing := null;
      end if;

      if v_existing is not null then
        update issues set
          title       = coalesce(nullif(trim(v_row ->> 'title'), ''), title),
          description = coalesce(v_row ->> 'description', description),
          type_id     = v_type_id,
          state       = v_state,
          owner_id    = v_owner_id,
          priority_id = coalesce(v_priority, priority_id),
          weight      = coalesce((v_row ->> 'weight')::numeric, weight),
          due_date    = coalesce((v_row ->> 'due_date')::date, due_date)
        where id = v_existing;

        v_updated := v_updated + 1;
      else
        insert into issues (
          title, description, type_id, state, owner_id, created_by,
          priority_id, weight, due_date, external_id, imported
        ) values (
          trim(v_row ->> 'title'),
          nullif(trim(v_row ->> 'description'), ''),
          v_type_id, v_state, v_owner_id, coalesce(v_actor, v_owner_id),
          v_priority,
          (v_row ->> 'weight')::numeric,
          (v_row ->> 'due_date')::date,
          v_external, true
        );

        v_created := v_created + 1;
      end if;

    exception when others then
      -- Una fila mala no debe abortar el import entero: se reporta y se sigue.
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_object(
        'row', v_row ->> 'rowNumber', 'message', sqlerrm);
    end;
  end loop;

  return jsonb_build_object(
    'created', v_created, 'updated', v_updated,
    'skipped', v_skipped, 'errors', v_errors);
end;
$fn$;

revoke execute on function import_issues(jsonb) from public, anon;
grant  execute on function import_issues(jsonb) to authenticated;
