import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function InventoryDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  width = '520px'
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="gi-drawer-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="gi-drawer-panel"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="gi-drawer-header">
          <div className="gi-drawer-header-left">
            {Icon && (
              <div className="gi-drawer-icon">
                <Icon size={20} />
              </div>
            )}
            <div>
              <h2 className="gi-drawer-title">{title}</h2>
              {subtitle && <p className="gi-drawer-subtitle">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            className="gi-drawer-close-btn"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="gi-drawer-body">
          {children}
        </div>

        {/* Drawer Sticky Footer */}
        {footer && (
          <div className="gi-drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

