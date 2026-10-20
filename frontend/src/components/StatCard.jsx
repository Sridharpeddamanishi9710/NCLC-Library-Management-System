import React from 'react';

export function StatCard({ title, value, subtitle, icon, variant = 'primary', onClick }) {
  return (
    <div
      className={`stat-card stat-${variant} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="stat-header">
        <span className="stat-title">{title}</span>
        {icon && <span className="stat-icon" aria-hidden="true">{icon}</span>}
      </div>
      <div className="stat-value">{value !== undefined && value !== null ? value : '—'}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
    </div>
  );
}

export default StatCard;
