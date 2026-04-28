// casahunt pi-scraper entry point.
// Per run:
//   1. Pick the search URL(s) — MVP: env SEARCH_URL. Later: casahunt.filters.
//   2. Scrape results.
//   3. Upsert into casahunt.listings_seen and detect new rows.
//   4. For each new listing, send a Telegram alert.
//
// Exits cleanly so cron can run it every 15 minutes.

import { config } from "./config.js";
import { db } from "./supabase.js";
import { scrapeIdealista } from "./scrape/idealista.js";
import { sendPhoto, sendMessage } from "./telegram.js";

async function main() {
  const startedAt = Date.now();
  log("run start", { searchUrl: config.searchUrl, dryRun: config.dryRun });

  const listings = await scrapeIdealista(config.searchUrl);
  log(`scraped ${listings.length} listings`);

  if (listings.length === 0) {
    log("no listings parsed — selectors may be stale");
    return;
  }

  const newOnes = await upsertAndFindNew(listings);
  log(`${newOnes.length} new listings`);

  if (config.dryRun) {
    for (const l of newOnes) log("would notify", l);
    return;
  }

  for (const l of newOnes) {
    try {
      await notify(l);
    } catch (e) {
      log("notify failed", { id: l.external_id, err: String(e) });
    }
  }

  log("run done", { ms: Date.now() - startedAt });
}

async function upsertAndFindNew(listings) {
  const ids = listings.map((l) => l.external_id);
  const { data: existing, error } = await db
    .from("listings_seen")
    .select("external_id")
    .eq("source", "idealista")
    .in("external_id", ids);
  if (error) throw error;

  const known = new Set((existing || []).map((r) => r.external_id));
  const newOnes = listings.filter((l) => !known.has(l.external_id));

  if (config.dryRun) return newOnes;

  const now = new Date().toISOString();
  const rows = listings.map((l) => ({
    ...l,
    last_seen_at: now,
    raw: l,
  }));
  const { error: upErr } = await db
    .from("listings_seen")
    .upsert(rows, { onConflict: "source,external_id" });
  if (upErr) throw upErr;

  return newOnes;
}

async function notify(l) {
  const chatId = config.telegramChatId;
  if (!chatId) {
    log("no TELEGRAM_CHAT_ID set, skipping notify");
    return;
  }
  const price = l.price_eur ? `€${l.price_eur.toLocaleString("es-ES")}` : "—";
  const size = l.size_m2 ? `${l.size_m2}m²` : "—";
  const rooms = l.rooms ? `${l.rooms} hab` : "—";
  const caption =
    `<b>${escapeHtml(l.title || "New listing")}</b>\n` +
    `${price} · ${size} · ${rooms}\n` +
    `<a href="${l.url}">View on Idealista</a>`;

  if (l.photo_url) {
    await sendPhoto(chatId, l.photo_url, caption);
  } else {
    await sendMessage(chatId, caption);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

main().catch((e) => {
  console.error("run failed:", e);
  process.exit(1);
});
