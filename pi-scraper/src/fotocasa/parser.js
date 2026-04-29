// Parse Fotocasa search-results HTML (rendered by headless Chromium).
//
// Fotocasa's React-rendered DOM uses <article> cards. After hydration:
//   <article class="@container w-full">
//     <a href="/es/alquiler/vivienda/.../12345678">
//     price in a display-3 text element
//     h3 with the title
//     <ul> with details (rooms, m², floor, etc.)
//     <img> for the photo
//
// The exact class names are Tailwind utility classes and may shift, so we
// rely on structural patterns (article > a[href], h3, ul > li) rather than
// specific class names.

import * as cheerio from "cheerio";

export function parseFotocasaResults(html, baseUrl) {
  const $ = cheerio.load(html);
  const cards = $("article");
  if (cards.length === 0) {
    return { items: [], diagnostics: diagnose($) };
  }

  const out = [];
  cards.each((_, el) => {
    const $el = $(el);
    const item = parseCard($, $el, baseUrl);
    if (item) out.push(item);
  });

  return { items: out, diagnostics: out.length === 0 ? diagnose($) : null };
}

function parseCard($, $el, baseUrl) {
  // Find the main link — href contains /es/alquiler/ and ends with a numeric ID.
  const link = $el.find("a[href*='/es/alquiler/']").first();
  const href = link.attr("href") || "";
  if (!href) return null;

  const idMatch = href.match(/\/(\d{5,})$/);
  const external_id = idMatch ? idMatch[1] : null;
  if (!external_id) return null;

  const url = href.startsWith("http")
    ? href
    : `https://www.fotocasa.es${href}`;

  // Title — usually in an h3.
  const title = ($el.find("h3").first().text() || "").trim() || null;

  // Price — look for text matching €/mes or just a number with €.
  const priceText = $el.find("[class*='display']").first().text() ||
                    $el.find("[class*='price']").first().text() || "";
  const price_eur = toInt(priceText);

  // Details — rooms, m², floor in <ul><li> items.
  let rooms = null, size_m2 = null;
  $el.find("ul li").each((_, li) => {
    const t = $(li).text().trim().toLowerCase();
    if (!t) return;
    if (rooms == null && /\bhab/.test(t)) rooms = toInt(t);
    else if (size_m2 == null && /m²|m2/.test(t)) size_m2 = toInt(t);
  });

  // Photo.
  const photo_url =
    $el.find("img[src*='fotocasa']").first().attr("src") ||
    $el.find("img[data-src]").first().attr("data-src") ||
    $el.find("img").first().attr("src") ||
    null;

  // Neighborhood from breadcrumb or title — best-effort.
  const neighborhood = null; // Will be inferred from the search URL.

  return {
    source: "fotocasa",
    external_id: String(external_id),
    url,
    title,
    price_eur,
    size_m2,
    rooms,
    neighborhood,
    city: "barcelona",
    photo_url: photo_url && !photo_url.includes("skeleton") ? photo_url : null,
  };
}

function toInt(s) {
  if (!s) return null;
  const m = String(s).replace(/\./g, "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function diagnose($) {
  const title = $("title").text().trim();
  const isBlocked = /captcha|access denied|blocked|cloudflare/i.test(title) ||
    /captcha|access denied/i.test($("body").text().slice(0, 500));
  const articleCount = $("article").length;
  const sampleArticles = $("article").slice(0, 2).map((_, el) => {
    const $el = $(el);
    return {
      classes: ($el.attr("class") || "").slice(0, 100),
      hasLink: !!$el.find("a[href*='/es/alquiler/']").length,
      hasSkeleton: !!$el.find("[data-panot-component='skeleton']").length,
      textSnippet: $el.text().replace(/\s+/g, " ").trim().slice(0, 200),
    };
  }).get();

  return { pageTitle: title, suspectedBlock: isBlocked, articleCount, sampleArticles };
}
