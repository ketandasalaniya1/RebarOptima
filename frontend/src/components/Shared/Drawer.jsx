import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './Drawer.css';

/**
 * Reusable Right-Side Slide-Over Drawer Component
 * 
 * Complies with UX/Accessibility requirements:
 * - Keyboard accessible (Esc closes drawer)
 * - Traps background scrolling while open
 * - Clean slide-in animation from the right
 * - Fixed header, scrollable body, and sticky footer
 */
export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = '480px',
  ariaLabel,
}) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="ro-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || (typeof title === 'string' ? title : 'Drawer panel')}
    >
      <div
        className="ro-drawer-panel"
        ref={drawerRef}
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="ro-drawer-header">
          <div className="ro-drawer-title-box">
            {icon && <span className="ro-drawer-icon">{icon}</span>}
            <div>
              <h3 className="ro-drawer-title">{title}</h3>
              {subtitle && <p className="ro-drawer-subtitle">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            className="ro-drawer-close-btn"
            onClick={onClose}
            aria-label="Close drawer"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="ro-drawer-body">
          {children}
        </div>

        {/* Drawer Footer (Sticky Actions) */}
        {footer && (
          <div className="ro-drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

