-- casahunt schema — Supabase MIKAN project
-- Mirrors the dropping schema-per-app pattern: own schema, RLS via current_chat_id().

create schema if not exists casahunt;

-- Expose the schema via PostgREST (configure in Supabase dashboard:
-- Settings → API → Exposed schemas: add "casahunt")

-- ──────────────────────────────────────────────────────────────────────────
-- Helper: resolve the current chat_id from the session token header.
-- The frontend sends `x-session-token: <uuid>` on each PostgREST call.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function casahunt.current_chat_id()
returns bigint
language sql
stable
security definer
set search_path = casahunt, public
as $$
  select s.chat_id
  from casahunt.sessions s
  where s.token = nullif(current_setting('request.headers', true)::json->>'x-session-token', '')::uuid
    and s.expires_at > now()
  limit 1
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Tables
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists casahunt.users (
  chat_id      bigint primary key,            -- Telegram chat id
  username     text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists casahunt.auth_codes (
  chat_id     bigint not null,
  code        text   not null,                 -- 6-digit
  expires_at  timestamptz not null,
  consumed    boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (chat_id, code)
);

create table if not exists casahunt.sessions (
  token       uuid primary key default gen_random_uuid(),
  chat_id     bigint not null references casahunt.users(chat_id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '30 days')
);
create index if not exists sessions_chat_id_idx on casahunt.sessions(chat_id);

create table if not exists casahunt.filters (
  id             bigserial primary key,
  chat_id        bigint not null references casahunt.users(chat_id) on delete cascade,
  name           text   not null default 'default',
  city           text   not null default 'barcelona',
  source         text   not null default 'idealista',    -- idealista | fotocasa
  price_min      int,
  price_max      int,
  size_min_m2    int,
  size_max_m2    int,
  rooms_min      int,
  rooms_max      int,
  neighborhoods  text[] not null default '{}',           -- free-form slugs for now
  search_url     text,                                    -- optional: raw pre-built URL
  enabled        boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists filters_chat_id_idx on casahunt.filters(chat_id);

-- One row per listing we've ever seen, per source.
-- Dedupe key: (source, external_id). A "new" listing is one we haven't seen.
create table if not exists casahunt.listings_seen (
  source          text   not null,              -- idealista | fotocasa
  external_id     text   not null,              -- portal's listing id
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  published_at    timestamptz,                   -- portal-reported publish/bump time
  url             text,
  title           text,
  price_eur       int,
  size_m2         int,
  rooms           int,
  neighborhood    text,
  city            text,
  photo_url       text,
  raw             jsonb,                         -- full scraped payload for later analysis
  primary key (source, external_id)
);
create index if not exists listings_seen_first_seen_idx on casahunt.listings_seen(first_seen_at desc);

-- Scraper bookkeeping / shared config
create table if not exists casahunt.config (
  key    text primary key,
  value  jsonb not null,
  updated_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────────────────
alter table casahunt.users         enable row level security;
alter table casahunt.filters       enable row level security;
alter table casahunt.sessions      enable row level security;
alter table casahunt.auth_codes    enable row level security;
alter table casahunt.listings_seen enable row level security;
alter table casahunt.config        enable row level security;

-- users: a user can see/update only their own row
drop policy if exists users_self_select on casahunt.users;
create policy users_self_select on casahunt.users
  for select using (chat_id = casahunt.current_chat_id());
drop policy if exists users_self_update on casahunt.users;
create policy users_self_update on casahunt.users
  for update using (chat_id = casahunt.current_chat_id());

-- filters: CRUD scoped to the caller
drop policy if exists filters_self_all on casahunt.filters;
create policy filters_self_all on casahunt.filters
  for all using (chat_id = casahunt.current_chat_id())
          with check (chat_id = casahunt.current_chat_id());

-- sessions / auth_codes / listings_seen / config: no anon access.
-- Edge Functions + Pi scraper use the service role key which bypasses RLS.
