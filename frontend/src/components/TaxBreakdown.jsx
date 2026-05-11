import { Info } from 'lucide-react';
import { eurFmt } from './StatCard';

/**
 * Detailed tax breakdown card.
 * Renders the full tax computation step-by-step with clear labels,
 * and shows both the "without advance" and "with advance" totals.
 */
export default function TaxBreakdown({ tax, netMonthlyIncome, config: cfg }) {
  const {
    grossRevenue,
    companyExpenses,
    netTaxableProfit,
    corporateIncomeTax,
    businessTax,
    advanceTax,
    expectedTax,
    effectiveTaxRate,
  } = tax;

  const rows = [
    {
      label: 'Gross Company Revenue',
      value: eurFmt.format(grossRevenue),
      info: 'All MnApps-tagged income for the current year',
    },
    {
      label: 'Total Company Expenses',
      value: `− ${eurFmt.format(companyExpenses)}`,
      info: 'All MnApps-tagged withdrawals for the current year',
      valueClass: 'text-negative',
    },
    {
      label: 'Net Taxable Profit',
      value: eurFmt.format(netTaxableProfit),
      info: 'Revenue − Expenses (floored at €0)',
      bold: true,
    },
  ];

  const taxRows = [
    {
      label: `Corporate Income Tax (CIT) × ${(cfg.incomeTaxRate * 100).toFixed(0)}%`,
      value: eurFmt.format(corporateIncomeTax),
      valueClass: 'text-warning',
    },
    {
      label: `Business Tax (Telos Epitidevmatos)`,
      value: `+ ${eurFmt.format(businessTax)}`,
      info: 'Flat annual fee',
      valueClass: 'text-warning',
    },
    {
      label: `Advance Tax (Prokatavoli) × ${(cfg.advanceTaxRate * 100).toFixed(0)}% of CIT`,
      value: `+ ${eurFmt.format(advanceTax)}`,
      info: 'Prepayment towards next year',
      valueClass: 'text-negative',
    },
  ];

  if (tax.previousAdvanceTax > 0) {
    taxRows.push({
      label: `Minus Previous Advance Tax`,
      value: `− ${eurFmt.format(tax.previousAdvanceTax)}`,
      info: 'Prepaid tax from the previous year',
      valueClass: 'text-positive',
    });
  }

  return (
    <div className="card fade-in-up">
      <div className="card-title">
        <Info size={14} aria-hidden="true" />
        Tax Calculation Breakdown — {new Date().getFullYear()}
      </div>

      {/* Step 1: profit calculation */}
      {rows.map((r) => (
        <div className="tax-row" key={r.label}>
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

      {/* Step 2: tax components */}
      {taxRows.map((r) => (
        <div className="tax-row" key={r.label}>
          <span className="tax-row-label" title={r.info}>
            {r.label}
          </span>
          <span className={`tax-row-value ${r.valueClass ?? ''}`}>{r.value}</span>
        </div>
      ))}

      <div className="tax-divider" aria-hidden="true" />

      {/* Totals */}
      <div className="tax-total-row danger">
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
            Expected Tax Total
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-secondary)', marginTop: 2 }}>
            CIT + Business Tax + Advance Tax · Effective rate: {effectiveTaxRate.toFixed(1)}%
          </div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 'var(--font-size-xl)', color: 'var(--clr-negative)' }}>
          {eurFmt.format(expectedTax)}
        </div>
      </div>

      {/* Net monthly income derived values */}
      <div className="tax-divider" style={{ marginTop: 'var(--space-4)' }} aria-hidden="true" />
      <div style={{ marginTop: 'var(--space-4)' }}>
        <div className="card-title" style={{ marginBottom: 'var(--space-3)' }}>
          Net Income Projection (Month {netMonthlyIncome.currentMonth})
        </div>
        <div className="tax-row">
          <span className="tax-row-label">After Expected Tax (Annualized)</span>
          <span className="tax-row-value text-positive">
            {eurFmt.format(netMonthlyIncome.projected)}
          </span>
        </div>
        <div className="tax-row">
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
