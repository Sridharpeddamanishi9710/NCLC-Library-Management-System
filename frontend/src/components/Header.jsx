import React from 'react';

const SYSTEM_DATE = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
}).format(new Date());

export function Header({
  title,
  subtitle,
  health,
  isRefreshing,
  onRefresh,
  onOpenSidebar,
}) {
  const currentDate = SYSTEM_DATE;

  const isConnected = health && health.status === 'UP';

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={onOpenSidebar}
          aria-label="Open navigation menu"
        >
          ☰
        </button>
        <div className="header-title-wrap">
          <h1 className="header-title">{title}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="header-right">
        <div className="header-meta">
          <span className="current-date" title="System Date">
            📅 {currentDate}
          </span>
          <div
            className={`connection-pill ${isConnected ? 'pill-connected' : 'pill-disconnected'}`}
            title={isConnected ? `Connected to MySQL: ${health.database?.database}` : 'Backend Disconnected'}
          >
            <span className="pill-dot"></span>
            <span className="pill-text">
              {isConnected ? `MySQL: ${health.database?.database || 'UP'}` : 'Offline'}
            </span>
          </div>
        </div>

        <button
          type="button"
          className={`btn-icon-refresh ${isRefreshing ? 'spinning' : ''}`}
          onClick={onRefresh}
          title="Refresh All Data"
          disabled={isRefreshing}
          aria-label="Refresh Data"
        >
          🔄
        </button>
      </div>
    </header>
  );
}

export default Header;
