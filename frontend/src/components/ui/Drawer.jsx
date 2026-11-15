import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import './ui.css';

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
  className = '',
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const sizeClass = `ro-drawer--${size}`;

  return (
    <div
      className="ro-drawer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'ro-drawer-title' : undefined}
    >
      <div className={`ro-drawer ${sizeClass} ${className}`}>
        {/* Header */}
        <div className="ro-drawer__header">
          <div className="ro-drawer__title-box">
            {title && (
              <h2 id="ro-drawer-title" className="ro-drawer__title">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="ro-drawer__subtitle">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            className="ro-drawer__close"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="ro-drawer__body">{children}</div>

        {/* Sticky Footer */}
        {footer && <div className="ro-drawer__footer">{footer}</div>}
      </div>
    </div>
  );
}

