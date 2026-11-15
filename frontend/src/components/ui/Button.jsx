import React from 'react';
import './ui.css';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  disabled = false,
  loading = false,
  icon: Icon = null,
  rightIcon: RightIcon = null,
  onClick,
  ...rest
}) {
  const sizeClass = size === 'md' ? 'ro-btn--md' : `ro-btn--${size}`;
  const variantClass = `ro-btn--${variant}`;

  return (
    <button
      type={type}
      className={`ro-btn ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {loading ? (
        <span className="ro-btn-spinner" aria-hidden="true" />
      ) : (
        Icon && <Icon size={size === 'sm' ? 13 : 15} aria-hidden="true" />
      )}
      <span>{children}</span>
      {!loading && RightIcon && (
        <RightIcon size={size === 'sm' ? 13 : 15} aria-hidden="true" />
      )}
    </button>
  );
}
