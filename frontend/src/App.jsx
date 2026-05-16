import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import HistoryModal from './components/HistoryModal';
import { fetchStatistics } from './api/client';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedMetricHistory, setSelectedMetricHistory] = useState(null);

  const handleDownload = async (format = 'pdf') => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/report/${format}`);
      if (!response.ok) throw new Error(`Failed to generate ${format.toUpperCase()}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      a.href = url;
      const extension = format === 'pdf' ? 'pdf' : 'html';
      a.download = `WheresMyMoney_Report_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert(`Failed to generate ${format.toUpperCase()} report. Please check that the backend is running.`);
    } finally {
      setDownloading(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await fetchStatistics();
      setData(stats);
    } catch (err) {
      console.error('Failed to load statistics:', err);
      setError(err.response?.data?.error ?? err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load once on mount
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="app">
      <Header
        lastUpdated={data?.meta?.lastUpdated}
        onRefresh={load}
        loading={loading}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="layout-container">
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
          onDownload={handleDownload}
          downloading={downloading}
        />
        <main className="main-content" id="main">
          {loading && !data && <LoadingState />}
          {error && !data && <ErrorState error={error} onRetry={load} />}
          {data && <Dashboard data={data} onMetricClick={setSelectedMetricHistory} />}
        </main>
      </div>

      {selectedMetricHistory && (
        <HistoryModal 
          metric={selectedMetricHistory} 
          onClose={() => setSelectedMetricHistory(null)} 
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-container" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p className="loading-text">Fetching your financial data from Firefly III…</p>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="error-container" role="alert">
      <div style={{ fontSize: '3rem' }} aria-hidden="true">⚠️</div>
      <h2 className="error-title">Could not load data</h2>
      <p className="error-message">
        {error}
        <br /><br />
        Make sure the backend is running and can reach your Firefly III instance at the configured URL.
      </p>
      <button id="btn-retry" className="retry-btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
