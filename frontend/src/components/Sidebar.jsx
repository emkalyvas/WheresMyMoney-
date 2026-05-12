import { X, FileDown } from 'lucide-react';

export default function Sidebar({ isOpen, onClose, onDownload, downloading }) {
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

  return (
    <>
      <div 
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`} 
        onClick={onClose} 
        aria-hidden="true" 
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Navigation</h2>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
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
        
        <div className="sidebar-footer" style={{ marginTop: 'auto', padding: 'var(--space-4)' }}>
          <button 
            className="retry-btn" 
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={downloading}
            onClick={() => {
              onDownload();
              if (window.innerWidth <= 1024) onClose();
            }}
          >
            <FileDown size={16} />
            {downloading ? 'Generating…' : 'Download Report'}
          </button>
        </div>
      </aside>
    </>
  );
}
