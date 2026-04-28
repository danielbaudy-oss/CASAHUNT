# casahunt — Project Kickoff

> Move this file out of the `dropping` workspace into a new `casahunt` folder when you're ready to start.

Rental & real estate alert app. Scrapes Idealista / Fotocasa for new listings matching user-defined filters and sends Telegram notifications the moment something matching appears.

## Why
Decent flats in Barcelona / Madrid go in hours. Manually refreshing portals doesn't scale. Get a Telegram ping the second a matching listing is published, before the rest of the market sees it.

## Architecture (modeled after dropping)

```
[GitHub Pages frontend]  →  [Supabase Postgres + Edge Functions]
                                      ↓
                                [Raspberry Pi cron scraper]
                                      ↓
                                [Telegram Bot API]
```

- **Frontend (GitHub Pages)**: single-page app. Users set up filters (city, price range, size, rooms, neighborhoods), auth via Telegram code.
- **Supabase (MIKAN project, `casahunt` schema)**: Postgres + PostgREST + RLS, Edge Functions for auth.
- **Raspberry Pi (`baudypi.local`)**: scraper jobs via cron every 10–30 min, residential IP bypasses Idealista's anti-bot.
- **Telegram**: instant notifications.

## Key differences from dropping
- **Poll frequency**: minutes, not hours (listings go in hours).
- **Deduping is harder**: a "new" listing might be a bump/edit of an old one. Track listing ID + published timestamp + first-seen.
- **More filter dimensions**: neighborhood polygons, min/max size, rooms, outdoor space, pets allowed, furnished, elevator, etc.
- **Richer notifications**: photo, price per m², map preview, "3 new today" digest.
- **Idealista is aggressive**: may need headless Chromium (reuse `headless.js` from dropping). Fotocasa is usually more permissive.

## Reusable from dropping
- Pi + cron + Node setup — mostly copy-paste
- Supabase schema pattern (schema-per-app, RLS via `current_chat_id()`, `sessions` + `auth_codes`)
- Telegram auth flow (6-digit code via Edge Function)
- Frontend structure (GitHub Pages + anon key + session-token header)
- `headless.js` Puppeteer helper for anti-bot sites

## MVP scope
1. Single user (you), single city (Barcelona), Idealista only
2. Filters: price range, min rooms, max m², neighborhood list
3. Check every 15 minutes
4. Telegram alert per new listing: photo + price + size + link
5. Store seen listing IDs so we notify once per listing

## Later
- Multi-user (reuse Telegram auth flow from dropping)
- Fotocasa as second source
- Match deduplication across sources (same flat on both = one alert)
- Frontend UI for filter management
- Map-based neighborhood selection
- Price history per listing (detect drops)
- Saved searches, shareable links

## Starting checklist
- [ ] Create `casahunt` schema in Supabase MIKAN project
- [ ] Tables: `users`, `filters`, `listings_seen`, `sessions`, `auth_codes`, `config`
- [ ] Pi scraper skeleton based on `dropping/pi-scraper/`
- [ ] Investigate Idealista API / HTML structure + anti-bot behavior
- [ ] First job: scrape one search URL, log results, no notifications yet
- [ ] Add dedupe via `listings_seen`
- [ ] Add Telegram notifications
- [ ] Frontend + auth (copy dropping pattern)

## Steering file for new workspace
Drop this into `.kiro/steering/project.md` when you create the new workspace:

```markdown
---
inclusion: always
---
# casahunt — Real estate alerts

Scrapes Idealista / Fotocasa for new rental listings matching user filters, sends Telegram alerts.
Same architecture as dropping: Pi scraper + Supabase (MIKAN project, `casahunt` schema) + GitHub Pages frontend.
Pi is baudypi.local, reuse scraper patterns from ~/dropping/pi-scraper.
Telegram bot: create a new one for casahunt (don't reuse dropping_alerts_bot — different domain).
```

## Research notes to capture before coding
- Idealista search URL structure + filter params
- Does Idealista have a mobile API with JSON endpoints?
- How does Idealista detect bots? (header checks, JS challenges, rate limits)
- Fotocasa fallback: what's their structure look like?
- How to express a "neighborhood" filter programmatically (list of district IDs? GeoJSON polygon?)
