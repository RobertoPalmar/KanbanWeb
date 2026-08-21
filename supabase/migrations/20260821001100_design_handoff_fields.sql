-- =============================================================================
-- MVP 1 · Campos que exige el handoff de diseño
--
-- El diseño es hifi: siglas, colores y capacidad no son decoración, son parte
-- de cómo se lee la tabla y el kanban. Hardcodearlos en el front rompería la
-- pantalla de Configuración, donde los tipos son editables por el admin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- issue_types: sigla de 2 letras y color
--
-- La sigla es la identidad del tipo en la fila compacta (28 px), donde el
-- nombre completo no entra.
-- -----------------------------------------------------------------------------

alter table issue_types add column if not exists abbrev text;

update issue_types set abbrev = 'PB', color = '#0A73E8' where name = 'Publicación / Post';
update issue_types set abbrev = 'DG', color = '#F2542D' where name = 'Diseño gráfico';
update issue_types set abbrev = 'VD', color = '#7B3FD4' where name = 'Video / Reel';
update issue_types set abbrev = 'CW', color = '#0F9D58' where name = 'Copywriting';
update issue_types set abbrev = 'CA', color = '#F5A300' where name = 'Campaña';
update issue_types set abbrev = 'EV', color = '#E5197F' where name = 'Cobertura de evento';
update issue_types set abbrev = 'SI', color = '#8A9099' where name = 'Solicitud interna';
update issue_types set abbrev = 'AN', color = '#00A9C7' where name = 'Reporte / Analítica';

alter table issue_types
  alter column abbrev set not null,
  add constraint issue_types_abbrev_len check (length(abbrev) between 1 and 3);

-- -----------------------------------------------------------------------------
-- priorities: colores del diseño
--
-- OJO con el orden: el "order" de la BD es 1=Urgente..4=Baja (prioridad
-- descendente, como se listan en un selector). El diseño numera al revés
-- (1=Baja..4=Urgente). Se mantiene el orden de la BD; el front ordena por
-- "order", nunca por el número del prototipo.
-- -----------------------------------------------------------------------------

update priorities set color = '#E0182D' where name = 'Urgente';
update priorities set color = '#F5A300' where name = 'Alta';
update priorities set color = '#0A73E8' where name = 'Media';
update priorities set color = '#00A9C7' where name = 'Baja';

-- -----------------------------------------------------------------------------
-- users: cargo y capacidad
--
-- `role` (viewer/member/admin) es un rol de PERMISOS. El diseño muestra además
-- un cargo descriptivo ("Diseño gráfico", "Producción y eventos") que es otra
-- cosa: dos conceptos distintos que en el prototipo comparten nombre.
--
-- capacity: el diseño la hardcodea en 20 puntos y la usa para la barra de carga
-- de la vista Personas. Como columna, cada persona puede tener la suya —media
-- jornada, licencia— sin tocar código.
-- -----------------------------------------------------------------------------

alter table users
  add column if not exists job_title text,
  add column if not exists capacity  numeric not null default 20
    check (capacity > 0);

-- -----------------------------------------------------------------------------
-- user_preferences: tema y densidad
--
-- Son preferencias POR USUARIO, a diferencia de `settings`, que es la
-- configuración global del workspace. El toggle de peso sí es global y vive en
-- settings.estimation_enabled.
-- -----------------------------------------------------------------------------

create table if not exists user_preferences (
  user_id    uuid primary key references users(id) on delete cascade,
  theme      text not null default 'claro'  check (theme   in ('claro', 'oscuro')),
  density    text not null default 'comoda' check (density in ('compacta', 'comoda')),
  updated_at timestamptz not null default now()
);

alter table user_preferences enable row level security;

create policy user_preferences_own on user_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger user_preferences_touch
  before update on user_preferences
  for each row execute function touch_updated_at();

-- -----------------------------------------------------------------------------
-- notification_preferences
--
-- Los tres interruptores de la pantalla de Ajustes. Guardar la preferencia no
-- implica que el envío exista: el MVP 1 excluye notificaciones por email, así
-- que por ahora solo alimentan el aviso in-app.
-- -----------------------------------------------------------------------------

create table if not exists notification_preferences (
  user_id      uuid primary key references users(id) on delete cascade,
  on_assigned  boolean not null default true,   -- "Me asignan un ticket"
  on_mention   boolean not null default true,   -- "Comentan o me mencionan"
  daily_digest boolean not null default false,  -- "Resumen diario a las 8:00"
  updated_at   timestamptz not null default now()
);

alter table notification_preferences enable row level security;

create policy notification_preferences_own on notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger notification_preferences_touch
  before update on notification_preferences
  for each row execute function touch_updated_at();

-- -----------------------------------------------------------------------------
-- saved_views: compartidas con el equipo y fijadas en la barra lateral
-- -----------------------------------------------------------------------------

alter table saved_views
  add column if not exists is_shared boolean not null default false,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists "order"   int     not null default 0;

drop policy if exists saved_views_own on saved_views;

create policy saved_views_select on saved_views
  for select to authenticated
  using (user_id = (select auth.uid()) or is_shared);

create policy saved_views_write on saved_views
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
