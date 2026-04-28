// Build Idealista search URLs from a casahunt filter.
//
// Strategy:
//   - One URL per selected neighborhood. If a district is fully selected, we
//     still iterate per neighborhood (simpler than branching; the cost is ~6
//     requests instead of 1, which is fine at 15-min cadence).
//   - If no neighborhoods selected, one URL for the whole city.
//   - Price/rooms/size encoded via Idealista's con-* path suffixes.
//
// Examples:
//   /alquiler-viviendas/barcelona/sant-marti/el-poblenou/con-precio-hasta_1500,de-dos-habitaciones/
//   /alquiler-viviendas/barcelona-barcelona/con-precio-hasta_1500/
//
// We stick to the Spanish URL form (`alquiler-viviendas`). Catalan works too
// but adds an axis we don't need.

import { IDEALISTA_BASE, paths } from "./locations.js";

const ROOM_SEGMENT = {
  0: "de-un-dormitorio",   // "studio" maps to 0; Idealista treats 0 specially
  1: "de-un-dormitorio",
  2: "de-dos-dormitorios",
  3: "de-tres-dormitorios",
  4: "de-cuatro-dormitorios",
  5: "de-cinco-o-mas-dormitorios",
};

function buildConSegment(filter) {
  const parts = [];
  if (filter.price_max)   parts.push(`precio-hasta_${filter.price_max}`);
  if (filter.price_min)   parts.push(`precio-desde_${filter.price_min}`);
  if (filter.size_min_m2) parts.push(`metros-cuadrados-mas-de_${filter.size_min_m2}`);
  if (filter.size_max_m2) parts.push(`metros-cuadrados-menos-de_${filter.size_max_m2}`);
  // rooms: use min only; Idealista's "X+ rooms" is expressed by picking a single bucket
  if (filter.rooms_min != null) {
    const seg = ROOM_SEGMENT[Math.min(5, Math.max(0, filter.rooms_min))];
    if (seg) parts.push(seg);
  }
  return parts.length ? `con-${parts.join(",")}` : "";
}

function cityPath(filter) {
  // Hardcoded to Barcelona for MVP. When we add Madrid etc., map filter.city → path.
  return "barcelona-barcelona";
}

/**
 * Given a filter row + the list of neighborhood records from neighborhoods.js
 * (for district lookup), return an array of absolute Idealista search URLs.
 */
export function buildSearchUrls(filter, nbRecords) {
  const con = buildConSegment(filter);
  const tail = con ? `/${con}/` : "/";
  const slugs = filter.neighborhoods || [];

  if (!slugs.length) {
    return [`${IDEALISTA_BASE}/alquiler-viviendas/${cityPath(filter)}${tail}`];
  }

  const byCasahuntSlug = new Map(nbRecords.map((n) => [n.slug, n]));
  const urls = [];
  const skipped = [];
  for (const slug of slugs) {
    const n = byCasahuntSlug.get(slug);
    if (!n) { skipped.push(slug); continue; }
    const p = paths(slug, n.district);
    if (!p) { skipped.push(slug); continue; }
    urls.push(`${IDEALISTA_BASE}/alquiler-viviendas/barcelona/${p.district}/${p.neighborhood}${tail}`);
  }
  return urls;
}
