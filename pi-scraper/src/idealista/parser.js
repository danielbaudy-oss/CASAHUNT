// Parse Idealista search-results HTML.
//
// Known selector signatures (from historical Idealista markup):
//   - <article class="item" data-adid|data-element-id="...">
//   - <a class="item-link" href="/inmueble/12345/">
//   - .item-price   → "1.500 €/mes"
//   - .item-detail-char .item-detail → "2 hab.", "75 m²", "2 baños"
//   - <picture><img data-original|data-src|src="..."></picture>
//
// Real HTML may drift. `parseSearchResults` logs a digest of the first ~5
// <article> elements when it parses 0 listings, so we can re-tune from real
// pages without guessing.

import * as cheerio from "cheerio";

export function parseSearchResults(html, baseUrl) {
  const $ = cheerio.load(html);

  // Idealista wraps each result in <article class="item">; the id lives on the
  // element itself (data-adid or data-element-id) or on a .item-link a[href].
  const cards = $("article.item");
  if (cards.length === 0) {
    return { items: [], diagnostics: diagnose($) };
  }

  const out = [];
  cards.each((_, el) => {
    const $el = $(el);
    const item = parseCard($el, baseUrl);
    if (item) out.push(item);
  });

  return { items: out, diagnostics: out.length === 0 ? diagnose($) : null };
}

function parseCard($el, baseUrl) {
  const external_id =
    $el.attr("data-adid") ||
    $el.attr("data-element-id") ||
    idFromHref($el.find("a.item-link").first().attr("href"));
  if (!external_id) return null;

  const linkEl = $el.find("a.item-link").first();
  const href = linkEl.attr("href") || "";
  const url = href
    ? (href.startsWith("http") ? href : new URL(href, baseUrl).toString())
    : null;
  if (!url) return null;

  const title = (linkEl.attr("title") || linkEl.text() || "").trim();

  const priceText = $el.find(".item-price, .price-row, [class*='price']").first().text();
  const price_eur = toInt(priceText);

  let rooms = null, size_m2 = null, floor = null;
  $el.find(".item-detail-char .item-detail, .item-detail-char li, .item-detail")
    .each((_, d) => {
      const t = cheerio.load(d)("*").end().text().trim().toLowerCase();
      if (!t) return;
      if (rooms == null && /\bhab|dormitorio/.test(t)) rooms = toInt(t);
      else if (size_m2 == null && /m²|m2|metros/.test(t)) size_m2 = toInt(t);
      else if (floor == null && /planta|bajo|ático/.test(t)) floor = t;
    });

  const neighborhood = ($el.find(".item-detail-location, .item-location").first().text() || "").trim() || null;

  const photo_url =
    $el.find("picture source").first().attr("srcset")?.split(" ")[0] ||
    $el.find("picture img").attr("data-original") ||
    $el.find("picture img").attr("data-src") ||
    $el.find("picture img").attr("src") ||
    $el.find("img").attr("data-original") ||
    $el.find("img").attr("src") ||
    null;

  return {
    source: "idealista",
    external_id: String(external_id),
    url,
    title: title || null,
    price_eur,
    size_m2,
    rooms,
    neighborhood,
    city: "barcelona",
    photo_url,
    floor,
  };
}

function idFromHref(href) {
  if (!href) return null;
  const m = href.match(/\/inmueble\/(\d+)/);
  return m ? m[1] : null;
}

function toInt(s) {
  if (!s) return null;
  // Idealista uses "1.500" = 1500; strip dots and non-digits.
  const m = String(s).replace(/\./g, "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// If we parsed zero items, capture what the page looks like so we can retune.
function diagnose($) {
  const firstArticles = $("article").slice(0, 3).map((_, el) => {
    const $el = $(el);
    return {
      classes: $el.attr("class") || "",
      dataAttrs: Object.fromEntries(
        Object.entries($el[0].attribs || {}).filter(([k]) => k.startsWith("data-"))
      ),
      hasItemLink: !!$el.find("a.item-link").length,
      anchorsHrefs: $el.find("a[href]").slice(0, 3).map((_, a) => $(a).attr("href")).get(),
      textSnippet: $el.text().replace(/\s+/g, " ").trim().slice(0, 180),
    };
  }).get();

  // Title/meta tells us if we were blocked / redirected.
  const title = $("title").text().trim();
  const isBlocked =
    /captcha|access denied|blocked|cloudflare/i.test(title) ||
    /captcha|access denied/i.test($("body").text().slice(0, 500));

  return {
    pageTitle: title,
    suspectedBlock: isBlocked,
    articleCount: $("article").length,
    sampleArticles: firstArticles,
  };
}
