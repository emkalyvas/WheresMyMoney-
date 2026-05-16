import { Info } from 'lucide-react';
import { eurFmt } from './StatCard';

/**
 * Detailed tax breakdown card.
 * Renders the full tax computation step-by-step with clear labels,
 * and shows both the "without advance" and "with advance" totals.
 */
export default function TaxBreakdown({ tax, netMonthlyIncome, onMetricClick }) {
  const {
    description,
    grossRevenue,
    companyExpenses,
    netTaxableProfit,
    expectedTaxTotal,
    effectiveTaxRate,
    breakdown
  } = tax;

  const rows = [
    {
      label: 'Gross Company Revenue',
      value: eurFmt.format(grossRevenue),
      info: 'All company-tagged income for the current year',
      path: 'tax.grossRevenue',
    },
    {
      label: 'Total Company Expenses',
      value: `− ${eurFmt.format(companyExpenses)}`,
      info: 'All company-tagged withdrawals for the current year',
      valueClass: 'text-negative',
      path: 'tax.companyExpenses',
    },
    {
      label: 'Net Taxable Profit',
      value: eurFmt.format(netTaxableProfit),
      info: 'Revenue − Expenses (floored at €0)',
      bold: true,
      path: 'tax.netTaxableProfit',
    },
  ];

  return (
    <div className="card fade-in-up">
      <div className="card-title">
        <Info size={14} aria-hidden="true" />
        Tax Calculation Breakdown — {new Date().getFullYear()}
      </div>
      
      {description && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-muted)', marginBottom: 'var(--space-4)', fontStyle: 'italic' }}>
          {description}
        </div>
      )}

      {/* Step 1: profit calculation */}
      {rows.map((r) => (
        <div 
          className={`tax-row ${onMetricClick ? 'clickable' : ''}`} 
          key={r.label}
          onClick={() => onMetricClick && onMetricClick({ path: r.path, label: r.label, format: 'currency' })}
        >
          <span className="tax-row-label" title={r.info}>
            {r.label}
          </span>
          <span
            className={`tax-row-value ${r.valueClass ?? ''} ${r.bold ? 'text-accent' : ''}`}
            style={r.bold ? { fontSize: 'var(--font-size-base)' } : {}}
          >
            {r.value}
          </span>
        </div>
      ))}

      <div className="tax-divider" aria-hidden="true" />

      {/* Step 2: Dynamic tax components */}
      {breakdown && breakdown.map((r) => (
        <div 
          className={`tax-row ${onMetricClick && r.path ? 'clickable' : ''}`} 
          key={r.label}
          onClick={() => onMetricClick && r.path && onMetricClick({ path: r.path, label: r.label.split(' ×')[0], format: 'currency' })}
        >
          <span className="tax-row-label" title={r.info}>
            {r.label}
          </span>
          <span className={`tax-row-value text-${r.type ?? ''}`}>
            {r.value < 0 ? `− ` : r.value > 0 && !r.label.includes('Taxable') ? `+ ` : ''}
            {eurFmt.format(Math.abs(r.value))}
          </span>
        </div>
      ))}

      <div className="tax-divider" aria-hidden="true" />

      {/* Totals */}
      <div 
        className={`tax-total-row danger ${onMetricClick ? 'clickable' : ''}`}
        onClick={() => onMetricClick && onMetricClick({ path: 'tax.expectedTaxTotal', label: 'Expected Tax Total', format: 'currency' })}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
            Expected Tax Total
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-secondary)', marginTop: 2 }}>
            Effective rate: {effectiveTaxRate.toFixed(1)}%
          </div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 'var(--font-size-xl)', color: 'var(--clr-negative)' }}>
          {eurFmt.format(expectedTaxTotal)}
        </div>
      </div>

      {/* Net monthly income derived values */}
      <div className="tax-divider" style={{ marginTop: 'var(--space-4)' }} aria-hidden="true" />
      <div style={{ marginTop: 'var(--space-4)' }}>
        <div className="card-title" style={{ marginBottom: 'var(--space-3)' }}>
          Net Income Projection (Month {netMonthlyIncome.currentMonth})
        </div>
        <div 
          className={`tax-row ${onMetricClick ? 'clickable' : ''}`}
          onClick={() => onMetricClick && onMetricClick({ path: 'netMonthlyIncome.projected', label: 'Net Annual Income Projection', format: 'currency' })}
        >
          <span className="tax-row-label">After Expected Tax (Annualized)</span>
          <span className="tax-row-value text-positive">
            {eurFmt.format(netMonthlyIncome.projected)}
          </span>
        </div>
        <div 
          className={`tax-row ${onMetricClick ? 'clickable' : ''}`}
          onClick={() => onMetricClick && onMetricClick({ path: 'netMonthlyIncome.monthly', label: 'Net Monthly Income Projection', format: 'currency' })}
        >
          <span className="tax-row-label">After Expected Tax (Monthly)</span>
          <span className="tax-row-value text-positive" style={{ opacity: 0.8 }}>
            {eurFmt.format(netMonthlyIncome.monthly)}
          </span>
        </div>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-muted)', marginTop: 'var(--space-3)' }}>
          Formula: (Net Taxable Profit − Expected Tax Total) ÷ days passed in year × total days in year
        </p>
      </div>
    </div>
  );
}
