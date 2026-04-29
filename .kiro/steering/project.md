---
inclusion: always
---
# cazapiso — Real estate alerts

Scrapes Idealista / Fotocasa for new rental listings matching user filters, sends Telegram alerts.

Architecture mirrors `dropping`:
- Pi scraper on `baudypi.local` (cron, residential IP)
- Supabase MIKAN project, `casahunt` schema (Postgres + RLS + Edge Functions)
- GitHub Pages frontend (static SPA, anon key + session-token header)

Reuse patterns from `~/dropping` where sensible:
- `headless.js` Puppeteer helper for anti-bot sites
- Telegram auth flow (6-digit code via Edge Function)
- `sessions` + `auth_codes` + `current_chat_id()` RLS pattern

New Telegram bot for casahunt (do not reuse `dropping_alerts_bot` — different domain).

MVP: single user (me), Barcelona, Idealista only, 15-min poll, Telegram alert per new listing.
