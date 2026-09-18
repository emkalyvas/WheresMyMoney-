import React from 'react';
import { X, Activity } from 'lucide-react';
import { eurFmt } from './StatCard';

export default function ExchangeRateModal({ asset, onClose }) {
  if (!asset || asset.balance === 0) return null;

  const exchangeRate = asset.balanceEur / asset.balance;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '350px', width: '90%', padding: 'var(--space-5)', backgroundColor: 'var(--clr-bg-base)' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} style={{ color: 'var(--clr-text-main)' }} />
            <h2 className="modal-title" style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>{asset.ticker} Exchange Rate</h2>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-text-muted)', padding: '4px' }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>
        
        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--clr-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span style={{ color: 'var(--clr-text-muted)' }}>Asset</span>
            <span style={{ fontWeight: 600 }}>{asset.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span style={{ color: 'var(--clr-text-muted)' }}>Total Balance</span>
            <span style={{ fontWeight: 600 }}>{asset.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset.ticker}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <span style={{ color: 'var(--clr-text-muted)' }}>Value in EUR</span>
            <span style={{ fontWeight: 600 }}>{eurFmt.format(asset.balanceEur)}</span>
          </div>
          
          <div style={{ borderTop: '1px solid var(--clr-border-light)', paddingTop: 'var(--space-4)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--clr-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Calculated Rate
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--clr-text-main)' }}>
              1 {asset.ticker} = {eurFmt.format(exchangeRate)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
