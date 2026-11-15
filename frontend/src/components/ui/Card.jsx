import React from 'react';
import './ui.css';

export default function Card({
  children,
  className = '',
  onClick,
  style,
  ...rest
}) {
  return (
    <div
      className={`ro-card ${className}`}
      onClick={onClick}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

