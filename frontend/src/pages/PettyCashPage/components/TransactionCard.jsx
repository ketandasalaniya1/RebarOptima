import React, { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Calendar,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatINR } from '../../../utils/money';

export default function TransactionCard({
  transactions = [],
  onSelectTransaction,
  onOpenPhotos,
  onOpenCredit,
  onOpenDebit,
  isLoading = false
}) {
  // Group transactions by Date ('YYYY-MM-DD')
  const groupedByDay = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const map = new Map();

    transactions.forEach((tx) => {
      const dateKey = tx.date || 'Undated';
      if (!map.has(dateKey)) {
        map.set(dateKey, {
          date: dateKey,
          items: [],
          netTotal: 0,
          totalCredits: 0,
          totalDebits: 0
        });
      }
      const group = map.get(dateKey);
      group.items.push(tx);

      const amt = Number(tx.amount) || 0;
      if (tx.type === 'CREDIT') {
        group.netTotal += amt;
        group.totalCredits += amt;
      } else {
        group.netTotal -= amt;
        group.totalDebits += amt;
      }
    });

    const sortedDays = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));

    sortedDays.forEach((group) => {
      group.items.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    });

    return sortedDays;
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="pc-mobile-cards-list">
        {[1, 2, 3].map((i) => (
          <div key={i} className="pc-skeleton pc-skeleton-card" />
        ))}
      </div>
    );
  }

  if (groupedByDay.length === 0) {
    return (
      <div className="pc-mobile-empty-state">
        <div className="pc-empty-icon-box">
          <Wallet size={32} />
        </div>
        <h4>No Entries Recorded</h4>
        <p className="pc-text-muted">
          No transactions found for the selected filter. Tap below to record money in or an expense.
        </p>
        <div className="pc-mobile-empty-actions">
          <button type="button" className="pc-btn-primary pc-btn-credit-cta" onClick={onOpenCredit}>
            <ArrowDownLeft size={16} />
            <span>+ Money Received</span>
          </button>
          <button type="button" className="pc-btn-secondary pc-btn-debit-cta" onClick={onOpenDebit}>
            <ArrowUpRight size={16} />
            <span>+ Site Expense</span>
          </button>
        </div>
      </div>
    );
  }

  const formatDayHeader = (dateStr) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().split('T')[0];

      if (dateStr === todayStr) return 'Today';
      if (dateStr === yestStr) return 'Yesterday';

      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="pc-mobile-cards-list">
      {groupedByDay.map((group) => {
        const isNetPositive = group.netTotal >= 0;

        return (
          <div key={group.date} className="pc-mobile-day-group">
            {/* Day Header with Net Total */}
            <div className="pc-day-header-row">
              <div className="pc-day-title-wrap">
                <Calendar size={14} className="pc-text-muted" />
                <span className="pc-day-title-text">{formatDayHeader(group.date)}</span>
                <span className="pc-day-count-badge">{group.items.length}</span>
              </div>
              <div className="pc-day-net-wrap">
                <span className="pc-day-net-label">Day Net:</span>
                <span className={`pc-day-net-val ${isNetPositive ? 'pc-text-success' : 'pc-text-danger'}`}>
                  {isNetPositive ? '+' : '−'} {formatINR(Math.abs(group.netTotal))}
                </span>
              </div>
            </div>

            {/* Transaction Cards List */}
            <div className="pc-day-cards-wrap">
              {group.items.map((tx) => {
                const isCredit = tx.type === 'CREDIT';
                const hasPhotos = tx.photos && tx.photos.length > 0;
                const status = tx.status || 'VERIFIED';

                return (
                  <div
                    key={tx.id || tx._id}
                    className={`pc-mobile-tx-card ${isCredit ? 'pc-card-credit' : 'pc-card-debit'}`}
                    onClick={() => onSelectTransaction(tx)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="pc-tx-card-left">
                      <div className={`pc-tx-type-dot ${isCredit ? 'pc-dot-credit' : 'pc-dot-debit'}`}>
                        {isCredit ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                      </div>

                      <div className="pc-tx-details">
                        <div className="pc-tx-title-row">
                          {tx.voucherNo && (
                            <span className="pc-card-voucher-pill">{tx.voucherNo}</span>
                          )}
                          <span className="pc-tx-desc">{tx.description || tx.category}</span>
                        </div>

                        <div className="pc-tx-sub-row">
                          <span className="pc-tx-cat-chip">{tx.category}</span>
                          <span className="pc-tx-person-name">• {tx.personName}</span>
                          {status === 'PENDING' && (
                            <span className="pc-card-status-dot pc-dot-pending" title="Pending Verification">
                              <Clock size={10} />
                            </span>
                          )}
                          {status === 'REJECTED' && (
                            <span className="pc-card-status-dot pc-dot-rejected" title="Rejected">
                              <AlertCircle size={10} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pc-tx-card-right">
                      <div className={`pc-tx-amount-big ${isCredit ? 'pc-text-success' : 'pc-text-danger'}`}>
                        {isCredit ? '+' : '−'} {formatINR(tx.amount)}
                      </div>

                      {hasPhotos && (
                        <button
                          type="button"
                          className="pc-card-photo-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPhotos(tx.photos);
                          }}
                          aria-label={`View ${tx.photos.length} photos`}
                        >
                          <Camera size={12} />
                          <span>{tx.photos.length}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
