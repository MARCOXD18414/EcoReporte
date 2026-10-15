-- =====================================================================
--  EcoReporta Carmen — Esquema normalizado (3FN) para Supabase
--  Ciudad del Carmen, Campeche · Laguna de Términos · Playa Norte
--
--  Ejecutar completo en: Supabase Dashboard → SQL Editor → New query
--
--  Estrategia de 2 bases de datos gratuitas:
--    1) Supabase (PostgreSQL + Storage)  → fuente de verdad en la nube
--    2) IndexedDB (navegador / PWA)      → cola offline de reportes
--
--  Notas de normalización (3FN):
--    · Todo valor repetible vive en un catálogo (roles, categorias,
--      tipos_desecho, severidades, estados_reporte) y se referencia por FK.
--    · La categoría de un reporte NO se guarda en reportes: se deriva de
--      tipos_desecho.categoria_id (evita dependencia transitiva).
--    · El historial de estados y las notificaciones IA son tablas propias
--      (no columnas repetidas dentro de reportes).
--    · La relación N:M brigadas↔usuarios se resuelve con tabla puente.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. CATÁLOGOS
-- ---------------------------------------------------------------------
create table if not exists public.roles (
  id      smallint primary key,
  slug    text not null unique,
  nombre  text not null
);

create table if not exists public.categorias (
  id      smallint primary key,
  slug    text not null unique,
  nombre  text not null
);

create table if not exists public.tipos_desecho (
  id            smallint primary key,
  nombre        text not null unique,
  icono         text not null,
  categoria_id  smallint not null references public.categorias(id),
  descripcion   text
);

create table if not exists public.severidades (
  id      smallint primary key,
  slug    text not null unique,
  nombre  text not null,
  nivel   smallint not null unique check (nivel between 1 and 3)
);

create table if not exists public.estados_reporte (
  id      smallint primary key,
  slug    text not null unique,
  nombre  text not null,
  orden   smallint not null unique
);

-- ---------------------------------------------------------------------
-- 2. USUARIOS
-- ---------------------------------------------------------------------
create table if not exists public.usuarios (
  id             uuid primary key default gen_random_uuid(),
  alias          text not null check (char_length(alias) between 2 and 40),
  email          text unique,
  password_hash  text,
  rol_id         smallint not null default 1 references public.roles(id),
  created_at     timestamptz not null default now(),
  -- Un administrador siempre requiere credenciales
  constraint usuarios_admin_credenciales
    check (rol_id = 1 or (email is not null and password_hash is not null))
);

-- ---------------------------------------------------------------------
-- 3. REPORTES (tabla principal)
-- ---------------------------------------------------------------------
create table if not exists public.reportes (
  id                     uuid primary key default gen_random_uuid(),
  usuario_id             uuid references public.usuarios(id) on delete set null,
  tipo_desecho_id        smallint not null references public.tipos_desecho(id),
  severidad_id           smallint not null default 2 references public.severidades(id),
  estado_id              smallint not null default 1 references public.estados_reporte(id),
  latitud                numeric(9,6) not null check (latitud between -90 and 90),
  longitud               numeric(9,6) not null check (longitud between -180 and 180),
  ubicacion_ajustada     boolean not null default false,  -- el usuario movió el pin
  imagen_url             text,                            -- NULLABLE (alerta rápida sin foto)
  descripcion_detallada  text check (char_length(descripcion_detallada) <= 1000),
  es_alerta_rapida       boolean not null default false,
  procesado_offline      boolean not null default false,
  confianza_ia           numeric(4,3) check (confianza_ia between 0 and 1),
  analisis_ia            jsonb,
  client_uuid            uuid unique,                     -- idempotencia de sync offline
  capturado_en           timestamptz not null default now(),  -- hora real de captura (offline)
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_reportes_estado     on public.reportes(estado_id);
create index if not exists idx_reportes_tipo       on public.reportes(tipo_desecho_id);
create index if not exists idx_reportes_created    on public.reportes(created_at desc);
create index if not exists idx_reportes_coords     on public.reportes(latitud, longitud);

-- ---------------------------------------------------------------------
-- 4. HISTORIAL DE ESTADOS (auditoría Pendiente → En Proceso → Resuelto)
-- ---------------------------------------------------------------------
create table if not exists public.historial_estados (
  id          bigint generated always as identity primary key,
  reporte_id  uuid not null references public.reportes(id) on delete cascade,
  estado_id   smallint not null references public.estados_reporte(id),
  usuario_id  uuid references public.usuarios(id) on delete set null,
  comentario  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_historial_reporte on public.historial_estados(reporte_id);

-- ---------------------------------------------------------------------
-- 5. NOTIFICACIONES GENERADAS POR GEMMA IA (panel de autoridades)
-- ---------------------------------------------------------------------
create table if not exists public.notificaciones_ia (
  id            bigint generated always as identity primary key,
  reporte_id    uuid not null references public.reportes(id) on delete cascade,
  severidad_id  smallint not null references public.severidades(id),
  titulo        text not null,
  mensaje       text not null,
  leida         boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_notif_leida on public.notificaciones_ia(leida, created_at desc);

-- ---------------------------------------------------------------------
-- 6. BRIGADAS CIUDADANAS (Comunidad)
-- ---------------------------------------------------------------------
create table if not exists public.brigadas (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null check (char_length(titulo) between 4 and 120),
  descripcion     text,
  categoria_id    smallint not null references public.categorias(id),
  lugar           text not null,
  latitud         numeric(9,6) not null,
  longitud        numeric(9,6) not null,
  fecha           timestamptz not null,
  organizador_id  uuid references public.usuarios(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists public.brigada_participantes (
  brigada_id  uuid not null references public.brigadas(id) on delete cascade,
  usuario_id  uuid not null references public.usuarios(id) on delete cascade,
  unido_en    timestamptz not null default now(),
  primary key (brigada_id, usuario_id)
);

-- ---------------------------------------------------------------------
-- 7. TRIGGER updated_at
-- ---------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_reportes_updated on public.reportes;
create trigger trg_reportes_updated
  before update on public.reportes
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- 8. VISTAS DE LECTURA (derivadas, no rompen 3FN)
-- ---------------------------------------------------------------------
create or replace view public.v_reportes_detalle
with (security_invoker = true) as
select
  r.id, r.usuario_id, u.alias as usuario_alias,
  r.tipo_desecho_id, t.nombre as tipo_nombre, t.icono as tipo_icono,
  c.id as categoria_id, c.slug as categoria_slug, c.nombre as categoria_nombre,
  r.severidad_id, s.slug as severidad_slug, s.nombre as severidad_nombre,
  r.estado_id, e.slug as estado_slug, e.nombre as estado_nombre,
  r.latitud, r.longitud, r.ubicacion_ajustada,
  r.imagen_url, r.descripcion_detallada,
  r.es_alerta_rapida, r.procesado_offline,
  r.confianza_ia, r.analisis_ia,
  r.capturado_en, r.created_at, r.updated_at
from public.reportes r
join public.tipos_desecho   t on t.id = r.tipo_desecho_id
join public.categorias      c on c.id = t.categoria_id
join public.severidades     s on s.id = r.severidad_id
join public.estados_reporte e on e.id = r.estado_id
left join public.usuarios   u on u.id = r.usuario_id;

create or replace view public.v_brigadas_detalle
with (security_invoker = true) as
select
  b.*, c.slug as categoria_slug, c.nombre as categoria_nombre,
  u.alias as organizador_alias,
  (select count(*) from public.brigada_participantes p where p.brigada_id = b.id)::int as participantes
from public.brigadas b
join public.categorias c on c.id = b.categoria_id
left join public.usuarios u on u.id = b.organizador_id;

-- ---------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
--    El backend usa SERVICE_ROLE (omite RLS). Estas políticas permiten
--    lectura pública con la anon key si se consulta directo desde el cliente.
-- ---------------------------------------------------------------------
alter table public.roles                 enable row level security;
alter table public.categorias            enable row level security;
alter table public.tipos_desecho         enable row level security;
alter table public.severidades           enable row level security;
alter table public.estados_reporte       enable row level security;
alter table public.usuarios              enable row level security;
alter table public.reportes              enable row level security;
alter table public.historial_estados     enable row level security;
alter table public.notificaciones_ia     enable row level security;
alter table public.brigadas              enable row level security;
alter table public.brigada_participantes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categorias','tipos_desecho','severidades','estados_reporte','reportes','brigadas','brigada_participantes']
  loop
    execute format('drop policy if exists lectura_publica on public.%I', t);
    execute format('create policy lectura_publica on public.%I for select using (true)', t);
  end loop;
end $$;
-- usuarios, historial y notificaciones: sólo vía backend (service role).

-- ---------------------------------------------------------------------
-- 10. STORAGE: bucket público para fotos de reportes
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('reportes', 'reportes', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 11. DATOS SEMILLA
-- ---------------------------------------------------------------------
insert into public.roles (id, slug, nombre) values
  (1, 'ciudadano', 'Ciudadano'),
  (2, 'admin',     'Servicios Públicos / Admin')
on conflict (id) do nothing;

insert into public.categorias (id, slug, nombre) values
  (1, 'residuos',   'Residuos Sólidos'),
  (2, 'manglares',  'Manglares'),
  (3, 'fauna',      'Fauna Silvestre y Marina'),
  (4, 'feria',      'Feria / Playa Norte'),
  (5, 'emergencia', 'Emergencia Ambiental')
on conflict (id) do nothing;

insert into public.tipos_desecho (id, nombre, icono, categoria_id, descripcion) values
  (1, 'PET / Botellas',                          '🧴', 1, 'Botellas y envases plásticos PET'),
  (2, 'Redes / Pesca Fantasma',                  '🎣', 3, 'Redes, líneas y artes de pesca abandonadas'),
  (3, 'Bolsas / Empaques',                       '🛍️', 1, 'Bolsas, envolturas y unicel'),
  (4, 'Microplásticos / Fragmentos',             '🔬', 1, 'Fragmentos plásticos < 5 mm en arena o agua'),
  (5, 'Otros / Voluminosos',                     '📦', 1, 'Llantas, muebles, chatarra y otros'),
  (6, 'Invasión / Tala en Manglares',            '🌳', 2, 'Tala, relleno o quema de manglar'),
  (7, 'Animal Herido o Muerto / Fauna en Riesgo','🐢', 3, 'Tortugas, delfines, aves o manatíes en riesgo'),
  (8, 'Residuos en Zona de Feria / Playa Norte', '🎡', 4, 'Basura en la zona de feria y Playa Norte'),
  (9, 'Accidente / Derrame Ambiental',           '⚠️', 5, 'Derrame de combustible, aceite o químicos')
on conflict (id) do nothing;

insert into public.severidades (id, slug, nombre, nivel) values
  (1, 'baja',     'Baja',     1),
  (2, 'moderada', 'Moderada', 2),
  (3, 'critica',  'Crítica',  3)
on conflict (id) do nothing;

insert into public.estados_reporte (id, slug, nombre, orden) values
  (1, 'pendiente',  'Pendiente',  1),
  (2, 'en_proceso', 'En Proceso', 2),
  (3, 'resuelto',   'Resuelto',   3)
on conflict (id) do nothing;

-- Administrador demo (¡cambiar contraseña en producción!)
-- email: admin@ecoreporta.mx · password: Carmen2026!
insert into public.usuarios (alias, email, password_hash, rol_id)
values ('Servicios Públicos Carmen', 'admin@ecoreporta.mx',
        extensions.crypt('Carmen2026!', extensions.gen_salt('bf', 10)), 2)
on conflict (email) do nothing;

insert into public.usuarios (id, alias, rol_id) values
  ('00000000-0000-4000-8000-000000000001', 'Brigada Playa Norte', 1)
on conflict (id) do nothing;

-- Reportes de ejemplo alrededor de Ciudad del Carmen
insert into public.reportes
  (usuario_id, tipo_desecho_id, severidad_id, estado_id, latitud, longitud,
   descripcion_detallada, confianza_ia, analisis_ia, client_uuid)
values
  ('00000000-0000-4000-8000-000000000001', 1, 2, 1, 18.659500, -91.815500,
   null, 0.910, '{"resumen":"Acumulación de botellas PET en la línea de marea","modelo":"seed"}',
   '10000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000001', 6, 3, 2, 18.637200, -91.788000,
   'Relleno con escombro sobre el manglar junto al estero', 0.840,
   '{"resumen":"Posible relleno y tala de manglar rojo","modelo":"seed"}',
   '10000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000001', 7, 3, 1, 18.651000, -91.842000,
   null, 0.880, '{"resumen":"Tortuga marina enredada en red","riesgo_fauna":true,"modelo":"seed"}',
   '10000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000001', 8, 2, 3, 18.656000, -91.812000,
   null, 0.790, '{"resumen":"Residuos tras evento en zona de feria","modelo":"seed"}',
   '10000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000000001', 2, 2, 1, 18.640500, -91.830500,
   null, 0.820, '{"resumen":"Red de pesca abandonada en orilla de la Laguna de Términos","modelo":"seed"}',
   '10000000-0000-4000-8000-000000000005')
on conflict (client_uuid) do nothing;

insert into public.historial_estados (reporte_id, estado_id, comentario)
select r.id, r.estado_id, 'Registro inicial (semilla)'
from public.reportes r
where r.client_uuid::text like '10000000-%'
  and not exists (select 1 from public.historial_estados h where h.reporte_id = r.id);

insert into public.brigadas (titulo, descripcion, categoria_id, lugar, latitud, longitud, fecha, organizador_id)
select 'Limpieza de Playa Norte', 'Traer guantes, gorra y agua. Habrá bolsas.', 4,
       'Playa Norte, frente al malecón', 18.659500, -91.815500,
       now() + interval '7 days', '00000000-0000-4000-8000-000000000001'
where not exists (select 1 from public.brigadas where titulo = 'Limpieza de Playa Norte');

insert into public.brigadas (titulo, descripcion, categoria_id, lugar, latitud, longitud, fecha, organizador_id)
select 'Reforestación de manglar', 'Plantación de propágulos de mangle rojo.', 2,
       'Estero de Pargo', 18.637200, -91.788000,
       now() + interval '14 days', '00000000-0000-4000-8000-000000000001'
where not exists (select 1 from public.brigadas where titulo = 'Reforestación de manglar');
