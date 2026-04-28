# casahunt — end-to-end setup

A walkthrough to go from empty repo to live alerts. Estimated time: ~45 min.

## 1. Telegram bot

1. DM [@BotFather](https://t.me/BotFather) → `/newbot` → name it (e.g. `casahunt_alerts_bot`).
2. Save the **bot token**.
3. DM your new bot anything so it can message you back.
4. Get your **chat id**: open `https://api.telegram.org/bot<TOKEN>/getUpdates` after sending a message — look for `message.chat.id`.

## 2. Supabase

1. MIKAN project → SQL editor → run `supabase/migrations/0001_init.sql`.
2. Project Settings → API → **Exposed schemas**: add `casahunt`.
3. Project Settings → API: copy **Project URL**, **anon key**, **service role key**.
4. Install CLI: `npm i -g supabase`, then `supabase login`.
5. Link: `supabase link --project-ref <mikan-ref>`.
6. Set the casahunt-specific secret (do NOT overwrite `TELEGRAM_BOT_TOKEN` — that one belongs to `dropping`):
   ```bash
   supabase secrets set CASAHUNT_BOT_TOKEN=<your-casahunt-bot-token> --project-ref <mikan-ref>
   ```
7. Edge Functions are deployed as `casahunt-auth-request-code` and `casahunt-auth-verify-code` (namespaced to avoid colliding with dropping's `auth-request-code`/`auth-verify-code`). They're already deployed via the Supabase MCP; to redeploy from source:
   ```bash
   supabase functions deploy casahunt-auth-request-code --project-ref <mikan-ref>
   supabase functions deploy casahunt-auth-verify-code  --project-ref <mikan-ref>
   ```

## 3. Frontend (GitHub Pages)

1. Edit `frontend/config.js` with your Supabase URL + anon key. Commit.
2. GitHub repo → Settings → Pages → **Source: GitHub Actions**.
3. Push to `main`. The `pages.yml` workflow deploys `frontend/`.
4. Visit `https://<user>.github.io/casahunt/`.

## 4. Pi scraper

On the Pi (`baudypi.local`):

```bash
ssh baudy@baudypi.local
mkdir -p ~/casahunt
exit
```

From your workstation:
```bash
rsync -av --delete --exclude node_modules --exclude .env pi-scraper/ baudy@baudypi.local:~/casahunt/pi-scraper/
scp pi-scraper/.env baudy@baudypi.local:~/casahunt/pi-scraper/.env
ssh baudy@baudypi.local "cd ~/casahunt/pi-scraper && npm install --omit=dev"
```

Smoke test (dry run — no writes, no Telegram):
```bash
ssh baudy@baudypi.local "cd ~/casahunt/pi-scraper && DRY_RUN=1 node src/index.js"
```

If you get 0 listings parsed, Idealista is blocking plain fetch. Try:
```bash
ssh baudy@baudypi.local "cd ~/casahunt/pi-scraper && npm install puppeteer && USE_HEADLESS=1 DRY_RUN=1 node src/index.js"
```

Install cron:
```bash
ssh baudy@baudypi.local "crontab -e"
```
Add:
```
*/15 * * * * cd /home/baudy/casahunt/pi-scraper && /usr/bin/node src/index.js >> /home/baudy/casahunt/pi-scraper/scraper.log 2>&1
```

## 5. First login

1. Open the Pages site.
2. Enter your Telegram chat id → Send code.
3. Paste the 6-digit code from Telegram → Verify.
4. Add a filter. (MVP scraper still uses `SEARCH_URL` from env; swapping to read from `casahunt.filters` is the next milestone.)

## Troubleshooting

- **CORS errors in the browser**: confirm `casahunt` is in Exposed Schemas, and Edge Functions CORS is permissive (see `supabase/functions/_shared/cors.ts`).
- **`permission denied for schema casahunt`** on REST calls: you're missing the `x-session-token` header, or the session has expired.
- **Empty scrape output**: Idealista's DOM changed, or plain fetch is being blocked. Inspect with `curl -A "$USER_AGENT" "$SEARCH_URL" | head` from the Pi.
- **Telegram `sendPhoto` 400**: Idealista CDN blocked hotlinking for that image; the scraper already falls back to `sendMessage`.
