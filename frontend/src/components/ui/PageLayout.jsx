import React from 'react';
import './ui.css';

export default function PageLayout({
  title,
  subtitle,
  breadcrumbs = null,
  actions = null,
  children,
  className = '',
}) {
  return (
    <div className={`ro-page-layout ${className}`}>
      {breadcrumbs && <div style={{ marginBottom: '12px' }}>{breadcrumbs}</div>}

      {(title || actions) && (
        <header className="ro-page-header">
          <div className="ro-page-title-group">
            {title && <h1 className="ro-page-title">{title}</h1>}
            {subtitle && <p className="ro-page-subtitle">{subtitle}</p>}
          </div>

          {actions && <div className="ro-page-actions">{actions}</div>}
        </header>
      )}

      <main>{children}</main>
    </div>
  );
}

