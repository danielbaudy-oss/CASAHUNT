// Fetch an Idealista page, with plain HTTP by default and a headless Chromium
// fallback when plain HTTP returns non-200 or suspiciously short HTML.

import { fetch } from "undici";
import { config } from "../config.js";

const PLAIN_HEADERS = {
  "accept-language": "es-ES,es;q=0.9,en;q=0.8",
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "cache-control": "no-cache",
  "upgrade-insecure-requests": "1",
};

export async function fetchIdealistaHtml(url) {
  if (config.useHeadless) {
    const { fetchWithHeadless } = await import("../scrape/headless.js");
    return fetchWithHeadless(url);
  }

  const res = await fetch(url, {
    headers: { ...PLAIN_HEADERS, "user-agent": config.userAgent },
    redirect: "follow",
  });

  if (res.status === 403 || res.status === 429) {
    throw new BlockedError(`idealista returned ${res.status}; try USE_HEADLESS=1`);
  }
  if (!res.ok) {
    throw new Error(`idealista fetch ${res.status}`);
  }
  const html = await res.text();

  // Idealista sometimes serves a 200 with an "are you a robot" interstitial.
  if (/accede a idealista|DataDome|captcha/i.test(html.slice(0, 4000))) {
    throw new BlockedError("idealista served a bot-check interstitial");
  }
  if (html.length < 10_000) {
    throw new BlockedError(`idealista response suspiciously short (${html.length} bytes)`);
  }
  return html;
}

export class BlockedError extends Error {
  constructor(msg) { super(msg); this.name = "BlockedError"; }
}
