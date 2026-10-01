# WheresMyMoney! v2: Redesign Proposal

Branch: `redesign/v2` · Status: **proposal, nothing implemented yet**

This document reviews the current codebase (as of `9462f13`) and proposes a rewrite in phases. The goals:

1. **User friendly.** Find the answer to "where is my money?" in seconds, not by scrolling one long page.
2. **Private by default.** Nothing personal is exposed on the network, in logs, in git or on screen unless you choose to show it.
3. **Configured in the app.** A Settings screen and a first-run setup wizard replace the ~45 `.env` variables.
4. **Well built.** Typed, tested and modular, so new data sources, tax modules and pages are cheap to add.

---

## 1. Review of the current project

### 1.1 What works well (keep it)

- **Cached snapshot architecture.** The background worker computes a payload and the UI reads it from SQLite, so the dashboard loads instantly. The daily `daily_statistics` snapshots are valuable: they give you history for free.
- **Pluggable data sources** (`dataSources/`) and **pluggable tax modules** (`taxModules/`) are the right abstractions.
- **The Greek OE tax logic** (VAT extraction by tag, advance-tax deduction, VAT paid to the government) is real domain value. `FIREFLY_RULES.md` documents it well.
- **The metric history modal.** Clicking any number shows its time series. This is the app's best feature and it should be used everywhere.

### 1.2 Privacy and security issues (highest priority)

| # | Issue | Where | Impact |
|---|-------|-------|--------|
| S1 | **CORS allows every origin** and the **backend port is published to the host**. With `APP_PASSWORD` empty, *any website open in your browser* can `fetch('http://<host>:3001/api/statistics')` and read your full financial payload. | `backend/src/index.js` (`cors()`), `docker-compose.yml` (`ports`) | Critical |
| S2 | When no password is set, everything is open, including `POST /recalculate` (which hits Firefly and Trading 212) and the PDF/HTML export endpoints. | `index.js` | High |
| S3 | The password check uses plain `===` (not timing-safe), with **no rate limiting** on `/api/auth/login`. | `index.js` | High |
| S4 | **One static token per process.** It never expires, can't be revoked, every restart logs everyone out, and it's kept in `localStorage`, where any XSS could read it. | `authToken.js`, `api/client.js` | Medium |
| S5 | **The token is passed in a URL query string** to Puppeteer (`?token=…`), so it lands in the nginx access log of the frontend container. | `pdfGenerator.js` | Medium |
| S6 | **Secrets live in plaintext `.env`** (Firefly PAT, Trading 212 keys, SMTP password) and are passed as container env vars, so they're visible to `docker inspect`. | compose, `config.js` | Medium |
| S7 | Error responses return raw `err.message`. Network errors include your Firefly hostname (e.g. `getaddrinfo ENOTFOUND …`). Startup logs also print the Firefly URL. | `routes/statistics.js`, `index.js` | Low |
| S8 | **Third-party requests reveal what you hold.** The app calls Google Fonts on every page load, `open.er-api.com` once *per currency*, and `api.binance.com/…?symbol=<COIN>EUR` for each coin you own. | `index.html`, `firefly.js` | Low |
| S9 | **Git history contained personal data**: a real Firefly hostname and a person's name in `.env.example`. ✅ *Purged with `git filter-repo` on 2026-10-01.* | git history | Done |
| S10 | Your personal setup is baked into code defaults: `COMPANY_TAG=MnApps`, Greek account name `Φόρος Εισοδήματος YYYY`, notes format `Προκαταβολή:`, and **BTC and ADA hard-coded as "invested" assets**. | `config.js`, `gr_oe.js`, `calculator.js`, `GeneralOverviewCard.jsx` | Low (privacy), but blocks anyone else from using the app |
| S11 | Nothing hides amounts on screen. Screen-sharing or opening the app in public shows everything. | UI | UX / privacy |

### 1.3 Bugs and correctness issues

| # | Issue | Where |
|---|-------|-------|
| B1 | **The backfill re-downloads every Firefly transaction once per month** (≈30+ full fetches), and it uses the **current** Trading 212 holdings for every historical month, so historic net worth is wrong. | `cacheWorker.js` |
| B2 | **"Recalculate All" can return stale data.** If the 15-minute job is already running, `recalculateAndCache` returns immediately and the route responds `success` with the old cache. | `cacheWorker.js`, `routes/statistics.js` |
| B3 | **A custom `BACKEND_PORT` breaks the stack.** The container always listens on 3001, but compose maps `${BACKEND_PORT}:${BACKEND_PORT}`. | `docker-compose.yml` |
| B4 | `STATISTICS_CACHE_TTL_MINUTES` > 59 produces `*/60 * * * *` etc., which does not mean "every N minutes". | `cacheWorker.js` |
| B5 | Monthly mean and median include the **current, partial month**, which biases all "monthly average" figures downward early in each month. | `calculator.js` |
| B6 | Snapshot dates use `toISOString()` (UTC), so a snapshot taken 00:00–03:00 Greek time is filed under the previous day. | `db.js` |
| B7 | The tax card title uses `new Date().getFullYear()` rather than the snapshot's year, so it's wrong when viewing a past year's snapshot. | `TaxBreakdown.jsx` |
| B8 | `check_missing_expenses.js` calls `firefly.fetchCompanyTransactions()`, which no longer exists. `scratch.js` is a leftover. | backend root |
| B9 | The exchange-rate API is fetched once per foreign currency instead of once per run. | `firefly.js` |
| B10 | The PDF export expands lists by clicking every button whose text contains "Show" and "More". This is fragile and breaks if the copy changes. | `pdfGenerator.js` |

### 1.4 Code quality

- **`calculator.js` is a 650-line function.** Income and expense category blocks are copy-pasted, and mean/median/previous variants are computed by hand. It has no tests, even though it is the core of the app.
- **The frontend has 186 inline `style={{…}}` objects** plus a 1,400-line global `index.css`. Hover effects are done with `onMouseEnter` handlers that mutate `style`. This is hard to theme and hard to keep consistent.
- **State management is manual.** `load()` and `handleRecalculate()` in `App.jsx`, `window.innerWidth` checks during render, and Refresh/Recalculate/Logout buttons duplicated in both the header and the sidebar.
- **Accessibility.** Clickable `<div>`s with no keyboard support, modals without focus trapping, and gain/loss shown by red/green colour alone.
- **Config is read at module load time**, so any change needs a restart. This rules out a settings screen without restructuring.
- **No linting, formatting, types or tests.** `GEMINI.md` says as much ("TODO: Add specific testing instructions").
- **The backend image ships Chromium** (~400 MB) just for PDFs, and Puppeteer runs with `--single-process --no-sandbox`.

---

## 2. Target architecture

```
┌──────────────────────────── one container: wmm ────────────────────────────┐
│                                                                            │
│  Browser ──HTTPS──▶  Fastify/Express (single origin, only exposed port)     │
│                      ├── /             built React SPA (static)            │
│                      ├── /api/*        session-cookie auth, zod-validated   │
│                      └── /print/*      print-optimised report route         │
│                                                                            │
│  Services: settings (encrypted) · sync worker · calculator (pure modules) │
│            · data sources · tax modules · reports/scheduler · health      │
│                                                                            │
│  SQLite (/data): settings · secrets(enc) · snapshots · sessions · jobs    │
└────────────────────────────────────────────────────────────────────────────┘
        │ outbound only: Firefly III · Trading 212 · FX rates · SMTP
```

The key changes:

- **One origin, one exposed port.** The backend serves the built SPA, so CORS goes away entirely and the API is never published separately. nginx becomes optional; it's still fine behind your own reverse proxy.
- **Settings move from env vars to the database**, read through a `settings` service that emits change events. The worker, scheduler and data sources re-configure live, with no restart needed.
- **The env file shrinks to bootstrap values only:**

  ```env
  PORT=3000
  DATA_DIR=/data
  # Optional. If unset, a random key is generated into /data/secret.key on first boot.
  WMM_SECRET_KEY=
  ```

### 2.1 Proposed stack

| Layer | Now | Proposed | Why |
|-------|-----|----------|-----|
| Language | JS | **TypeScript** (both sides) with a shared `packages/shared` for types and zod schemas | One schema validates the settings form, the API body and the DB row |
| Frontend | React 18 + Vite | **React 19 + Vite 6**, **React Router**, **TanStack Query** | Real pages and URLs; caching, retries and background refetch for free |
| UI kit | Hand-written CSS + inline styles | **Tailwind CSS v4 + shadcn/ui (Radix)** | Accessible dialogs, tooltips, tabs and forms; light/dark theming via tokens |
| Forms | none | **react-hook-form + zod** | For the settings screens |
| Charts | Recharts 2 | **Recharts 3** (kept) | Already familiar; a colour-blind-safe palette |
| Fonts | Google Fonts CDN | **@fontsource/inter** (self-hosted) | No third-party request (fixes S8) |
| Backend | Express 4 | **Fastify 5** (or Express 5 if you prefer to stay close) | Built-in schema validation, `@fastify/helmet`, `@fastify/rate-limit` |
| DB | `sqlite3` (callbacks) | **better-sqlite3 + versioned migrations** | Simpler synchronous code, transactional migrations |
| Logging | `console.log` | **pino** with redaction of tokens, keys, URLs and amounts | Fixes S7 |
| Tests | none | **Vitest** (calculator + API), **Playwright** (smoke + PDF) | The calculator gets golden-fixture tests before it is refactored |
| Tooling | none | ESLint, Prettier, npm workspaces, GitHub Actions CI | |

---

## 3. Privacy and security design

1. **Authentication is always on.** The first-run wizard requires you to create an admin password, so there is no "open" mode. If you really want open access on a trusted LAN, it's an explicit toggle in *Settings → Security* with a warning banner.
2. **Passwords are hashed with `crypto.scrypt`** (built in, no dependency) and checked with a timing-safe comparison. Login is **rate-limited** (e.g. 5 attempts per 15 minutes per IP).
3. **Sessions use an `httpOnly`, `Secure`, `SameSite=Strict` cookie** backed by a `sessions` table with expiry, a "log out other sessions" option and a sessions list. No tokens in `localStorage` or URLs. Puppeteer gets a short-lived, single-use **print ticket** sent as a header, never in the query string (fixes S4 and S5).
4. **Secrets are encrypted at rest** with AES-256-GCM, keyed by `WMM_SECRET_KEY` or the generated `/data/secret.key`. The API is **write-only for secrets**: it returns `{ set: true, last4: "…a1f2" }` and never the value. Settings export excludes secrets by default.
5. **Default security headers:** strict CSP (`default-src 'self'`), `helmet`, no `x-powered-by`. Errors return generic messages plus a request ID, and the details go only to redacted server logs.
6. **Privacy mode in the UI.** One click (or the `P` shortcut) blurs every amount and account name app-wide. It's remembered per device, with an optional "start in privacy mode" setting. Reports get a *redact account names* option.
7. **Fewer outbound calls.** FX rates are fetched once per run and cached. The provider is configurable, and you can switch to *Firefly III exchange rates only* for zero third-party calls.
8. **Repo hygiene.** Remove personal defaults (`MnApps`, BTC/ADA, Greek account names) from code and move them into settings. Delete `scratch.js` and `check_missing_expenses.js`, and add a `gitleaks` pre-commit/CI check. **Git history (S9) is your call:** rewriting history to remove the old hostname is destructive and only matters if the repo is or will be public. I won't do it unless you ask.

---

## 4. Configuration: Settings screen and setup wizard

### 4.1 First-run setup wizard

On first boot (an empty settings table) the app opens a 5-step wizard instead of the dashboard:

1. **Create admin password**
2. **Connect Firefly III**: URL + Personal Access Token → **[Test connection]** shows the Firefly version, user and number of accounts.
3. **Pick your accounts**: the app lists your Firefly asset and liability accounts. For each one you set **include / exclude** and a **type**: *Cash*, *Investment*, *Crypto*, *Liability*. This replaces `IGNORE_FIREFLY_ACCOUNTS` and the hard-coded BTC/ADA.
4. **Business & tax (optional)**: choose a tax module (*None* / *Greek OE*), then pick the company tag and VAT tags from **dropdowns populated from your Firefly tags** instead of typing them.
5. **Done.** The first sync and history backfill start, and a progress bar shows them running.

**Migration from v1:** if a `.env` is present on first boot, the wizard offers **"Import from existing .env"**. It pre-fills every field (secrets get encrypted), then tells you which env vars you can now delete.

### 4.2 Settings sections

| Section | Contents | Replaces |
|---------|----------|----------|
| **Connections** | Firefly URL/token (test); Trading 212 accounts as a list you can add to/remove from (name, key, secret, live/demo, test each); FX rate provider | `FIREFLY_*`, `TRADING212_*` (including the comma-separated multi-account lists) |
| **Accounts** | Table of all accounts: include toggle, type (cash/investment/crypto), display name/alias, colour | `IGNORE_FIREFLY_ACCOUNTS`, hard-coded BTC/ADA/T212 logic |
| **Business & Tax** | Tax module; company tag; VAT tag prefix; no-VAT tag; default VAT %; VAT-paid tags; CIT rate; business tax; advance-tax rate; advance-tax liability account (pick from list) + notes keyword | `COMPANY_TAG`, `VAT_*`, `*_TAX*`, the hard-coded `Φόρος Εισοδήματος` / `Προκαταβολή` |
| **Planning** | Goal amount, expected growth, SWR, monthly investment, horizon | `TARGET_ASSET_GOAL` … `PROJECTION_HORIZON_YEARS` |
| **Reports & Email** | SMTP (test email button), recipients, schedule (day/time with a "next run" preview), format (PDF/HTML), redact names; history of sent reports | `SMTP_*`, `REPORT_*` |
| **Data & Sync** | Data start date; sync interval (any value, validated); **Sync now**; **Rebuild history**; last sync status/log; export/import settings (JSON, secrets excluded) | `START_DATE`, `STATISTICS_CACHE_TTL_MINUTES` |
| **Security** | Change password, active sessions, privacy-mode default, LAN-open toggle | `APP_PASSWORD` |
| **Appearance & Locale** | Theme (system/light/dark), language (EN/EL), number/date locale, base currency | hard-coded EUR and `undefined` locale |

Every field is validated with the same zod schema on the client and the server. Saving a field that affects calculations triggers a recalculation, and a toast confirms it.

### 4.3 Data health page (from `FIREFLY_RULES.md`)

The rules you currently document by hand become live checks:

- ⚠️ 3 deposits this year look like company income but lack the `<company tag>`
- ⚠️ 12 withdrawals are *Uncategorized*
- ⚠️ No liability account matches the advance-tax account setting for 2025
- ⚠️ A VAT tag has an unparseable rate (`ΦΠΑ x`)
- ✅ Trading 212 "ISA" reachable · last sync 4 min ago

Each item links to the matching transaction search in Firefly III.

---

## 5. UI and UX redesign

### 5.1 Information architecture

Today everything sits on one scrolling page (8 sections + 4 modal types), and the *Category Breakdown* is shown twice (all-time and 90-day). The proposal splits it into pages with real URLs:

| Page | Answers | Content |
|------|---------|---------|
| **Overview** `/` | "How am I doing?" | Net worth hero with a sparkline (from snapshots); 4 KPI tiles (income, spending, savings rate, runway) each with delta and sparkline; this month vs. typical month; 3 top insights ("Groceries +38% vs. median") |
| **Cash flow** `/cashflow` | "Where does it go?" | Income vs. expenses chart; categories table with the **period picker** (one table instead of two sections); category drill-down (history, rank movement) |
| **Net worth** `/networth` | "What do I own?" | Allocation donut (cash/investments/crypto); accounts and holdings table; liabilities; FX rates used |
| **Business & Tax** `/tax` | "What will I owe?" | Revenue → profit → tax waterfall chart; VAT position (collected / deductible / paid / remaining); YoY; quarterly view |
| **Planning** `/planning` | "When can I stop?" | Projection chart with **live what-if sliders** (growth, monthly investment, SWR) that don't change saved settings; milestone cards |
| **Reports** `/reports` | | Generate PDF/HTML now, schedule, sent history |
| **Settings** `/settings/*` | | §4 |
| **Data health** `/health` | | §4.3 |

### 5.2 Global controls

A slim top bar holds **period** (This month · 90 days · YTD · 12 months · All), **Mean/Median**, **privacy eye**, **sync status** ("Synced 4 min ago" ⟳) and the user menu. These are currently scattered across the header and sidebar footer and duplicated. The period and statistic selections live in the URL, so a view can be bookmarked.

"Refresh" and "Recalculate All" merge into a single **Sync** action. The UI also stops blocking on a 503: it shows the last snapshot with a "recalculating…" chip.

### 5.3 Layout wireframes

**Overview (desktop)**

```
┌──────┬──────────────────────────────────────────────────────────────────┐
│ ◉ WMM│  Overview        [This month ▾] [Mean|Median]   👁   ⟳ 4 min ago  │
│      ├──────────────────────────────────────────────────────────────────┤
│ ⌂ Ov │  NET WORTH                                                       │
│ ⇄ CF │  € ••• ,•••.••   ▲ 2.4% vs last month   ╱‾‾╲__╱‾‾‾‾╱ (12 mo)     │
│ ◔ NW │  Cash ███████░ 62%   Investments ███░ 31%   Crypto █ 7%          │
│ § Tax├────────────────┬────────────────┬────────────────┬────────────────┤
│ ↗ Pln│ Income /mo     │ Spending /mo   │ Savings rate   │ Runway         │
│ ⎙ Rep│ €4,210  ▲3%    │ €2,380  ▼5%    │ 43%            │ 14.2 mo        │
│      │ ▁▃▅▃▆▅▇        │ ▆▅▅▇▄▅▃        │ ▃▄▄▅▆▅▆        │ cash only: 6.1 │
│      ├────────────────┴────────────────┼────────────────┴────────────────┤
│      │ Income vs spending (12 mo)      │ This month so far               │
│      │ ▇▅ ▆▅ ▇▃ ▆▆ ▇▄ ...              │ Groceries  €410  ▲38% vs median │
│ ⚙    │                                 │ Rent       €900  =              │
│ ⚠ 3  │                                 │ Transport  €120  ▼12%           │
└──────┴─────────────────────────────────┴─────────────────────────────────┘
```

**Settings → Connections**

```
Settings
├ Connections   ┌ Firefly III ───────────────────────────────── ● Connected ┐
├ Accounts      │ URL    [ https://…                                ]       │
├ Business&Tax  │ Token  [ ••••••••••••••••••••a1f2 ]  [Replace]            │
├ Planning      │                         [Test connection]  v6.1 · 23 accts│
├ Reports&Email └───────────────────────────────────────────────────────────┘
├ Data & Sync   ┌ Trading 212 ──────────────────────────────── [+ Add acct] ┐
├ Security      │ ISA     live  ••••3c9e   ● OK      [Test] [Edit] [Remove] │
└ Appearance    │ Invest  live  ••••77b0   ● OK      [Test] [Edit] [Remove] │
                └───────────────────────────────────────────────────────────┘
```

**Mobile:** a bottom tab bar (Overview, Cash flow, Net worth, Tax, More). KPI tiles go into a 2×2 grid and tables turn into stacked rows.

### 5.4 Visual design

- **Design tokens** (colour, spacing, radius, type scale) as CSS variables, with **light and dark themes** that follow the system setting. The current navy-dark look becomes the dark theme.
- **Calmer surfaces.** Drop the heavy glow/gradient cards and use colour for meaning, not decoration. The palette is colour-blind-safe for income/expense, and every delta also gets ▲/▼ and a sign, so meaning never depends on colour alone.
- **Tabular numerals** for amounts. Values stay right-aligned in tables, and figures over 1,000 can be shown compact (`€12.4k`) with the exact value on hover.
- **Every metric explains itself.** An ⓘ tooltip shows the formula and inputs ("Mean over 32 complete months, excluding the current month"). Every number opens the existing history chart.
- **Skeleton loaders** instead of a full-page spinner; empty states that point you to Settings ("No Trading 212 accounts connected, add one").
- Logo: replace the `₿` glyph with a neutral mark.
- **Accessibility:** real `<button>`/`<a>` elements, focus rings, Radix dialogs (focus trap, Esc), `prefers-reduced-motion`, WCAG AA contrast in both themes.

---

## 6. Backend code changes

### 6.1 Module layout

```
apps/
  server/src/
    app.ts                 # fastify instance, plugins, static SPA
    auth/                  # password hashing, sessions, rate limit, print tickets
    settings/              # schema, repository, encryption, change events, .env importer
    sync/                  # worker: fetch once → compute → snapshot; job status
    sources/
      firefly/             # client, paginator, tags/accounts listing for the UI
      trading212/
      fx/                  # provider interface, cached per run
    calc/
      period.ts            # month ranges, complete-month logic, TZ-aware dates
      cashflow.ts          # totals, mean/median/rolling, per-category (one generic fn)
      networth.ts          # account classification driven by settings
      projections.ts
      index.ts             # compose → StatisticsPayload (typed, versioned)
    tax/
      gr-oe/               # module + its own settings schema + tests
      index.ts             # registry: { id, name, settingsSchema, calculate }
    reports/               # print route renderer, puppeteer, mailer, scheduler
    health/                # data-health checks
    db/                    # better-sqlite3, migrations/
  web/src/
    app/ (router, providers, layout)
    pages/ overview, cashflow, networth, tax, planning, reports, settings/*, health
    components/ ui/ (shadcn), charts/, metric/ (Metric, Delta, Money, InfoTip)
    lib/ api.ts (TanStack Query hooks), format.ts, privacy.ts
packages/shared/          # zod schemas + TS types (settings, payload, API)
```

### 6.2 Specific changes

- **The calculator becomes pure, small functions with tests.** First, freeze today's behaviour with golden fixtures (anonymised synthetic Firefly data). Then refactor and fix B5 behind a flag so the numbers can be compared. The duplicated income/expense category code collapses into one `summarizeCategories(journals, periods)`.
- **The sync worker** fetches transactions **once**, then computes the backfill months from that single dataset (fixes B1). Historical external assets come from stored snapshots, never live values. The worker runs one job at a time through a queue with status (`idle / running / failed + error`). `POST /api/sync` returns a job ID and the UI polls it (fixes B2). Scheduling uses `setInterval`/`node-cron` built from minutes properly (fixes B4).
- **The snapshot payload is versioned** (`schemaVersion`), so the UI can handle old snapshots, and dates use the configured timezone (fixes B6).
- **The tax module interface** is `{ id, label, settingsSchema, defaults, calculate(ctx) }`. The Settings screen renders the module's own fields from `settingsSchema`, so a future module (e.g. Greek sole trader, or none) needs no UI work.
- **The report pipeline** renders a dedicated `/print/report` route with print CSS and every list expanded by prop (fixes B10). Chromium becomes an **optional image variant** (`wmm:latest` vs `wmm:latest-reports`), or a `browserless` sidecar URL. The scheduler re-registers whenever its settings change.
- **API surface:**
  ```
  POST /api/auth/login · POST /api/auth/logout · GET /api/auth/me · GET/DELETE /api/auth/sessions
  GET  /api/setup/status · POST /api/setup (wizard) · POST /api/setup/import-env
  GET  /api/settings · PATCH /api/settings/:section · POST /api/settings/test/:connection
  GET  /api/firefly/accounts · GET /api/firefly/tags          (for pickers)
  GET  /api/stats?at=YYYY-MM-DD · GET /api/stats/history?metric=…&from=…&to=…
  POST /api/sync · GET /api/sync/:jobId
  GET  /api/health/data
  POST /api/reports (generate) · GET /api/reports · GET /api/reports/:id/file
  ```
  `metric` becomes an allow-listed metric ID rather than a raw JSON path.

---

## 7. Delivery plan (all on `redesign/v2`)

Each phase is a set of reviewable commits, and the app stays runnable after each one.

| Phase | Scope | Outcome |
|-------|-------|---------|
| **0. Groundwork** | npm workspaces, TS config, ESLint/Prettier, Vitest; delete leftovers (B8); synthetic fixtures + **golden tests of the current calculator** | Safety net before touching logic |
| **1. Security quick wins** | Single origin and closed backend port (S1), forced auth, scrypt + timing-safe compare + rate limit (S3), cookie sessions (S4), print ticket (S5), redacted logging (S7), self-hosted font (S8), compose port fix (B3) | Privacy issues closed even before the redesign lands |
| **2. Settings core** | Migrations, encrypted settings store, settings API, `.env` importer, live reconfiguration of worker/scheduler/sources | `.env` no longer needed beyond bootstrap |
| **3. Calculator & sync** | Split calculator, account classification from settings, sync queue/job status, single-fetch backfill, FX caching, fixes B1/B2/B4–B6/B9 | Correct, tested numbers |
| **4. Frontend shell** | Router, Tailwind + shadcn, tokens/themes, TanStack Query, layout (sidebar + top bar + mobile tabs), privacy mode, setup wizard, **Settings pages** | New app frame + configuration UI |
| **5. Pages** | Overview, Cash flow, Net worth, Tax, Planning (what-if), history drawer, info tooltips | Redesigned dashboard |
| **6. Reports & health** | Print route, PDF/HTML, scheduler + mail with test send, report history, Data health page | Feature parity+ |
| **7. Docs & release** | README rewrite, migration guide v1→v2, retire `FIREFLY_RULES.md` into in-app help, CI | Ready to merge |

---

## 8. Decisions needed from you

1. **TypeScript migration?** *Recommended: yes.* The shared schemas between the settings UI and the API are what make the config screen robust.
2. **UI kit:** Tailwind + shadcn/ui (*recommended*), or keep hand-written CSS and just tidy it up?
3. **Deployment:** a single container (*recommended*, simpler and closes S1 by design), or keep separate frontend/backend containers?
4. **PDF engine:** keep Chromium in the main image, make it an optional variant (*recommended*), or drop PDF in favour of HTML/print-to-PDF?
5. **Language:** add a Greek UI translation now, or EN only for v2?
6. **Git history (S9):** leave it as is, or rewrite history to purge the old hostname? Rewriting is destructive and needs a force-push.
