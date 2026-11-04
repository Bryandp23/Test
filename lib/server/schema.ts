// Migrations SQL versionnées (PostgreSQL). Ne jamais modifier une migration publiée : en ajouter une nouvelle.
export const SCHEMA_MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin','editor')),
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table admin_sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  type text not null default 'formation',
  description text not null default '',
  info_url text,
  organizer_name text,
  organizer_email text,
  organizer_phone text,
  image_url text,
  format text not null default 'onsite' check (format in ('onsite','online','hybrid')),
  location_name text,
  address text,
  room text,
  online_url text,
  online_platform text,
  timezone text not null default 'Europe/Brussels',
  reminder_minutes int,
  session_selection text not null default 'all' check (session_selection in ('all','choose')),
  status text not null default 'draft' check (status in ('draft','published','cancelled','archived')),
  status_before_archive text,
  sequence int not null default 0,
  is_demo boolean not null default false,
  cancel_reason text,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  cancelled_at timestamptz,
  first_start_utc timestamptz,
  last_end_utc timestamptz
);
create index events_status_idx on events(status);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text,
  date text not null,
  start_time text not null,
  end_time text not null,
  start_utc timestamptz not null,
  end_utc timestamptz not null,
  location_name text,
  address text,
  room text,
  online_url text,
  status text not null default 'active' check (status in ('active','cancelled')),
  sequence int not null default 0,
  content_hash text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_event_idx on sessions(event_id);

-- Historique des modifications (qui a fait quoi), utile pour rassurer et pour les emails de modification.
create table event_changes (
  id bigserial primary key,
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  action text not null,
  summary jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Calendriers connectés par OAuth (Mode B). Aucun compte EPHEC : le lien est un cookie aléatoire du navigateur.
create table calendar_connections (
  id uuid primary key default gen_random_uuid(),
  browser_key_hash text not null,
  provider text not null check (provider in ('google','microsoft')),
  account_email text,
  account_email_hmac text,
  access_token_enc text not null,
  refresh_token_enc text,
  token_expires_at timestamptz,
  scope text,
  auto_add boolean not null default false,
  auto_add_consented_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index calendar_connections_browser_idx on calendar_connections(browser_key_hash);
create index calendar_connections_email_idx on calendar_connections(account_email_hmac);

-- Événements créés via API dans un calendrier connecté : permet idempotence, mises à jour et annulations.
create table synced_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references calendar_connections(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  provider_event_id text,
  provider_link text,
  synced_sequence int not null default -1,
  state text not null default 'pending' check (state in ('pending','active','deleted','error','removed_by_user')),
  last_error text,
  created_at timestamptz not null default now(),
  last_synced_at timestamptz,
  unique (connection_id, session_id)
);

-- Liens personnalisés par inscription (Phase 3) : aucune donnée personnelle obligatoire.
create table registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  token text not null unique,
  external_ref text,
  email_hmac text,
  created_at timestamptz not null default now(),
  unique (event_id, external_ref)
);

-- Statistiques agrégées par jour : aucune adresse IP, aucun identifiant de personne.
create table stats_daily (
  event_id uuid not null references events(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('view','click','confirmed')),
  provider text not null default '',
  device text not null default '',
  count int not null default 0,
  primary key (event_id, day, kind, provider, device)
)`,
  },
];
