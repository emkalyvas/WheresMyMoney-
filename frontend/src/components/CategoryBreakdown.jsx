import { eurFmt } from './StatCard';

const EXPENSE_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#06b6d4', '#3b82f6',
  '#8b5cf6', '#ec4899',
];

const INCOME_COLORS = [
  '#3b82f6', '#06b6d4', '#10b981', '#22c55e',
  '#8b5cf6', '#f59e0b', '#ec4899',
];

/**
 * Horizontal category bars for expenses and income.
 * Shows the mean monthly amount per category as a proportional bar.
 *
 * Props:
 *  - expenses: array of { name, monthlyMean, total, transactionCount }
 *  - income:   same shape
 */
export default function CategoryBreakdown({ expenses, income }) {
  return (
    <div className="two-col">
      <CategoryList
        title="Expenses by Category"
        id="expense-categories"
        items={expenses}
        colors={EXPENSE_COLORS}
        invertGrowthColor={true}
      />
      <CategoryList
        title="Income by Category"
        id="income-categories"
        items={income}
        colors={INCOME_COLORS}
        invertGrowthColor={false}
      />
    </div>
  );
}

function CategoryList({ title, id, items, colors, invertGrowthColor }) {
  if (!items?.length) {
    return (
      <div className="card fade-in-up">
        <div className="card-title">{title}</div>
        <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>No data available.</p>
      </div>
    );
  }

  const max = Math.max(...items.map((i) => i.monthlyMean));

  const getGrowth = (current, previous) => {
    if (previous == null || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  return (
    <div className="card fade-in-up" id={id}>
      <div className="card-title">{title}</div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-muted)', marginBottom: 'var(--space-4)' }}>
        Mean per month · sorted by total
      </div>

      {items.slice(0, 10).map((item, i) => {
        const growth = getGrowth(item.monthlyMean, item.previousMonthlyMean);
        
        let rankIndicator = null;
        if (item.rankChange != null) {
          if (item.rankChange > 0) rankIndicator = <span style={{ color: 'var(--clr-positive)', marginLeft: 4 }}>▲{item.rankChange}</span>;
          else if (item.rankChange < 0) rankIndicator = <span style={{ color: 'var(--clr-negative)', marginLeft: 4 }}>▼{Math.abs(item.rankChange)}</span>;
          else rankIndicator = <span style={{ color: 'var(--clr-text-muted)', marginLeft: 4 }}>=</span>;
        } else if (item.monthlyMean > 0 && !item.previousMonthlyMean) {
          rankIndicator = <span style={{ color: 'var(--clr-positive)', marginLeft: 4 }}>NEW</span>;
        }

        return (
          <div className="category-item" key={item.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
              <span className="category-name" title={item.name}>{item.name}</span>
              <span style={{ fontSize: '10px', flexShrink: 0 }}>{rankIndicator}</span>
            </div>

            <div className="category-bar-track" aria-hidden="true">
              <div
                className="category-bar-fill"
                style={{
                  width: max > 0 ? `${(item.monthlyMean / max) * 100}%` : '0%',
                  background: colors[i % colors.length],
                  opacity: 0.85,
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
              {growth != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--clr-text-muted)' }}>
                    Prev: {eurFmt.format(item.previousMonthlyMean)}
                  </span>
                  <span 
                    className={`badge ${
                      growth > 0 
                        ? (invertGrowthColor ? 'badge-negative' : 'badge-positive') 
                        : growth < 0
                          ? (invertGrowthColor ? 'badge-positive' : 'badge-negative')
                          : ''
                    }`}
                    style={{ fontSize: '10px', padding: '2px 4px' }}
                  >
                    {growth > 0 ? '▲' : growth < 0 ? '▼' : '−'} {Math.abs(growth).toFixed(1)}%
                  </span>
                </div>
              )}
              <span className="category-value" style={{ color: 'var(--clr-text-primary)' }}>
                {eurFmt.format(item.monthlyMean)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
