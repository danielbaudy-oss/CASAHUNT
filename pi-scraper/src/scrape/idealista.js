// Idealista search-results parser.
// MVP: fetch the search URL and extract listing cards.
// NOTE: selectors below are a starting point and will need tuning once we
// inspect live HTML. The DOM changes often; pin it after first successful run.

import { fetch } from "undici";
import * as cheerio from "cheerio";
import { config } from "../config.js";

export async function scrapeIdealista(searchUrl) {
  const html = await fetchHtml(searchUrl);
  return parseSearchResults(html, searchUrl);
}

async function fetchHtml(url) {
  if (config.useHeadless) {
    const { fetchWithHeadless } = await import("./headless.js");
    return fetchWithHeadless(url);
  }
  const res = await fetch(url, {
    headers: {
      "user-agent": config.userAgent,
      "accept-language": "es-ES,es;q=0.9,en;q=0.8",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`idealista fetch ${res.status}`);
  return res.text();
}

export function parseSearchResults(html, baseUrl) {
  const $ = cheerio.load(html);
  const out = [];

  // Primary selector — Idealista uses <article class="item"> with data-element-id.
  $("article.item[data-element-id]").each((_, el) => {
    const $el = $(el);
    const external_id = $el.attr("data-element-id");
    if (!external_id) return;

    const linkEl = $el.find("a.item-link").first();
    const href = linkEl.attr("href") || "";
    const url = href.startsWith("http")
      ? href
      : new URL(href, baseUrl).toString();
    const title = (linkEl.attr("title") || linkEl.text() || "").trim();

    const priceText = $el.find(".item-price, .price-row").first().text();
    const price_eur = toInt(priceText);

    const details = $el.find(".item-detail-char .item-detail");
    let rooms = null;
    let size_m2 = null;
    details.each((_, d) => {
      const t = $(d).text().trim();
      if (/hab/i.test(t)) rooms = rooms ?? toInt(t);
      else if (/m²|m2/i.test(t)) size_m2 = size_m2 ?? toInt(t);
    });

    const photo_url =
      $el.find("picture img").attr("src") ||
      $el.find("img").attr("src") ||
      null;

    out.push({
      source: "idealista",
      external_id,
      url,
      title,
      price_eur,
      size_m2,
      rooms,
      photo_url,
      neighborhood: null,
      city: "barcelona",
    });
  });

  return out;
}

function toInt(s) {
  if (!s) return null;
  const m = String(s).replace(/\./g, "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}
