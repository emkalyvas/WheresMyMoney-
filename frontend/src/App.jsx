import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import { fetchStatistics } from './api/client';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      />

      <main className="main-content" id="main">
        {loading && !data && <LoadingState />}
        {error && !data && <ErrorState error={error} onRetry={load} />}
        {data && <Dashboard data={data} />}
      </main>
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
