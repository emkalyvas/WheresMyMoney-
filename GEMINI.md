# WheresMyMoney! - Project Overview & Context

WheresMyMoney! is a comprehensive financial dashboard and reporting tool designed to aggregate transaction data from **Firefly III** and external data sources (like **Trading 212**) to compute essential economic statistics. It is tailored for freelancers and small businesses to visualize financial health, automate tax calculations, and project future wealth.

## 🏗 Architecture & Core Technologies

### Tech Stack
- **Frontend:** React 18 (with Vite), Recharts for data visualization, and Lucide React for iconography.
- **Backend:** Node.js, Express, Axios (API requests), SQLite (local caching), Puppeteer (PDF generation), Node-cron, and Nodemailer (scheduling/email).
- **Deployment:** Fully containerized with Docker and Docker Compose.

### Key Backend Services (`backend/src/services/`)
- **`calculator.js`**: The core "brain" of the application. It processes raw transaction data, applies tax rules, and computes all statistics (means, year-over-year growth, projections).
- **`firefly.js`**: Service for interacting with the Firefly III API.
- **`dataSources/`**: Pluggable architecture for external data. Currently includes `trading212.js`.
- **`db.js` & `cacheWorker.js`**: Manages a local SQLite database and a background worker that periodically recalculates statistics to ensure the dashboard loads instantly.
- **`pdfGenerator.js`**: Uses Puppeteer to render the frontend and print it to a PDF report.
- **`reportScheduler.js`**: Handles the monthly cron job for generating and emailing reports.

### Key Frontend Components (`frontend/src/components/`)
- **`Dashboard.jsx`**: The main layout aggregating all data visualization cards.
- **`StatCard.jsx`**: A generic component for displaying single-metric highlights.
- **`MonthlyChart.jsx`**: Visualizes monthly income vs. expenses trends.
- **`TaxBreakdown.jsx`**: Displays detailed tax estimations and effective rates.
- **`ProjectionCard.jsx`**: Shows long-term wealth projections and retirement milestones.

---

## 🚀 Building and Running

### Development Mode (with Hot Reloading)
To start the project in development mode with hot-reloading for both backend and frontend:
```bash
npm run dev
```
*This uses `docker-compose.dev.yml` to mount local source code into the containers.*

### Production Deployment
To build and start the production containers:
```bash
docker-compose up -d --build
```

### Accessing the Application
- **Frontend:** `http://localhost:3000`
- **Backend API:** `http://localhost:3001`
- **Health Check:** `http://localhost:3001/health`

---

## 🛠 Development Conventions

### 1. Data Source Extension
To add a new data source:
1. Create a new file in `backend/src/services/dataSources/`.
2. Export a function that fetches and maps data to the common `assetList` structure.
3. Register the new source in `backend/src/services/dataSources/index.js`.

### 2. Environment Variables
Configuration is strictly handled via environment variables. See `.env.example` for the full list of supported variables, including tax rates, company tags, and API credentials.

### 3. Caching & Background Work
The backend does not compute statistics on every request. It relies on a cached payload in the SQLite database. If you make changes to the calculation logic in `calculator.js`, you may need to wait for the next `cacheWorker` cycle (defined by `STATISTICS_CACHE_TTL_MINUTES`) or restart the backend to see the changes.

### 4. PDF Reporting
The PDF generator navigates to the frontend dashboard. Ensure any new UI components render correctly within a headless Chrome environment and do not depend on interactive states for their initial data visualization.

---

## 🧪 Testing
*(TODO: Add specific testing instructions once test suites are implemented. Currently, testing is primarily performed via manual verification in the dev environment.)*
