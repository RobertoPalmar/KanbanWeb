-- =============================================================================
-- Borrar definitivamente a un usuario ya desactivado
--
-- Desactivar (`active = false`) es la salida normal: la historia de issues,
-- comentarios y activity log lo referencia, y borrarlo dejaría los reportes sin
-- autor. Pero hay un caso donde la desactivación es puro ruido: la persona nunca
-- hizo nada. Una invitación aceptada por error, alguien que se fue la primera
-- semana, una cuenta de prueba. Esas filas se acumulan en la lista del equipo
-- para siempre.
--
-- Esta función borra SOLO en ese caso, y devuelve el motivo cuando no puede.
-- El conteo y el borrado van en la misma transacción con FOR UPDATE: entre
-- "no tiene tickets" y "borralo" no puede colarse un INSERT.
--
-- Las cuatro FK RESTRICT (issues.owner_id, issues.created_by, comments.author_id
-- y attachments.uploaded_by) son la red final: aunque esta comprobación fallara,
-- Postgres no dejaría borrar a alguien con rastro.
-- =============================================================================

create or replace function eliminar_usuario_sin_rastro(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor        uuid := auth.uid();
  v_objetivo     users%rowtype;
  v_issues       int;
  v_comentarios  int;
  v_adjuntos     int;
  v_admins       int;
begin
  if v_actor is not null and not is_admin() then
    raise exception 'Solo un admin puede eliminar usuarios' using errcode = '42501';
  end if;

  if v_actor is not null and v_actor = p_user_id then
    raise exception 'No podés eliminarte a vos mismo' using errcode = '42501';
  end if;

  -- FOR UPDATE: nadie le asigna un ticket mientras se decide.
  select * into v_objetivo from users where id = p_user_id for update;

  if v_objetivo.id is null then
    raise exception 'El usuario no existe' using errcode = '42704';
  end if;

  -- Eliminar es la continuación de desactivar, no un atajo. Obliga a que alguien
  -- ya haya decidido que esta persona no trabaja más acá.
  if v_objetivo.active then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'activo',
      'mensaje', 'Primero hay que desactivar el acceso de la persona. Eliminar es el paso siguiente.'
    );
  end if;

  -- El último admin no se elimina, igual que no se degrada ni se desactiva.
  if v_objetivo.role = 'admin' then
    select count(*) into v_admins from users where role = 'admin' and active;
    if v_admins = 0 then
      return jsonb_build_object(
        'ok', false,
        'motivo', 'ultimo_admin',
        'mensaje', 'Es el único admin que queda. Nombrá otro admin antes de eliminarlo.'
      );
    end if;
  end if;

  select count(*) into v_issues
    from issues where owner_id = p_user_id or created_by = p_user_id;

  select count(*) into v_comentarios from comments    where author_id  = p_user_id;
  select count(*) into v_adjuntos    from attachments where uploaded_by = p_user_id;

  if v_issues > 0 or v_comentarios > 0 or v_adjuntos > 0 then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'tiene_historial',
      'issues', v_issues,
      'comentarios', v_comentarios,
      'adjuntos', v_adjuntos,
      'mensaje', 'La persona dejó trabajo registrado en el tablero. Si se eliminara, esos tickets y comentarios se quedarían sin autor y los reportes de meses anteriores cambiarían. Queda desactivada, que es lo que corresponde.'
    );
  end if;

  -- La invitación que ESTA persona aceptó se conserva, soltando la referencia:
  -- accepted_by admite null y la fila documenta que la invitación existió.
  update invitations set accepted_by = null where accepted_by = p_user_id;

  -- Las que ELLA envió se borran: created_by es NOT NULL y no se puede soltar.
  -- No se pierde nada relevante: si la invitación fue aceptada, la cuenta
  -- resultante ya existe por su cuenta y es el rastro que importa; si sigue
  -- pendiente, apunta a una cuenta que ya no está y no se puede aceptar.
  delete from invitations where created_by = p_user_id;

  -- El borrado de auth.users arrastra `users` por CASCADE, y con ella
  -- preferencias, vistas guardadas y apoyos.
  delete from auth.users where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'email', v_objetivo.email,
    'nombre', v_objetivo.name
  );
end;
$fn$;

revoke execute on function eliminar_usuario_sin_rastro(uuid) from public, anon;
grant  execute on function eliminar_usuario_sin_rastro(uuid) to authenticated;
