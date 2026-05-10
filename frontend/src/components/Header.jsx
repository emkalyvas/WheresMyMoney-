import { useState } from 'react';
import { RefreshCw, FileDown } from 'lucide-react';

const BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || 3001}`;

/**
 * Sticky top header with brand logo, last-updated timestamp, refresh and download buttons.
 */
export default function Header({ lastUpdated, onRefresh, loading }) {
  const formatted = lastUpdated
    ? new Date(lastUpdated).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/report/pdf`);
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      a.href = url;
      a.download = `WheresMyMoney_Report_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to generate PDF report. Please check that the backend is running.');
    } finally {
      setDownloading(false);
    }
  };

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
          id="btn-download"
          className="header-refresh-btn"
          onClick={handleDownload}
          disabled={downloading}
          aria-label="Download PDF report"
        >
          <FileDown size={14} />
          {downloading ? 'Generating…' : 'Download Report'}
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
      </div>
    </header>
  );
}
