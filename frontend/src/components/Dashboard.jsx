import {
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  PiggyBank,
  Receipt,
  ArrowUpDown,
  Target,
  Clock,
  BarChart2,
} from 'lucide-react';
import StatCard, { eurFmt, pctFmt } from './StatCard';
import TaxBreakdown from './TaxBreakdown';
import AssetOverview from './AssetOverview';
import MonthlyChart from './MonthlyChart';
import CategoryBreakdown from './CategoryBreakdown';
import MonthlyOverviewCard from './MonthlyOverviewCard';
import GeneralOverviewCard from './GeneralOverviewCard';

/** Choose the right icon and badge for a percentage change value. */
function trendBadge(pct) {
  if (pct == null) return null;
  if (pct > 0) return { type: 'positive', text: `▲ ${pct.toFixed(1)}%` };
  if (pct < 0) return { type: 'negative', text: `▼ ${Math.abs(pct).toFixed(1)}%` };
  return { type: 'warning', text: '→ 0%' };
}

/** Section wrapper with a coloured accent bar and title. */
function Section({ title, children }) {
  return (
    <section className="section">
      <div className="section-header">
        <div className="section-title-accent" aria-hidden="true" />
        <h2 className="section-title">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/**
 * Main dashboard — composes all stat cards and chart sections from the
 * statistics payload returned by the backend.
 */
export default function Dashboard({ data }) {
  const { summary, surplus, yearOverYear, tax, netMonthlyIncome, assets, categories, monthlyData, runway, meta } = data;

  const runwayColor =
    runway.months == null ? '' :
    runway.months > 12 ? 'text-positive' :
    runway.months > 6  ? 'text-warning'  : 'text-negative';

  return (
    <div>
      {/* ── 1. General Overview ────────────────────────────────────────────── */}
      <Section title="Overview">
        <GeneralOverviewCard data={data} />
      </Section>

      {/* ── 2. Monthly Overview ──────────────────────────────────────────── */}
      <Section title="Monthly Overview">
        <MonthlyOverviewCard data={data} />
      </Section>

      {/* ── 2. Monthly Chart ─────────────────────────────────────────────── */}
      <Section title="Monthly Trend">
        <MonthlyChart monthlyData={monthlyData} />
      </Section>

      {/* ── 3. Tax & Net Income ──────────────────────────────────────────── */}
      <Section title="Tax Calculation">
        <div className="two-col">
          <TaxBreakdown tax={tax} netMonthlyIncome={netMonthlyIncome} config={tax.config} />

          {/* Year-over-year summary card */}
          <div className="card fade-in-up">
            <div className="card-title">Year-over-Year Comparison</div>

            <YoYBlock
              label="Income"
              thisYear={yearOverYear.projectedIncomeThisYear}
              prevYear={yearOverYear.incomePreviousYear}
              pct={yearOverYear.incomeGrowthPercent}
              currentYear={`${yearOverYear.currentYear} Projected`}
              previousYear={yearOverYear.previousYear}
              positiveIsGood
            />

            <div className="tax-divider" aria-hidden="true" />

            <YoYBlock
              label="Expenses"
              thisYear={yearOverYear.projectedExpensesThisYear}
              prevYear={yearOverYear.expensesPreviousYear}
              pct={yearOverYear.expensesGrowthPercent}
              currentYear={`${yearOverYear.currentYear} Projected`}
              previousYear={yearOverYear.previousYear}
              positiveIsGood={false}
            />

            <div className="tax-divider" aria-hidden="true" />

            <YoYBlock
              label="Surplus"
              thisYear={surplus.projectedThisYear}
              prevYear={surplus.previousYear}
              pct={surplus.growthPercent}
              currentYear={`${yearOverYear.currentYear} Projected`}
              previousYear={yearOverYear.previousYear}
              positiveIsGood
            />
          </div>
        </div>
      </Section>

      {/* ── 4. Category Breakdown ────────────────────────────────────────── */}
      <Section title="Category Breakdown">
        <CategoryBreakdown expenses={categories.expenses} income={categories.income} />
      </Section>

      {/* ── 5. Assets ────────────────────────────────────────────────────── */}
      <Section title="Assets &amp; Liabilities">
        <AssetOverview assets={assets} />
      </Section>
    </div>
  );
}

/** Compact year-over-year comparison block for a single metric. */
function YoYBlock({ label, thisYear, prevYear, pct, currentYear, previousYear, positiveIsGood }) {
  const increased = pct != null && pct > 0;
  const changeColor = pct == null ? '' :
    (positiveIsGood ? (increased ? 'text-positive' : 'text-negative') :
                      (increased ? 'text-negative' : 'text-positive'));

  return (
    <div style={{ padding: 'var(--space-4) 0' }}>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-3)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-muted)', marginBottom: 2 }}>{previousYear}</div>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600 }}>{eurFmt.format(prevYear)}</div>
        </div>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-muted)', marginBottom: 2 }}>{currentYear}</div>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{eurFmt.format(thisYear)}</div>
        </div>
      </div>
      {pct != null && (
        <div className={`badge ${pct > 0 ? (positiveIsGood ? 'badge-positive' : 'badge-negative') : (positiveIsGood ? 'badge-negative' : 'badge-positive')}`}
          style={{ marginTop: 'var(--space-2)' }}>
          {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% YoY
        </div>
      )}
    </div>
  );
}
