import React, { useEffect } from 'react';

export function NotificationToast({ notifications = [], onDismiss }) {
  useEffect(() => {
    if (notifications.length === 0) return;
    const timers = notifications.map((toast) => {
      return setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration || 4500);
    });

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [notifications, onDismiss]);

  if (notifications.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" role="region" aria-label="Notifications">
      {notifications.map((toast) => (
        <div key={toast.id} className={`toast-card toast-${toast.type || 'info'}`}>
          <div className="toast-icon">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '✕'}
            {toast.type === 'warning' && '⚠'}
            {(!toast.type || toast.type === 'info') && 'ℹ'}
          </div>
          <div className="toast-content">
            {toast.title && <div className="toast-title">{toast.title}</div>}
            <div className="toast-message">{toast.message}</div>
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default NotificationToast;
