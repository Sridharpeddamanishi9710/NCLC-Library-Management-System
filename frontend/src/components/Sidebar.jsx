import React from 'react';

export function Sidebar({ currentTab, onSelectTab, overdueCount = 0, isOpen, onClose }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'books', label: 'Book Catalog', icon: '📚' },
    { id: 'members', label: 'Member Directory', icon: '👥' },
    { id: 'loans', label: 'Circulation & Loans', icon: '🔄' },
    {
      id: 'fines',
      label: 'Overdue & Fines',
      icon: '⚠️',
      badge: overdueCount > 0 ? overdueCount : null,
      badgeColor: 'badge-danger',
    },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">📖</div>
          <div className="brand-text">
            <h2>NCLC Library</h2>
            <span>Management System</span>
          </div>
          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul>
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onSelectTab(item.id);
                      if (onClose) onClose();
                    }}
                  >
                    <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    {item.badge !== null && item.badge !== undefined && (
                      <span className={`nav-badge ${item.badgeColor || ''}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="engine-badge">
            <span className="status-dot-pulse"></span>
            <span>MySQL 8.0 Engine</span>
          </div>
          <div className="version-tag">NCLC-2 • v1.0.0</div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
