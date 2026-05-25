import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import HistoryModal from './components/HistoryModal';
import Login from './components/Login';
import { fetchStatistics, checkAuthStatus, recalculateStatistics } from './api/client';
import { ChevronRight } from 'lucide-react';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedMetricHistory, setSelectedMetricHistory] = useState(null);

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 1024) {
      setIsSidebarOpen(!isSidebarOpen);
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  const handleDownload = async (format = 'pdf') => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('wmm_token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`/api/report/${format}`, { headers });
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
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Failed to load statistics:', err);
      if (err.response?.status === 401) {
        setIsAuthenticated(false);
      } else {
        setError(err.response?.data?.error ?? err.message ?? 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRecalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await recalculateStatistics();
      setData(stats);
    } catch (err) {
      console.error('Failed to recalculate statistics:', err);
      if (err.response?.status === 401) {
        setIsAuthenticated(false);
      } else {
        setError(err.response?.data?.error ?? err.message ?? 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wmm_token');
    setIsAuthenticated(false);
    setData(null);
  };

  // Check URL token & backend auth requirements on mount
  useEffect(() => {
    const initializeAuth = async () => {
      // 1. Check for token in URL parameter (for Puppeteer / PDF rendering bypass)
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken) {
        localStorage.setItem('wmm_token', urlToken);
        // Clear token from URL to keep address bar clean
        urlParams.delete('token');
        const cleanSearch = urlParams.toString();
        const cleanUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
        window.history.replaceState({}, document.title, cleanUrl);
      }

      // 2. Fetch auth requirement status from backend
      try {
        const isRequired = await checkAuthStatus();
        setIsAuthRequired(isRequired);
        if (isRequired) {
          const storedToken = localStorage.getItem('wmm_token');
          if (!storedToken) {
            setIsAuthenticated(false);
          } else {
            await load();
          }
        } else {
          // Password protection disabled: load statistics straight away
          setIsAuthenticated(true);
          await load();
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
        // Attempt basic fetch if status call fails
        await load();
      } finally {
        setAuthChecking(false);
      }
    };

    initializeAuth();
  }, [load]);

  if (authChecking) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => { setIsAuthenticated(true); load(); }} />;
  }

  return (
    <div className="app">
      <Header
        lastUpdated={data?.meta?.lastUpdated}
        onRefresh={load}
        onRecalculate={handleRecalculate}
        loading={loading}
        onToggleSidebar={handleToggleSidebar}
        isSidebarOpen={isSidebarOpen}
        onLogout={isAuthRequired ? handleLogout : null}
      />

      {isSidebarCollapsed && (
        <button
          className="sidebar-expand-tab"
          onClick={() => setIsSidebarCollapsed(false)}
          aria-label="Expand sidebar"
        >
          <ChevronRight size={18} />
        </button>
      )}

      <div className="layout-container">
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
          onDownload={handleDownload}
          downloading={downloading}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onLogout={isAuthRequired ? handleLogout : null}
          onRefresh={load}
          onRecalculate={handleRecalculate}
          loading={loading}
        />
        <div className={`sidebar-spacer ${isSidebarCollapsed ? 'collapsed' : ''}`} />
        <main className={`main-content ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`} id="main">
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
