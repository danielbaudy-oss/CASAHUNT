-- Replace neighborhoods text[] with locations jsonb[].
-- Each location is: { name, display_name, osm_id, osm_type, lat, lng, type, country_code }
-- type = "city" | "district" | "suburb" | "neighbourhood" | "town" etc.
-- The scraper maps these to portal-specific URLs at runtime.

alter table casahunt.filters
  add column if not exists locations jsonb not null default '[]'::jsonb;

-- Migrate existing neighborhood slugs to locations (Barcelona only, best-effort).
-- Existing filters keep working; the scraper checks locations first, falls back to neighborhoods.
