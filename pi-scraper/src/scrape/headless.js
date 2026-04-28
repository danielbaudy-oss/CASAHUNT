// Puppeteer fallback for when Idealista blocks plain fetch.
// Keep this isolated — puppeteer is an optionalDependency so plain-fetch
// deploys stay lightweight on the Pi.

import { config } from "../config.js";

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const puppeteer = await import("puppeteer");
      return puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });
    })();
  }
  return browserPromise;
}

export async function fetchWithHeadless(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(config.userAgent);
    await page.setExtraHTTPHeaders({ "accept-language": "es-ES,es;q=0.9" });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Give JS a beat to finish hydrating
    await new Promise((r) => setTimeout(r, 1500));
    return await page.content();
  } finally {
    await page.close();
  }
}
