-- Cross-source deduplication support.
-- A listing can appear on Idealista + Fotocasa + Habitaclia as 3 rows keyed by
-- (source, external_id). `canonical_key` is a stable fingerprint across portals
-- so the notifier can collapse them into a single alert.
--
-- Population order of preference (highest first):
--   1) geohash-8 of (lat, lng) when available  →  ~20m bucket
--   2) md5(address + floor) when address is clean
--   3) fingerprint: md5(neighborhood|price|size|rooms)
-- The scraper decides which and stamps it before insert.

alter table casahunt.listings_seen
  add column if not exists lat            double precision,
  add column if not exists lng            double precision,
  add column if not exists address        text,
  add column if not exists canonical_key  text;

create index if not exists listings_seen_canonical_idx
  on casahunt.listings_seen(canonical_key)
  where canonical_key is not null;

-- Notifications table: one row per (filter, canonical_key) so we don't spam
-- when the same flat appears on a second portal.
create table if not exists casahunt.notifications (
  id             bigserial primary key,
  filter_id      bigint not null references casahunt.filters(id) on delete cascade,
  chat_id        bigint not null references casahunt.users(chat_id) on delete cascade,
  canonical_key  text   not null,
  source         text   not null,          -- source where we first saw the listing
  external_id    text   not null,
  sent_at        timestamptz not null default now(),
  unique (filter_id, canonical_key)
);
create index if not exists notifications_chat_idx  on casahunt.notifications(chat_id, sent_at desc);

alter table casahunt.notifications enable row level security;

drop policy if exists notifications_self_select on casahunt.notifications;
create policy notifications_self_select on casahunt.notifications
  for select using (chat_id = casahunt.current_chat_id());
