import React from 'react';
import './ui.css';

export default function Badge({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
  style,
}) {
  const variantClass = `ro-badge--${variant}`;

  return (
    <span className={`ro-badge ${variantClass} ${className}`} style={style}>
      {dot && <span className="ro-badge__dot" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}

