import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Building2, Wallet } from 'lucide-react';
import { formatINR } from '../../../utils/money';

export default function BalanceSummary({
  siteName,
  currentBalance = 0,
  openingBalance = 0,
  totalCredits = 0,
  totalDebits = 0,
  closingBalance = 0,
  transactionCount = 0,
  isLoading = false
}) {
  if (isLoading) {
    return (
      <section className="pc-balance-hero-skeleton">
        <div className="pc-skeleton pc-skeleton-hero-number" />
        <div className="pc-skeleton pc-skeleton-strip" />
      </section>
    );
  }

  const isNegative = currentBalance < 0;

  return (
    <section className="pc-balance-hero-wrap">
      {/* Hero Balance Block */}
      <div className="pc-balance-hero-main">
        <div className="pc-balance-meta-top">
          <span className="pc-balance-label">Cash in Hand</span>
          <span className="pc-site-pill">
            <Building2 size={13} />
            <span>{siteName || 'Site'}</span>
          </span>
        </div>

        <div className="pc-balance-figure-row">
          <div className={`pc-balance-hero-amount ${isNegative ? 'pc-text-danger' : 'pc-text-success'}`}>
            {formatINR(currentBalance)}
          </div>
          <span className="pc-balance-currency-tag">INR Float</span>
        </div>

        {/* Mobile Compact Trio (In / Out / Opening) */}
        <div className="pc-mobile-trio">
          <div className="pc-trio-item pc-trio-in">
            <span className="pc-trio-label">In (+)</span>
            <span className="pc-trio-val">{formatINR(totalCredits)}</span>
          </div>
          <div className="pc-trio-item pc-trio-out">
            <span className="pc-trio-label">Out (−)</span>
            <span className="pc-trio-val">{formatINR(totalDebits)}</span>
          </div>
          <div className="pc-trio-item pc-trio-opening">
            <span className="pc-trio-label">Opening</span>
            <span className="pc-trio-val">{formatINR(openingBalance)}</span>
          </div>
        </div>
      </div>

      {/* Desktop Single-Row Equation Strip */}
      <div className="pc-equation-strip">
        <div className="pc-equation-cell">
          <span className="pc-eq-label">Opening</span>
          <span className="pc-eq-val pc-text-muted">{formatINR(openingBalance)}</span>
        </div>

        <div className="pc-equation-op">+</div>

        <div className="pc-equation-cell">
          <span className="pc-eq-label">Received</span>
          <span className="pc-eq-val pc-text-success">{formatINR(totalCredits)}</span>
        </div>

        <div className="pc-equation-op">−</div>

        <div className="pc-equation-cell">
          <span className="pc-eq-label">Expenses</span>
          <span className="pc-eq-val pc-text-danger">{formatINR(totalDebits)}</span>
        </div>

        <div className="pc-equation-op">=</div>

        <div className="pc-equation-cell pc-eq-closing">
          <span className="pc-eq-label">Closing</span>
          <span className={`pc-eq-val ${closingBalance < 0 ? 'pc-text-danger' : 'pc-text-success'}`}>
            {formatINR(closingBalance)}
          </span>
        </div>
      </div>
    </section>
  );
}

