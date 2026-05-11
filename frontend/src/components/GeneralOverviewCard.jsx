import { Activity } from 'lucide-react';
import { eurFmt } from './StatCard';

/**
 * General Overview displayed as a list of rows, similar to the Monthly Overview card.
 */
export default function GeneralOverviewCard({ data }) {
  const { summary, runway, netMonthlyIncome, assets, categories, meta } = data;

  const getGrowth = (current, previous) => {
    if (previous == null || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const rows = [
    {
      label: 'Mean Monthly Income',
      value: eurFmt.format(summary.meanMonthlyIncome),
      valueClass: 'text-positive',
      info: `Over ${meta.totalMonths} months`,
      growth: getGrowth(summary.meanMonthlyIncome, summary.previousMeanMonthlyIncome),
      invertGrowthColor: false,
      previousValue: summary.previousMeanMonthlyIncome,
    },
    {
      label: 'Mean Monthly Expenses',
      value: eurFmt.format(summary.meanMonthlyExpenses),
      valueClass: 'text-negative',
      info: `Over ${meta.totalMonths} months`,
      growth: getGrowth(summary.meanMonthlyExpenses, summary.previousMeanMonthlyExpenses),
      invertGrowthColor: true,
      previousValue: summary.previousMeanMonthlyExpenses,
    },
    {
      label: 'Mean Monthly Surplus',
      value: eurFmt.format(summary.meanMonthlySurplus),
      valueClass: summary.meanMonthlySurplus >= 0 ? 'text-positive' : 'text-negative',
      info: `Savings rate: ${summary.savingsRate.toFixed(1)}%`,
      growth: getGrowth(summary.meanMonthlySurplus, summary.previousMeanMonthlySurplus),
      invertGrowthColor: false,
      previousValue: summary.previousMeanMonthlySurplus,
    },
    {
      label: 'Net Annual Projection',
      value: eurFmt.format(netMonthlyIncome.projected),
      valueClass: 'text-positive',
    },
    {
      label: 'Asset Runway',
      value: runway.months != null ? `${runway.months.toFixed(1)} mo` : '—',
      info: 'Months of expenses covered by assets',
    },
    {
      label: 'Top Expense Category',
      value: categories.topExpense?.name ?? '—',
      info: categories.topExpense ? `${eurFmt.format(categories.topExpense.monthlyMean)}/mo avg` : '',
    },
  ];

  return (
    <div className="card fade-in-up">
      <div className="card-title">
        <Activity size={14} aria-hidden="true" />
        Overview
      </div>

      <div style={{ textAlign: 'center', margin: 'var(--space-4) 0' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Total Net Worth
        </div>
        <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: assets.netWorthEur >= 0 ? 'var(--clr-positive)' : 'var(--clr-negative)' }}>
          {eurFmt.format(assets.netWorthEur)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 'var(--space-4)', marginTop: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--clr-text-muted)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>₿ {assets.totalBtc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
            <span style={{ opacity: 0.7 }}>{eurFmt.format(assets.totalBtcEur)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>₳ {assets.totalAda.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
            <span style={{ opacity: 0.7 }}>{eurFmt.format(assets.totalAdaEur)}</span>
          </div>
          {assets.investedStocks?.map(stock => (
            <div key={stock.ticker} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>{stock.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {stock.ticker}</span>
              <span style={{ opacity: 0.7 }}>{eurFmt.format(stock.balanceEur)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="tax-divider" style={{ marginBottom: 'var(--space-3)' }} aria-hidden="true" />

      {rows.map((r, i) => (
        <div className="tax-row" key={r.label + i}>
          <div className="tax-row-label">
            {r.label}
            {r.info && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-muted)', marginLeft: '8px' }}>
                ({r.info})
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`tax-row-value ${r.valueClass ?? ''}`}>
                {r.value}
              </span>
              {r.growth != null && (
                <span
                  className={`badge ${r.growth > 0
                    ? (r.invertGrowthColor ? 'badge-negative' : 'badge-positive')
                    : r.growth < 0
                      ? (r.invertGrowthColor ? 'badge-positive' : 'badge-negative')
                      : ''
                    }`}
                >
                  {r.growth > 0 ? '▲' : r.growth < 0 ? '▼' : '−'} {Math.abs(r.growth).toFixed(1)}%
                </span>
              )}
            </div>
            {r.growth != null && (
              <div style={{ marginTop: '0' }} >
                <span style={{ fontSize: '11px', color: 'var(--clr-text-muted)' }}>
                  Prev: {eurFmt.format(r.previousValue)}
                </span>
              </div>
            )}

          </div>
        </div>
      ))}
    </div>
  );
}
