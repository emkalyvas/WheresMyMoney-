import { useState } from 'react';
import { RefreshCw, FileDown, Menu } from 'lucide-react';

const BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || 3001}`;

/**
 * Sticky top header with brand logo, last-updated timestamp, refresh and download buttons.
 */
export default function Header({ lastUpdated, onRefresh, loading, onToggleSidebar, isSidebarOpen }) {
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
          id="btn-refresh"
          className="header-refresh-btn"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh statistics"
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>

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
