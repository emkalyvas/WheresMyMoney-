# WheresMyMoney! — project context for AI assistants

Self-hosted dashboard for Firefly III data (plus Trading 212, eToro and Interactive Brokers): net worth, cash flow, categories, Greek OE company tax and VAT, projections, PDF reports. See README.md for features, docs/MIGRATING.md for v1 → v2.

## Layout (npm workspaces, TypeScript everywhere)

- `packages/shared`: zod settings schema (`settings.ts`), statistics payload types (`statistics.ts`), API types, metric allow-list, projection maths. Imported as TS source by both apps.
- `apps/server`: Fastify 5, better-sqlite3, pino.
  - `src/calc/`: the calculator (pure). Its output must keep every v1 field: `test/calculator.golden.test.ts` compares against v1 output for a synthetic dataset.
  - `src/tax/`: tax modules (`gr-oe.ts`); register new ones in `tax/index.ts` and `TAX_MODULES`.
  - `src/sync/`: sync worker (one job at a time), snapshot store, data-health checks.
  - `src/settings/`: settings store, AES-GCM secrets (write-only via the API), one-time v1 `.env` importer.
  - `src/auth/`: scrypt passwords, hashed sessions (cookie for the browser, bearer for integrations), CSRF header check.
  - `src/reports/`: PDF via @react-pdf/renderer, mailer, minute-tick scheduler; server-side strings in `strings.ts`.
  - `src/sources/`: Firefly client, FX, and broker connectors returning `BrokerHolding`s in their own currency (converted to EUR in the sync service). IBKR statements are cached in `kv` (`ibkr_cache:<id>`).
  - `test/mock-firefly.ts`: fake Firefly III, eToro and IBKR Flex with synthetic data.
- `apps/web`: React 19, Vite, Tailwind CSS v4 (tokens in `src/styles.css`), React Router 7, TanStack Query, react-hook-form + zod, Recharts, i18next (`src/i18n/en.ts`, typed keys).

## Conventions

- Configuration lives in the database, not in env vars (only PORT, DATA_DIR, WMM_SECRET_KEY, TRUST_PROXY, LOG_LEVEL, WEB_DIR).
- Never log or return secrets, hostnames or amounts in errors; upstream errors are `UpstreamError` with a reason code.
- `/api/auth/login`, `/api/statistics*` and `/api/report/pdf` are a public contract (TimologioPlus): don't change their shapes.
- Amounts in the UI go through `<Money>` (blurred in privacy mode); account names through `<Private>`.
- All user-facing strings go through i18n.

## Commands

`npm run dev:mock`, `npm run dev`, `npm test`, `npm run typecheck`, `docker compose up -d --build`.
