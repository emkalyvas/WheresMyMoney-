# WheresMyMoney!

A private, self-hosted dashboard for your finances in **Firefly III**: net worth, cash flow, categories, company taxes and VAT, long-term projections and monthly PDF reports — at a glance.

- **Overview** — net worth with trend, income/spending/savings rate/runway for any period, this month vs. a typical month
- **Cash flow** — monthly history and category breakdowns for this month, 90 days, YTD, 12 months or all time
- **Net worth** — history, allocation (cash / investments / crypto), accounts and holdings; multi-currency and crypto via exchange rates
- **Business & tax** — company income tax, business tax, advance tax and VAT position from tagged transactions (Greek OE module included)
- **Planning** — compound-growth projections with what-if sliders and financial-independence milestones
- **Reports** — PDF report on demand or e-mailed monthly
- **Data health** — checks that your Firefly III data follows the conventions the calculations rely on, with links to the offending transactions
- **Brokers** — positions and cash from **Trading 212**, **eToro** (official read-only API) and **Interactive Brokers** (read-only Flex Web Service), several accounts each, converted to EUR

Every number can be opened to see its history, built from daily snapshots.

## Privacy & security

- Password protection is always on (scrypt-hashed); sessions use httpOnly, SameSite=Strict cookies; login is rate-limited
- Tokens, API keys and the SMTP password are **encrypted at rest** and never sent back to the browser
- One origin, no CORS, strict Content-Security-Policy, no third-party fonts or scripts
- **Privacy mode** (press <kbd>P</kbd>) blurs every amount and account name — handy when screen-sharing
- Logs and error messages never contain hostnames, tokens or amounts

## Quick start (Docker)

```bash
git clone https://github.com/emkalyvas/WheresMyMoney-.git && cd WheresMyMoney-
docker compose up -d --build
docker compose logs wheresmymoney | grep "setup code"
```

Open `http://localhost:3000`, enter the setup code from the logs, choose a password, and the wizard walks you through connecting Firefly III (URL + personal access token), choosing accounts and (optionally) taxes.

Upgrading from v1 (`.env` configuration)? Read **[docs/MIGRATING.md](docs/MIGRATING.md)** — settings, password and history are imported automatically.

### Configuration

Everything is configured in the app (**Settings**). The few optional bootstrap variables are listed in [.env.example](.env.example): port, data directory, encryption key, trusted proxies.

Put WheresMyMoney! behind your reverse proxy with HTTPS if you expose it beyond your LAN.

## Firefly III conventions

| What | How |
|------|-----|
| Exclude an account | Turn it off in Settings → Accounts, or untick "Include in net worth" in Firefly III |
| Account type (cash / investment / crypto) | Automatic (non-ISO currencies count as crypto), override in Settings → Accounts |
| Brokers | Settings → Connections; each broker has a short "how to get the credentials" guide. IBKR needs an Activity Flex Query (XML) with Open Positions, Cash Report and NAV; statements are end-of-day and fetched every few hours |
| Company transactions | Tag them with the company tag (Settings → Business & tax) |
| VAT rate of a transaction | Tag `<prefix> <rate>`, e.g. `ΦΠΑ 13`; the no-VAT tag means 0 %; otherwise the default rate |
| VAT in the cash flow | Optional (Settings → Business & tax → VAT in cash flow): VAT per category with the same rules, for company transactions only or for all transactions except categories you exclude (rent, salary, …) |
| VAT paid to the tax office | A withdrawal carrying all "VAT payment tags" (case/accent-insensitive) |
| Prepaid advance tax | A liability account named after the configured pattern (e.g. `Φόρος Εισοδήματος 2025`) with `Προκαταβολή: 1500.50` in its notes |

The **Data health** page checks these for you.

## API for integrations

`POST /api/auth/login` with `{"password": "…"}` returns `{"success": true, "token": "…"}`; send it as `Authorization: Bearer <token>` to `GET /api/statistics` (optionally `?year=YYYY`). The v1 contract is unchanged — see [docs/statistics-api.md](docs/statistics-api.md).

## Development

Requires Node.js 22+.

```bash
npm install
npm run dev:mock            # fake Firefly III with synthetic data on :8089 (token: mock-token),
                            # plus fake eToro (keys mock-key / mock-user) and IBKR (token mock-token, query 123456)
npm run dev                 # API on :3000 + web app with hot reload on :5173
npm test                    # calculator golden tests + API integration tests
npm run typecheck
```

On first start the dev server prints a setup code; use URL `http://127.0.0.1:8089` and token `mock-token` in the wizard.
To point the broker connectors at the mock, start the server with `WMM_DEV_ETORO_URL=http://127.0.0.1:8089/etoro WMM_DEV_IBKR_URL=http://127.0.0.1:8089/ibkr` (ignored when `NODE_ENV=production`).

| Path | What |
|------|------|
| `packages/shared` | zod settings schema, statistics payload types, metric registry, projection maths — shared by server and web |
| `apps/server` | Fastify API: settings & encrypted secrets, auth, sync worker, calculator, tax modules, PDF reports, scheduler |
| `apps/server/src/calc` | The calculator (pure functions, verified against v1 output) |
| `apps/server/src/tax` | Tax modules — add one by implementing `calculate()` and registering it |
| `apps/server/src/sources` | Firefly III, brokers (`trading212.ts`, `etoro.ts`, `ibkr.ts` → `BrokerHolding`s) and FX |
| `apps/web` | React 19 + Tailwind CSS v4 + TanStack Query; strings in `src/i18n` |

### Adding a language

Copy `apps/web/src/i18n/en.ts` to e.g. `el.ts`, translate, register it in `apps/web/src/i18n/index.ts` and `appearanceSettingsSchema` in `packages/shared`, and add the PDF/e-mail strings in `apps/server/src/reports/strings.ts`.

## License

MIT
