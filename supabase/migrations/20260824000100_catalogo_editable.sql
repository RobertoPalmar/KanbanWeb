-- =============================================================================
-- MVP 1 · Catálogo editable: tipos de ticket y etiquetas
--
-- La pantalla de Ajustes pasa de mostrar los tipos como chips de solo lectura a
-- permitir crear tipos y etiquetas nuevos, cada uno con un color de una paleta
-- fija. Esta migración NO agrega columnas —`issue_types` y `labels` ya tienen
-- name, color, abbrev y archived— y NO toca las políticas RLS, que ya dejan
-- escribir a los admin (`issue_types_admin`, `labels_admin` en
-- 20260821000300_rls.sql).
--
-- Lo único que faltaba es la garantía de unicidad: de la SIGLA entre tipos
-- activos, y del NOMBRE de etiqueta sin distinguir mayúsculas.
--
-- NOTA: esta migración ya está aplicada en el proyecto bpitialkrbfgwsriiips.
-- No siembra etiquetas: el catálogo real ya tenía 15 y la siembra habría
-- generado duplicados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- issue_types.abbrev: única entre los tipos ACTIVOS
--
-- La sigla es la identidad visual del tipo en la fila compacta de 28px, donde el
-- nombre no entra: dos tipos activos con la misma sigla vuelven la tabla
-- ilegible, porque la píldora "DG" dejaría de identificar una sola cosa.
--
-- El índice es PARCIAL (`where not archived`) a propósito. La regla del proyecto
-- es que los tipos se archivan y nunca se borran, así que la lista de
-- archivados crece para siempre; si la sigla tuviera que ser única en toda la
-- tabla, con el tiempo las 676 combinaciones de dos letras se irían agotando y
-- el admin quedaría bloqueado por tipos que ya nadie usa. Entre los activos, en
-- cambio, la unicidad es exactamente lo que la interfaz necesita.
--
-- Consecuencia a tener en cuenta: desarchivar un tipo puede fallar si otro
-- activo tomó su sigla mientras estaba archivado. Es el comportamiento correcto
-- —dos "DG" activos no pueden convivir— y el error se traduce en la acción de
-- servidor.
-- -----------------------------------------------------------------------------

-- Antes de crear el índice hay que resolver los choques que ya existan: si dos
-- tipos activos comparten sigla, el `create unique index` falla y la migración
-- entera se corta. Se desempata dejando la sigla al de `order` más bajo y
-- agregándole un dígito al resto, que es reversible desde la interfaz.
with duplicados as (
  select
    id,
    abbrev,
    row_number() over (partition by upper(abbrev) order by "order", created_at) as n
  from issue_types
  where not archived
)
update issue_types t
   set abbrev = left(d.abbrev, 2) || (d.n - 1)::text
  from duplicados d
 where t.id = d.id
   and d.n > 1;

create unique index if not exists issue_types_abbrev_activos_key
  on issue_types (upper(abbrev))
  where not archived;

comment on index issue_types_abbrev_activos_key is
  'La sigla identifica al tipo en la fila compacta: única entre activos. Parcial para no agotar el espacio de siglas con tipos archivados.';

-- -----------------------------------------------------------------------------
-- labels: nombre único sin distinguir mayúsculas
--
-- `labels.name` ya tiene un unique del schema original, pero es sensible a
-- mayúsculas: admitiría "Urgente" y "urgente" como dos etiquetas distintas, que
-- es exactamente el duplicado que un catálogo compartido no debería permitir.
-- El chequeo de la acción de servidor compara sin tildes ni mayúsculas; este
-- índice lo respalda en la base para que dos altas simultáneas no lo esquiven.
-- -----------------------------------------------------------------------------

with duplicados as (
  select id, name,
         row_number() over (partition by lower(name) order by created_at) as n
  from labels
)
update labels l
   set name = d.name || ' (' || d.n::text || ')'
  from duplicados d
 where l.id = d.id
   and d.n > 1;

create unique index if not exists labels_name_lower_key
  on labels (lower(name));
