# Backend — Sistema de Gestión de Trabajo (MVP 1)

Estado del proyecto Supabase y decisiones tomadas durante la implementación.

**Proyecto:** `bpitialkrbfgwsriiips` · región `us-east-2` · plan gratuito
**URL:** `https://bpitialkrbfgwsriiips.supabase.co`

---

## 1. Ambigüedad de la especificación que hubo que resolver

El documento incluye **dos secciones numeradas 2.4** con reglas incompatibles:

| | Primera 2.4 | Segunda 2.4 |
|---|---|---|
| Admin y la secuencia | "no tiene restricción… se salta por completo" | "**Ningún rol** puede saltar estados, incluido el admin" |
| `cancelled` | reactivable por admin | "terminal, sin reactivación en MVP 1" |
| `draft` → | solo `cancelled` | `todo` (aprobación) o `cancelled` |

**Se implementó la segunda 2.4.** Es la más específica (incluye `ADMIN_ONLY`,
`REQUIRES_COMMENT` y la nota sobre imports) y la sección 3 la respalda:
*"El admin tiene alcance total, no exención de secuencia."*

La tabla de permisos de la sección 3 dice lo contrario en una fila
("Saltarse la secuencia: Admin ✓"), contradiciendo su propio párrafo siguiente.
Se ignoró esa fila.

**Para revertir la decisión** basta con un UPDATE, sin tocar código:

```sql
-- Permitir que el owner también reabra un ticket finalizado
update state_transitions set admin_only = false
 where from_state = 'done' and to_state = 'in_review';
```

Consecuencia si se revierte: el throughput semanal deja de ser estable — pasa a
ser un número que cambia hacia atrás.

---

## 2. Dónde vive cada regla

La regla de oro: **lo que no puede evadirse desde el cliente vive en la base.**

| Regla | Dónde | Por qué ahí |
|---|---|---|
| Alcance (qué tickets toca cada rol) | Políticas RLS | Es filtrado por fila |
| Secuencia de estados | Trigger `enforce_state_transition` | Un `UPDATE` directo la evadiría |
| Comentario al cancelar | RPC `move_issue_state` + trigger diferido | Necesita transacción |
| Estado inicial (draft vs todo) | Trigger `set_initial_state` | El cliente podría mentir |
| Reasignar owner = admin | Trigger `guard_owner_reassignment` | Las políticas RLS se combinan con OR |
| Cambio de rol | Trigger `guard_role_change` | Escalada de privilegios |
| Activity log | Trigger `log_issue_activity` | Ningún camino de código puede omitirlo |
| Feedback previo en el kanban | `lib/transitions.ts` | Solo UX; no es seguridad |

`lib/states.ts` y `lib/transitions.ts` son **espejo** de la base, no la fuente de
verdad. Si divergen, manda la base.

---

## 3. Migraciones aplicadas

| Archivo | Contenido |
|---|---|
| `20260821000100_schema.sql` | Enums, tablas, índices, semillas |
| `20260821000200_transitions_activity.sql` | `state_transitions`, triggers de secuencia y activity log |
| `20260821000300_rls.sql` | Políticas RLS, alta de usuarios |
| `20260821000400_metrics.sql` | Vistas y funciones de métricas |
| `20260821000500_hardening.sql` | Correcciones halladas al probar (ver §4) |
| `20260821000600_rpc_move_issue_state.sql` | RPC transaccional para mover de estado |
| `20260821000700_rls_performance.sql` | `(select auth.uid())` + índices de FK |
| `20260821000800_storage_attachments.sql` | Bucket privado de adjuntos, 25 MB |
| `20260821000900_rpc_import_issues.sql` | Import idempotente CSV/XLSX |
| `20260821001000_fix_importing_flag_escalation.sql` | Cierre de escalada de privilegios (ver §4.5) |
| `20260821001100_design_handoff_fields.sql` | Siglas y colores de tipo, cargo y capacidad, preferencias |
| `20260821001200_bootstrap_user_preferences.sql` | Alta automática de preferencias |
| `20260821001300_fibonacci_weight.sql` | Escala Fibonacci con CHECK |
| `20260821001400_drafts_inbox_and_metrics.sql` | Bandeja de borradores, aging WIP, cycle time semanal |

---

## 4. Bugs encontrados al probar contra la base real

Los cuatro primeros archivos pasaron el linter pero fallaron pruebas de
comportamiento. Cada uno se corrigió y se volvió a verificar.

### 4.1 El guardia append-only bloqueaba la integridad referencial

Borrar un usuario fallaba con *"issue_activity es append-only: UPDATE no está
permitido"*. El trigger a nivel de statement rechazaba también lo que Postgres
ejecuta internamente:

- `actor_id ON DELETE SET NULL` → un UPDATE interno
- `issue_id ON DELETE CASCADE` → un DELETE interno

**Ningún usuario podía borrarse jamás.** Se pasó a triggers por fila que
reconocen exactamente esas dos firmas y rechazan todo lo demás.

### 4.2 `guard_role_change` bloqueaba al service role

`is_admin()` consulta `auth.uid()`, que es `NULL` con service key, así que
devolvía `false`. No había forma de asignar roles desde el backend: ni el
bootstrap inicial, ni una Edge Function de invitaciones, ni un script. Todo
dependía de un admin que todavía no existía.

Se agregó además la protección del último admin: no puede autodegradarse.

### 4.3 Un member podía reasignar el owner de su propio ticket

Es decir, sacarse trabajo de encima sin aprobación — el control de asignación
entero quedaba sin efecto.

**Causa:** las políticas RLS permisivas se combinan con **OR**.
`issues_update_owner` exigía `owner_id = auth.uid()` en su `WITH CHECK`, pero
`issues_update_draft_creator` se satisfacía por `created_by = auth.uid()`. En un
ticket donde el member es a la vez owner y creador — el caso normal — la segunda
política abría el paso.

Se resolvió con un trigger, que expresa la regla una sola vez y no depende de
cómo se combinen las políticas presentes ni futuras.

### 4.4 La RPC devolvía éxito al cancelar sin comentario

El constraint trigger que exige el comentario es `DEFERRABLE INITIALLY DEFERRED`:
corre al COMMIT, **después** de que la función retorna. En producción PostgREST
haría el COMMIT y el error llegaría cuando el cliente ya recibió un OK: la UI
mostraría el ticket cancelado y la base lo habría revertido.

La RPC ahora valida por adelantado. El trigger diferido queda como red de
seguridad para cualquier `UPDATE` que no pase por la RPC.

### 4.5 Escalada de privilegios vía `app.importing` (la más seria)

`is_importing()` solo leía `current_setting('app.importing')`, y **cualquier rol
puede llamar a `set_config()` sobre una variable de usuario**. Un member que
consiguiera ejecutar SQL arbitrario podía hacer:

```sql
select set_config('app.importing', 'on', true);
update issues set state = 'done' where id = <un ticket suyo>;
```

y saltarse la validación de secuencia entera — falseando throughput y cycle
time, justo la manipulación que la regla de secuencia existe para impedir.
**Se verificó explotable antes del fix:** el ticket pasó de `todo` a `done`.

Apoyarse en que "PostgREST no expone `set_config`" es un supuesto sobre la capa
de transporte, no una garantía de la base. El bypass ahora exige **dos**
condiciones: la bandera activa **y** un actor con permiso real de importar.

Tras el fix se verificó que el exploit falla, que el flujo normal del member
sigue funcionando y que el import del admin no se rompió.

---

## 5. Estado del linter

**Seguridad:** de 21 warnings iniciales quedan 4, todos intencionales y ninguno
de nivel ERROR:

- `is_admin()`, `can_write()`, `current_role_of()` — solo leen el rol del propio
  `auth.uid()`, información que el usuario ya tiene sobre sí mismo. La UI los
  necesita para ocultar acciones no permitidas.
- `import_issues()` — es `SECURITY DEFINER` a propósito (necesita activar
  `app.importing`), y verifica `is_admin()` en su primera línea.

**Rendimiento:** los `auth_rls_initplan` se corrigieron envolviendo `auth.uid()`
en `(select ...)`, que lo evalúa una vez por query en vez de una vez por fila.

Los `unused_index` restantes son esperables: la base está vacía, ningún índice
se usó todavía.

---

## 6. Cosas que el frontend debe saber

### Estado inicial: no lo mandes

El trigger `set_initial_state` lo decide y sobrescribe lo que venga del cliente.
`lib/transitions.ts → initialState()` existe solo para mostrar el estado
correcto en el formulario antes de guardar.

### Mover de estado: usá siempre la RPC

```ts
const result = await moveIssueState(supabase, issueId, 'cancelled', motivo)
if (result.needsComment) {
  // abrir el diálogo de motivo y reintentar
}
```

Un `UPDATE` directo sobre `issues.state` funciona para transiciones normales,
pero para cancelar rompe: el comentario tiene que ir en la misma transacción.

### Kanban: deshabilitar antes de soltar

```ts
const targets = allowedTargets(issue.state, { isAdmin, isOwner })
```

Con 6 columnas y solo 2–3 destinos válidos, el feedback tiene que ser previo.
Rechazar el drop después de soltarlo es la peor versión.

### Los borradores están fuera de las métricas

`draft` no es `started` ni `completed`, así que queda excluido de WIP,
throughput y cycle time por construcción. Aparece en el kanban, en el filtro de
la tabla, y en `pending_drafts` para el badge del admin.

### Tickets importados

`imported = true` los excluye de `issue_cycle_times`. Su `started_at` es nulo
porque no tienen historia de transiciones — solo un evento `imported`. Sin esto,
un import masivo distorsionaría todas las métricas del primer mes.

---

## 7. Estado por paso del plan de construcción

| # | Paso | Estado |
|---|---|---|
| 1 | Schema + RLS | ✅ aplicado y probado |
| 2 | Auth, roles | ✅ alta automática, primer usuario = admin |
| 3 | Configuración: tipos y labels | ✅ tablas + semillas + queries |
| 4 | CRUD de tickets + activity log | ✅ el log escribe desde el trigger |
| 5 | Vista tabla con filtros | ⏳ backend listo (`listIssues`), falta UI |
| 6 | Kanban con drag & drop | ⏳ backend listo (`allowedTargets`), falta UI |
| 7 | Detalle: comentarios, adjuntos, historial | ✅ backend completo |
| 8 | Miembros | ✅ `getMemberStats`, `member_wip` |
| 9 | Calendario | ⏳ backend listo (filtros por fecha), falta UI |
| 10 | Dashboard | ✅ `dashboard_summary()` — 9 números en una llamada |
| 11 | Import CSV/XLSX | ✅ parser + RPC, probado idempotente |
| 12 | Reportes PDF | ⏳ `monthly_summary` listo, falta generación |

### Las 4 métricas del MVP 1

| Métrica | Dónde |
|---|---|
| **WIP** | `member_wip` — conteo y suma de pesos por persona |
| **Throughput** | `weekly_throughput` — cerrados por semana, excluye cancelados |
| **Cycle time p85** | `cycle_time_p85()` global · `weekly_cycle_time` serie |
| **Aging WIP** | `aging_wip` con umbrales 3 / 7 / 14 días |

### Pendiente

- [ ] Invitaciones de miembros (Edge Function con service role)
- [ ] Generación del PDF
- [ ] Implementación del front
