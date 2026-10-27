import React from 'react';
import './ui.css';

const VARIANTS = ['primary', 'secondary', 'danger', 'ghost'];
const SIZES = ['sm', 'md', 'lg'];

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  disabled = false,
  onClick,
  ...rest
}) {
  const v = VARIANTS.includes(variant) ? variant : 'primary';
  const s = SIZES.includes(size) ? size : 'md';
  const sizeClass = s === 'md' ? '' : ` ro-btn--${s}`;

  return (
    <button
      type={type}
      className={`ro-btn ro-btn--${v}${sizeClass}${className ? ` ${className}` : ''}`}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
