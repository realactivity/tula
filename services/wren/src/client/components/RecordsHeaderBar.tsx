import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

type RecordsSection = 'records' | 'browser' | 'redaction' | 'about';

function linkClass(active: boolean): string {
  return active ? 'records-nav-link active' : 'records-nav-link';
}

export default function RecordsHeaderBar({ current }: { current: RecordsSection }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const onNavigate = () => {
    setMenuOpen(false);
  };

  return (
    <div className="records-nav-wrap">
      <div className="records-nav" role="navigation" aria-label="Records section navigation">
        <div className="records-nav-main">
          <div className="records-nav-brand">Wren</div>
          <button
            type="button"
            className="records-nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="records-nav-links"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        <div id="records-nav-links" className={`records-nav-links${menuOpen ? ' open' : ''}`}>
          <Link to="/records" className={linkClass(current === 'records')} onClick={onNavigate}>My Records</Link>
          <Link to="/records/browser" className={linkClass(current === 'browser')} onClick={onNavigate}>Browse</Link>
          <Link to="/records/redaction" className={linkClass(current === 'redaction')} onClick={onNavigate}>Redaction</Link>
          <Link to="/" className={linkClass(current === 'about')} onClick={onNavigate}>About</Link>
        </div>
      </div>
    </div>
  );
}
