# frontend

Static SPA deployed to GitHub Pages. No build step.

## Local dev

Any static server works:
```bash
npx serve .
# or
python -m http.server 8080
```

## Config

Edit `config.js` with your Supabase URL + anon key. The anon key is safe to ship — RLS enforces access via the session token set in `x-session-token`.

## Deploy

Enable GitHub Pages on this repo → **Settings → Pages → Source: GitHub Actions**, then the workflow in `.github/workflows/pages.yml` publishes this folder on every push to `main`.
