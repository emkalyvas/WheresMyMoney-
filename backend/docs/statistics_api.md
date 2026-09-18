# WheresMyMoney! Statistics API

The Statistics API is the core endpoint provider for the WheresMyMoney! backend. It aggregates data from Firefly III and external sources (like Trading 212), runs it through the `calculator.js` engine, and serves a cached, high-performance payload.

## Base Path
All endpoints are relative to `/api/statistics`.

---

## Endpoints

### 1. Get Core Statistics
**Endpoint:** `GET /`

Returns the most recently calculated dashboard statistics from the SQLite cache. This endpoint powers the main dashboard and is designed for sub-millisecond response times since it avoids hitting external APIs on every request.

**Responses:**
- `200 OK`: Returns the full statistics payload.
- `503 Service Unavailable`: Returned if the cache is currently being built (e.g. immediately upon cold startup).

**Example Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "meanMonthlyExpenses": 1200.50,
      "meanMonthlyIncome": 3000.00,
      "meanMonthlySurplus": 1799.50,
      "savingsRate": 60.0
      // ... includes previous means and rolling 90/180 day averages
    },
    "surplus": {
      "thisYear": 5000.00,
      "projectedThisYear": 12000.00,
      "previousYear": 10000.00,
      "difference": 2000.00,
      "growthPercent": 20.0
    },
    "yearOverYear": { /* Annual income/expenses comparison */ },
    "monthOverMonth": { /* Current vs previous month breakdown */ },
    "tax": {
      "enabled": true,
      "netTaxableProfit": 25000.00,
      "expectedTaxTotal": 5000.00,
      "effectiveTaxRate": 20.0
    },
    "netMonthlyIncome": {
      "projected": 20000.00,
      "monthly": 1666.67
    },
    "assets": {
      "totalEur": 50000.00,
      "totalLiabilitiesEur": 2000.00,
      "netWorthEur": 48000.00,
      "accounts": [
        {
          "id": "1",
          "name": "Revolut",
          "type": "asset",
          "currency": "EUR",
          "balance": 1500.00,
          "balanceEur": 1500.00,
          "allocationPct": 3.0
        }
      ],
      "investedStocks": [ /* Filtered external accounts */ ]
    },
    "categories": {
      "expenses": [ /* Ranked list of expense categories */ ],
      "income": [ /* Ranked list of income categories */ ]
    },
    "monthlyData": [
      {
        "month": "2026-09",
        "income": 3000.00,
        "expenses": 1200.50,
        "surplus": 1799.50
      }
    ],
    "runway": { /* Liquid runway metrics based on 90d rolling expenses */ },
    "projections": { /* Horizon projection data for FIRE goals */ },
    "meta": {
      "lastUpdated": "2026-09-18T09:00:00Z",
      "dataStartDate": "2024-01-01"
    },
    "_cachedAt": "2026-09-18 09:00:01"
  }
}
```

---

### 2. Force Recalculation
**Endpoint:** `POST /recalculate`

Forces the backend cache worker to immediately fetch fresh data from all downstream APIs (Firefly III, Trading 212, Exchange Rates), recalculate the statistics, and overwrite the `statistics_cache` and `daily_statistics` snapshots for the current day. 

> [!NOTE]
> This endpoint is automatically invoked via a node-cron job based on your `STATISTICS_CACHE_TTL_MINUTES` setting, but can be manually triggered from the UI for immediate updates.

**Responses:**
- `200 OK`: Returns the freshly calculated statistics payload (same structure as `GET /`).
- `503 Service Unavailable`: If the calculation fails to save.

---

### 3. Get Historical Data
**Endpoint:** `GET /history`

Fetches historical time-series data for a specific metric path across a requested date range. Used for plotting long-term trends (like Net Worth or Category spending over time) against daily snapshots stored in the SQLite database.

**Query Parameters:**
- `metricPath` (string, required): A JSON path corresponding to the statistics payload.
  - Simple path: `$.assets.netWorthEur`
  - Complex array path: `categories.expenses[?(@.name=="Food")].monthlyMean`
- `start` (string, required): Start date in `YYYY-MM-DD` format.
- `end` (string, required): End date in `YYYY-MM-DD` format.

**Responses:**
- `200 OK`: Returns an array of historical data points.
- `400 Bad Request`: If any required query parameter is missing.

**Example Request:**
`GET /api/statistics/history?metricPath=$.assets.netWorthEur&start=2026-08-01&end=2026-09-18`

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-08-01",
      "value": 45000.00
    },
    {
      "date": "2026-08-02",
      "value": 45150.00
    }
  ]
}
```
