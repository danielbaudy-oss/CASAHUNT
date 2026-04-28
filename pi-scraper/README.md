# pi-scraper

Cron-driven Idealista scraper. Runs on `baudypi.local`. Self-updates from GitHub on each run.

## One-time setup on the Pi

```bash
ssh baudy@baudypi.local

# 1. Clone
cd ~
git clone https://github.com/danielbaudy-oss/CASAHUNT.git casahunt

# 2. Create env
cd casahunt/pi-scraper
cp .env.example .env
nano .env   # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN

# 3. First install
npm install --omit=dev

# 4. Make run script executable
chmod +x run.sh

# 5. Dry-run test
DRY_RUN=1 ./run.sh

# 6. Install cron (every 15 min, self-updates from GitHub)
crontab crontab.txt
```

From that point on, every push to `main` gets picked up automatically on the next cron run — no SSH needed to deploy.

## Manual commands (on the Pi)

```bash
# One scrape now (dry-run: no DB writes, no Telegram)
cd ~/casahunt/pi-scraper && DRY_RUN=1 ./run.sh

# Real run right now
cd ~/casahunt/pi-scraper && ./run.sh

# Watch the log
tail -f ~/casahunt/pi-scraper/logs/run.log

# Switch to headless Chromium if Idealista starts blocking plain fetch
cd ~/casahunt/pi-scraper
echo "USE_HEADLESS=1" >> .env
npm install puppeteer    # ~300MB download of Chromium
```

## Structure

```
src/
  index.js                 orchestrator: reads filters, scrapes, notifies
  config.js                env loading
  supabase.js              service-role client
  telegram.js              sendMessage / sendPhoto
  neighborhoods.js         mirror of frontend/neighborhoods.js
  dedupe.js                canonical-key fingerprints
  idealista/
    locations.js           casahunt slug → Idealista URL path mapping
    urlBuilder.js          filter → search URLs
    fetcher.js             plain HTTP + headless fallback
    parser.js              Cheerio parser with self-diagnostic mode
  scrape/
    headless.js            Puppeteer helper (loaded only when USE_HEADLESS=1)
run.sh                     cron wrapper: git pull → npm install → node src/index.js
crontab.txt                `*/15 * * * *` schedule
```
