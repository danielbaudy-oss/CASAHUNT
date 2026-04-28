#!/bin/bash
# casahunt — cron wrapper. Pulls the latest code, installs new deps if any,
# then runs the scraper. Env is loaded from .env (outside git).
#
# Called by crontab.txt. Manual use:   ./run.sh
#                                      DRY_RUN=1 ./run.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

# Self-update. Safe to skip if offline — we still run with what we have.
git pull --ff-only 2>&1 || echo "[run.sh] git pull failed, continuing with local copy"

cd "$SCRIPT_DIR"

# Reinstall deps if package-lock or package.json changed since last install.
if [ ! -d node_modules ] || [ package.json -nt node_modules ] || [ package-lock.json -nt node_modules ] 2>/dev/null; then
  echo "[run.sh] installing deps"
  npm install --omit=dev --no-audit --no-fund
fi

# Load env
if [ ! -f .env ]; then
  echo "[run.sh] .env missing"; exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

mkdir -p logs

/usr/bin/node src/index.js
