import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './ui.css';

export default function AppModal({
  open,
  title,
  subtitle,
  children,
  footer,
  onClose,
  size = 'md',
  className = '',
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('button, [href], input, select, textarea')?.focus?.();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = size === 'md' ? '' : ` ro-modal--${size}`;

  return (
    <div
      className="ro-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className={`ro-modal${sizeClass}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ro-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ro-modal__header">
          <div>
            <h2 id="ro-modal-title" className="ro-modal__title">
              {title}
            </h2>
            {subtitle ? <p className="ro-modal__subtitle">{subtitle}</p> : null}
          </div>
          {onClose ? (
            <button type="button" className="ro-modal__close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          ) : null}
        </div>
        <div className="ro-modal__body">{children}</div>
        {footer ? <div className="ro-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
