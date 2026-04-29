// Puppeteer fallback for when sites block plain fetch.
// Configured to look like a real desktop browser session.

import { randomUA } from "../useragents.js";

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const puppeteer = await import("puppeteer");
      const mod = puppeteer.default || puppeteer;
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
      return mod.launch({
        headless: "new",
        executablePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-blink-features=AutomationControlled",
          "--window-size=1366,768",
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
    const ua = randomUA();
    await page.setUserAgent(ua);
    await page.setViewport({ width: 1366, height: 768 });
    await page.setExtraHTTPHeaders({
      "accept-language": "es-ES,es;q=0.9,ca;q=0.8,en;q=0.7",
      "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Linux"',
    });

    // Override navigator.webdriver to avoid detection.
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      // Fake plugins array.
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });
      // Fake languages.
      Object.defineProperty(navigator, "languages", {
        get: () => ["es-ES", "es", "ca", "en"],
      });
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Random human-like wait (1.5–3.5s).
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000));
    return await page.content();
  } finally {
    await page.close();
  }
}
