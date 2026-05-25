import { useState } from 'react';
import { RefreshCw, FileDown, Menu, LogOut } from 'lucide-react';

const BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || 3001}`;

/**
 * Sticky top header with brand logo, last-updated timestamp, refresh and download buttons.
 */
export default function Header({ lastUpdated, onRefresh, onRecalculate, loading, onToggleSidebar, isSidebarOpen, onLogout }) {
  const formatted = lastUpdated
    ? new Date(lastUpdated).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo" aria-hidden="true">₿</div>
        <h1 className="header-title">WheresMyMoney!</h1>
      </div>

      <div className="header-meta">
        {formatted && (
          <span>Last updated: {formatted}</span>
        )}



        <button
          id="btn-recalculate"
          className="header-refresh-btn"
          onClick={onRecalculate}
          disabled={loading}
          aria-label="Recalculate all statistics"
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          {loading ? 'Recalculating…' : 'Recalculate All'}
        </button>

        <button
          id="btn-refresh"
          className="header-refresh-btn"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh statistics"
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>

        {onLogout && (
          <button
            className="header-refresh-btn logout-btn"
            onClick={onLogout}
            aria-label="Log out"
            style={{ gap: 'var(--space-2)' }}
          >
            <LogOut size={14} />
            Logout
          </button>
        )}

        {!isSidebarOpen && (
          <button
            className="header-refresh-btn hamburger-btn"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
          >
            <Menu size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
