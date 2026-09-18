import React from 'react';
import { X, Receipt } from 'lucide-react';
import { eurFmt } from './StatCard';

export default function LiabilitiesBreakdownModal({ liabilities, onClose }) {
  if (!liabilities || liabilities.length === 0) return null;

  const sortedLiabilities = [...liabilities].sort((a, b) => Math.abs(b.balanceEur) - Math.abs(a.balanceEur));
  const totalLiabilities = sortedLiabilities.reduce((sum, a) => sum + Math.abs(a.balanceEur), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', padding: 'var(--space-5)', backgroundColor: 'var(--clr-bg-base)' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={20} style={{ color: 'var(--clr-negative)' }} />
            <h2 className="modal-title" style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>Liabilities Breakdown</h2>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-text-muted)', padding: '4px' }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>
        
        <div style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--clr-text-muted)', textAlign: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--clr-bg-elevated)', borderRadius: 'var(--radius-md)' }}>
          Total Liabilities: <strong style={{ color: 'var(--clr-negative)', fontSize: 'var(--font-size-lg)', display: 'block', marginTop: '4px' }}>{eurFmt.format(-totalLiabilities)}</strong>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
          {sortedLiabilities.map(acc => (
            <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--clr-bg-surface)', border: '1px solid var(--clr-border-light)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 500 }}>{acc.name}</span>
                {acc.currency !== 'EUR' && (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-muted)' }}>
                    {acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {acc.currency}
                  </span>
                )}
              </div>
              <div style={{ fontWeight: 600, color: 'var(--clr-negative)' }}>
                {eurFmt.format(-Math.abs(acc.balanceEur))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
