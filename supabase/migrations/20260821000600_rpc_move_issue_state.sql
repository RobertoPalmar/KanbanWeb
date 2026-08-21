-- =============================================================================
-- MVP 1 · RPC para mover de estado
--
-- Por qué una RPC y no dos llamadas desde el cliente: cancelar exige un
-- comentario. PostgREST ejecuta cada request en su propia transacción, así que
-- un INSERT de comentario seguido de un UPDATE de estado serían dos
-- transacciones distintas. Además, si el UPDATE fallara tras insertar el
-- comentario, quedaría un comentario huérfano explicando una cancelación que
-- nunca ocurrió.
--
-- SECURITY INVOKER (el default): corre con los permisos de quien llama, así que
-- RLS y todos los triggers de validación siguen aplicando. La RPC agrupa las
-- sentencias en una transacción; no otorga privilegios.
--
-- Sobre la validación del comentario: el constraint trigger
-- `issues_enforce_transition_comment` es DEFERRABLE INITIALLY DEFERRED y corre
-- al COMMIT, es decir DESPUÉS de que la función retorna. Si la RPC dependiera
-- solo de él, el cliente recibiría un OK y la transacción fallaría después: la
-- UI mostraría el ticket cancelado y la base lo habría revertido. Por eso la
-- función valida por adelantado. El trigger diferido se mantiene como red de
-- seguridad para cualquier UPDATE que no pase por aquí.
-- =============================================================================

create or replace function move_issue_state(
  p_issue_id uuid,
  p_to_state issue_state,
  p_comment  text default null
)
returns void
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  v_from             issue_state;
  v_requires_comment boolean := false;
  v_has_comment      boolean;
begin
  select state into v_from from issues where id = p_issue_id;

  if v_from is null then
    raise exception 'El ticket no existe o no tenés permiso para verlo'
      using errcode = '42501';
  end if;

  if v_from = p_to_state then
    raise exception 'El ticket ya está en ese estado' using errcode = '23514';
  end if;

  select coalesce(t.requires_comment, false) into v_requires_comment
    from state_transitions t
   where t.from_state = v_from and t.to_state = p_to_state;

  v_has_comment := p_comment is not null and length(trim(p_comment)) > 0;

  -- Validación sincrónica: el error llega en la misma llamada.
  if coalesce(v_requires_comment, false) and not v_has_comment then
    raise exception 'La transición % -> % exige un comentario que explique el motivo',
      v_from, p_to_state using errcode = '23514';
  end if;

  -- system_reason distingue el comentario exigido por la transición de un
  -- comentario voluntario, para poder mostrarlos distinto en el detalle.
  if v_has_comment then
    insert into comments (issue_id, author_id, body, system_reason)
    values (p_issue_id, auth.uid(), trim(p_comment), coalesce(v_requires_comment, false));
  end if;

  update issues set state = p_to_state where id = p_issue_id;

  -- Un UPDATE sin filas afectadas significa que RLS lo filtró: el usuario ve el
  -- ticket pero no puede moverlo. Sin esto el cliente recibiría éxito
  -- silencioso y la UI pintaría un cambio que no ocurrió.
  if not found then
    raise exception 'No tenés permiso para mover este ticket' using errcode = '42501';
  end if;
end;
$fn$;

revoke execute on function move_issue_state(uuid, issue_state, text) from public, anon;
grant  execute on function move_issue_state(uuid, issue_state, text) to authenticated;
