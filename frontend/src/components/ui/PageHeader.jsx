import React from 'react';
import { Building2 } from 'lucide-react';
import './ui.css';

export default function PageHeader({
  title,
  subtitle,
  projectName,
  actions,
  className = '',
}) {
  return (
    <header className={`ro-page-header${className ? ` ${className}` : ''}`}>
      <div className="ro-page-header__main">
        <h1 className="ro-page-header__title">{title}</h1>
        {subtitle ? <p className="ro-page-header__subtitle">{subtitle}</p> : null}
        {projectName ? (
          <div className="ro-page-header__context" title="Active project">
            <Building2 size={12} aria-hidden />
            {projectName}
          </div>
        ) : null}
      </div>
      {actions ? <div className="ro-page-header__actions">{actions}</div> : null}
    </header>
  );
}
