import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import './ui.css';

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  variant = 'primary',
  loading = false,
  children,
  className = '',
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    },
    [onClose, loading]
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

  return (
    <div
      className="ro-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'ro-modal-title' : undefined}
    >
      <div className={`ro-modal ${className}`}>
        {/* Header */}
        <div className="ro-modal__header">
          <h3 id="ro-modal-title" className="ro-modal__title">
            {title}
          </h3>
          <button
            type="button"
            className="ro-drawer__close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="ro-modal__body">
          {description && <p style={{ margin: 0, marginBottom: children ? 12 : 0 }}>{description}</p>}
          {children}
        </div>

        {/* Footer */}
        <div className="ro-modal__footer">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          {onConfirm && (
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              onClick={onConfirm}
              loading={loading}
            >
              {confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

