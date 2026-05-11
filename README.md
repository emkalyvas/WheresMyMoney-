# WheresMyMoney!

WheresMyMoney! is a full-stack financial dashboard and reporting tool designed to aggregate transaction data from your **Firefly III** instance and compute essential economic statistics. It provides a beautiful, unified view of your assets, income, expenses, and automated tax calculations, tailored specifically for freelancers and small businesses.

## ✨ Features

- **Firefly III Integration:** Directly connects to your Firefly III API to pull live financial data.
- **Extensible External Data Sources:** Integrates with external APIs (currently includes **Trading 212**) to fetch invested assets and cash, extending your financial snapshot beyond Firefly III.
- **Account Filtering:** Ability to selectively ignore specific Firefly III accounts from the global calculations by their names.
- **Economic Statistics Dashboard:** Visualizes your financial health with interactive charts for category breakdowns, monthly trends, and overall asset overviews.
- **Automated Tax & Business Calculations:** Automatically computes estimated income tax, advance tax, and standard business expenses based on configurable rates.
- **Smart Data Caching:** Employs a local SQLite caching layer and background worker to automatically fetch and calculate statistics, providing near-instantaneous load times on the dashboard.
- **PDF Report Generation:** Built-in engine utilizing Puppeteer to capture your dashboard and generate sleek, professional PDF reports on demand.
- **Scheduled Email Reporting:** Configurable monthly scheduler to automatically generate and email your financial summary as a PDF attachment.
- **Docker Ready:** Fully containerized with a simple `docker-compose.yml` for effortless deployment, plus a dedicated `docker-compose.dev.yml` for hot-reloading development.

## 🛠 Tech Stack

- **Frontend:** React 18, Vite, Recharts (for data visualization), Lucide React (for iconography).
- **Backend:** Node.js, Express, Axios (for Firefly III API requests), Puppeteer (for PDF generation), Node-cron & Nodemailer (for scheduling and sending emails).
- **Deployment:** Docker & Docker Compose.

## ⚙️ Prerequisites

To run WheresMyMoney!, you will need:
- An active [Firefly III](https://www.firefly-iii.org/) instance with a generated Personal Access Token.
- Docker and Docker Compose installed (for production/standard deployment).
- Node.js 18+ (if running locally for development).

## 🔧 Environment Variables

Configuration is handled entirely via environment variables. Create a `.env` file in the root directory (you can use `.env.example` as a template).

| Variable | Description | Default |
|----------|-------------|---------|
| `FIREFLY_API_URL` | The URL of your Firefly III instance | `http://localhost:8080` |
| `FIREFLY_TOKEN` | Your Firefly III Personal Access Token | Required |
| `BACKEND_PORT` | Port for the backend API | `3001` |
| `FRONTEND_PORT` | Port for the frontend interface | `3000` |
| `COMPANY_TAG` | Firefly III tag to identify company/business transactions | `MnApps` |
| `START_DATE` | Date from which to begin calculating statistics | `2024-01-01` |
| `INCOME_TAX_RATE` | Estimated income tax rate | `0.22` |
| `BUSINESS_TAX` | Standard fixed business tax/expenses | `800` |
| `ADVANCE_TAX_RATE`| Rate for advance tax calculations | `0.40` |
| `SMTP_HOST` | SMTP server for automated emails | |
| `SMTP_PORT` | SMTP port | |
| `SMTP_SECURE` | Use secure SMTP (true/false) | `false` |
| `SMTP_USER` | SMTP username | |
| `SMTP_PASS` | SMTP password | |
| `SMTP_FROM` | Sender email address for reports | |
| `REPORT_EMAILS` | Comma-separated list of recipient emails for reports | |
| `REPORT_SCHEDULE_DAY` | Day of the month to send the scheduled report | `1` |
| `REPORT_SCHEDULE_TIME`| Time of day to send the scheduled report (HH:MM) | `08:00` |
| `IGNORE_FIREFLY_ACCOUNTS` | Comma-separated list of account names to ignore from Firefly III calculations | |
| `TRADING212_API_KEY` | Your Trading 212 API Key | |
| `TRADING212_API_SECRET` | Your Trading 212 API Secret | |
| `TRADING212_ENV` | Trading 212 Environment (`live` or `demo`) | `live` |
| `STATISTICS_CACHE_TTL_MINUTES` | How often the background worker recalculates statistics (in minutes) | `15` |

## 🚀 Getting Started

### Using Docker (Recommended)

1. Clone the repository and navigate into the project directory.
2. Create your `.env` file and populate it with your Firefly III credentials and configuration.
3. Run the following command:

```bash
docker-compose up -d --build
```

The application will be available at:
- **Frontend Dashboard:** `http://localhost:3000`
- **Backend API:** `http://localhost:3001`

### Local Development (Hot Reloading)

WheresMyMoney! comes with a dedicated Docker development mode that provides instant hot-reloading for both the frontend (Vite HMR) and backend (Nodemon) without needing to rebuild containers.

1. Create your `.env` file based on `.env.example`.
2. From the root project directory, use the helper script:

```bash
npm run dev
```

This uses `docker-compose.dev.yml` to mount your local code directly into the containers. Any file changes you make will instantly reflect in the browser!

## 🏗 Architecture Overview

- **`backend/src/services/calculator.js`:** The core engine that processes raw transaction data from Firefly III, applying your configured tax rates and business rules.
- **`backend/src/services/dataSources/`:** Pluggable architecture for incorporating external financial data providers. Currently supports Trading 212. Adding a new provider is as simple as creating a new file here that exports a fetching function, mapping the data to the expected `assetList` structure, and registering it in `index.js`.
- **`backend/src/services/db.js` & `cacheWorker.js`:** Manages the local SQLite database layer and background cron job that periodically updates the cached statistics to prevent slow on-demand calculations.
- **`backend/src/services/pdfGenerator.js`:** Uses headless Chrome (via Puppeteer) to navigate to the frontend, wait for charts to render, and print the page to a PDF buffer.
- **`frontend/src/components/`:** Modular React components mapping to specific financial metrics (e.g., `TaxBreakdown`, `MonthlyChart`, `AssetOverview`).
