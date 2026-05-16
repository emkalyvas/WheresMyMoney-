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
export default function CategoryBreakdown({ expenses, income, onMetricClick }) {
  return (
    <div className="two-col">
      <CategoryList
        title="Expenses by Category"
        id="expense-categories"
        items={expenses}
        colors={EXPENSE_COLORS}
        invertGrowthColor={true}
        onMetricClick={onMetricClick}
        type="expenses"
      />
      <CategoryList
        title="Income by Category"
        id="income-categories"
        items={income}
        colors={INCOME_COLORS}
        invertGrowthColor={false}
        onMetricClick={onMetricClick}
        type="income"
      />
    </div>
  );
}

function CategoryList({ title, id, items, colors, invertGrowthColor, onMetricClick, type }) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const displayedItems = isExpanded ? items : items.slice(0, 10);

  return (
    <div className="card fade-in-up" id={id}>
      <div className="card-title">{title}</div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-muted)', marginBottom: 'var(--space-4)' }}>
        Mean per month · sorted by total
      </div>

      {displayedItems.map((item, i) => {
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
          <div 
            className={`category-item ${onMetricClick ? 'clickable' : ''}`} 
            key={item.name}
            onClick={() => onMetricClick && onMetricClick({ path: `categories.${type}[?(@.name=="${item.name}")].monthlyMean`, label: `${item.name} (${type})`, format: 'currency' })}
            style={onMetricClick ? { padding: 'var(--space-3)', margin: '0 calc(var(--space-3) * -1)', borderRadius: 'var(--radius-sm)', transition: 'background var(--transition-fast)' } : {}}
            onMouseEnter={(e) => onMetricClick && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
            onMouseLeave={(e) => onMetricClick && (e.currentTarget.style.background = 'transparent')}
          >
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
                  {eurFmt.format(item.monthlyMean)}
                </span>
                {growth != null && (
                  <span style={{ fontSize: '10px', color: 'var(--clr-text-muted)', marginTop: '2px' }}>
                    Prev: {eurFmt.format(item.previousMonthlyMean)}
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
