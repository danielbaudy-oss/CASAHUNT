-- Migrate filters.source (text) → filters.sources (text[]) so a single filter
-- can fan out over Idealista AND Fotocasa.

alter table casahunt.filters
  add column if not exists sources text[] not null default array['idealista']::text[];

-- Backfill from the old column, if any rows still have non-default values.
update casahunt.filters
  set sources = array[source]
  where source is not null
    and (sources is null or array_length(sources, 1) is null
         or (array_length(sources,1) = 1 and sources[1] = 'idealista'));

alter table casahunt.filters drop column if exists source;
