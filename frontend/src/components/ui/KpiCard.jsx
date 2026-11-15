import React from 'react';
import './ui.css';

export default function KpiCard({
  title,
  value,
  subtext,
  icon: Icon = null,
  trend = null, // { text: '+4.2%', isPositive: true }
  selected = false,
  onClick,
  className = '',
}) {
  return (
    <div
      className={`ro-kpi-card ${selected ? 'selected' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(e); } : undefined}
    >
      <div className="ro-kpi-card__header">
        <span className="ro-kpi-card__title">{title}</span>
        {Icon && (
          <div className="ro-kpi-card__icon">
            <Icon size={16} />
          </div>
        )}
      </div>

      <div className="ro-kpi-card__value">{value}</div>

      {(subtext || trend) && (
        <div className="ro-kpi-card__subtext">
          {trend && (
            <span
              style={{
                color: trend.isPositive ? 'var(--success-text)' : 'var(--danger-text)',
                fontWeight: 'var(--font-semibold)',
              }}
            >
              {trend.text}
            </span>
          )}
          {subtext && <span>{subtext}</span>}
        </div>
      )}
    </div>
  );
}

