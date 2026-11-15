import React, { useState, useEffect, useRef } from 'react';
import './ui.css';

/**
 * Custom hook to avoid skeleton flicker on fast networks:
 * - Delays showing skeleton by delayMs (default 150ms)
 * - Once shown, ensures skeleton remains visible for at least minDisplayMs (default 300ms)
 */
export function useDelayedSkeleton(isLoading, delayMs = 150, minDisplayMs = 300) {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const showTimeRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isLoading) {
      // Delay initial appearance by delayMs
      timerRef.current = setTimeout(() => {
        showTimeRef.current = Date.now();
        setShowSkeleton(true);
      }, delayMs);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (showSkeleton) {
        // Enforce minimum display time of minDisplayMs
        const elapsed = Date.now() - showTimeRef.current;
        const remaining = Math.max(0, minDisplayMs - elapsed);
        const hideTimer = setTimeout(() => {
          setShowSkeleton(false);
        }, remaining);
        return () => clearTimeout(hideTimer);
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoading, delayMs, minDisplayMs, showSkeleton]);

  return showSkeleton;
}

export function TableSkeleton({ rows = 5, cols = 4, className = '' }) {
  return (
    <div className={`ro-table-container ${className}`} style={{ padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {[...Array(cols)].map((_, c) => (
            <div
              key={c}
              className="ro-skeleton"
              style={{ height: '28px', flex: 1, borderRadius: 'var(--radius-sm)' }}
            />
          ))}
        </div>
        {[...Array(rows)].map((_, r) => (
          <div key={r} style={{ display: 'flex', gap: '12px' }}>
            {[...Array(cols)].map((_, c) => (
              <div
                key={c}
                className="ro-skeleton"
                style={{ height: '36px', flex: 1, borderRadius: 'var(--radius-sm)' }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ height = '140px', className = '' }) {
  return (
    <div
      className={`ro-card ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minHeight: height,
      }}
    >
      <div className="ro-skeleton" style={{ height: '20px', width: '40%' }} />
      <div className="ro-skeleton" style={{ height: '14px', width: '70%' }} />
      <div className="ro-skeleton" style={{ height: '32px', width: '100%', marginTop: 'auto' }} />
    </div>
  );
}

export function KpiSkeleton({ className = '' }) {
  return (
    <div
      className={`ro-kpi-card ${className}`}
      style={{ minHeight: '104px', pointerEvents: 'none' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="ro-skeleton" style={{ height: '14px', width: '45%' }} />
        <div className="ro-skeleton" style={{ height: '24px', width: '24px', borderRadius: 'var(--radius-sm)' }} />
      </div>
      <div className="ro-skeleton" style={{ height: '28px', width: '60%', margin: '6px 0' }} />
      <div className="ro-skeleton" style={{ height: '12px', width: '35%' }} />
    </div>
  );
}
