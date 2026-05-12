import { Landmark } from 'lucide-react';
import { eurFmt } from './StatCard';

/**
 * Displays the user's total net worth (assets − liabilities) and an itemised
 * list of all accounts with EUR equivalents for non-EUR balances.
 */
export default function AssetOverview({ assets }) {
  const { totalEur, totalLiabilitiesEur, netWorthEur, accounts, liabilities } = assets;

  return (
    <div className="card fade-in-up">
      <div className="card-title">
        <Landmark size={14} aria-hidden="true" />
        Assets &amp; Net Worth
      </div>

      {/* Net worth hero */}
      <div className="net-worth-display">
        <div className="net-worth-label">Total Net Worth</div>
        <div className="net-worth-value">{eurFmt.format(netWorthEur)}</div>
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-secondary)' }}>
          <span>Assets: <strong style={{ color: 'var(--clr-positive)' }}>{eurFmt.format(totalEur)}</strong></span>
          <span>Invested: <strong style={{ color: 'var(--clr-positive)' }}>{eurFmt.format(assets.totalInvestedEur ?? 0)}</strong></span>
          <span>Liabilities: <strong style={{ color: 'var(--clr-negative)' }}>{eurFmt.format(totalLiabilitiesEur)}</strong></span>
        </div>
      </div>

      {/* Asset accounts */}
      {accounts.length > 0 && (
        <>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--clr-text-muted)', marginBottom: 'var(--space-3)' }}>
            Accounts
          </div>
          {accounts.map((acc) => (
            <AccountRow key={acc.id} acc={acc} total={totalEur} />
          ))}
        </>
      )}

      {/* Liabilities */}
      {liabilities.length > 0 && (
        <>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--clr-text-muted)', margin: 'var(--space-4) 0 var(--space-3)' }}>
            Liabilities
          </div>
          {liabilities.map((acc) => (
            <AccountRow key={acc.id} acc={acc} total={totalLiabilitiesEur} isLiability />
          ))}
        </>
      )}
    </div>
  );
}

function AccountRow({ acc, total, isLiability = false }) {
  const showConversion = acc.currency.toUpperCase() !== 'EUR';
  const color = isLiability ? 'var(--clr-negative)' : 'var(--clr-positive)';
  const percentage = total > 0 ? (Math.abs(acc.balanceEur) / total) * 100 : 0;

  return (
    <div className="asset-item">
      <div className="asset-item-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="asset-item-name">{acc.name}</div>
          <span className="badge" style={{ fontSize: '10px', padding: '2px 4px', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)' }}>
            {percentage.toFixed(1)}%
          </span>
        </div>
        <div className="asset-item-meta">
          {acc.type} · {acc.currency}
          {showConversion && ` · Rate: ${acc.exchangeRate.toFixed(4)}`}
        </div>
      </div>
      <div className="asset-item-balance">
        <div className="asset-item-eur" style={{ color }}>
          {eurFmt.format(acc.balanceEur)}
        </div>
        {showConversion && (
          <div className="asset-item-native">
            {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: acc.currency,
              maximumFractionDigits: 2,
            }).format(acc.balance)}
          </div>
        )}
      </div>
    </div>
  );
}
