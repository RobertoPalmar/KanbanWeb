-- =============================================================================
-- SUPERADA por 20260824000400_issues_soft_delete.sql
--
-- La politica issues_delete_admin que crea este archivo fue REVOCADA por esa
-- migracion posterior: al pasar a soft-delete, borrar dejo de ser un DELETE y
-- dejar la politica puesta era una puerta al problema que el soft-delete existe
-- para evitar (un admin destruyendo el historico desde la consola creyendo que
-- replica la papelera de la UI). Hoy no hay ninguna politica FOR DELETE sobre
-- issues.
--
-- Se conserva por historial. NO reejecutar sola: dejaria la base en un estado
-- que la 000400 ya descarto.
-- =============================================================================

-- =============================================================================
-- Borrado de tickets · política DELETE explícita
--
-- NO CAMBIA NINGÚN PERMISO. Es una migración de intención, y por eso vale la
-- pena aplicarla igual.
--
-- ESTADO ANTERIOR. `issues_admin_all` es `for all to authenticated using
-- (is_admin())`, y `for all` incluye DELETE. Así que el admin ya podía borrar y
-- el member ya no podía —no existe ninguna otra política FOR DELETE sobre
-- `issues`, y sin política permisiva el comando se deniega. El comentario de
-- 20260821000300_rls.sql lo dice tal cual: "Se implementa por omisión: no hay
-- política FOR DELETE salvo la de admin."
--
-- POR QUÉ DEJARLO IMPLÍCITO ERA UN PROBLEMA. Ahora hay una papelera en el
-- panel de detalle apuntando a este DELETE. Que el permiso más destructivo del
-- esquema se lea entre líneas de un `for all` —y que su ausencia para el member
-- sea la ausencia de una línea— es exactamente lo que se rompe en silencio el
-- día que alguien agregue `issues_delete_owner` "por simetría" con
-- `issues_update_owner`. Con la política escrita, ese cambio es un diff visible
-- que hay que justificar.
--
-- POR QUÉ SOLO ADMIN, Y NO EL DUEÑO. Un DELETE se lleva por cascade el
-- `issue_activity` del ticket, que es la FUENTE de `issue_timings`,
-- `weekly_cycle_time` y `aging_wip`. Borrar un ticket ya cerrado no lo saca del
-- tablero: le saca su cycle time al histórico y cambia series de semanas que ya
-- se habían reportado. El member que quiere sacarse un ticket de encima tiene
-- `cancelled`, que conserva todo. Borrar es para lo que nunca debió existir —un
-- duplicado, una prueba, un import mal hecho— y eso lo decide un admin.
-- =============================================================================

create policy issues_delete_admin on issues
  for delete to authenticated
  using (is_admin());

-- Los hijos NO necesitan política de DELETE para la cascada: las FK
-- `on delete cascade` de issue_supporters, issue_labels, issue_activity,
-- comments y attachments las ejecuta el sistema, que no pasa por RLS. La
-- cascada no es un DELETE del usuario.
--
-- Los ARCHIVOS de Storage sí quedan afuera: ninguna FK llega al bucket. Los
-- borra la Server Action `eliminarTicket` (app/actions/issues.ts), leyendo las
-- rutas ANTES del DELETE, porque después de la cascada ya no existen.
