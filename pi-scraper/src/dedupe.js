// Build a cross-source canonical key for a listing.
// Precedence: geohash-8 (if lat/lng) → address hash → fingerprint.
// The canonical key is NOT a dedupe primary key — (source, external_id) is.
// It's just the grouping key for notifications.

import { createHash } from "node:crypto";

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function geohash(lat, lng, precision = 8) {
  if (lat == null || lng == null) return null;
  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let bits = 0, bit = 0, even = true, hash = "";
  while (hash.length < precision) {
    if (even) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) { bits = (bits << 1) | 1; lngRange[0] = mid; }
      else            { bits = (bits << 1);     lngRange[1] = mid; }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) { bits = (bits << 1) | 1; latRange[0] = mid; }
      else            { bits = (bits << 1);     latRange[1] = mid; }
    }
    even = !even;
    if (++bit === 5) { hash += BASE32[bits]; bits = 0; bit = 0; }
  }
  return hash;
}

export function canonicalKey(l) {
  if (l.lat != null && l.lng != null) {
    return "gh:" + geohash(l.lat, l.lng, 8);
  }
  if (l.address) {
    return "addr:" + md5(l.address.toLowerCase().replace(/\s+/g, " ").trim()).slice(0, 12);
  }
  // Last-resort fingerprint. Not stable if price gets bumped, but better than
  // nothing — at least collapses exact re-posts of the same listing.
  const fp = [
    l.neighborhood || "",
    l.city || "",
    l.price_eur || "",
    l.size_m2 || "",
    l.rooms || "",
  ].join("|").toLowerCase();
  return "fp:" + md5(fp).slice(0, 12);
}

function md5(s) { return createHash("md5").update(s).digest("hex"); }
