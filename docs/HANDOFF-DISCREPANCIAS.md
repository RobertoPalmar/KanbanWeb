# Handoff de diseño vs. backend

> **Estado: las tres decisiones abiertas están cerradas.** Ver §6.
> 1. `cancelled` queda terminal → se corrige el diseño.
> 2. Cycle time p85, aging WIP y bandeja de borradores → se agregan con el
>    lenguaje visual del handoff. Especificación en
>    [DISENO-PANTALLAS-NUEVAS.md](DISENO-PANTALLAS-NUEVAS.md).
> 3. Estimación → Fibonacci, validada por constraint en la base.


Análisis del handoff (`design_handoff_gestion_trabajo`) contra la base ya
implementada y probada.

**La buena noticia primero:** la alineación estructural es casi total. Los 6
estados con sus etiquetas en español exactas, un owner obligatorio + N apoyos,
los 8 tipos nombre por nombre, las 4 prioridades, adjuntos archivo/enlace,
y el peso desactivable globalmente. El diseño se construyó sobre la misma
especificación, y se nota.

---

## 1. Conflicto — RESUELTO: se corrige el diseño

### `cancelled` reabrible

| | |
|---|---|
| **Diseño** | `cancelado: ['borrador', 'porhacer']` — se puede arrastrar de vuelta |
| **Base** | `cancelled` es **terminal**, sin transiciones de salida |

En el kanban del prototipo, una tarjeta cancelada se puede arrastrar a Borrador
o Por hacer, y la UI la presenta como destino válido (cabecera resaltada,
fantasma diciendo "Soltar en Por hacer"). **El backend lo rechazaría.**

La especificación es explícita al respecto:

> `cancelled` es terminal. No hay reactivación en MVP 1. Si el trabajo revive,
> se crea un ticket nuevo. Esto mantiene limpio el cálculo de tiempos y evita
> tickets con historia zigzagueante.

**Decidido: se corrige el diseño.** Es una regla deliberada de la
especificación, con su razón escrita. El front usa:

```ts
cancelled: []  // no ['draft', 'todo']
```

que es lo que ya tiene `lib/transitions.ts`. Ver §6.1 para qué implica en el
kanban.

---

## 2. Reglas del backend que el diseño no expresa

Ninguna es un conflicto — son cosas que el diseño simplemente no dibujó, y que
si no se implementan producen errores del servidor sin explicación en la UI.

### 2.1 Transiciones exclusivas de admin

`draft → todo` (aprobación) y `done → in_review` (reapertura) son admin-only.
El diseño las presenta como arrastres normales.

**Lo bueno:** el diseño ya tiene el mecanismo visual para esto. Las columnas
inválidas bajan a `opacity:.38`, el fantasma dice "Destino no válido", y hay una
barra de pista al pie que "explica la restricción". Para un no-admin, esas dos
transiciones simplemente no ofrecen destino válido y la pista dice por qué. **No
hace falta diseño nuevo.**

### 2.2 Cancelar exige comentario

El diseño ejecuta el cambio directo, con confirmación de 900 ms. La base lo
rechaza sin comentario.

**Falta diseñar:** un paso de motivo al arrastrar a Cancelado. La RPC
`move_issue_state` ya devuelve `needsComment: true` para que la UI abra el
diálogo y reintente.

### 2.3 Los apoyos no editan

El panel de detalle presenta Estado, Prioridad, Tipo, Dueño y Vence como campos
editables en sitio **para cualquiera que abra el panel**. La base solo permite
al owner y al admin.

El único lugar donde el diseño sí respeta el permiso es el arrastre del kanban
(`ticket.dueno === usuarioActual`).

**Lo bueno:** el token del estado deshabilitado ya existe en la hoja de Sistema
visual (`border-color: var(--linea); background: var(--superficie-2); color:
var(--tinta-3)`). Solo falta aplicarlo.

### 2.4 No existe el concepto de rol en la UI

No hay indicador del rol propio, ni gestión de miembros, ni diferencia visual
entre viewer/member/admin. Un **viewer** vería el botón "Nuevo ticket", campos
editables y tarjetas arrastrables — todo lo cual el backend rechaza.

`lib/permissions.ts` tiene las funciones para ocultar cada cosa; falta cablearlas.

---

## 3. Campos que agregué a la base

El diseño los necesita y son claramente correctos, así que ya están aplicados
(migración `20260821001100_design_handoff_fields.sql`):

| Campo | Dónde lo usa el diseño |
|---|---|
| `issue_types.abbrev` | Sigla de 2 letras (PB, DG, VD…) en la fila de 28 px |
| `issue_types.color` | Punto y fondo de la píldora de tipo (ya existía, ahora con la paleta del diseño) |
| `users.job_title` | Cargo descriptivo en Personas ("Producción y eventos") — distinto de `role`, que es permisos |
| `users.capacity` | Barra de carga en Personas. El diseño lo hardcodea en 20; como columna, cada persona puede tener la suya |
| `user_preferences` | Tema y densidad, por usuario |
| `notification_preferences` | Los 3 interruptores de Ajustes |
| `saved_views.is_shared/is_pinned/order` | Vistas propias vs. del equipo, fijadas en la nav |

Las preferencias se crean solas al dar de alta un usuario, así que el front
nunca recibe `null`.

---

## 4. Lo que la base tiene y el diseño no muestra

No es un problema — es alcance que quedó fuera del prototipo. Lo listo para que
decidas si entra en el MVP 1:

| Disponible en la base | Estado en el diseño |
|---|---|
| **Cycle time p85** | ✅ **Especificado** — ver DISENO-PANTALLAS-NUEVAS.md |
| **Aging WIP** (tickets estancados) | ✅ **Especificado** — tarjeta en Panel + sección en Miembros |
| Bandeja de borradores | ✅ **Especificada** — vista propia + badge en la nav |
| `created_by`, `created_at` | ❌ El detalle solo muestra Vence. No hay "creado por X el Y" |
| Gestión de miembros y roles | ❌ Sin pantalla. Personas es un dashboard de carga, no un administrador |
| `settings.org_name` / `logo_url` | ❌ La marca está hardcodeada ("C" + "COMUNICACIÓN"). La especificación los pide para el encabezado de los PDF |
| `imported` / `external_id` | ❌ Sin marca visual de ticket importado |
| `estimation_scale` t-shirt | ✅ **Descartada** — Fibonacci confirmado, ver §6.3 |

Los tres pendientes que quedan (autoría en el detalle, gestión de miembros,
datos de la organización) son requisitos de la especificación sin diseño. No
bloquean: la base ya los soporta.

---

## 5. Detalles menores

- **Orden de prioridad invertido.** El diseño numera 1=Baja..4=Urgente; la base
  ordena 1=Urgente..4=Baja. El front debe ordenar por `order` y nunca por el
  número del prototipo. `lib/design-map.ts` indexa los íconos por nombre
  justamente para evitar el cruce.
- **Claves de estado.** `porhacer` vs `todo`, `progreso` vs `in_progress`, etc.
  Las etiquetas visibles coinciden exactamente. Resuelto en `DESIGN_STATE_TO_DB`;
  el código usa el enum de la base.
- **Etiquetas sin color.** El diseño usa chips grises uniformes; la base tiene
  `labels.color`. Se puede aprovechar o ignorar.
- **Adjunto de 184 MB** en los datos de ejemplo, con límite real de 25 MB. Es
  dato simulado, pero conviene que el ejemplo no sugiera un límite que no existe.
- **README vs HTML.** Difieren en `--nav-fg`, `--nav-fg-2` y en el path del
  ícono de Urgente. Tomé el **HTML**, que es el artefacto hifi. Anotado en
  `app/tokens.css`.

---

## 6. Decisiones tomadas

### 6.1 `cancelled` es terminal — se corrige el diseño

La base queda como está. El front debe usar `cancelled: []`, que ya es lo que
tiene `lib/transitions.ts`.

**Qué cambia en el prototipo:** la columna Cancelado del kanban deja de ser
origen de arrastre. Sus tarjetas se abren pero no se levantan — el mismo
tratamiento que ya reciben las tarjetas ajenas (`cursor: default`, sin elevación
en hover, `border-left: 1px solid var(--linea)` en lugar de los 3 px de
`--linea-fuerte`).

Si un ticket cancelado tiene que revivir, se crea uno nuevo. Eso mantiene limpio
el cálculo de tiempos y evita tickets con historia zigzagueante.

### 6.2 Las tres piezas faltantes se agregan

Backend listo:

| Pieza | Vista / función SQL |
|---|---|
| Bandeja de borradores | `draft_inbox` + `approveDraft` / `rejectDraft` |
| Aging WIP | `aging_wip` con umbrales 3 / 7 / 14 días |
| Cycle time p85 | `weekly_cycle_time` (serie de 8 semanas) |
| Resumen del Panel | `dashboard_summary()` — nueve números en una llamada |

Especificación visual completa en
[DISENO-PANTALLAS-NUEVAS.md](DISENO-PANTALLAS-NUEVAS.md).

### 6.3 Fibonacci

`1, 2, 3, 5, 8, 13`, validado por constraint en `issues.weight`. Sin la
validación, alguien escribe 7 y la suma sigue funcionando pero la estimación
deja de ser comparable entre personas, que es todo el punto de estimar.

La escala t-shirt queda descartada para el MVP 1: el diseño suma pesos en tres
lugares y S/M/L no se suma. El toggle de estimación queda **encendido** por
defecto, que es lo que el diseño asume (`data-peso="si"`).

`FIBONACCI_WEIGHTS` en `lib/queries/catalog.ts` y el CHECK de la base tienen que
moverse juntos si algún día cambia la escala.
