import React from 'react';
import { Inbox } from 'lucide-react';
import './ui.css';

export default function EmptyState({
  icon,
  title = 'Nothing here yet',
  description,
  action,
  className = '',
}) {
  return (
    <div className={`ro-empty${className ? ` ${className}` : ''}`} role="status">
      <div className="ro-empty__icon" aria-hidden>
        {icon || <Inbox size={24} />}
      </div>
      <h2 className="ro-empty__title">{title}</h2>
      {description ? <p className="ro-empty__desc">{description}</p> : null}
      {action || null}
    </div>
  );
}
