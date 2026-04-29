// Fotocasa is a React SPA — plain HTTP returns skeleton HTML.
// Always use headless Chromium and wait for React to hydrate.

import { config } from "../config.js";

export async function fetchFotocasaHtml(url) {
  const puppeteer = await import("puppeteer");
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  const page = await browser.newPage();
  try {
    await page.setUserAgent(config.userAgent);
    await page.setExtraHTTPHeaders({ "accept-language": "es-ES,es;q=0.9" });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    // Wait for listing cards to render (React hydration).
    await page.waitForSelector("article a[href*='/es/alquiler/']", { timeout: 15000 })
      .catch(() => {}); // If no results, don't throw.
    return await page.content();
  } finally {
    await page.close();
    await browser.close();
  }
}
