// Migrations versionnées. Source unique : ce fichier.
// - Appliquées automatiquement au démarrage (Supabase PostgreSQL ou PGlite local).
// - Exportées dans supabase/migrations/ par `npm run db:export` pour une application manuelle (SQL Editor / supabase db push).
// Les instructions sont séparées par une ligne ne contenant que `-- ;;`.

export interface Migration {
  version: number;
  name: string;
  /** "all" : partout ; "supabase" : uniquement sur Supabase (schéma storage disponible). */
  target: "all" | "supabase";
  sql: string;
}

const RLS_TABLES = [
  "tags",
  "cycles",
  "sessions",
  "publications",
  "publication_attachments",
  "publication_links",
  "publication_tags",
  "retroplanning_templates",
  "activity_log",
  "saved_views",
  "user_prefs",
];

const rls = RLS_TABLES.map(
  (t) => `alter table public.${t} enable row level security
-- ;;
drop policy if exists "${t}_owner" on public.${t}
-- ;;
create policy "${t}_owner" on public.${t} for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())`,
).join("\n-- ;;\n");

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "init",
    target: "all",
    sql: `
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  dimension text not null check (dimension in ('canal','public','nature','format','libre')),
  label text not null check (char_length(label) between 1 and 60),
  color text not null default 'blue' check (color in ('blue','coral','orange','violet','green','yellow','teal','gray')),
  position double precision not null default 0,
  created_at timestamptz not null default now()
)
-- ;;
create unique index if not exists tags_owner_dim_label on public.tags (owner_id, dimension, lower(label))
-- ;;
create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  kind text not null default 'cycle' check (kind in ('cycle','projet')),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  audience_tag_id uuid references public.tags(id) on delete set null,
  category text not null default '',
  cover_path text,
  start_date date,
  end_date date,
  status text not null default 'a_venir' check (status in ('a_venir','en_cours','termine','archive')),
  links jsonb not null default '[]'::jsonb,
  notes text not null default '',
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
)
-- ;;
create index if not exists cycles_owner_pos on public.cycles (owner_id, position)
-- ;;
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  kind text not null default 'session' check (kind in ('session','info','autre')),
  title text not null check (char_length(title) between 1 and 120),
  date date,
  start_time time,
  end_time time,
  location text not null default '',
  description text not null default '',
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, cycle_id)
)
-- ;;
create index if not exists sessions_cycle_pos on public.sessions (cycle_id, position)
-- ;;
create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  session_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  channel_tag_id uuid references public.tags(id) on delete set null,
  format_tag_id uuid references public.tags(id) on delete set null,
  audience_tag_id uuid references public.tags(id) on delete set null,
  nature_tag_id uuid references public.tags(id) on delete set null,
  production_status text not null default 'idee' check (production_status in ('idee','a_creer','en_cours','pret')),
  diffusion_status text not null default 'a_programmer' check (diffusion_status in ('a_programmer','programme','publie','annule')),
  body text not null default '',
  target_date date,
  target_time time,
  scheduled_at timestamptz,
  scheduled_platform text not null default '',
  published_at timestamptz,
  published_url text not null default '',
  notes text not null default '',
  position double precision not null default 0,
  retro_key text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Une session doit appartenir au même cycle que la publication. Si elle est supprimée, seule session_id passe à NULL.
  foreign key (session_id, cycle_id) references public.sessions(id, cycle_id) on delete set null (session_id),
  check (diffusion_status <> 'programme' or scheduled_at is not null)
)
-- ;;
create index if not exists publications_cycle on public.publications (cycle_id, session_id, position)
-- ;;
create index if not exists publications_owner_target on public.publications (owner_id, target_date)
-- ;;
create unique index if not exists publications_retro_key on public.publications (cycle_id, retro_key) where retro_key is not null
-- ;;
create table if not exists public.publication_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  kind text not null check (kind in ('image','video','gif','pdf','document','html','other')),
  storage_path text not null,
  thumb_path text,
  name text not null,
  mime text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  width int,
  height int,
  duration_s real,
  status text not null default 'pending' check (status in ('pending','ready')),
  position double precision not null default 0,
  created_at timestamptz not null default now()
)
-- ;;
create index if not exists attachments_pub on public.publication_attachments (publication_id, position)
-- ;;
create table if not exists public.publication_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  url text not null check (url ~* '^https?://'),
  title text not null default '',
  kind text not null default 'externe' check (kind in ('externe','page','publication')),
  position double precision not null default 0,
  created_at timestamptz not null default now()
)
-- ;;
create index if not exists links_pub on public.publication_links (publication_id, position)
-- ;;
create table if not exists public.publication_tags (
  publication_id uuid not null references public.publications(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  owner_id uuid not null default auth.uid(),
  primary key (publication_id, tag_id)
)
-- ;;
create table if not exists public.retroplanning_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null,
  scope text not null check (scope in ('cycle','session')),
  intensity text not null default 'standard' check (intensity in ('leger','standard','intensif','perso')),
  rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
)
-- ;;
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  entity_type text not null,
  entity_id uuid not null,
  publication_id uuid references public.publications(id) on delete cascade,
  action text not null,
  from_value text,
  to_value text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
)
-- ;;
create index if not exists activity_pub on public.activity_log (publication_id, created_at desc)
-- ;;
create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null check (char_length(name) between 1 and 80),
  filters jsonb not null default '{}'::jsonb,
  position double precision not null default 0,
  created_at timestamptz not null default now()
)
-- ;;
create table if not exists public.user_prefs (
  owner_id uuid primary key default auth.uid(),
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
)
-- ;;
${rls}
`,
  },
  {
    version: 2,
    name: "storage",
    target: "supabase",
    sql: `
insert into storage.buckets (id, name, public, file_size_limit)
values ('studio-files', 'studio-files', false, null)
on conflict (id) do update set public = false
-- ;;
drop policy if exists "studio_files_select" on storage.objects
-- ;;
create policy "studio_files_select" on storage.objects for select to authenticated
using (bucket_id = 'studio-files' and (storage.foldername(name))[1] = auth.uid()::text)
-- ;;
drop policy if exists "studio_files_insert" on storage.objects
-- ;;
create policy "studio_files_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'studio-files' and (storage.foldername(name))[1] = auth.uid()::text)
-- ;;
drop policy if exists "studio_files_update" on storage.objects
-- ;;
create policy "studio_files_update" on storage.objects for update to authenticated
using (bucket_id = 'studio-files' and (storage.foldername(name))[1] = auth.uid()::text)
-- ;;
drop policy if exists "studio_files_delete" on storage.objects
-- ;;
create policy "studio_files_delete" on storage.objects for delete to authenticated
using (bucket_id = 'studio-files' and (storage.foldername(name))[1] = auth.uid()::text)
`,
  },
];

/** Fonction auth.uid() de remplacement pour PGlite (Supabase la fournit déjà). */
export const LOCAL_AUTH_SHIM = `
create schema if not exists auth
-- ;;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''), '')::uuid
$$
`;

export function splitSql(sql: string): string[] {
  return sql
    .split(/\n--\s*;;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
