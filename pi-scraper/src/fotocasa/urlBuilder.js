// Build Fotocasa search URLs from a casahunt filter.
//
// Fotocasa URL structure:
//   https://www.fotocasa.es/es/alquiler/viviendas/barcelona-capital/<neighborhood>/l
//   https://www.fotocasa.es/es/alquiler/viviendas/barcelona-capital/todas-las-zonas/l
//
// Filters are query params:
//   ?maxPrice=1500&minPrice=800&minRooms=2&minSurface=60&maxSurface=120

import { FOTOCASA_NEIGHBORHOODS } from "./locations.js";

const BASE = "https://www.fotocasa.es/es/alquiler/viviendas/barcelona-capital";

function buildQueryParams(filter) {
  const params = new URLSearchParams();
  if (filter.price_min)   params.set("minPrice", filter.price_min);
  if (filter.price_max)   params.set("maxPrice", filter.price_max);
  if (filter.rooms_min)   params.set("minRooms", filter.rooms_min);
  if (filter.rooms_max)   params.set("maxRooms", filter.rooms_max);
  if (filter.size_min_m2) params.set("minSurface", filter.size_min_m2);
  if (filter.size_max_m2) params.set("maxSurface", filter.size_max_m2);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function buildFotocasaUrls(filter, nbRecords) {
  const qs = buildQueryParams(filter);
  const slugs = filter.neighborhoods || [];

  if (!slugs.length) {
    return [`${BASE}/todas-las-zonas/l${qs}`];
  }

  const bySlug = new Map(nbRecords.map((n) => [n.slug, n]));
  const urls = [];
  for (const slug of slugs) {
    const fc = FOTOCASA_NEIGHBORHOODS[slug];
    if (fc) {
      urls.push(`${BASE}/${fc}/l${qs}`);
    }
  }
  // If no neighborhoods mapped, fall back to whole city.
  return urls.length ? urls : [`${BASE}/todas-las-zonas/l${qs}`];
}
