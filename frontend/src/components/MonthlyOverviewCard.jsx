import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { eurFmt } from './StatCard';

/**
 * Monthly Overview displayed as a list of rows, similar to the TaxBreakdown card.
 * Allows navigating through months using arrows.
 */
export default function MonthlyOverviewCard({ data }) {
  const { monthlyData } = data;
  const [currentIndex, setCurrentIndex] = useState(monthlyData.length - 1);

  if (!monthlyData || monthlyData.length === 0) {
    return null;
  }

  const currentMonthData = monthlyData[currentIndex];

  const formattedMonthName = (() => {
    if (!currentMonthData?.month) return '';
    const [year, month] = currentMonthData.month.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  })();

  const currentMonthRows = [
    {
      label: 'Income',
      value: eurFmt.format(currentMonthData.income),
      valueClass: 'text-positive',
    },
    {
      label: 'Expenses',
      value: eurFmt.format(currentMonthData.expenses),
      valueClass: 'text-negative',
    },
    {
      label: 'Surplus',
      value: eurFmt.format(currentMonthData.surplus),
      valueClass: currentMonthData.surplus >= 0 ? 'text-positive' : 'text-negative',
    },
  ];

  return (
    <div className="card fade-in-up">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <Calendar size={14} aria-hidden="true" style={{ marginRight: '8px' }} />

        {currentIndex > 0 && (
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--clr-text)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 4px',
            }}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        <span style={{ margin: '0 4px' }}>{formattedMonthName} Overview</span>

        {currentIndex < monthlyData.length - 1 && (
          <button
            onClick={() => setCurrentIndex((i) => Math.min(monthlyData.length - 1, i + 1))}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--clr-text)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 4px',
            }}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      {currentMonthRows.map((r, i) => (
        <div className="tax-row" key={r.label + i}>
          <div className="tax-row-label">
            {r.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className={`tax-row-value ${r.valueClass ?? ''}`}>
              {r.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
