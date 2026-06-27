import { useState, useEffect, useRef } from 'react';
import { X, FileDown, ChevronUp, LogOut, RefreshCw } from 'lucide-react';

export default function Sidebar({ isOpen, onClose, onDownload, downloading, isCollapsed, onToggleCollapse, onLogout, onRefresh, onRecalculate, loading, calculationMethod, onCalculationMethodChange }) {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowDownloadMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'monthly-overview', label: 'Monthly Overview' },
    { id: 'monthly-trend', label: 'Monthly Trend' },
    { id: 'tax-calculation', label: 'Tax Calculation' },
    { id: 'category-breakdown', label: 'Category Breakdown' },
    { id: 'assets-liabilities', label: 'Assets & Liabilities' },
    { id: 'future-projections', label: 'Future Projections' },
  ];

  const handleLinkClick = () => {
    // On mobile, close sidebar after clicking
    if (window.innerWidth <= 1024) {
      onClose();
    }
  };

  const triggerDownload = (format) => {
    onDownload(format);
    setShowDownloadMenu(false);
    if (window.innerWidth <= 1024) onClose();
  };

  return (
    <>
      <div 
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`} 
        onClick={onClose} 
        aria-hidden="true" 
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <h2>Navigation</h2>
          <button 
            className="sidebar-close-btn" 
            onClick={() => {
              if (window.innerWidth <= 1024) {
                onClose();
              } else {
                onToggleCollapse();
              }
            }} 
            aria-label={window.innerWidth <= 1024 ? "Close menu" : "Collapse sidebar"}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {sections.map(section => (
            <a 
              key={section.id} 
              href={`#${section.id}`} 
              className="sidebar-link"
              onClick={handleLinkClick}
            >
              {section.label}
            </a>
          ))}
        </nav>
        
        <div className="sidebar-footer" style={{ marginTop: 'auto', padding: 'var(--space-4)', position: 'relative', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }} ref={menuRef}>
          <div style={{
            display: 'flex',
            background: 'var(--clr-surface)',
            border: '1px solid var(--clr-border)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            marginBottom: '8px',
          }}>
            <button
              style={{
                flex: 1,
                padding: '8px 0',
                background: calculationMethod === 'mean' ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none',
                color: calculationMethod === 'mean' ? 'var(--clr-text)' : 'var(--clr-text-muted)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: calculationMethod === 'mean' ? 600 : 400,
                transition: 'all 0.2s',
              }}
              onClick={() => onCalculationMethodChange('mean')}
            >
              Mean
            </button>
            <button
              style={{
                flex: 1,
                padding: '8px 0',
                background: calculationMethod === 'median' ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none',
                color: calculationMethod === 'median' ? 'var(--clr-text)' : 'var(--clr-text-muted)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: calculationMethod === 'median' ? 600 : 400,
                transition: 'all 0.2s',
              }}
              onClick={() => onCalculationMethodChange('median')}
            >
              Median
            </button>
          </div>

          {showDownloadMenu && !downloading && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 'var(--space-4)',
              right: 'var(--space-4)',
              marginBottom: '8px',
              background: 'var(--clr-surface)',
              border: '1px solid var(--clr-border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 10,
            }}>
              <button 
                onClick={() => triggerDownload('pdf')}
                style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--clr-text)', textAlign: 'left', cursor: 'pointer', fontSize: '14px', transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                Download PDF
              </button>
              <button 
                onClick={() => triggerDownload('html')}
                style={{ padding: '12px 16px', background: 'none', border: 'none', color: 'var(--clr-text)', textAlign: 'left', cursor: 'pointer', fontSize: '14px', transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                Download HTML
              </button>
            </div>
          )}
          <button 
            className="retry-btn" 
            style={{ width: '100%', justifyContent: 'space-between', padding: '10px 16px' }}
            disabled={downloading}
            onClick={() => {
              if (downloading) return;
              setShowDownloadMenu(!showDownloadMenu);
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileDown size={16} />
              {downloading ? 'Generating…' : 'Download Report'}
            </span>
            <ChevronUp size={16} style={{ transition: 'transform 0.2s', transform: showDownloadMenu ? 'rotate(180deg)' : 'none' }} />
          </button>
          
          <button 
            className="retry-btn sidebar-mobile-btn" 
            style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', marginBottom: '8px' }}
            disabled={loading}
            onClick={() => {
              if (loading) return;
              if (onRefresh) onRefresh();
              if (window.innerWidth <= 1024) onClose();
            }}
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          <button 
            className="retry-btn sidebar-mobile-btn" 
            style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', marginBottom: '8px', background: 'var(--clr-accent-purple)' }}
            disabled={loading}
            onClick={() => {
              if (loading) return;
              if (onRecalculate) onRecalculate();
              if (window.innerWidth <= 1024) onClose();
            }}
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            {loading ? 'Recalculating…' : 'Recalculate All'}
          </button>

          {onLogout && (
            <button 
              className="retry-btn sidebar-logout-btn" 
              style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--clr-negative)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              onClick={onLogout}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LogOut size={16} />
                Logout
              </span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
