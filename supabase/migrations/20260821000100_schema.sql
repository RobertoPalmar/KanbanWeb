-- =============================================================================
-- MVP 1 · Schema base
-- Sistema de gestión de trabajo (ITS) para departamento de comunicación social.
-- Un solo workspace. Sin multi-tenancy.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- Estados fijos en código (lib/states.ts es la fuente de verdad de labels/colores).
-- Agregar un estado = una línea en lib/states.ts + un ALTER TYPE aquí.
create type issue_state as enum (
  'draft',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'cancelled'
);

-- Categoría derivada del estado. Es lo que consultan las métricas: ninguna query
-- filtra por nombre ni por clave individual de estado.
create type state_category as enum (
  'draft',
  'unstarted',
  'started',
  'completed',
  'cancelled'
);

create type user_role as enum ('viewer', 'member', 'admin');

create type attachment_kind as enum ('file', 'link');

-- -----------------------------------------------------------------------------
-- Mapeo estado -> categoría / orden
-- Función inmutable en lugar de tabla: mismo dato que lib/states.ts, sin CRUD.
-- -----------------------------------------------------------------------------

create or replace function state_category(s issue_state)
returns state_category
language sql
immutable
parallel safe
as $fn$
  select case s
    when 'draft'       then 'draft'
    when 'todo'        then 'unstarted'
    when 'in_progress' then 'started'
    when 'in_review'   then 'started'
    when 'done'        then 'completed'
    when 'cancelled'   then 'cancelled'
  end::state_category;
$fn$;

create or replace function state_order(s issue_state)
returns int
language sql
immutable
parallel safe
as $fn$
  select case s
    when 'draft'       then 1
    when 'todo'        then 2
    when 'in_progress' then 3
    when 'in_review'   then 4
    when 'done'        then 5
    when 'cancelled'   then 6
  end;
$fn$;

-- Cuenta en WIP: solo la categoría 'started'.
create or replace function counts_in_wip(s issue_state)
returns boolean
language sql
immutable
parallel safe
as $fn$
  select state_category(s) = 'started';
$fn$;

-- -----------------------------------------------------------------------------
-- users
-- Espejo de auth.users con el rol de la aplicación.
-- -----------------------------------------------------------------------------

create table users (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  email      text not null unique,
  avatar_url text,
  role       user_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_role_idx on users(role);

-- -----------------------------------------------------------------------------
-- issue_types · labels
-- Se archivan, nunca se borran: borrar un tipo con tickets históricos rompe
-- los reportes.
-- -----------------------------------------------------------------------------

create table issue_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text not null default '#6b7280',
  icon       text,
  "order"    int  not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create index issue_types_active_idx on issue_types("order") where not archived;

create table labels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text not null default '#6b7280',
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create index labels_active_idx on labels(name) where not archived;

-- -----------------------------------------------------------------------------
-- settings
-- Fila única. El check sobre id garantiza que no pueda haber una segunda.
-- -----------------------------------------------------------------------------

create table settings (
  id                 boolean primary key default true check (id),
  estimation_enabled boolean not null default false,
  estimation_scale   text    not null default 'fibonacci'
                     check (estimation_scale in ('fibonacci', 'tshirt')),
  org_name           text    not null default 'Comunicación Social y Mercadeo',
  logo_url           text,
  updated_at         timestamptz not null default now()
);

insert into settings (id) values (true);

-- -----------------------------------------------------------------------------
-- priorities
-- Configurable por admin (sección 6 · Configuración), por eso es tabla y no enum.
-- -----------------------------------------------------------------------------

create table priorities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text not null default '#6b7280',
  "order"    int  not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- issues
-- -----------------------------------------------------------------------------

create sequence issue_number_seq as bigint start 1;

create table issues (
  id           uuid primary key default gen_random_uuid(),
  number       bigint not null unique default nextval('issue_number_seq'),
  title        text   not null check (length(trim(title)) > 0),
  description  text,
  type_id      uuid   not null references issue_types(id) on delete restrict,
  state        issue_state not null default 'draft',
  priority_id  uuid   references priorities(id) on delete set null,

  -- weight vive siempre en la tabla, incluso con estimation_enabled = false,
  -- para no perder datos históricos al alternar el toggle.
  weight       numeric,

  owner_id     uuid not null references users(id) on delete restrict,
  created_by   uuid not null references users(id) on delete restrict,
  due_date     date,

  -- Idempotencia del import: re-importar el mismo archivo actualiza, no duplica.
  external_id  text unique,

  -- Los tickets importados con estado avanzado no tienen historia de
  -- transiciones. Se excluyen del cálculo de cycle time.
  imported     boolean not null default false,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index issues_state_idx      on issues(state);
create index issues_owner_idx      on issues(owner_id);
create index issues_type_idx       on issues(type_id);
create index issues_due_date_idx   on issues(due_date) where due_date is not null;
create index issues_created_at_idx on issues(created_at desc);

-- WIP por persona: el índice parcial cubre la query caliente del dashboard.
create index issues_wip_idx on issues(owner_id)
  where state in ('in_progress', 'in_review');

-- Borradores pendientes: alimenta el badge contador del admin.
create index issues_draft_idx on issues(created_at) where state = 'draft';

-- -----------------------------------------------------------------------------
-- issue_supporters
-- Los apoyos comentan y adjuntan; no mueven el ticket ni editan campos.
-- -----------------------------------------------------------------------------

create table issue_supporters (
  issue_id   uuid not null references issues(id) on delete cascade,
  user_id    uuid not null references users(id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (issue_id, user_id)
);

create index issue_supporters_user_idx on issue_supporters(user_id);

create table issue_labels (
  issue_id uuid not null references issues(id) on delete cascade,
  label_id uuid not null references labels(id) on delete cascade,
  primary key (issue_id, label_id)
);

create index issue_labels_label_idx on issue_labels(label_id);

-- -----------------------------------------------------------------------------
-- issue_activity · log append-only
-- Fuente de verdad de started_at, completed_at, tiempo por estado, reaperturas
-- y cumulative flow. Sin UPDATE ni DELETE (ver políticas RLS).
--
-- Para transiciones de estado: field = 'state', y old_value/new_value guardan
-- CLAVES de estado, nunca etiquetas.
-- Para tickets importados: field = 'imported' en lugar de una cadena de
-- transiciones falsas.
-- -----------------------------------------------------------------------------

create table issue_activity (
  id         bigserial primary key,
  issue_id   uuid not null references issues(id) on delete cascade,
  actor_id   uuid references users(id) on delete set null,
  field      text not null,
  old_value  text,
  new_value  text,
  created_at timestamptz not null default now()
);

create index issue_activity_issue_idx on issue_activity(issue_id, created_at);
create index issue_activity_actor_idx on issue_activity(actor_id, created_at desc);

-- Transiciones de estado: sostiene el cálculo de started_at / completed_at.
create index issue_activity_state_idx on issue_activity(issue_id, created_at)
  where field = 'state';

-- -----------------------------------------------------------------------------
-- comments
-- -----------------------------------------------------------------------------

create table comments (
  id         uuid primary key default gen_random_uuid(),
  issue_id   uuid not null references issues(id) on delete cascade,
  author_id  uuid not null references users(id) on delete restrict,
  body       text not null check (length(trim(body)) > 0),

  -- Marca los comentarios exigidos por una transición (cancelación).
  -- Permite distinguirlos en el detalle del ticket.
  system_reason boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_issue_idx on comments(issue_id, created_at);

-- -----------------------------------------------------------------------------
-- attachments · a nivel de ticket, no de comentario
-- -----------------------------------------------------------------------------

create table attachments (
  id           uuid primary key default gen_random_uuid(),
  issue_id     uuid not null references issues(id) on delete cascade,
  uploaded_by  uuid not null references users(id) on delete restrict,
  kind         attachment_kind not null,
  file_name    text,
  mime_type    text,
  size_bytes   bigint,
  storage_path text,
  external_url text,
  created_at   timestamptz not null default now(),

  -- Límite duro de 25 MB, validado también en cliente y en el edge de subida.
  constraint attachments_size_limit
    check (size_bytes is null or size_bytes <= 25 * 1024 * 1024),

  -- 'file' exige storage_path; 'link' exige external_url. Nunca ambos.
  constraint attachments_shape check (
    (kind = 'file' and storage_path is not null and external_url is null)
    or
    (kind = 'link' and external_url is not null and storage_path is null)
  )
);

create index attachments_issue_idx on attachments(issue_id, created_at);

-- -----------------------------------------------------------------------------
-- saved_views
-- Filtro + nombre. Es lo que evita que la herramienta se sienta pesada al mes.
-- -----------------------------------------------------------------------------

create table saved_views (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  name         text not null,
  filters_json jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (user_id, name)
);

create index saved_views_user_idx on saved_views(user_id);

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

create trigger users_touch    before update on users    for each row execute function touch_updated_at();
create trigger issues_touch   before update on issues   for each row execute function touch_updated_at();
create trigger comments_touch before update on comments for each row execute function touch_updated_at();
create trigger settings_touch before update on settings for each row execute function touch_updated_at();

-- -----------------------------------------------------------------------------
-- Semillas
-- El primer tipo de la lista es el default del formulario (order = 1).
-- -----------------------------------------------------------------------------

insert into issue_types (name, "order", color, icon) values
  ('Publicación / Post',   1, '#3b82f6', 'megaphone'),
  ('Diseño gráfico',       2, '#8b5cf6', 'palette'),
  ('Video / Reel',         3, '#ec4899', 'video'),
  ('Copywriting',          4, '#f59e0b', 'pen-tool'),
  ('Campaña',              5, '#10b981', 'target'),
  ('Cobertura de evento',  6, '#06b6d4', 'camera'),
  ('Solicitud interna',    7, '#6b7280', 'inbox'),
  ('Reporte / Analítica',  8, '#ef4444', 'bar-chart');

insert into priorities (name, "order", color) values
  ('Urgente', 1, '#ef4444'),
  ('Alta',    2, '#f59e0b'),
  ('Media',   3, '#3b82f6'),
  ('Baja',    4, '#6b7280');
