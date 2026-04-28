// Orchestrator. Per run:
//   1. Fetch enabled filters from casahunt.filters.
//   2. For each filter:
//      a. Build Idealista search URLs (one per neighborhood, or one for city).
//      b. Fetch + parse listings.
//      c. Stamp canonical_key.
//      d. Upsert into casahunt.listings_seen (discovers new (source, external_id)).
//      e. For each NEW listing, insert a row in casahunt.notifications
//         keyed by (filter_id, canonical_key). If the insert succeeds we send
//         a Telegram alert; if it's a dup, we skip (cross-source collapse).
//   3. Exit. Cron schedules the next run.

import { config } from "./config.js";
import { db } from "./supabase.js";
import { NEIGHBORHOODS_BCN } from "./neighborhoods.js";
import { buildSearchUrls } from "./idealista/urlBuilder.js";
import { fetchIdealistaHtml } from "./idealista/fetcher.js";
import { parseSearchResults } from "./idealista/parser.js";
import { canonicalKey } from "./dedupe.js";
import { sendPhoto, sendMessage } from "./telegram.js";

async function main() {
  const startedAt = Date.now();
  log("run start", { dryRun: config.dryRun, useHeadless: config.useHeadless });

  const { data: filters, error } = await db
    .from("filters")
    .select("*")
    .eq("enabled", true);
  if (error) throw error;
  if (!filters?.length) { log("no enabled filters"); return; }

  for (const filter of filters) {
    try {
      await runFilter(filter);
    } catch (e) {
      log("filter failed", { id: filter.id, name: filter.name, err: String(e) });
    }
  }

  log("run done", { ms: Date.now() - startedAt });
}

async function runFilter(filter) {
  const srcs = filter.sources || ["idealista"];
  if (!srcs.includes("idealista")) {
    log("skip filter (no idealista source)", { id: filter.id });
    return;
  }

  const urls = buildSearchUrls(filter, NEIGHBORHOODS_BCN);
  log("filter urls", { id: filter.id, name: filter.name, n: urls.length });

  const scraped = [];
  for (const url of urls) {
    try {
      const html = await fetchIdealistaHtml(url);
      const { items, diagnostics } = parseSearchResults(html, url);
      if (!items.length) {
        log("parse returned 0 items", { url, diagnostics });
      } else {
        log("parsed", { url, n: items.length });
      }
      scraped.push(...items);
    } catch (e) {
      log("fetch/parse failed", { url, err: String(e) });
    }
    // Politeness: small jitter between requests.
    await sleep(800 + Math.random() * 800);
  }

  // Dedupe by (source, external_id) inside this filter's scrape (a listing can
  // appear in multiple neighborhood URLs if it's on a border).
  const byKey = new Map();
  for (const l of scraped) byKey.set(`${l.source}|${l.external_id}`, l);
  const unique = [...byKey.values()].map((l) => ({ ...l, canonical_key: canonicalKey(l) }));

  if (!unique.length) return;

  const newOnes = await upsertAndFindNew(unique);
  log("new listings", { id: filter.id, n: newOnes.length });

  if (config.dryRun) {
    for (const l of newOnes) log("would notify", { id: l.external_id, url: l.url });
    return;
  }

  for (const l of newOnes) {
    try {
      await notifyIfUnseen(filter, l);
    } catch (e) {
      log("notify failed", { id: l.external_id, err: String(e) });
    }
  }
}

async function upsertAndFindNew(listings) {
  const pairs = listings.map((l) => ({ source: l.source, external_id: l.external_id }));

  // Fetch what we already know.
  const { data: existing, error: exErr } = await db
    .from("listings_seen")
    .select("source, external_id")
    .in("external_id", pairs.map((p) => p.external_id));
  if (exErr) throw exErr;
  const known = new Set((existing || []).map((r) => `${r.source}|${r.external_id}`));
  const newOnes = listings.filter((l) => !known.has(`${l.source}|${l.external_id}`));

  const now = new Date().toISOString();
  const rows = listings.map((l) => ({ ...l, last_seen_at: now, raw: l }));
  const { error: upErr } = await db
    .from("listings_seen")
    .upsert(rows, { onConflict: "source,external_id" });
  if (upErr) throw upErr;

  return newOnes;
}

async function notifyIfUnseen(filter, l) {
  // Try to claim this (filter_id, canonical_key) — unique index prevents dup.
  const { error } = await db
    .from("notifications")
    .insert({
      filter_id: filter.id,
      chat_id: filter.chat_id,
      canonical_key: l.canonical_key,
      source: l.source,
      external_id: l.external_id,
    });
  if (error) {
    if (String(error.code) === "23505") {
      log("cross-source dedupe hit", { filter: filter.id, key: l.canonical_key, url: l.url });
      return;
    }
    throw error;
  }

  const price = l.price_eur ? `€${l.price_eur.toLocaleString("es-ES")}` : "—";
  const size  = l.size_m2   ? `${l.size_m2} m²` : "—";
  const rooms = l.rooms     ? `${l.rooms} hab`  : "—";
  const loc   = l.neighborhood || filter.city || "barcelona";
  const caption =
    `<b>${escapeHtml(l.title || "New listing")}</b>\n` +
    `${price} · ${size} · ${rooms}\n` +
    `${escapeHtml(loc)}\n` +
    `<a href="${l.url}">View on Idealista</a>`;

  if (l.photo_url) await sendPhoto(filter.chat_id, l.photo_url, caption);
  else             await sendMessage(filter.chat_id, caption);
}

function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function log(...args) { console.log(new Date().toISOString(), ...args); }

main().catch((e) => { console.error("run failed:", e); process.exit(1); });
