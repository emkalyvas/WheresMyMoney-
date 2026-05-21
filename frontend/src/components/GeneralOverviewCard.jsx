import { Activity } from 'lucide-react';
import { eurFmt } from './StatCard';

/**
 * General Overview displayed as a list of rows, similar to the Monthly Overview card.
 */
export default function GeneralOverviewCard({ data, onMetricClick }) {
  const { summary, runway, netMonthlyIncome, assets, categories, meta } = data;

  const getGrowth = (current, previous) => {
    if (previous == null || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const allTimeRows = [
    {
      label: 'Mean Monthly Income',
      value: eurFmt.format(summary.meanMonthlyIncome),
      valueClass: 'text-positive',
      info: `Over ${meta.totalMonths} months`,
      growth: getGrowth(summary.meanMonthlyIncome, summary.previousMeanMonthlyIncome),
      invertGrowthColor: false,
      previousValue: summary.previousMeanMonthlyIncome,
      path: 'summary.meanMonthlyIncome',
      format: 'currency',
    },
    {
      label: 'Mean Monthly Expenses',
      value: eurFmt.format(summary.meanMonthlyExpenses),
      valueClass: 'text-negative',
      info: `Over ${meta.totalMonths} months`,
      growth: getGrowth(summary.meanMonthlyExpenses, summary.previousMeanMonthlyExpenses),
      invertGrowthColor: true,
      previousValue: summary.previousMeanMonthlyExpenses,
      path: 'summary.meanMonthlyExpenses',
      format: 'currency',
    },
    {
      label: 'Mean Monthly Surplus',
      value: eurFmt.format(summary.meanMonthlySurplus),
      valueClass: summary.meanMonthlySurplus >= 0 ? 'text-positive' : 'text-negative',
      info: `Savings rate: ${summary.savingsRate.toFixed(1)}%`,
      growth: getGrowth(summary.meanMonthlySurplus, summary.previousMeanMonthlySurplus),
      invertGrowthColor: false,
      previousValue: summary.previousMeanMonthlySurplus,
      path: 'summary.meanMonthlySurplus',
      format: 'currency',
    },
    {
      label: 'Top Expense Category',
      value: categories.topExpense?.name ?? '—',
      info: categories.topExpense ? `${eurFmt.format(categories.topExpense.monthlyMean)}/mo avg` : '',
    },
  ];

  const ninetyDayRows = [
    {
      label: '90-Day Avg Income',
      value: eurFmt.format(summary.rolling90DayIncome),
      valueClass: 'text-positive',
      info: 'Last 90 days',
      path: 'summary.rolling90DayIncome',
      format: 'currency',
    },
    {
      label: '90-Day Avg Expenses',
      value: eurFmt.format(summary.rolling90DayExpenses),
      valueClass: 'text-negative',
      info: 'Last 90 days',
      path: 'summary.rolling90DayExpenses',
      format: 'currency',
    },
    {
      label: '90-Day Avg Surplus',
      value: eurFmt.format(summary.rolling90DaySurplus),
      valueClass: summary.rolling90DaySurplus >= 0 ? 'text-positive' : 'text-negative',
      info: 'Last 90 days',
      path: 'summary.rolling90DaySurplus',
      format: 'currency',
    },
    {
      label: 'Asset Runway',
      value: runway.months != null ? `${runway.months.toFixed(1)} mo` : '—',
      info: 'Based on 90-day avg expenses',
      path: 'runway.months',
      format: 'number',
    },
    {
      label: 'Liquid Runway',
      value: runway.liquidMonths != null ? `${runway.liquidMonths.toFixed(1)} mo` : '—',
      info: 'Months covered by cash only',
      path: 'runway.liquidMonths',
      format: 'number',
    },
    {
      label: 'Top Expense Category',
      value: categories.topExpense90d?.name ?? '—',
      info: categories.topExpense90d ? `${eurFmt.format(categories.topExpense90d.monthlyMean)}/mo avg` : '',
    },
  ];

  const renderRow = (r, i) => (
    <div 
      className={`tax-row ${onMetricClick && r.path ? 'clickable' : ''}`} 
      key={r.label + i}
      onClick={() => {
        if (onMetricClick && r.path) {
          onMetricClick({ path: r.path, label: r.label, format: r.format });
        }
      }}
    >
      <div className="tax-row-label">
        {r.label}
        {r.info && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-muted)', marginLeft: '8px' }}>
            ({r.info})
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
        {r.growth != null && (
          <span
            className={`badge ${r.growth > 0
              ? (r.invertGrowthColor ? 'badge-negative' : 'badge-positive')
              : r.growth < 0
                ? (r.invertGrowthColor ? 'badge-positive' : 'badge-negative')
                : ''
              }`}
            style={{ fontSize: '11px', padding: '4px 6px' }}
          >
            {r.growth > 0 ? '▲' : r.growth < 0 ? '▼' : '−'} {Math.abs(r.growth).toFixed(1)}%
          </span>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span className={`tax-row-value ${r.valueClass ?? ''}`} style={{ lineHeight: 1.2 }}>
            {r.value}
          </span>
          {r.growth != null && (
            <span style={{ fontSize: '10px', color: 'var(--clr-text-muted)', marginTop: '2px' }}>
              Prev: {eurFmt.format(r.previousValue)}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="card fade-in-up">
      <div className="card-title">
        <Activity size={14} aria-hidden="true" />
        Overview
      </div>

      <div 
        style={{ textAlign: 'center', margin: 'var(--space-4) 0', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}
        className={onMetricClick ? 'clickable' : ''}
        onClick={() => onMetricClick && onMetricClick({ path: 'assets.netWorthEur', label: 'Total Net Worth', format: 'currency' })}
      >
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
      
      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--clr-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
        All-Time
      </div>

      {allTimeRows.map(renderRow)}

      <div className="tax-divider" style={{ margin: 'var(--space-4) 0 var(--space-3) 0' }} aria-hidden="true" />
      
      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--clr-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
        Last 90 Days
      </div>

      {ninetyDayRows.map(renderRow)}
    </div>
  );
}
