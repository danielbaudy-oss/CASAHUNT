# pi-scraper

Cron-driven scraper that runs on `baudypi.local`. Fetches Idealista search results, writes new listings to Supabase, and pings Telegram.

## Local run

```bash
cp .env.example .env     # fill in creds
npm install
npm run dry-run          # scrape + log, no writes / notifications
npm start                # real run
```

## Deploy to the Pi

```bash
# one-time
ssh baudy@baudypi.local "mkdir -p ~/casahunt"
rsync -av --delete --exclude node_modules --exclude .env ./ baudy@baudypi.local:~/casahunt/pi-scraper/
ssh baudy@baudypi.local "cd ~/casahunt/pi-scraper && npm install --omit=dev"
# copy .env up separately (don't rsync secrets)
scp .env baudy@baudypi.local:~/casahunt/pi-scraper/.env
```

## Cron

Edit with `crontab -e` on the Pi:

```
*/15 * * * * cd /home/baudy/casahunt/pi-scraper && /usr/bin/node src/index.js >> /home/baudy/casahunt/pi-scraper/scraper.log 2>&1
```

## Structure

```
src/
  index.js        entry point: for each enabled filter, scrape → dedupe → notify
  config.js       env loading + validation
  supabase.js     service-role client
  telegram.js     sendMessage / sendPhoto
  scrape/
    idealista.js  fetch + parse Idealista search results
    headless.js   Puppeteer fallback for anti-bot sites (stub for now)
```
