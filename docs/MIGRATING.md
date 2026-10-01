# Upgrading from v1 to v2

v2 replaces the two containers (frontend + backend) with one, and moves configuration from `.env` into the app. Your settings, password and history carry over automatically.

## What happens on first start

1. **Database.** If the data directory contains the v1 `cache.db`, it is copied to `wmm.db`. All daily snapshots (the history behind every chart) are kept. `cache.db` is left untouched as a backup.
2. **Settings.** If the settings table is empty and v1 variables are present in the environment (the compose file loads `.env`), they are imported once:
   - Firefly URL and token, Trading 212 accounts (single and comma-separated lists), SMTP settings and password, recipients and schedule, tax settings, ignored accounts, projections, start date, cache interval.
   - Tokens, API keys and the SMTP password are **encrypted** into the database.
   - `APP_PASSWORD` becomes the login password (hashed), so integrations such as TimologioPlus keep working without changes.
3. After that, the variables are **ignored**. The log lists them, and Settings shows a banner until you dismiss it.

## Steps

```bash
docker compose down                 # stop v1
git pull                            # or check out the v2 branch
```

Choose where the data lives. Either:

```bash
mv backend/data data                # v2 default location: ./data
```

or keep the old folder by adding `WMM_DATA_DIR=./backend/data` to `.env`.

```bash
docker compose up -d --build
docker compose logs -f wheresmymoney
```

Open the app on the same port as the v1 frontend (`FRONTEND_PORT` is still honoured; or set `WMM_PORT`). Check **Settings**, then **Data health**.

Once everything looks right, **remove the old variables from `.env`** — especially `FIREFLY_TOKEN`, `TRADING212_*`, `SMTP_PASS` and `APP_PASSWORD`. Only the optional variables in `.env.example` are still read.

## Things that changed

| v1 | v2 |
|----|----|
| Frontend on `FRONTEND_PORT`, API on `BACKEND_PORT` | One port for both (`/api/…` on the same origin). The API is no longer exposed separately and sends no CORS headers. |
| Optional password | Always required. A fresh install asks for a one-time setup code printed in the logs. |
| Token in `localStorage`, valid until restart | httpOnly session cookie for the browser; bearer tokens for integrations (from `POST /api/auth/login`), valid for the configured number of days, revocable under Settings → Security |
| `/health` | `/healthz` |
| PDF via headless Chrome; HTML export | PDF rendered on the server without a browser (much smaller image). HTML export removed; use the browser's print if needed. |
| BTC/ADA hard-coded as "invested" | Account types in Settings → Accounts; any non-ISO currency counts as crypto by default |
| `IGNORE_FIREFLY_ACCOUNTS` | Settings → Accounts (imported) |
| Monthly averages included the unfinished current month | Excluded by default (Settings → General); turn off to match v1 numbers exactly |
| `/api/statistics/recalculate` could return stale data while a sync was running | Waits for a fresh calculation |
| History backfill re-downloaded all transactions for every month | Fetches transactions once; fills only missing months unless you choose to overwrite |
| Snapshot dates in UTC | In your configured timezone |

The statistics payload keeps every v1 field; see [statistics-api.md](statistics-api.md).

## Rolling back

v1's `cache.db` is not modified, so you can go back to the v1 commit and its `.env` at any time.
