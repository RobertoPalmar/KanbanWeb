# Diseño de pantallas nuevas — MVP 1

Especificación de las tres piezas que la especificación del MVP 1 exige y que el
handoff hifi (`Gestión de trabajo.dc.html`) no dibujó:

1. **Bandeja de borradores** — vista nueva, solo admin, con badge en la barra lateral.
2. **Cycle time p85** — tarjeta nueva en el Panel.
3. **Aging WIP** — tarjeta nueva en el Panel + sección en la ficha de Miembros.

Este documento **no** define tokens nuevos. Todo valor de color, tamaño, radio y
duración sale del handoff o de `app/tokens.css`. Donde una medida no existía en el
handoff, se deriva de un patrón que sí existe y se indica de dónde viene.

## Principios que gobiernan estas tres piezas

Los mismos tres del handoff, sin excepción:

- **Densidad de información.** Cada pieza tiene que aportar decisión, no ocupar
  espacio. Nada de tarjetas de estadística con número grande y flechita verde.
- **Legibilidad sostenida.** Esto se mira ocho horas por día. Nada de gradientes,
  glassmorphism, sombras difusas de 40px ni animación decorativa.
- **Velocidad de escaneo.** Lo numérico y categórico va en IBM Plex Mono para que
  las columnas alineen solas; lo narrativo en Archivo.

Y la regla no negociable de accesibilidad: **la interfaz nunca depende solo del
color.** Cada nivel de aging, cada estado de muestra, cada nivel de espera lleva
además una marca no cromática (punto lleno, borde punteado, glifo, texto).

## Referencia de tokens usados

| Token | Uso en estas pantallas |
|---|---|
| `--lienzo` | fondo de las tres vistas y de inputs en reposo |
| `--superficie` | tarjetas del Panel, filas de la bandeja, modal |
| `--superficie-2` | hover de fila, riel de barras, chips neutros, barras de carga |
| `--superficie-3` | activo de fila y de encabezado de grupo |
| `--linea` | hairline por defecto, borde de tarjeta |
| `--linea-fuerte` | separadores estructurales, borde de input, borde punteado |
| `--tinta` | texto primario, valor de dato |
| `--tinta-2` | metadatos, etiquetas, nivel `atencion` de aging |
| `--tinta-3` | placeholder, encabezado de columna, nivel `normal` de aging |
| `--acento` | foco, botón primario, selección |
| `--acento-suave` | fila abierta, fondo de destino válido |
| `--alerta` | vencido, nivel `critico` de aging, conteo urgente del badge |
| `--alerta-suave` | fondo de fila crítica |
| `#E07100` (= `--e4-fg`) | nivel `alerta` de aging, "en ≤3 días" |
| `--e1-fg` / `--e1-bg` | chip de Borrador (acromático, borde punteado) |
| `--e5-fg` / `--e5-bg` | confirmación de aprobado |
| `--e6-fg` / `--e6-bg` | confirmación de rechazado |

Radios: `6px` chips · `8px` inputs y botones de tab · `10px` campos y filas
clicables · `12px` tarjetas kanban y celdas · `14px` tarjetas de panel · `16px`
modal · `99px` píldoras.

Transiciones: `.1s` fondo de fila y ancho de tira · `.12s` hover de botón, borde,
sombra · `.16s` interruptor · `.3s` altura/ancho de barra al montar. **Ninguna
otra.**

---

# 1. Bandeja de borradores

## 1.1 Por qué existe y qué decide

Un borrador es trabajo que alguien pidió y que todavía no está pasando. Marcos
creó un ticket y se lo asignó a Ana; hasta que un admin lo apruebe, ese trabajo no
entró a la cola de Ana y nadie lo está haciendo. Si nadie los mira, se acumulan
invisibles.

La decisión que el admin toma en esta pantalla es una sola y binaria:
**¿este trabajo que X le asignó a Y debe entrar a la cola de Y?**

De ahí se deriva todo el layout: **"de X para Y" es la información central de cada
fila**, junto con cuánto lleva esperando. El título viene después. El peso, el tipo
y la prioridad son contexto de la decisión, no el sujeto.

Es admin-only. Un miembro que no es admin no ve la entrada de navegación ni el
badge, y la ruta responde con el estado vacío de "sin permiso" (§1.12).

## 1.2 Ruta y ubicación en la navegación

- Ruta: `/borradores`. Migaja: `Comunicación / Borradores`.
- La entrada va en la sección **VISTAS** de la barra lateral, primera de la lista,
  por encima de "Mis tickets". No es una entrada de la navegación principal (Panel ·
  Tickets · Calendario · Personas · Ajustes): esa lista es de superficies
  permanentes y la bandeja es una cola que idealmente queda vacía.

## 1.3 Badge de la barra lateral

La sección VISTAS ya tiene el patrón exacto: botón de 28px con etiqueta a la
izquierda y conteo mono a la derecha, y el conteo de "Vencidos" en `--alerta`. La
bandeja lo reutiliza sin inventar nada.

**Anatomía**

```
Borradores                                    4
└ Archivo 400 13px                            └ Plex Mono 400 11px
```

**Medidas exactas** (idénticas a las demás filas de VISTAS):

```
height: 28px; padding: 0 9px; border-radius: 10px; gap: 9px;
display: flex; align-items: center; justify-content: space-between;
border: 0; background: transparent; text-align: left;
transition: background .12s, color .12s;
```

**Etiqueta**: `font: 400 13px Archivo; color: var(--nav-fg)`.
**Conteo**: `font: 400 11px 'IBM Plex Mono', monospace`.

**Color del conteo según antigüedad** — la regla es la misma de "Vencidos":

| Condición | Color del conteo | Marca no cromática |
|---|---|---|
| 0 borradores | — | la fila entera no se renderiza |
| 1+ borradores, ninguno con `days_waiting ≥ 3` | `var(--tinta-3)` | solo el número |
| Al menos uno con `days_waiting ≥ 3` | `var(--alerta)` | punto lleno `●` de 5px antes del número, en `--alerta` |

El punto es lo que cumple el requisito de no depender del color: en escala de
grises, "hay algo esperando hace rato" se sigue percibiendo por la presencia del
glifo, no por el tono del número.

**Estados**

| Estado | Tratamiento |
|---|---|
| reposo | `background: transparent; color: var(--nav-fg)` |
| hover | `background: var(--nav-hover); color: #ffffff` |
| activo (ruta actual) | `background: var(--nav-activo); color: #ffffff; font-weight: 500` |
| foco | `outline: 2px solid var(--acento); outline-offset: 2px` |

**Cero borradores: la fila desaparece.** No se muestra "Borradores 0". Es la misma
decisión que la fila de chips de filtro del handoff: cero filtros, cero fila; no se
reserva espacio para lo que no existe. El admin llega a la bandeja vacía por URL
directa o desde el estado vacío del Panel.

**Refresco**: el conteo viene de `getPendingDraftCount()` y se revalida al montar
la app, al volver la pestaña al foco, y de forma optimista tras aprobar o rechazar
(decrementa en 1 en el acto, con rollback si la RPC falla).

**Accesibilidad**: el botón lleva `aria-label="Borradores, 4 pendientes de
aprobación"`. El conteo se anuncia en un `aria-live="polite"` cuando cambia por
una acción del propio usuario, para que un lector de pantalla confirme el
decremento después de aprobar.

## 1.4 Cabecera de la vista

Sigue el patrón de Personas y Ajustes: `max-width: 1080px; padding: 24px 28px 60px`
sobre `background: var(--lienzo)`, con scroll propio.

```
Borradores                                              ← Archivo 700 24px, font-stretch: 80%
4 solicitudes esperando aprobación · la más antigua hace 9 días
                                                        ← Archivo 400 13px, --tinta-2, margin-bottom: 20px
```

- Título: `font: 700 24px Archivo; font-stretch: 80%; color: var(--tinta); margin-bottom: 2px`.
- Línea de contexto: `font: 400 13px Archivo; color: var(--tinta-2)`. El fragmento
  `hace 9 días` va en `--alerta` con `font-weight: 500` si ese máximo es ≥ 7 días;
  en `#E07100` si está entre 3 y 6; en `--tinta-2` si es menor.
- Concordancia obligatoria: "1 solicitud esperando aprobación" / "N solicitudes
  esperando aprobación"; "la más antigua hace 1 día" / "hace N días".

**No hay barra de filtros.** La bandeja es una cola corta y ordenada; siete filtros
sobre cuatro filas es ruido. Si la cola supera 25 elementos, aparece un único campo
de búsqueda por texto a la derecha de la cabecera, con las medidas del buscador de
la tabla: `flex: 0 1 200px; min-width: 110px; height: 24px; background: var(--lienzo)`,
borde a `--acento` en `focus-within`.

## 1.5 Estructura de la lista

Un contenedor único, no tarjetas sueltas — la comparación entre filas es el trabajo
de esta pantalla y las tarjetas separadas la entorpecen:

```
border: 1px solid var(--linea);
border-radius: 14px;
background: var(--superficie);
box-shadow: var(--tarjeta-sombra);
overflow: hidden;
```

Dentro, un grid de 7 columnas fijo. **Las columnas no se mueven nunca**, igual que
en la tabla:

```css
--cols-borradores: 8px 64px minmax(260px,1fr) 92px 200px 46px 172px;
```

| # | Columna | Ancho | Contenido |
|---|---|---|---|
| 1 | canaleta | `8px` | tira de 3px en `--e1-fg`, alto completo de la fila |
| 2 | Nº | `64px` | `mono-sm` en `--tinta-3` |
| 3 | Título | `minmax(260px, 1fr)` | Archivo 400 13px, `--tinta`, una línea con ellipsis |
| 4 | Tipo | `92px` | píldora del handoff: punto 6px + sigla, fondo `type_color + '1f'` |
| 5 | **De / para** | `200px` | el dato central (§1.6) |
| 6 | Peso | `46px` | `mono-sm` a la derecha, `data-col="peso"` |
| 7 | Esperando | `172px` | antigüedad + acciones (§1.7) |

Encabezado de columna sticky, idéntico al de la tabla: `position: sticky; top: 0;
z-index: 3; height: 28px; background: var(--superficie); border-bottom: 1px solid
var(--linea-fuerte); font: 500 10px 'IBM Plex Mono', monospace; letter-spacing:
.07em; text-transform: uppercase; color: var(--tinta-3)`.

Etiquetas: `Nº · Título · Tipo · De / para · Peso · Esperando`.

**Altura de fila**: `var(--fila)` — 28px en densidad compacta, 36px en cómoda, con
`font-size: var(--fila-fs)`. La bandeja respeta el conmutador de densidad global.
`border-bottom: 1px solid var(--linea)` por fila; la última sin borde.

**Orden**: por `created_at` ascendente — lo que más lleva esperando va primero. El
orden no es configurable. Una cola de aprobación con orden alterable invita a
posponer lo viejo, que es exactamente el problema que la pantalla resuelve.

**Sin agrupación.** Cuatro a quince filas homogéneas no necesitan encabezados de
grupo.

**Prioridad**: no tiene columna propia. `priority_name` y `priority_color` se usan
para teñir el punto de la píldora de tipo cuando la prioridad es Urgente: en ese
caso, a la izquierda del número aparece el ícono de prioridad urgente en su círculo
de 20px (`background: {priority_color}22`), dentro de la canaleta ampliada. Es el
único caso: cuatro círculos de prioridad en una cola de aprobación compiten con el
dato que importa, que es quién pide para quién.

## 1.6 La columna "De / para" — el corazón de la fila

Es el dato que sostiene la decisión, así que ocupa 200px y usa dos avatares reales,
no texto.

```
┌──────────────────────────────────┐
│  (MG) → (AN)   Marcos · Ana      │
└──────────────────────────────────┘
```

**Composición**, de izquierda a derecha, `display: flex; align-items: center; gap: 6px`:

1. Avatar del creador (`creator_id`, `creator_name`): 21px, `border-radius: 99px`,
   fondo `avatarColor(creator_id)`, iniciales blancas en `font: 600 9px 'IBM Plex
   Mono', monospace`. Lleva `title="De Marcos Gil"`.
2. Flecha `→`: SVG de 12px en `viewBox="0 0 14 14"`, `path="M2.5 7h9M8.4 4l3 3-3 3"`,
   `fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round;
   stroke-linejoin: round`, color `--tinta-3`. Es la marca no cromática de la
   dirección: quién pide y quién recibe se lee por posición y por flecha, no por
   color de avatar.
3. Avatar del dueño (`owner_id`, `owner_name`): 21px, mismo tratamiento,
   `title="Para Ana Navarro"`.
4. Nombres abreviados: `Marcos · Ana` en `font: 400 11.5px Archivo; color:
   var(--tinta-2)`, con `min-width: 0; overflow: hidden; text-overflow: ellipsis`.
   Se usa solo el nombre de pila; si dos personas del equipo comparten nombre de
   pila, se agrega la inicial del apellido (`Ana N. · Ana P.`).

**Sin dueño**: si `owner_id` es nulo, el segundo avatar se reemplaza por un círculo
de 21px con `border: 1px dashed var(--linea-fuerte); background: transparent` y un
`—` en `--tinta-3` al centro; el texto dice `Marcos · sin dueño` con "sin dueño" en
`--tinta-3` cursiva. Un borrador sin dueño se puede aprobar igual, pero la
aprobación advierte que entrará a la cola de nadie (§1.10).

**Creador = dueño** (alguien se asignó trabajo a sí mismo): se muestra un solo
avatar, sin flecha, y el texto dice `Marcos, para sí mismo` en `--tinta-2`. Es un
caso distinto y la fila lo tiene que decir: nadie le está pidiendo trabajo a nadie.

## 1.7 La columna "Esperando" — antigüedad y acciones

Es la columna que cambia entre reposo y hover, con el mismo mecanismo que las
acciones rápidas de la tabla: en reposo se ve el dato, al hover aparecen los
botones.

**En reposo** — antigüedad alineada a la derecha:

`font: 400 11.5px 'IBM Plex Mono', monospace`, con esta escala:

| `days_waiting` | Texto | Color | Marca no cromática |
|---|---|---|---|
| 0 | `hoy` | `var(--tinta-3)` | — |
| 1 | `1 día` | `var(--tinta-3)` | — |
| 2 | `2 días` | `var(--tinta-3)` | — |
| 3–6 | `N días` | `#E07100` | `· ` como prefijo |
| ≥ 7 | `N días` | `var(--alerta)` | `● ` punto lleno como prefijo, `font-weight: 500` |

Los umbrales 3 y 7 son los mismos del aging WIP (§3). Una sola escala mental para
toda la herramienta: tres días es "mirá esto", siete es "esto ya es un problema".
El prefijo `•`/`●` replica exactamente el tratamiento de fecha vencida de la tabla
(`• ` + fecha en `--alerta`).

**Vencimiento**: si el borrador tiene `due_date` y ya venció, a la izquierda de la
antigüedad aparece `• vencido` en `font: 500 11px 'IBM Plex Mono', monospace;
color: var(--alerta)`, con `title="Vencía el 18 de agosto"`. Un borrador que ya
venció antes de ser aprobado es la señal más fuerte de la cola: el trabajo se pidió,
nadie lo aprobó, y la fecha pasó.

**Al hover o al foco de la fila** — la antigüedad se desplaza a la izquierda dentro
de la columna y aparecen dos botones a la derecha, `margin-left: auto`, con
`transition: opacity .1s` de `0` a `1`:

```
Aprobar          height: 24px; padding: 0 10px; border-radius: 99px;
                 background: var(--acento); color: #fff;
                 font: 500 11.5px Archivo; border: 0;
Rechazar         height: 24px; padding: 0 10px; border-radius: 99px;
                 background: var(--superficie); color: var(--tinta);
                 border: 1px solid var(--linea-fuerte);
                 font: 400 11.5px Archivo;
```

Ambos llaman `stopPropagation()` para no abrir el panel de detalle.

Estados de los botones, tomados literalmente del sistema visual del handoff:

| | Aprobar (primario) | Rechazar (secundario) |
|---|---|---|
| reposo | `background: var(--acento); color: #fff` | `border: 1px solid var(--linea-fuerte); background: var(--superficie)` |
| hover | `filter: brightness(1.14); transform: translateY(-1px)` | `border-color: var(--tinta-3); background: var(--superficie-2)` |
| activo | `transform: translateY(0); filter: brightness(.9)` | `border-color: var(--tinta-2); background: var(--superficie-3)` |
| foco | `outline: 2px solid var(--acento); outline-offset: 2px` | igual |
| deshabilitado | `background: var(--superficie-2); color: var(--tinta-3); border-color: var(--linea)` | `border-color: var(--linea); color: var(--tinta-3)` |
| enviando | texto pasa a `Aprobando…`, botón deshabilitado, ambos botones de la fila bloqueados | texto pasa a `Rechazando…` |

**Rechazar no es destructivo en apariencia.** Es un botón secundario normal, no
rojo. Rechazar un borrador es una respuesta legítima y frecuente, no una
emergencia; pintarlo de `--alerta` haría que el admin dude cada vez. La fricción
real la pone el motivo obligatorio (§1.9), que es donde corresponde.

**En pantallas angostas** (< 1000px de ancho de contenido) las acciones no aparecen
al hover: se muestran siempre, y la columna "Esperando" crece a 220px reduciendo la
de título. En táctil no hay hover, así que la regla es la misma.

## 1.8 Estados de fila

| Estado | Tratamiento |
|---|---|
| reposo | `background: transparent`; tira de canaleta de 3px en `--e1-fg`; acciones a `opacity: 0` |
| hover | `background: var(--superficie-2)`; tira crece a **5px**; acciones a `opacity: 1` |
| foco de teclado | `outline: 2px solid var(--acento); outline-offset: -2px`; acciones a `opacity: 1` |
| abierta en el panel de detalle | `background: var(--acento-suave)`; tira 5px |
| seleccionada | `background: var(--acento-suave)`; casilla marcada |
| resolviéndose (optimista) | `opacity: .45`; acciones deshabilitadas; sin cambio de fondo |
| resuelta (confirmación) | ver abajo |

La tira de canaleta va en `--e1-fg` (`#8A9099`) porque el estado real de estos
tickets es Borrador y el sistema cromático es consistente: los extremos son
acromáticos. Una bandeja entera de tiras grises es correcto — todo lo que hay acá
todavía no cuenta.

**Confirmación al resolver.** La fila **no desaparece de golpe**. Durante 900ms —
la misma duración que la confirmación de soltado del kanban — la fila se reemplaza
por una línea de confirmación de la misma altura, y recién después se retira con la
lista recomponiéndose:

- Aprobado: fondo `var(--e5-bg)`, tira de canaleta en `--e5-fg`, y en la columna
  de título el texto `✓ Aprobado · pasó a la cola de Ana` en `font: 500 12px
  Archivo; color: var(--e5-fg)`. El `✓` es la marca no cromática de "cerrado bien"
  que ya usa el estado Finalizado.
- Rechazado: fondo `var(--e6-bg)`, tira en `--e6-fg`, número del ticket **tachado**
  (`text-decoration: line-through`, la marca del estado Cancelado), y el texto
  `Rechazado · Ana queda sin este trabajo` en `font: 400 12px Archivo; color:
  var(--e6-fg)`.

A la derecha de la línea de confirmación, un botón de texto `Deshacer` en
`font: 400 11.5px Archivo; color: var(--acento)`, subrayado, activo durante esos
900ms. Al vencer, la fila se retira y `Deshacer` deja de estar disponible; revertir
después se hace desde el detalle del ticket, como cualquier otro cambio de estado.

**Clic en la fila** (fuera de los botones) abre el panel de detalle del ticket, con
las mismas medidas y comportamiento del handoff: `position: absolute; top: 0;
right: 0; bottom: 0; width: min(560px, 52vw); min-width: 400px; z-index: 5;
box-shadow: var(--sombra-panel)`, `role="complementary"`, cierre con Escape,
devolución del foco a la fila de origen. Desde el detalle, las mismas dos acciones
están disponibles en la cabecera del panel, con las medidas del botón `Abrir en
página` (`height: 24px; padding: 0 8px; border-radius: 9px`).

## 1.9 Modal de rechazo — el motivo es obligatorio

Rechazar exige explicar por qué. `rejectDraft()` ya lo impone en la capa de datos
(`throw new Error('Rechazar un borrador exige explicar el motivo')`); la UI tiene
que pedirlo antes de que ese error pueda ocurrir, no después.

**Por qué modal y no edición en línea.** El motivo se convierte en el comentario que
Marcos va a leer para entender que su pedido no va. Un textarea de 24px embutido en
una fila de 36px produce motivos de tres palabras. El modal da el espacio que el
texto necesita y marca que la acción tiene consecuencias.

**Overlay y contenedor** — exactamente los del modal de nuevo ticket:

```
overlay:  position: absolute; inset: 0; z-index: 70;
          display: flex; align-items: flex-start; justify-content: center;
          padding-top: 56px; background: rgba(12,15,20,.42);

diálogo:  width: 600px; max-height: calc(100vh - 100px);
          border-radius: 16px; background: var(--superficie);
          box-shadow: 0 18px 50px rgba(10,14,20,.3);
          display: flex; flex-direction: column; overflow: hidden;
```

**Cabecera** (`padding: 16px 20px; border-bottom: 1px solid var(--linea); gap: 10px`):

```
Rechazar borrador          nº 223            ✕
└ Archivo 600 16px         └ Plex Mono 400 11px, --tinta-3
```

El cerrar es circular de 28px, `border-radius: 99px; background: transparent;
color: var(--tinta-2)`, hover a `background: var(--superficie-2); color:
var(--tinta)`, con la `✕` como SVG de 13px (`path="M3.5 3.5l7 7M10.5 3.5l-7 7"`,
`stroke-width: 1.6`).

**Cuerpo** (`padding: 18px 20px; display: flex; flex-direction: column; gap: 18px`):

1. **Resumen del borrador** — para que el admin no escriba un motivo mirando el
   ticket equivocado. Bloque de `padding: 12px; border-radius: 10px; background:
   var(--lienzo); border: 1px solid var(--linea)`:

   ```
   223   ●SI   Solicitud: tarjetas de presentación
   (MG) → (LP)   Marcos · Lucía          ● 9 días esperando
   ```

   Número en `mono-sm` `--tinta-3`; píldora de tipo; título en Archivo 400 13px
   `--tinta`; segunda línea con el mismo componente "De / para" de §1.6 y la
   antigüedad con su color y prefijo de §1.7.

2. **Motivo** — el campo obligatorio:

   ```
   Motivo del rechazo                              ← label, Archivo 500 11.5px, --tinta-2, margin-bottom: 6px
   ┌────────────────────────────────────────────┐
   │ Explicá por qué no entra. Marcos va a ver  │  ← textarea
   │ este texto.                                 │
   └────────────────────────────────────────────┘
   Se guarda como comentario del ticket.         ← Archivo 400 11.5px, --tinta-3, margin-top: 6px
   ```

   Textarea: `width: 100%; height: 88px; resize: vertical; padding: 10px 12px;
   border: 1px solid var(--linea-fuerte); border-radius: 10px; background:
   var(--lienzo); color: var(--tinta); font: 400 13.5px/1.55 Archivo; outline: none;
   transition: border-color .12s, background .12s`.

   Estados, según el sistema visual del handoff:

   | Estado | Tratamiento |
   |---|---|
   | reposo | `border: 1px solid var(--linea-fuerte); background: var(--lienzo)` |
   | relleno | `border-color: var(--tinta-3); background: var(--superficie)` |
   | foco | `border-color: var(--acento); background: var(--superficie); outline: 2px solid var(--acento); outline-offset: 1px` |
   | error | `border-color: var(--alerta); background: var(--alerta-suave); color: var(--alerta)` |

   Placeholder: `Explicá por qué no entra. Marcos va a ver este texto.` (con el
   nombre real del creador interpolado).

3. **Validación.** El botón `Rechazar borrador` arranca **deshabilitado** y se
   habilita cuando el motivo tiene al menos 10 caracteres no vacíos tras `trim()`.
   Diez y no uno: "no" no es un motivo, y un umbral visible es más honesto que un
   error posterior.

   - Mientras está por debajo del mínimo, debajo del textarea, en lugar de la línea
     de ayuda: `Escribí al menos unas palabras para que el motivo sirva.` en
     `font: 400 11.5px Archivo; color: var(--tinta-3)`. Sin rojo: todavía no hay
     error, hay un campo incompleto.
   - Si el usuario intenta enviar igual (Enter en el pie, `⌘↵`, clic sobre el botón
     deshabilitado), el textarea pasa a estado de error, el foco salta a él, y el
     texto de ayuda se reemplaza por `Hace falta un motivo para rechazar.` en
     `color: var(--alerta)`, con un `role="alert"`.
   - Contador de caracteres a la derecha de la línea de ayuda, `font: 400 11px 'IBM
     Plex Mono', monospace; color: var(--tinta-3)`, visible solo por encima de 400
     caracteres, con formato `487 / 600` y en `--alerta` al pasarse.

**Pie** (`padding: 14px 20px; border-top: 1px solid var(--linea); background:
var(--lienzo); display: flex; align-items: center; gap: 8px`):

```
⌘↵ para rechazar          [ Cancelar ]  [ Rechazar borrador ]
```

- Pista: `font: 400 11px 'IBM Plex Mono', monospace; color: var(--tinta-3)`.
- `Cancelar`: `margin-left: auto; height: 32px; padding: 0 15px; border: 1px solid
  var(--linea-fuerte); border-radius: 99px; background: var(--superficie); color:
  var(--tinta); font: 400 13px Archivo`. Hover: `border-color: var(--tinta-3)`.
- `Rechazar borrador`: `height: 32px; padding: 0 17px; border: 0; border-radius:
  99px; background: var(--acento); color: #fff; font: 500 13px Archivo`. Hover:
  `filter: brightness(1.14); transform: translateY(-1px)`. Deshabilitado:
  `background: var(--superficie-2); color: var(--tinta-3); border: 1px solid
  var(--linea)`.

  El primario **no es rojo**. La consistencia del sistema manda: el botón que
  confirma la acción del modal es el primario del sistema, sea cual sea la acción.
  Que sea un rechazo lo dicen el título del modal y el texto del botón, no el color.

**Teclado y accesibilidad del modal**

- Focus trap dentro del diálogo. `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby` apuntando al título.
- Al abrir, el foco va **al textarea**, no al primer botón: escribir el motivo es
  lo único que el modal pide.
- `Escape` cierra sin rechazar. Si hay texto escrito, pide confirmación con un
  segundo diálogo mínimo de una línea (`¿Descartar el motivo escrito?` con
  `Descartar` / `Seguir escribiendo`); si el textarea está vacío, cierra directo.
- `⌘↵` / `Ctrl+Enter` envía si el motivo es válido; si no, dispara el estado de
  error descrito arriba.
- `Tab` cicla: textarea → Cancelar → Rechazar borrador → cerrar → textarea.
- Al cerrarse, el foco vuelve al botón `Rechazar` de la fila de origen.

## 1.10 Aprobación — sin modal, con una salvedad

Aprobar no pide confirmación. Es la acción esperada, es reversible durante 900ms
con `Deshacer`, y queda registrada en el activity log. Un modal por cada aprobación
convertiría una cola de ocho en dieciséis clics.

**Única excepción**: si el borrador **no tiene dueño**, `Aprobar` abre un popover de
280px anclado al botón (`border-radius: 12px; background: var(--superficie); border:
1px solid var(--linea-fuerte); box-shadow: var(--tarjeta-sombra-alta); padding:
12px`) con el texto `Este borrador no tiene dueño. Si lo aprobás, entra a la cola de
nadie.` en Archivo 400 12.5px, y dos acciones: `Asignar dueño` (primario, abre el
selector de personas del detalle) y `Aprobar igual` (secundario). Escape lo cierra y
devuelve el foco al botón `Aprobar`.

## 1.11 Selección múltiple

Cuando la cola tiene más de 6 filas, aparece una casilla de selección de 14px en la
canaleta de cada fila (reemplazando la tira de estado al hover, no sumando una
columna nueva — **las columnas no se mueven**) y una casilla en el encabezado.

Con al menos una fila seleccionada, sobre el encabezado de columnas aparece una
barra de 32px, `background: var(--acento-suave); border-bottom: 1px solid
var(--acento)`:

```
3 seleccionados        [ Aprobar seleccionados ]  [ Rechazar seleccionados ]  Quitar selección
```

- Conteo en `font: 500 12px Archivo; color: var(--acento)`, con concordancia.
- `Aprobar seleccionados`: primario de 24px, píldora.
- `Rechazar seleccionados`: secundario de 24px, píldora. Abre **un solo modal** con
  el resumen reemplazado por la lista de los N borradores (máximo 5 visibles + `y N
  más`) y **un motivo único** que se aplica a todos. Etiqueta del campo: `Motivo del
  rechazo (se aplica a los 3)`.
- `Quitar selección`: botón de texto subrayado en `--tinta-2`.

`Shift + clic` selecciona rango. `Escape` quita la selección.

## 1.12 Estado vacío

Dos casos, ambos con el tratamiento del handoff: **alineados a la izquierda bajo el
encabezado**, nunca centrados en un vacío enorme, `padding: 40px 16px; max-width:
520px`.

**Caso A — bandeja al día (el caso frecuente y bueno)**

```
No hay borradores esperando
Todo lo que el equipo pidió ya está aprobado o rechazado. Cuando alguien
cree un ticket en borrador, aparece acá y en la barra lateral.

[ Ir al Panel ]   [ Ver todos los tickets ]
```

- Título: `font: 600 15px Archivo; color: var(--tinta); margin-bottom: 6px`.
- Cuerpo: `font: 400 13px/1.5 Archivo; color: var(--tinta-2); margin-bottom: 14px`.
- Acciones, `display: flex; gap: 8px`:
  - `Ir al Panel` — primario: `height: 28px; padding: 0 12px; border: 1px solid
    var(--acento); border-radius: 8px; background: var(--acento); color: #fff;
    font: 500 12px Archivo`.
  - `Ver todos los tickets` — secundario: `height: 28px; padding: 0 12px; border:
    1px solid var(--linea-fuerte); border-radius: 8px; background: var(--superficie);
    color: var(--tinta); font: 400 12px Archivo`. Hover: `border-color: var(--tinta-3)`.

Sin ilustración, sin ícono grande, sin felicitación. La bandeja vacía es el estado
normal de una herramienta sana, no un logro.

**Caso B — sin permiso (usuario no admin que llega por URL)**

```
Esta bandeja es solo para administración
Aprobar y rechazar borradores lo hace el equipo de dirección. Si creaste un
ticket en borrador, ya está en la cola de aprobación.

[ Ir al Panel ]   [ Ver mis tickets ]
```

Mismas medidas. La ruta no redirige en silencio: un redirect deja al usuario sin
entender por qué el enlace que le pasaron no lleva a ningún lado.

## 1.13 Estado de carga

Como en la tabla: **se mantiene el encabezado de columnas y las líneas de fila**, y
las celdas se rellenan con barras de 8px en `--superficie-2` de ancho variable por
columna. **Sin shimmer, sin pulso, sin animación de ningún tipo.**

Ocho filas esqueleto, cada una `height: var(--fila); border-bottom: 1px solid
var(--linea)`, con:

| Columna | Relleno |
|---|---|
| canaleta | vacía |
| Nº | barra de 8px × 26px |
| Título | barra de 8px, anchos alternados 68% / 44% / 81% / 52% / 73% / 39% / 62% / 47% |
| Tipo | barra de 8px × 20px |
| De / para | dos círculos de 16px + barra de 8px × 70px |
| Peso | vacía |
| Esperando | barra de 8px × 44px, alineada a la derecha |

La cabecera de la vista muestra el título real y, en lugar de la línea de contexto,
una barra de 8px × 220px en `--superficie-2`.

**Error de carga**: mismo bloque que el estado vacío (`padding: 40px 16px;
max-width: 520px`), con título `No se pudo cargar la bandeja`, cuerpo `Revisá la
conexión y probá de nuevo. Si sigue fallando, avisá a soporte.` y acciones
`Reintentar` (primario) / `Ir al Panel` (secundario).

**Error de una acción** (la RPC de aprobar o rechazar falló): la fila vuelve de
`opacity: .45` a su estado normal y aparece, sobre la fila, una línea de 24px con
`background: var(--alerta-suave); color: var(--alerta); font: 400 11.5px Archivo;
padding: 0 9px` que dice `No se pudo aprobar. Probá de nuevo.` con un botón de texto
`Reintentar` subrayado al lado. Se retira sola a los 6 segundos o al reintentar.

## 1.14 Teclado

La bandeja se opera enteramente con teclado, igual que la tabla.

| Tecla | Acción |
|---|---|
| `Tab` | entra a la lista y recorre filas (cada fila es `tabIndex="0"` con `role="row"`) |
| `↑` / `↓` | mueve el foco entre filas sin salir de la lista |
| `Enter` | abre el panel de detalle del ticket enfocado |
| `A` | aprueba el borrador enfocado |
| `R` | abre el modal de rechazo del borrador enfocado |
| `Espacio` | alterna la selección de la fila enfocada (si la selección múltiple está activa) |
| `Shift` + `↑`/`↓` | extiende la selección |
| `Escape` | quita la selección; si no hay selección, cierra el panel de detalle |
| `⌘Z` / `Ctrl+Z` | deshace la última resolución dentro de la ventana de 900ms |

Los atajos `A` y `R` solo actúan si el foco está en una fila y no dentro de un campo
de texto. Se documentan en un pie de la vista: `A aprobar · R rechazar · ↑↓ moverse`
en `font: 400 11px 'IBM Plex Mono', monospace; color: var(--tinta-3); margin-top:
12px`.

## 1.15 Microcopy final

| Elemento | Texto |
|---|---|
| Navegación lateral | `Borradores` |
| `aria-label` del badge | `Borradores, {n} pendientes de aprobación` |
| Migaja | `Comunicación / Borradores` |
| Título de vista | `Borradores` |
| Contexto (plural) | `{n} solicitudes esperando aprobación · la más antigua hace {d} días` |
| Contexto (singular) | `1 solicitud esperando aprobación · hace {d} días` |
| Encabezados de columna | `Nº` · `Título` · `Tipo` · `De / para` · `Peso` · `Esperando` |
| Sin dueño en la fila | `{creador} · sin dueño` |
| Autoasignado | `{creador}, para sí mismo` |
| Antigüedad | `hoy` / `1 día` / `{n} días` |
| Vencido | `• vencido` |
| Acción primaria de fila | `Aprobar` |
| Acción secundaria de fila | `Rechazar` |
| En curso | `Aprobando…` / `Rechazando…` |
| Confirmación de aprobado | `✓ Aprobado · pasó a la cola de {dueño}` |
| Confirmación de aprobado sin dueño | `✓ Aprobado · queda sin dueño` |
| Confirmación de rechazado | `Rechazado · {dueño} queda sin este trabajo` |
| Deshacer | `Deshacer` |
| Aviso de sin dueño | `Este borrador no tiene dueño. Si lo aprobás, entra a la cola de nadie.` |
| Acciones del aviso | `Asignar dueño` / `Aprobar igual` |
| Título del modal | `Rechazar borrador` |
| Etiqueta del motivo | `Motivo del rechazo` |
| Placeholder del motivo | `Explicá por qué no entra. {creador} va a ver este texto.` |
| Ayuda del motivo | `Se guarda como comentario del ticket.` |
| Ayuda incompleta | `Escribí al menos unas palabras para que el motivo sirva.` |
| Error del motivo | `Hace falta un motivo para rechazar.` |
| Pista del pie | `⌘↵ para rechazar` |
| Botones del modal | `Cancelar` / `Rechazar borrador` |
| Descartar el modal | `¿Descartar el motivo escrito?` → `Descartar` / `Seguir escribiendo` |
| Barra de selección | `{n} seleccionados` / `1 seleccionado` |
| Acciones de selección | `Aprobar seleccionados` / `Rechazar seleccionados` / `Quitar selección` |
| Motivo en lote | `Motivo del rechazo (se aplica a los {n})` |
| Vacío A — título | `No hay borradores esperando` |
| Vacío A — cuerpo | `Todo lo que el equipo pidió ya está aprobado o rechazado. Cuando alguien cree un ticket en borrador, aparece acá y en la barra lateral.` |
| Vacío A — acciones | `Ir al Panel` / `Ver todos los tickets` |
| Vacío B — título | `Esta bandeja es solo para administración` |
| Vacío B — cuerpo | `Aprobar y rechazar borradores lo hace el equipo de dirección. Si creaste un ticket en borrador, ya está en la cola de aprobación.` |
| Vacío B — acciones | `Ir al Panel` / `Ver mis tickets` |
| Error de carga — título | `No se pudo cargar la bandeja` |
| Error de carga — cuerpo | `Revisá la conexión y probá de nuevo. Si sigue fallando, avisá a soporte.` |
| Error de carga — acciones | `Reintentar` / `Ir al Panel` |
| Error de acción | `No se pudo aprobar. Probá de nuevo.` / `No se pudo rechazar. Probá de nuevo.` + `Reintentar` |
| Pie de atajos | `A aprobar · R rechazar · ↑↓ moverse` |

---

# 2. Tarjeta "Cycle time p85" en el Panel

## 2.1 Qué muestra y por qué así

Cycle time p85 es **cuántos días tarda el 85 % del trabajo en cerrarse**. Percentil
85 y no promedio: el promedio lo distorsiona un ticket olvidado tres meses, y con
un equipo de ocho personas eso pasa todas las semanas.

La tarjeta muestra **la serie de 8 semanas**, no el número suelto. Un p85 de 6 días
no dice nada; que haya pasado de 3 a 6 en cinco semanas, sí. El número global de
`dashboard_summary().cycle_p85_days` se muestra como referencia al lado del título,
no como protagonista.

**Nada de KPI grande con flechita verde.** No hay porcentaje de variación, no hay
comparación con el período anterior, no hay color de "mejoró/empeoró". Un p85 que
sube puede significar que el equipo tomó trabajo más grande, y una flecha roja
mentiría.

## 2.2 Ubicación en el grid del Panel

El Panel actual es, de arriba a abajo:

```
fila 1   [ Creados y cerrados por semana  1.35fr ]  [ Estado de la cartera  1fr ]
fila 2   [ Volumen por tipo de trabajo — ancho completo                        ]
fila 3   [ Próximos vencimientos  1.35fr ]  [ Distribución por estado  1fr     ]
                                            [ Carga del equipo         1fr     ]
```

**Cycle time p85 entra como una fila 2 nueva, columna izquierda (1.35fr)**, y
`Tickets estancados` (§3) ocupa la columna derecha (1fr) de esa misma fila.
"Volumen por tipo de trabajo" baja a fila 3 y el resto corre una posición:

```
fila 1   [ Creados y cerrados por semana  1.35fr ]  [ Estado de la cartera  1fr ]
fila 2   [ Cycle time p85                 1.35fr ]  [ Tickets estancados    1fr ]   ← NUEVA
fila 3   [ Volumen por tipo de trabajo — ancho completo                        ]
fila 4   [ Próximos vencimientos  1.35fr ]  [ Distribución por estado  1fr     ]
                                            [ Carga del equipo         1fr     ]
```

Justificación del lugar: fila 1 responde "qué entró y qué salió", fila 2 responde
"a qué velocidad y qué está trabado". Las dos son de ritmo y se leen juntas.
Ponerlas al fondo las volvería invisibles.

La fila 2 usa el mismo `display: grid; grid-template-columns: 1.35fr 1fr; gap: 16px;
align-items: start; margin-bottom: 16px` que la fila 1.

## 2.3 Contenedor

Idéntico a todas las tarjetas del Panel, sin excepción:

```
border: 1px solid var(--linea);
border-radius: 14px;
background: var(--superficie);
padding: 16px 18px;
box-shadow: var(--tarjeta-sombra);
```

## 2.4 Cabecera de la tarjeta

Una sola línea, `display: flex; align-items: baseline; gap: 10px; margin-bottom: 16px`:

```
Cycle time p85    6 d ahora    ····························    ▨ muestra corta
```

1. **Título**: `Cycle time p85` en `font: 600 13px Archivo; color: var(--tinta)`.
   Idéntico al título de las otras seis tarjetas.

2. **Valor global**: `{cycle_p85_days} d ahora` — el número de
   `dashboard_summary().cycle_p85_days` redondeado a un decimal si es < 10, entero
   si es ≥ 10. `font: 400 11px Archivo; color: var(--tinta-2)`, con el número en
   `font: 600 11px 'IBM Plex Mono', monospace; color: var(--tinta)`. Es del tamaño
   de la leyenda de "Creados y cerrados por semana", no un KPI.

   Si `cycle_p85_days` es `null`, el fragmento no se renderiza.

3. **Leyenda de muestra corta**, solo si alguna semana de la serie tiene
   `sample_size < 3` — `margin-left: auto`:
   `muestra corta` en `font: 400 11px Archivo; color: var(--tinta-3)`, precedida
   de un rectángulo de 8px × 8px con `border: 1.5px dashed var(--linea-fuerte);
   background: transparent; border-radius: 2px`. El punteado es exactamente lo que
   el sistema usa para "esto no cuenta todavía" (el chip de Borrador), reaplicado a
   "este dato no es firme todavía".

4. **Ayuda**: un `title` en el título de la tarjeta con
   `Percentil 85: el 85 % del trabajo se cerró en ese plazo o menos.`

## 2.5 La gráfica

Barras verticales de 8 semanas, con la geometría de "Creados y cerrados por
semana" — misma altura de área, mismo ancho de barra, mismos radios, misma
transición:

```
área:     display: flex; align-items: flex-end; gap: 16px; height: 130px;
columna:  flex: 1; display: flex; flex-direction: column; align-items: center;
          gap: 7px; height: 100%;
cuerpo:   flex: 1; width: 100%; display: flex; align-items: flex-end;
          justify-content: center;
barra:    width: 16px; border-radius: 6px 6px 2px 2px;
          transition: height .3s;
etiqueta: font: 400 10px 'IBM Plex Mono', monospace; color: var(--tinta-3);
```

**Una sola barra por semana** (`p85_days`), no dos. La mediana no se dibuja como
segunda barra: dos barras invitan a compararlas y la comparación p85-vs-mediana no
es la pregunta de esta tarjeta. La mediana vive en el tooltip.

**Escala**: el máximo del eje es `Math.max(...p85_days) * 1.15`, redondeado hacia
arriba al múltiplo de 2 más cercano, con un piso de 8 días. El piso evita que una
serie de 1–2 días se dibuje con barras enormes y sugiera un problema que no existe.

**Altura de barra**: `height: {(p85_days / maxEje) * 100}%`, con un mínimo de 3px
para que una semana de valor muy bajo siga siendo visible y clicable.

**Etiqueta de semana**: `week_start` formateado como `4 ago`, en `mono-xs`. Si el
ancho de la tarjeta hace que ocho etiquetas se solapen, se muestran las alternadas
(semanas 1, 3, 5, 7) y las demás quedan solo en el tooltip. Las barras nunca se
quitan; las etiquetas sí.

**Sin ejes, sin retícula, sin línea de referencia.** El handoff no dibuja ejes en
ninguna de sus gráficas: la escala se lee por comparación entre barras y el valor
exacto por tooltip. Agregar un eje Y acá rompería la familia.

## 2.6 El tratamiento de `sample_size` — la decisión importante

`sample_size` viene a propósito. Un p85 calculado sobre 2 tickets no es una
tendencia, y dibujarlo con la misma firmeza que uno calculado sobre 14 miente.

**Regla de cuatro tramos**, con la marca no cromática determinada por el tamaño de
muestra:

| `sample_size` | Relleno de la barra | Marca no cromática | Lectura |
|---|---|---|---|
| `0` | sin barra; en su lugar un guion de 8px × 2px en `--linea-fuerte` sobre la línea base | ausencia de barra | no hubo cierres esa semana |
| `1–2` | `background: transparent; border: 1.5px dashed var(--linea-fuerte)` (barra hueca punteada) | **borde punteado** | dato no firme |
| `3–5` | `background: var(--acento); opacity: .45` | ninguna extra | dato débil pero real |
| `≥ 6` | `background: var(--acento); opacity: 1` | ninguna extra | dato firme |

El azul `--acento` es el mismo `#0A73E8` de la barra de "creados" del handoff — no
se introduce un color nuevo para esta gráfica.

**Por qué punteado y no solo opacidad**: en escala de grises o para un usuario con
baja visión, `opacity: .45` sobre azul y `opacity: 1` sobre azul se parecen
demasiado. El borde punteado es la marca que el sistema ya usa para "esto no cuenta
todavía" y sobrevive a la pérdida de color. Los tramos `3–5` y `≥ 6` sí se
distinguen solo por opacidad, pero la diferencia entre ellos es de grado, no de
confianza: ambos son datos reales. La distinción que **debe** ser inequívoca es
"firme vs. no firme", y esa la lleva el punteado.

**Debajo de cada barra**, entre la barra y la etiqueta de semana, el tamaño de
muestra en `font: 400 9px 'IBM Plex Mono', monospace; color: var(--tinta-3)`, con
formato `n 12`. En las semanas de `sample_size < 3` va en `--tinta-2` con
`font-weight: 500`, y en `sample_size = 0` se muestra `n 0` en `--tinta-3`.

Esto agrega una línea de 9px por columna y es exactamente el tipo de densidad que
la herramienta quiere: el dato que califica al dato, a la vista, sin hover.

## 2.7 Tooltip

`title` nativo en cada barra — el handoff usa `title` en las barras de "Creados y
cerrados por semana" y no introduce un componente de tooltip propio:

```
Semana del 4 ago · p85 6.2 d · mediana 3.1 d · 12 tickets
```

Para `sample_size < 3`:

```
Semana del 4 ago · p85 6.2 d · mediana 6.2 d · 2 tickets · muestra corta
```

Para `sample_size = 0`:

```
Semana del 4 ago · sin cierres
```

## 2.8 Interacción y estados

| Estado | Barra firme (`≥ 3`) | Barra punteada (`1–2`) | Sin cierres (`0`) |
|---|---|---|---|
| reposo | `background: var(--acento)` con su opacidad | hueca con borde punteado | guion de 2px |
| hover | `filter: brightness(1.1)`; `cursor: pointer` | `border-color: var(--tinta-3)`; `cursor: pointer` | sin cambio; `cursor: default` |
| activo | `filter: brightness(.9)` | `border-color: var(--tinta-2)` | — |
| foco | `outline: 2px solid var(--acento); outline-offset: 2px` | igual | no focusable |

`transition: filter .12s, border-color .12s`. En las barras punteadas no se usa
`brightness` porque sobre un borde punteado casi no se percibe.

- **Clic de barra**: navega a `/tickets` con el filtro `Cerrados en la semana del
  4 ago` aplicado, que aparece como chip removible en la fila de chips de filtro.
- **Foco**: cada barra clicable es un `<button>` con `tabIndex="0"`. `Enter` y
  `Espacio` equivalen al clic. `←`/`→` mueven entre barras.
- **Montaje**: `transition: height .3s` desde 0. Es la única animación, y es la que
  el handoff ya especifica para barras de gráfica. Se respeta
  `prefers-reduced-motion` vía la regla global de `tokens.css`.

## 2.9 Pie de la tarjeta

Una línea, `margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--linea)`:

```
El 85 % del trabajo se cierra en ese plazo o menos. Las barras punteadas
tienen menos de 3 tickets: no son tendencia.
```

`font: 400 11.5px/1.5 Archivo; color: var(--tinta-2)`. La segunda oración solo
aparece si hay al menos una semana con `sample_size < 3`.

Es la misma clase de nota explicativa que el subtítulo de Personas ("Ocho puntos de
peso equivalen aproximadamente a una semana de trabajo"): la herramienta explica sus
unidades en vez de asumir que se entienden.

## 2.10 Estado vacío

**Caso A — ninguna semana con cierres** (toda la serie con `sample_size = 0`):

Reemplaza la gráfica entera, alineado a la izquierda, `padding: 40px 16px;
max-width: 520px`:

```
Todavía no hay tickets cerrados
El cycle time se calcula sobre trabajo terminado. En cuanto se cierre el
primero, esta gráfica empieza a llenarse.

[ Ver tickets en revisión ]   [ Ver todos los tickets ]
```

Título en `font: 600 15px Archivo; margin-bottom: 6px`; cuerpo en `font: 400
13px/1.5 Archivo; color: var(--tinta-2); margin-bottom: 14px`; acciones con las
mismas medidas de §1.12.

**Caso B — serie parcial** (algunas semanas con cierres, otras sin): **no es un
estado vacío**. La gráfica se dibuja completa con las semanas sin datos como guion
de 8px, y el pie agrega `{n} de las últimas 8 semanas no tuvieron cierres.` Una
serie con huecos es información sobre el ritmo del equipo, no una falla de la
gráfica.

**Caso C — toda la serie con muestra corta** (todas las semanas con `sample_size`
entre 1 y 2): la gráfica se dibuja con las ocho barras punteadas y el valor global
de la cabecera se muestra en `--tinta-3` en vez de `--tinta`. El pie reemplaza su
segunda oración por `Todavía no hay volumen suficiente para hablar de tendencia.`

## 2.11 Estado de carga

Se mantienen el contenedor, el título y el área de 130px. En lugar de las ocho
barras, ocho columnas con:

- un rectángulo de 16px de ancho en `--superficie-2`, sin borde, con alturas
  variables (62%, 38%, 71%, 45%, 55%, 80%, 41%, 66% del área), anclado abajo;
- debajo, una barra de 8px × 14px en `--superficie-2` donde va el tamaño de muestra;
- debajo, una barra de 8px × 22px en `--superficie-2` donde va la etiqueta de semana.

El valor global de la cabecera se reemplaza por una barra de 8px × 46px en
`--superficie-2`. La leyenda de muestra corta no se renderiza. **Sin shimmer.**

**Error de carga**: el contenedor se mantiene y el área se reemplaza por
`No se pudo cargar el cycle time.` en `font: 400 13px Archivo; color: var(--tinta-2)`
con un botón de texto `Reintentar` subrayado en `--acento` al lado.

## 2.12 Accesibilidad

- La gráfica lleva `role="img"` y un `aria-label` que resume la serie:
  `Cycle time p85 de las últimas 8 semanas: 3, 4, 4 (muestra corta), 6, 5, 6, 8, 6
  días.`
- Cada barra clicable es un `<button>` con `aria-label` completo:
  `Semana del 4 de agosto, p85 6.2 días, mediana 3.1 días, 12 tickets cerrados.`
  Para muestra corta se agrega `Muestra corta: menos de 3 tickets.`
- La condición de "muestra corta" está en tres lugares independientes del color: el
  borde punteado, el `n 2` bajo la barra, y el texto del `aria-label`.
- Contraste: `--acento` al 45 % de opacidad sobre `--superficie` pierde contraste,
  pero es un elemento gráfico no textual cuya información también está en el número
  `n` bajo la barra y en el tooltip. Ningún texto de la tarjeta va por debajo de AA.

## 2.13 Microcopy final

| Elemento | Texto |
|---|---|
| Título | `Cycle time p85` |
| `title` del título | `Percentil 85: el 85 % del trabajo se cerró en ese plazo o menos.` |
| Valor global | `{n} d ahora` |
| Leyenda de muestra corta | `muestra corta` |
| Etiqueta de semana | `4 ago` |
| Tamaño de muestra | `n {sample_size}` |
| Tooltip normal | `Semana del {fecha} · p85 {p85} d · mediana {mediana} d · {n} tickets` |
| Tooltip muestra corta | `Semana del {fecha} · p85 {p85} d · mediana {mediana} d · {n} tickets · muestra corta` |
| Tooltip sin cierres | `Semana del {fecha} · sin cierres` |
| Chip de filtro resultante | `Cerrados en la semana del {fecha}` |
| Pie | `El 85 % del trabajo se cierra en ese plazo o menos.` |
| Pie (condicional) | `Las barras punteadas tienen menos de 3 tickets: no son tendencia.` |
| Pie (huecos) | `{n} de las últimas 8 semanas no tuvieron cierres.` |
| Pie (todo corto) | `Todavía no hay volumen suficiente para hablar de tendencia.` |
| Vacío — título | `Todavía no hay tickets cerrados` |
| Vacío — cuerpo | `El cycle time se calcula sobre trabajo terminado. En cuanto se cierre el primero, esta gráfica empieza a llenarse.` |
| Vacío — acciones | `Ver tickets en revisión` / `Ver todos los tickets` |
| Error | `No se pudo cargar el cycle time.` + `Reintentar` |
| `aria-label` de la gráfica | `Cycle time p85 de las últimas 8 semanas: {serie} días.` |
| `aria-label` de barra | `Semana del {fecha}, p85 {p85} días, mediana {mediana} días, {n} tickets cerrados.` |

---

# 3. Aging WIP — tarjeta del Panel y sección en Miembros

## 3.1 Qué es y por qué importa

> **Aging WIP: días que un ticket lleva sin moverse de estado.**

No es "días desde que se creó" ni "días hasta el vencimiento". Es tiempo parado. Un
ticket que lleva once días en "En progreso" sin un solo cambio de estado no está
en progreso: está trabado, y nadie lo dijo en voz alta.

Los umbrales viven en la vista de Postgres, no en el cliente, para que el Panel, la
ficha de Miembros y un futuro PDF cuenten la misma historia:

| Nivel | `days_idle` | Color (`agingColor()`) | Marca no cromática | Lectura |
|---|---|---|---|---|
| `normal` | 0–2 | `var(--tinta-3)` | ninguna | se movió hace poco |
| `atencion` | ≥ 3 | `var(--tinta-2)` | `·` como prefijo | mirá esto |
| `alerta` | ≥ 7 | `#E07100` | `●` punto lleno | esto ya es un problema |
| `critico` | ≥ 14 | `var(--alerta)` | `●` punto lleno + `font-weight: 500` | esto está muerto |

Los colores son exactamente los de `agingColor()` en `lib/queries/metrics.ts`.
`#E07100` es `--e4-fg`, el naranja de "En revisión" y de "vence en ≤3 días": el
sistema ya lo usa para "atención, pero no rojo".

Las marcas no cromáticas son las mismas que el handoff usa para vencimiento (`• ` +
fecha) y para actividad de estado (punto lleno `●`). No se inventa un glifo nuevo.

**La escala de niveles usa la misma progresión que "Esperando" en la bandeja
(§1.7): 3 y 7 días.** Un solo par de umbrales para toda la herramienta.

## 3.2 Tarjeta del Panel: "Tickets estancados"

### 3.2.1 Nombre

La tarjeta se llama **"Tickets estancados"**, no "Aging WIP". "Aging WIP" es el
nombre del concepto en la documentación y en el código; en la interfaz, que está
completamente en español, la etiqueta es la que se entiende sin glosario. El término
técnico aparece una vez, en la nota de pie.

### 3.2.2 Ubicación y contenedor

Fila 2 del Panel, columna derecha (`1fr`), al lado de "Cycle time p85" (§2.2).

Contenedor idéntico a las demás tarjetas del Panel:

```
border: 1px solid var(--linea);
border-radius: 14px;
background: var(--superficie);
padding: 16px 18px;
box-shadow: var(--tarjeta-sombra);
```

### 3.2.3 Cabecera

`display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px`:

```
Tickets estancados      7 de 23 en curso
```

- Título: `font: 600 13px Archivo; color: var(--tinta)`.
- Contexto: `{n} de {wip_count} en curso` en `font: 400 11px Archivo; color:
  var(--tinta-2)`, con los números en `font: 600 11px 'IBM Plex Mono', monospace;
  color: var(--tinta)`. `n` cuenta las filas con nivel ≥ `atencion`; `wip_count`
  viene de `dashboard_summary()`.

  No es un KPI. Es del tamaño de la leyenda, cuenta una proporción y no lleva
  flecha ni comparación con la semana pasada.

### 3.2.4 Barra de composición

Una barra segmentada de 10px que muestra cómo se reparte el WIP entre los cuatro
niveles. Es exactamente el componente de "Distribución por estado" del handoff:

```
display: flex; height: 10px; border-radius: 99px; overflow: hidden;
gap: 2px; margin-bottom: 12px;
```

Cada segmento: `width: {porcentaje}%; background: {agingColor(nivel)};
border-radius: 99px`.

Orden de los segmentos, de izquierda a derecha: `normal` → `atencion` → `alerta` →
`critico`. Siempre ese orden, aunque un nivel esté vacío — la posición es parte de
cómo se lee la barra de un vistazo. Los segmentos con `width: 0` no se renderizan.

**Marca no cromática de los segmentos**: la barra sola sería un caso de dependencia
del color, así que el orden fijo de izquierda a derecha **es** la marca: el segmento
más a la derecha siempre es el peor. Se refuerza con los chips de abajo, que llevan
la etiqueta en palabras. No se agrega textura ni trama a los segmentos: el handoff
no usa patrones de relleno en ninguna parte y meter uno acá rompería la familia.

Debajo de la barra, los chips por nivel, `display: flex; flex-wrap: wrap; gap: 6px;
margin-bottom: 12px`, con el componente de chip de "Distribución por estado":

```
padding: 3px 9px; border-radius: 99px; background: var(--superficie-2);
font: 500 11px Archivo; color: {agingColor(nivel)};
display: inline-flex; align-items: center; gap: 5px;
```

Con el conteo en `font: 600 11px 'IBM Plex Mono', monospace`. Los chips de `alerta`
y `critico` llevan además el punto lleno `●` de 6px antes del texto, en su color;
los de `atencion` y `normal` no. Etiquetas: `Al día` · `Atención` · `Alerta` ·
`Crítico`.

Los chips son clicables: filtran la lista de abajo a ese nivel y superiores.

| Estado del chip | Tratamiento |
|---|---|
| reposo | `background: var(--superficie-2); color: {agingColor(nivel)}` |
| hover | `background: var(--superficie-3)` |
| activo (filtro aplicado) | `background: var(--acento-suave); color: var(--acento)`, con `aria-pressed="true"` |
| foco | `outline: 2px solid var(--acento); outline-offset: 2px` |

### 3.2.5 Lista de los estancados

Hasta **6 filas**, ordenadas por `days_idle` descendente. Es el mismo componente que
"Próximos vencimientos" del handoff, fila por fila:

```
display: flex; align-items: center; gap: 10px;
padding: 7px 9px; border-radius: 10px; cursor: pointer;
transition: background .12s;
```

**Anatomía de la fila**, de izquierda a derecha:

```
●   214   Reel de lanzamiento línea 4        En progreso    ● 11 d   (AN)
│    │     │                                  │              │        │
│    │     │                                  │              │        └ avatar 22px del dueño
│    │     │                                  │              └ días parados
│    │     │                                  └ chip de estado
│    │     └ título, Archivo 400 13px, ellipsis
│    └ número, Plex Mono 400 11px, --tinta-3
└ punto del tipo, 7px, type_color
```

| Elemento | Especificación |
|---|---|
| Punto de tipo | `width: 7px; height: 7px; border-radius: 99px; flex: none; background: {type_color}`, con `title="{type_abbrev}"` |
| Número | `font: 400 11px 'IBM Plex Mono', monospace; color: var(--tinta-3)` |
| Título | `font: 400 13px Archivo; color: var(--tinta); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis` |
| Chip de estado | `flex: none; height: 18px; padding: 0 6px; border-radius: 6px; font: 600 10px Archivo; font-stretch: 82%; letter-spacing: .05em; text-transform: uppercase; background: var(--eN-bg); color: var(--eN-fg); border: 1px solid var(--eN-fg)`, con su marca (`●` para En progreso y En revisión) |
| Peso | `flex: none; font: 400 11px 'IBM Plex Mono', monospace; color: var(--tinta-3)`, formato `{weight} pt`, con `data-col="peso"` |
| Días parados | `flex: none; font: 500 11px 'IBM Plex Mono', monospace; color: {agingColor(aging_level)}`, con el prefijo de la tabla de §3.1 |
| Avatar del dueño | `flex: none; width: 22px; height: 22px; border-radius: 99px; background: avatarColor(owner_id); color: #fff; font: 600 9px 'IBM Plex Mono', monospace`, con `title="{owner_name}"` |

Al desactivar el campo de peso, el elemento con `data-col="peso"` desaparece y nada
más se mueve.

**Fondo de fila según nivel** — con la misma contención que el handoff aplica a las
fechas vencidas: *si diez tickets están estancados, diez filas rojas vuelven la
tarjeta ilegible*. Por eso solo el nivel crítico tiñe la fila:

| Nivel | Fondo de fila en reposo |
|---|---|
| `atencion`, `alerta` | `transparent` |
| `critico` | `var(--alerta-suave)` |

Y solo el nivel crítico, porque un ticket parado catorce días es un evento raro. Si
llegara a haber seis críticos, la tarjeta está diciendo exactamente lo que hay que
oír.

**Estados de fila**

| Estado | Tratamiento |
|---|---|
| reposo | fondo según nivel (arriba) |
| hover | `background: var(--superficie-2)` — también sobre las críticas, que pasan de `--alerta-suave` a `--superficie-2` |
| foco | `outline: 2px solid var(--acento); outline-offset: -2px` |
| abierta en el detalle | `background: var(--acento-suave)` |

**Clic**: abre el panel de detalle del ticket.

**Si hay más de 6**, al pie de la lista una fila de texto sin fondo:
`Ver los {n} estancados` en `font: 400 11.5px Archivo; color: var(--acento)`,
subrayado al hover, que navega a `/tickets` con el filtro `Sin moverse hace 3 días o
más` aplicado como chip removible.

### 3.2.6 Nota de pie

`margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--linea)`:

```
Aging WIP: días que un ticket lleva sin moverse de estado. Atención a los 3 días,
alerta a los 7, crítico a los 14.
```

`font: 400 11.5px/1.5 Archivo; color: var(--tinta-2)`. Es el único lugar de la
interfaz donde aparece el término "Aging WIP".

### 3.2.7 Estado vacío de la tarjeta

**Caso A — nada estancado** (`wip_count > 0`, ninguno con nivel ≥ `atencion`):

La barra de composición **se dibuja igual**, con un único segmento `normal` al 100 %
en `--tinta-3` — es información: todo el WIP está al día. Debajo, en lugar de la
lista, alineado a la izquierda, `padding: 40px 16px; max-width: 520px`:

```
Nada estancado
Los 23 tickets en curso se movieron en los últimos 3 días.

[ Ver tickets en curso ]   [ Ir a Personas ]
```

**Caso B — sin WIP** (`wip_count = 0`): no se dibuja la barra ni los chips. Solo:

```
No hay trabajo en curso
Cuando alguien arranque un ticket, acá se ve cuánto lleva sin moverse.

[ Ver borradores ]   [ Ver todos los tickets ]
```

(`Ver borradores` solo si el usuario es admin; si no, la acción primaria es
`Ver todos los tickets` y la secundaria `Nuevo ticket`.)

**Caso C — filtro de chip sin resultados** (el usuario tocó `Crítico` y no hay
ninguno): la barra y los chips se mantienen, y en lugar de la lista, una línea sin
padding grande: `Ningún ticket en este nivel.` en `font: 400 12px Archivo; color:
var(--tinta-3); padding: 12px 9px`, con `Quitar filtro` al lado como botón de texto
subrayado en `--acento`. No es un estado vacío de vista: es un filtro sin
resultados dentro de una tarjeta que sí tiene datos.

Mismas medidas tipográficas y de botón que §1.12 para los casos A y B.

### 3.2.8 Estado de carga

Se mantienen el contenedor y el título. Se reemplazan:

- El contexto de la cabecera, por una barra de 8px × 78px en `--superficie-2`.
- La barra de composición, por una barra completa de 10px en `--superficie-2` sin
  segmentos.
- Los chips, por tres píldoras de `height: 20px` y anchos 62px / 54px / 48px en
  `--superficie-2`, `border-radius: 99px`.
- Cada una de las 6 filas de la lista, por: círculo de 7px + barra de 8px × 26px +
  barra de 8px de ancho variable (66 %, 43 %, 78 %, 51 %, 70 %, 38 %) + píldora de
  18px × 62px + barra de 8px × 30px + círculo de 22px, todo en `--superficie-2`.

**Sin shimmer.**

**Error de carga**: el contenedor y el título se mantienen; el resto se reemplaza por
`No se pudieron cargar los estancados.` en `font: 400 13px Archivo; color:
var(--tinta-2)` con `Reintentar` subrayado en `--acento` al lado.

## 3.3 Sección de aging en la ficha de Miembros

### 3.3.1 Dónde va

La tarjeta de persona de la vista Personas hoy termina con "hasta 4 tickets abiertos
como filas clicables". La sección de aging va **entre la barra de carga y esa lista
de tickets**, porque cambia cómo se lee la lista: saber que dos de los cuatro
tickets están parados es lo que da sentido a verlos.

Estructura resultante de la tarjeta de persona:

```
1. Avatar 38px · nombre · rol · píldora de vencidos          (existente)
2. carga de capacidad puntos · N tickets abiertos            (existente)
3. Barra de progreso de 8px                                  (existente)
4. Franja de aging                                           ← NUEVA
5. Hasta 4 tickets abiertos como filas clicables             (existente, modificada)
```

La tarjeta conserva todo lo demás: `border: 1px solid var(--linea); border-radius:
14px; background: var(--superficie); padding: 16px; box-shadow: var(--tarjeta-sombra);
transition: box-shadow .14s, transform .14s`, hover a `box-shadow:
var(--tarjeta-sombra-alta); transform: translateY(-2px)`.

### 3.3.2 La franja de aging

Una sola línea, `margin-bottom: 12px; display: flex; align-items: center; gap: 8px`.
La tarjeta de persona mide 320px de ancho mínimo: no hay lugar para una segunda
gráfica, así que la franja es tipográfica y compacta.

**Caso con estancados** (al menos uno con nivel ≥ `atencion`):

```
● 2 estancados          el más viejo, 11 días
│                       └ Archivo 400 11px, --tinta-2, margin-left: auto
└ Archivo 500 11.5px, color del nivel más alto presente; punto lleno de 6px
```

- El punto `●` de 6px y el color son los del **nivel más alto presente** en los
  tickets de esa persona (`critico` > `alerta` > `atencion`), vía `agingColor()`.
  Para `atencion`, el prefijo es `·` en vez de `●`, según la tabla de §3.1.
- `{n} estancados` con concordancia: `1 estancado` / `{n} estancados`.
- El número de días en el fragmento derecho va en `font: 500 11px 'IBM Plex Mono',
  monospace` con el color del nivel de ese ticket.
- Toda la franja es un botón: clic filtra la lista de abajo a solo los estancados de
  esa persona y el texto pasa a `Ver los 4 abiertos` para volver.

| Estado de la franja | Tratamiento |
|---|---|
| reposo | `background: transparent; cursor: pointer` |
| hover | `background: var(--superficie-2); border-radius: 6px; margin: 0 -4px; padding: 0 4px` |
| activo (filtro aplicado) | `background: var(--acento-suave); border-radius: 6px; margin: 0 -4px; padding: 0 4px`, con `aria-pressed="true"` |
| foco | `outline: 2px solid var(--acento); outline-offset: 1px` |

El hover de la franja no debe disparar el hover de la tarjeta contenedora
(`translateY(-2px)`), que ya está activo por estar el puntero dentro de la tarjeta:
no se agrega elevación adicional.

**Caso sin estancados**:

```
✓ Todo se movió esta semana
└ Archivo 400 11.5px, var(--e5-fg); el ✓ es la marca de "cerrado bien" del sistema
```

Sin botón, sin hover, sin foco — no hay nada que filtrar.

**Caso sin WIP** (la persona no tiene tickets en curso): la franja no se renderiza.
No se muestra "0 estancados": una franja que dice cero en una tarjeta que ya dice
"0 tickets abiertos" es ruido.

### 3.3.3 Las filas de tickets, con aging

Las hasta 4 filas existentes conservan sus medidas exactas:

```
display: flex; align-items: center; gap: 7px;
padding: 5px 7px; border-radius: 9px; cursor: pointer;
transition: background .12s;
```

| Estado | Tratamiento |
|---|---|
| reposo | `background: transparent` |
| hover | `background: var(--superficie-2)` |
| foco | `outline: 2px solid var(--acento); outline-offset: -2px` |

Se les agrega, **a la derecha, con `margin-left: auto`**, el dato de aging, sin
cambiar nada de lo que ya está (punto de tipo de 6px, número en `mono` 10.5px
`--tinta-3`, título en Archivo 400 12px `--tinta-2` con ellipsis):

```
{prefijo}{days_idle} d
font: 400 10.5px 'IBM Plex Mono', monospace;
color: {agingColor(aging_level)};
flex: none;
```

Con el prefijo de la tabla de §3.1: nada para `normal`, `·` para `atencion`, `●`
para `alerta` y `critico`, y `font-weight: 500` en `critico`.

**Orden de las filas**: por `days_idle` descendente. Lo más parado primero — es lo
que hay que mirar, y en cuatro filas no hay espacio para enterrarlo.

**Sin fondo de fila teñido**, ni siquiera en `critico`. En la vista Personas hay
ocho tarjetas simultáneas; teñir filas dentro de cada una produce un mosaico rojo
que no comunica nada. El color va solo en el número de días. Es la misma decisión
que el handoff toma para las fechas vencidas de la tabla.

### 3.3.4 Estados vacíos en Miembros

- **Persona sin tickets abiertos**: la lista de filas y la franja de aging no se
  renderizan. En su lugar, una línea única: `Sin tickets abiertos` en `font: 400
  11.5px Archivo; color: var(--tinta-3); padding: 5px 7px`. La tarjeta mantiene el
  avatar, el rol, la barra de carga (vacía) y la píldora de "Al día".
- **Persona con tickets pero todos `normal`**: franja del caso "Todo se movió esta
  semana" (§3.3.2) + las filas normales con su `{days_idle} d` en `--tinta-3`.
- **Filtro activo sin resultados** (el usuario hizo clic en la franja pero un filtro
  global dejó la lista vacía): `Ningún estancado con estos filtros` en `font: 400
  11.5px Archivo; color: var(--tinta-3)`, con `Ver los {n} abiertos` al lado como
  botón de texto en `--acento`.

### 3.3.5 Estado de carga en Miembros

La tarjeta de persona se dibuja completa con: círculo de 38px en `--superficie-2`,
barras de 8px × 96px y 8px × 120px para nombre y rol, píldora de 20px × 54px para
los vencidos, barra de 8px × 140px para la línea de carga, la barra de progreso de
8px en `--superficie-2` sin relleno, una barra de 8px × 130px donde va la franja de
aging, y tres filas esqueleto (círculo de 6px + barra de 8px × 24px + barra de 8px
al 60 % / 42 % / 71 % + barra de 8px × 26px). **Sin shimmer.**

## 3.4 Consistencia entre las tres superficies

El mismo dato aparece en el Panel, en Miembros y (a futuro) en el PDF mensual. Las
tres tienen que decir lo mismo:

| | Panel | Miembros | Regla |
|---|---|---|---|
| Umbrales | 3 / 7 / 14 | 3 / 7 / 14 | vienen de `aging_wip.aging_level`, nunca se recalculan en el cliente |
| Colores | `agingColor()` | `agingColor()` | una sola función |
| Prefijos | `·` / `●` / `●` | `·` / `●` / `●` | una sola tabla (§3.1) |
| Formato de días | `11 d` | `11 d` | `{n} d`, siempre con espacio, siempre en mono |
| Etiquetas de nivel | `Al día` · `Atención` · `Alerta` · `Crítico` | idem | una sola tabla |
| Fondo teñido | solo `critico`, solo en la tarjeta del Panel | nunca | la tinción se reserva para donde hay pocas filas |

Si un umbral cambia, cambia en la vista de Postgres y las tres superficies se
mueven juntas. Ningún componente lee `days_idle` para decidir un color por su
cuenta: lee `aging_level`.

## 3.5 Accesibilidad

- Cada nivel tiene **color + prefijo glífico + etiqueta textual**. En escala de
  grises, `● 11 d` y `· 4 d` se distinguen por el glifo; el chip dice `Crítico` en
  palabras.
- La barra de composición del Panel lleva `role="img"` y un `aria-label` completo:
  `Composición del trabajo en curso: 16 al día, 4 en atención, 2 en alerta, 1
  crítico.` Los segmentos individuales llevan `title`.
- Cada fila de la lista de estancados es un elemento con `role="row"` y
  `tabIndex="0"`, navegable con `↑`/`↓`, con `Enter` para abrir el detalle y
  `Escape` para cerrarlo devolviendo el foco a la fila.
- El `aria-label` de cada fila es completo, no solo el título:
  `Ticket 214, Reel de lanzamiento línea 4, en progreso, parado hace 11 días, nivel
  crítico, dueño Ana Navarro.`
- Los chips de nivel del Panel son `<button aria-pressed>` para que el estado de
  filtro se anuncie.
- La franja de aging de Miembros lleva `aria-label="2 tickets estancados de Ana
  Navarro, el más viejo hace 11 días. Activar para filtrar la lista."` y
  `aria-pressed` cuando el filtro está aplicado.
- Contraste AA en todos los pares. `#E07100` sobre `--superficie` (`#FFFFFF`) y
  sobre `--alerta-suave` (`#FDE7E9`) cumple.

  **Corrección pendiente sobre el código existente**: en tema oscuro, el hex fijo
  `#E07100` de `agingColor()` no contrasta contra `--superficie` (`#16181C`). El
  nivel `alerta` debe devolver `var(--e4-fg)` en lugar de `#E07100`, que resuelve a
  `#E07100` en claro y a `#FFA23D` en oscuro. Es la única corrección que este
  documento pide sobre el código ya escrito.

## 3.6 Microcopy final

| Elemento | Texto |
|---|---|
| Título de la tarjeta del Panel | `Tickets estancados` |
| Contexto de la cabecera | `{n} de {wip} en curso` |
| Chips de nivel | `Al día` · `Atención` · `Alerta` · `Crítico` |
| Días parados | `{n} d` (con prefijo `·` o `●` según nivel) |
| Peso en la fila | `{n} pt` |
| Ver más | `Ver los {n} estancados` |
| Chip de filtro resultante | `Sin moverse hace 3 días o más` |
| Nota de pie | `Aging WIP: días que un ticket lleva sin moverse de estado. Atención a los 3 días, alerta a los 7, crítico a los 14.` |
| Vacío A — título | `Nada estancado` |
| Vacío A — cuerpo | `Los {n} tickets en curso se movieron en los últimos 3 días.` |
| Vacío A — acciones | `Ver tickets en curso` / `Ir a Personas` |
| Vacío B — título | `No hay trabajo en curso` |
| Vacío B — cuerpo | `Cuando alguien arranque un ticket, acá se ve cuánto lleva sin moverse.` |
| Vacío B — acciones (admin) | `Ver borradores` / `Ver todos los tickets` |
| Vacío B — acciones (miembro) | `Ver todos los tickets` / `Nuevo ticket` |
| Vacío C — filtro de chip | `Ningún ticket en este nivel.` + `Quitar filtro` |
| Error de la tarjeta | `No se pudieron cargar los estancados.` + `Reintentar` |
| Franja de Miembros (plural) | `{n} estancados` + `el más viejo, {d} días` |
| Franja de Miembros (singular) | `1 estancado` + `hace {d} días` |
| Franja de Miembros (sin) | `✓ Todo se movió esta semana` |
| Volver del filtro | `Ver los {n} abiertos` |
| Miembro sin tickets | `Sin tickets abiertos` |
| Miembro filtrado vacío | `Ningún estancado con estos filtros` |
| `aria-label` de la barra | `Composición del trabajo en curso: {a} al día, {b} en atención, {c} en alerta, {d} crítico.` |
| `aria-label` de fila | `Ticket {n}, {título}, {estado}, parado hace {d} días, nivel {nivel}, dueño {dueño}.` |
| `aria-label` de la franja | `{n} tickets estancados de {persona}, el más viejo hace {d} días. Activar para filtrar la lista.` |

---

# Anexo A — Resumen de decisiones y por qué

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| "De / para" ocupa 200px y es la columna central de la bandeja | poner el título primero, como en la tabla | la decisión del admin es sobre la relación pedidor–receptor, no sobre el contenido del ticket |
| El badge desaparece con cero borradores | mostrar `Borradores 0` | el handoff no reserva espacio para lo que no existe (fila de chips de filtro) |
| Rechazar es un botón secundario, no rojo | primario en `--alerta` | rechazar es frecuente y legítimo; la fricción va en el motivo obligatorio |
| El primario del modal de rechazo es azul | rojo destructivo | consistencia del sistema: el primario confirma la acción del modal, sea cual sea |
| Aprobar no pide confirmación | modal de confirmación | reversible 900ms + registrado en el log; el modal duplicaría los clics de la cola |
| Confirmación en la fila durante 900ms | quitar la fila al instante | misma duración y mismo patrón que la confirmación de soltado del kanban |
| Una barra por semana en cycle time, no dos | p85 + mediana lado a lado | dos barras invitan a una comparación que no es la pregunta de la tarjeta |
| Muestra corta = borde punteado, no solo opacidad | `opacity: .45` sola | el punteado sobrevive a la escala de grises; es la marca de "no cuenta todavía" del sistema |
| `n {sample_size}` visible bajo cada barra, sin hover | solo en el tooltip | densidad de información: el dato que califica al dato, a la vista |
| Sin ejes ni retícula en la gráfica | eje Y con marcas de días | el handoff no dibuja ejes en ninguna gráfica; agregarlo rompe la familia |
| La tarjeta se llama "Tickets estancados" | "Aging WIP" | interfaz completamente en español; el término técnico va una vez en el pie |
| Solo el nivel `critico` tiñe la fila | teñir `alerta` también | misma contención que las fechas vencidas: diez filas rojas vuelven ilegible la lista |
| En Miembros ninguna fila se tiñe | teñir críticos también ahí | ocho tarjetas simultáneas producirían un mosaico rojo sin señal |
| Cycle time y estancados comparten fila 2 | apilarlas al fondo del Panel | ritmo y trabas se leen juntas; al fondo serían invisibles |
| Umbrales 3 / 7 compartidos entre bandeja y aging | escalas independientes | una sola escala mental para toda la herramienta |
| El orden de la bandeja no es configurable | permitir ordenar por peso o prioridad | reordenar invita a posponer lo viejo, que es el problema que la vista resuelve |

# Anexo B — Checklist de implementación

Antes de dar por cerrada cualquiera de las tres piezas:

- [ ] Ningún valor hex nuevo. Todo color sale de un token o de `type_color` /
      `priority_color` / `avatarColor()`.
- [ ] Ninguna duración de transición fuera de `.1s` / `.12s` / `.16s` / `.3s`.
- [ ] Ningún gradiente de fondo, glassmorphism ni sombra difusa. Solo
      `--tarjeta-sombra` y `--tarjeta-sombra-alta`.
- [ ] Ninguna animación decorativa. Solo `height`/`width` de barra al montar.
- [ ] Todo estado y nivel tiene marca no cromática. Verificado en escala de grises.
- [ ] `:focus-visible` visible en todo elemento interactivo. Ningún `outline: none`
      sin reemplazo.
- [ ] Sentence case en botones y etiquetas; verbos activos.
- [ ] Concordancia de singular/plural en todo texto con número interpolado.
- [ ] Cada pieza tiene estado vacío, estado de carga y estado de error definidos.
- [ ] Estados vacíos alineados a la izquierda, `padding: 40px 16px`, `max-width:
      520px`, con acción primaria y secundaria.
- [ ] Esqueletos de carga con barras de 8px en `--superficie-2`. Sin shimmer.
- [ ] Todo elemento con `data-col="peso"` desaparece al desactivar el campo de peso,
      y nada más se mueve.
- [ ] Todo numérico y categórico en IBM Plex Mono; todo narrativo en Archivo.
- [ ] Las columnas de la bandeja no se mueven al cambiar la densidad.
- [ ] `aria-label` completo en toda fila, chip de filtro y elemento gráfico.
- [ ] El modal de rechazo tiene focus trap, cierre con Escape y devuelve el foco.
- [ ] Ningún componente recalcula `aging_level` a partir de `days_idle`.
- [ ] `agingColor('alerta')` devuelve `var(--e4-fg)`, no el hex fijo `#E07100`.
- [ ] Probado en tema claro y oscuro, densidad compacta y cómoda.
- [ ] `prefers-reduced-motion` respetado (ya cubierto por la regla global de
      `tokens.css`).
