import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
export default function CategoryBreakdown({ expenses, income, onMetricClick, expensePathKey = "expenses", incomePathKey = "income", calculationMethod = 'mean' }) {
  return (
    <div className="two-col">
      <CategoryList
        title="Expenses by Category"
        id="expense-categories"
        items={expenses}
        colors={EXPENSE_COLORS}
        invertGrowthColor={true}
        onMetricClick={onMetricClick}
        type={expensePathKey}
        calculationMethod={calculationMethod}
      />
      <CategoryList
        title="Income by Category"
        id="income-categories"
        items={income}
        colors={INCOME_COLORS}
        invertGrowthColor={false}
        onMetricClick={onMetricClick}
        type={incomePathKey}
        calculationMethod={calculationMethod}
      />
    </div>
  );
}

function CategoryList({ title, id, items, colors, invertGrowthColor, onMetricClick, type, calculationMethod }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isMedian = calculationMethod === 'median';

  if (!items?.length) {
    return (
      <div className="card fade-in-up">
        <div className="card-title">{title}</div>
        <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>No data available.</p>
      </div>
    );
  }

  const max = Math.max(...items.map((i) => isMedian && i.monthlyMedian !== undefined ? i.monthlyMedian : i.monthlyMean));

  const getGrowth = (current, previous) => {
    if (previous == null || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const sortedItems = [...items].sort((a, b) => {
    const aValue = isMedian && a.monthlyMedian !== undefined ? a.monthlyMedian : a.monthlyMean;
    const bValue = isMedian && b.monthlyMedian !== undefined ? b.monthlyMedian : b.monthlyMean;
    return bValue - aValue;
  });

  const displayedItems = isExpanded ? sortedItems : sortedItems.slice(0, 10);

  return (
    <div className="card fade-in-up" id={id}>
      <div className="card-title">{title}</div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-muted)', marginBottom: 'var(--space-4)' }}>
        {isMedian ? 'Median' : 'Mean'} per month · sorted by {isMedian ? 'median' : 'mean'}
      </div>

      {displayedItems.map((item, i) => {
        const currentValue = isMedian && item.monthlyMedian !== undefined ? item.monthlyMedian : item.monthlyMean;
        const previousValue = isMedian && item.previousMonthlyMedian !== undefined ? item.previousMonthlyMedian : item.previousMonthlyMean;
        const growth = getGrowth(currentValue, previousValue);
        const currentPath = isMedian && item.monthlyMedian !== undefined ? 'monthlyMedian' : 'monthlyMean';

        return (
          <div 
            className={`category-item ${onMetricClick ? 'clickable' : ''}`} 
            key={item.name}
            onClick={() => onMetricClick && onMetricClick({ path: `categories.${type}[?(@.name=="${item.name}")].${currentPath}`, label: `${item.name} (${type})`, format: 'currency' })}
            style={onMetricClick ? { padding: 'var(--space-3)', margin: '0 calc(var(--space-3) * -1)', borderRadius: 'var(--radius-sm)', transition: 'background var(--transition-fast)' } : {}}
            onMouseEnter={(e) => onMetricClick && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
            onMouseLeave={(e) => onMetricClick && (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
              <span className="category-name" title={item.name}>{item.name}</span>
            </div>

            <div className="category-bar-track" aria-hidden="true">
              <div
                className="category-bar-fill"
                style={{
                  width: max > 0 ? `${(currentValue / max) * 100}%` : '0%',
                  background: colors[i % colors.length],
                  opacity: 0.85,
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              {growth != null && (
                <span 
                  className={`badge ${
                    growth > 0 
                      ? (invertGrowthColor ? 'badge-negative' : 'badge-positive') 
                      : growth < 0
                        ? (invertGrowthColor ? 'badge-positive' : 'badge-negative')
                        : ''
                  }`}
                  style={{ fontSize: '11px', padding: '4px 6px' }}
                >
                  {growth > 0 ? '▲' : growth < 0 ? '▼' : '−'} {Math.abs(growth).toFixed(1)}%
                </span>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span className="category-value" style={{ color: 'var(--clr-text-primary)', lineHeight: 1.2 }}>
                  {eurFmt.format(currentValue)}
                </span>
                {growth != null && (
                  <span style={{ fontSize: '10px', color: 'var(--clr-text-muted)', marginTop: '2px' }}>
                    Prev: {eurFmt.format(previousValue)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {items.length > 10 && (
        <button
          className="header-refresh-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            width: '100%',
            marginTop: 'var(--space-4)',
            justifyContent: 'center',
            background: 'var(--clr-glass-bg)',
            border: '1px solid var(--clr-glass-border)',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--clr-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--clr-glass-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--clr-glass-bg)')}
        >
          {isExpanded ? (
            <>
              <ChevronUp size={16} />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown size={16} />
              Show {items.length - 10} More
            </>
          )}
        </button>
      )}
    </div>
  );
}
