# Supabase — casahunt schema

Project: **MIKAN** (shared with `dropping`, separate schema).

## Apply the migration

Option A — Supabase SQL editor:
1. Open the MIKAN project → SQL editor
2. Paste `migrations/0001_init.sql` and run

Option B — Supabase CLI:
```bash
supabase db push --project-ref <mikan-ref>
```

## Expose the schema

Dashboard → Project Settings → API → **Exposed schemas** → add `casahunt`.

## Edge Functions

- `auth-request-code` — user sends chat_id, function generates a 6-digit code, stores in `auth_codes`, and sends it via the Telegram bot.
- `auth-verify-code` — user submits code, function validates and returns a session token (row in `sessions`).

Deploy:
```bash
supabase functions deploy auth-request-code --project-ref <mikan-ref>
supabase functions deploy auth-verify-code  --project-ref <mikan-ref>
```

Set secrets:
```bash
supabase secrets set TELEGRAM_BOT_TOKEN=... --project-ref <mikan-ref>
```
