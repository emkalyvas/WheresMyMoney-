# Statistics API (for integrations)

The v1 contract is kept as is: external clients such as TimologioPlus work unchanged. All examples are relative to the app's origin (e.g. `https://wmm.example.com`).

## Authentication

```http
POST /api/auth/login
Content-Type: application/json

{ "password": "…" }
```

- `200 {"success": true, "token": "wmm_…"}`. Send it as `Authorization: Bearer <token>`.
- `401 {"success": false, "error": "Invalid password"}`.
- `429` after too many attempts (10 per 15 minutes per client IP).

Tokens stay valid for the session lifetime configured in Settings → Security (default 30 days). They are revoked when the password changes, and can be revoked individually under Settings → Security → Active sessions. On `401`, log in again.

`GET /api/auth/status` → `{"required": true, "authenticated": bool, "setupRequired": bool}` (no authentication needed).

## Endpoints

### `GET /api/statistics`

Latest computed statistics.

- `200 {"success": true, "data": StatisticsPayload}`
- `503 {"success": false, "error": "Data is currently being calculated…", "retryAfter": 5}` before the first sync.

`?year=YYYY` returns the last snapshot recorded in that year (`data._cachedAt` is its date): `400` for a malformed year, `404` when no snapshot exists.

### `GET /api/statistics/history?metricPath=…&start=YYYY-MM-DD&end=YYYY-MM-DD`

Time series of one value from the daily snapshots → `{"success": true, "data": [{"date", "value"}]}`.
`metricPath` is a JSON path into the payload (`assets.netWorthEur`, `tax.breakdown[0].value`) or a category filter: `categories.expenses[?(@.name=="Food")].monthlyMean`.

### `POST /api/statistics/recalculate`

Syncs from Firefly III and returns the fresh statistics (same response as `GET /api/statistics`). It waits for the calculation to finish. If the sync failed, the previous data is returned with an `X-WMM-Sync-Error` header.

### `GET /api/report/pdf`

The PDF report (`application/pdf`).

## Payload

The payload type is defined in [`packages/shared/src/statistics.ts`](../packages/shared/src/statistics.ts). Every v1 field is present with the same meaning; v2 only adds fields, so old snapshots may lack them:

| Section | Notes |
|---------|-------|
| `summary` | Monthly means/medians (and their "previous" values), savings rate, 90/180-day rolling averages |
| `surplus`, `yearOverYear` | This year vs. last year; the current year is projected linearly from the months so far |
| `monthOverMonth` | Current vs. previous month |
| `tax` | `enabled`, `description`, `grossRevenue`/`companyExpenses` (net amounts, v1 naming), `revenue`/`expenses` `{net, gross, vat}`, `vatLiability {collected, paid, total, paidToGovt, remaining}`, `netTaxableProfit`, `expectedTaxTotal`, `effectiveTaxRate`, `breakdown[]`. v2 adds `module`, `year` and `breakdown[].key`. |
| `netMonthlyIncome` | After-tax income, annualised |
| `assets` | Totals, `accounts[]`, `liabilities[]`, BTC/ADA totals, `investedStocks[]`. v2 adds `accounts[].kind`, `accounts[].source` (`firefly`, `trading212`, `etoro`, `ibkr`), `byKind`, `cryptoHoldings`; `investedStocks` now includes positions from all brokers |
| `categories` | All-time and 90-day category statistics. v2 adds `vat` (VAT contained in `total`) when VAT in cash flow is enabled |
| `monthlyData` | Income/expenses/surplus per month |
| `runway`, `projections` | v2 adds `projections.inputs` |
| `periods` (v2) | Per-period summaries: `month`, `90d`, `ytd`, `12m`, `all`; with VAT in cash flow enabled also `incomeVat`, `expensesVat` and `categories[].vat` |
| `meta` | `lastUpdated`, `dataStartDate`, `currentYear`, … v2 adds `approximations`, `excludeCurrentMonthFromAverages`, `cashflowVat` (`company`/`all`, absent when off) |
| `schemaVersion` (v2) | `2` |

## Other endpoints

The web app uses `/api/stats`, `/api/stats/history?metric=<id>`, `/api/sync`, `/api/settings`, `/api/health/data` and `/api/reports`. These may change between versions; integrations should use the endpoints above.
