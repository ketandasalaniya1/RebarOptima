import React, { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Trash2,
  Wallet,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { formatINR, plural } from '../../../utils/money';

export default function StatementTable({
  transactions = [],
  openingBalance = 0,
  onSelectTransaction,
  onOpenPhotos,
  onDeleteTransaction,
  isLoading = false,
  onOpenCredit,
  onOpenDebit
}) {
  // Compute running balance for each transaction chronologically
  const transactionsWithRunningBalance = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const sorted = [...transactions].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const createdA = new Date(a.createdAt || 0).getTime();
      const createdB = new Date(b.createdAt || 0).getTime();
      return createdA - createdB;
    });

    let running = openingBalance;
    const balanceMap = new Map();

    sorted.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'CREDIT') {
        running += amt;
      } else if (tx.type === 'DEBIT') {
        running -= amt;
      }
      balanceMap.set(tx.id || tx._id, Math.round(running * 100) / 100);
    });

    // Return in reverse chronological order (newest first) for presentation
    return [...transactions].map((tx) => ({
      ...tx,
      runningBalance: balanceMap.get(tx.id || tx._id) ?? 0
    }));
  }, [transactions, openingBalance]);

  if (isLoading) {
    return (
      <div className="pc-table-card">
        <div className="pc-skeleton-table">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="pc-skeleton pc-skeleton-row" />
          ))}
        </div>
      </div>
    );
  }

  if (transactionsWithRunningBalance.length === 0) {
    return (
      <div className="pc-empty-state-card">
        <div className="pc-empty-icon-box">
          <Wallet size={36} />
        </div>
        <h4>No Petty Cash Entries Found</h4>
        <p className="pc-text-muted">
          There are no transactions recorded matching your selected filters. Start by recording money received or a site expense.
        </p>
        <div className="pc-empty-actions">
          <button type="button" className="pc-btn-primary pc-btn-credit-cta" onClick={onOpenCredit}>
            <ArrowDownLeft size={16} />
            <span>+ Record Money Received</span>
          </button>
          <button type="button" className="pc-btn-secondary pc-btn-debit-cta" onClick={onOpenDebit}>
            <ArrowUpRight size={16} />
            <span>+ Record Expense</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pc-table-card">
      <div className="pc-table-responsive-wrapper">
        <table className="pc-statement-table">
          <thead>
            <tr>
              <th style={{ width: '130px' }}>Voucher #</th>
              <th style={{ width: '100px' }}>Date</th>
              <th style={{ width: '110px' }}>Type</th>
              <th style={{ width: '100px' }}>Status</th>
              <th>Category & Description</th>
              <th style={{ width: '150px' }}>Person / Spender</th>
              <th style={{ width: '90px' }}>Receipts</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Amount</th>
              <th style={{ width: '125px', textAlign: 'right' }}>Running Bal</th>
              <th style={{ width: '45px' }}></th>
            </tr>
          </thead>
          <tbody>
            {transactionsWithRunningBalance.map((tx) => {
              const isCredit = tx.type === 'CREDIT';
              const id = tx.id || tx._id;
              const hasPhotos = tx.photos && tx.photos.length > 0;
              const status = tx.status || 'VERIFIED';

              return (
                <tr
                  key={id}
                  className={`pc-table-row ${isCredit ? 'pc-row-credit' : 'pc-row-debit'}`}
                  onClick={() => onSelectTransaction(tx)}
                  title="Click to view transaction details"
                >
                  <td className="pc-cell-voucher">
                    {tx.voucherNo ? (
                      <span className="pc-voucher-badge">{tx.voucherNo}</span>
                    ) : (
                      <span className="pc-text-muted pc-text-xs">—</span>
                    )}
                  </td>

                  <td className="pc-cell-date">
                    <span className="pc-date-text">{tx.date}</span>
                  </td>

                  <td>
                    {isCredit ? (
                      <span className="pc-type-badge pc-badge-credit">
                        <ArrowDownLeft size={13} />
                        <span>Received</span>
                      </span>
                    ) : (
                      <span className="pc-type-badge pc-badge-debit">
                        <ArrowUpRight size={13} />
                        <span>Expense</span>
                      </span>
                    )}
                  </td>

                  <td>
                    {status === 'PENDING' ? (
                      <span className="pc-status-pill pc-status-pending" title="Pending accountant verification">
                        <Clock size={11} />
                        <span>Pending</span>
                      </span>
                    ) : status === 'REJECTED' ? (
                      <span className="pc-status-pill pc-status-rejected" title={tx.rejectionReason || 'Rejected during audit'}>
                        <AlertCircle size={11} />
                        <span>Rejected</span>
                      </span>
                    ) : (
                      <span className="pc-status-pill pc-status-verified" title="Verified & approved">
                        <CheckCircle2 size={11} />
                        <span>Verified</span>
                      </span>
                    )}
                  </td>

                  <td className="pc-cell-desc">
                    <div className="pc-tx-desc-line">{tx.description}</div>
                    <div className="pc-tx-tags-line">
                      <span className="pc-cat-tag">{tx.category}</span>
                      {tx.subcategory && (
                        <span className="pc-subcat-tag">{tx.subcategory}</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <div className="pc-person-cell">
                      <Users size={13} className="pc-text-muted" />
                      <span className="pc-person-name-txt">{tx.personName}</span>
                    </div>
                  </td>

                  <td>
                    {hasPhotos ? (
                      <button
                        type="button"
                        className="pc-photo-pill-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPhotos(tx.photos);
                        }}
                        title={`View ${plural(tx.photos.length, 'attached photo', 'attached photos')}`}
                      >
                        <Camera size={13} />
                        <span>{tx.photos.length}</span>
                      </button>
                    ) : (
                      <span className="pc-text-muted pc-no-photos">—</span>
                    )}
                  </td>

                  <td className="pc-cell-amount">
                    <span className={`pc-amount-val ${isCredit ? 'pc-text-success' : 'pc-text-danger'}`}>
                      {isCredit ? '+' : '−'} {formatINR(tx.amount)}
                    </span>
                  </td>

                  <td className="pc-cell-running">
                    <span className="pc-running-val">
                      {formatINR(tx.runningBalance)}
                    </span>
                  </td>

                  <td className="pc-cell-actions">
                    <button
                      type="button"
                      className="pc-btn-row-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTransaction(id, tx.description, tx.amount);
                      }}
                      title="Delete entry"
                      aria-label="Delete entry"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
