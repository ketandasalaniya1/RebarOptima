import React, { useEffect, useState } from 'react';
import {
  X,
  Trash2,
  Calendar,
  Tag,
  Users,
  Camera,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { formatINR, plural } from '../../../utils/money';

export default function TransactionDrawer({
  isOpen,
  transaction,
  onClose,
  onDelete,
  onOpenPhotos,
  onUpdateStatus
}) {
  const [copiedVoucher, setCopiedVoucher] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    setShowRejectInput(false);
    setRejectReason('');
    setCopiedVoucher(false);
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const isCredit = transaction.type === 'CREDIT';
  const id = transaction.id || transaction._id;
  const hasPhotos = transaction.photos && transaction.photos.length > 0;
  const status = transaction.status || 'VERIFIED';

  const copyVoucherNo = () => {
    if (transaction.voucherNo) {
      navigator.clipboard.writeText(transaction.voucherNo);
      setCopiedVoucher(true);
      setTimeout(() => setCopiedVoucher(false), 2000);
    }
  };

  const handleVerify = async () => {
    if (!onUpdateStatus) return;
    setIsUpdatingStatus(true);
    try {
      await onUpdateStatus(id, 'VERIFIED');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReject = async () => {
    if (!onUpdateStatus) return;
    if (!rejectReason.trim()) {
      alert('Please enter a reason for rejecting this entry.');
      return;
    }
    setIsUpdatingStatus(true);
    try {
      await onUpdateStatus(id, 'REJECTED', rejectReason.trim());
      setShowRejectInput(false);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="pc-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="pc-transaction-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className={`pc-drawer-header ${isCredit ? 'pc-drawer-hdr-credit' : 'pc-drawer-hdr-debit'}`}>
          <div className="pc-drawer-title-block">
              <div className="pc-drawer-hdr-tags">
                <div className="pc-drawer-type-badge">
                  {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  <span>{isCredit ? 'Money Received' : 'Site Expense'}</span>
                </div>

                {status === 'PENDING' ? (
                  <span className="pc-status-pill pc-status-pending">
                    <Clock size={12} />
                    <span>Pending Audit</span>
                  </span>
                ) : status === 'REJECTED' ? (
                  <span className="pc-status-pill pc-status-rejected">
                    <AlertCircle size={12} />
                    <span>Rejected</span>
                  </span>
                ) : (
                  <span className="pc-status-pill pc-status-verified">
                    <ShieldCheck size={12} />
                    <span>Verified</span>
                  </span>
                )}
              </div>

              <div className="pc-drawer-amount-hero">
                {isCredit ? '+' : '−'} {formatINR(transaction.amount)}
              </div>

              {/* Voucher Number Banner with 1-click Copy */}
              {transaction.voucherNo && (
                <div className="pc-drawer-voucher-bar">
                  <FileText size={13} />
                  <span className="pc-voucher-text">{transaction.voucherNo}</span>
                  <button
                    type="button"
                    className="pc-btn-copy-voucher"
                    onClick={copyVoucherNo}
                    title="Copy voucher number"
                  >
                    {copiedVoucher ? <Check size={12} className="pc-text-success" /> : <Copy size={12} />}
                    <span>{copiedVoucher ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="pc-drawer-close-btn"
              onClick={onClose}
              aria-label="Close drawer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Drawer Body Content */}
          <div className="pc-drawer-body">
            {/* Key Meta Grid */}
            <div className="pc-drawer-meta-grid">
              <div className="pc-meta-item">
                <span className="pc-meta-label">
                  <Calendar size={14} /> Date
                </span>
                <span className="pc-meta-value">{transaction.date}</span>
              </div>

              <div className="pc-meta-item">
                <span className="pc-meta-label">
                  <Users size={14} /> {isCredit ? 'Provided By' : 'Spent By'}
                </span>
                <span className="pc-meta-value font-medium">{transaction.personName || '—'}</span>
              </div>

              <div className="pc-meta-item">
                <span className="pc-meta-label">
                  <Tag size={14} /> Category
                </span>
                <span className="pc-meta-value">{transaction.category || 'General'}</span>
              </div>

              {transaction.subcategory && (
                <div className="pc-meta-item">
                  <span className="pc-meta-label">Subcategory</span>
                  <span className="pc-meta-value">{transaction.subcategory}</span>
                </div>
              )}
            </div>

            {/* Description Section */}
            <div className="pc-drawer-section">
              <label className="pc-drawer-section-label">Description / Remarks</label>
              <div className="pc-drawer-desc-box">
                {transaction.description || 'No description provided.'}
              </div>
            </div>

            {/* Audit & Verification Banner */}
            <div className="pc-drawer-section">
              <label className="pc-drawer-section-label">
                <ShieldCheck size={14} /> Audit & Verification Status
              </label>

              {status === 'VERIFIED' && (
                <div className="pc-audit-status-card pc-audit-verified">
                  <CheckCircle2 size={18} className="pc-text-success" />
                  <div className="pc-audit-status-txt">
                    <strong>Verified & Approved</strong>
                    <span>
                      Verified by {transaction.verifiedByName || 'Accountant'}{' '}
                      {transaction.verifiedAt && `on ${new Date(transaction.verifiedAt).toLocaleDateString('en-IN')}`}
                    </span>
                  </div>
                </div>
              )}

              {status === 'REJECTED' && (
                <div className="pc-audit-status-card pc-audit-rejected">
                  <AlertCircle size={18} className="pc-text-danger" />
                  <div className="pc-audit-status-txt">
                    <strong>Rejected Entry</strong>
                    <span>Reason: {transaction.rejectionReason || 'Disallowed during audit'}</span>
                  </div>
                </div>
              )}

              {status === 'PENDING' && (
                <div className="pc-audit-status-card pc-audit-pending">
                  <Clock size={18} className="pc-text-warning" />
                  <div className="pc-audit-status-txt">
                    <strong>Pending Approval</strong>
                    <span>Submitted by {transaction.createdByName || 'Site Supervisor'}, awaiting audit.</span>
                  </div>
                </div>
              )}

              {/* Verification Actions */}
              {onUpdateStatus && (
                <div className="pc-verification-actions-wrap">
                  {status !== 'VERIFIED' && (
                    <button
                      type="button"
                      className="pc-btn-primary pc-btn-sm pc-btn-verify-action"
                      onClick={handleVerify}
                      disabled={isUpdatingStatus}
                    >
                      <CheckCircle2 size={14} />
                      <span>Approve & Verify Voucher</span>
                    </button>
                  )}

                  {status !== 'REJECTED' && !showRejectInput && (
                    <button
                      type="button"
                      className="pc-btn-secondary pc-btn-sm pc-btn-reject-action"
                      onClick={() => setShowRejectInput(true)}
                      disabled={isUpdatingStatus}
                    >
                      <AlertCircle size={14} />
                      <span>Reject</span>
                    </button>
                  )}

                  {showRejectInput && (
                    <div className="pc-reject-input-box">
                      <input
                        type="text"
                        placeholder="Specify rejection reason (e.g. Missing GST bill)..."
                        className="pc-input-sm"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        autoFocus
                      />
                      <div className="pc-reject-actions-row">
                        <button
                          type="button"
                          className="pc-btn-secondary pc-btn-sm"
                          onClick={() => setShowRejectInput(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="pc-btn-primary pc-btn-sm pc-btn-danger"
                          onClick={handleReject}
                          disabled={isUpdatingStatus}
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Photos / Receipts Section */}
            <div className="pc-drawer-section">
              <div className="pc-drawer-section-hdr">
                <label className="pc-drawer-section-label">
                  Attached Receipts & Photographs ({hasPhotos ? transaction.photos.length : 0})
                </label>
                {hasPhotos && (
                  <button
                    type="button"
                    className="pc-link-btn"
                    onClick={() => onOpenPhotos(transaction.photos)}
                  >
                    View Fullscreen
                  </button>
                )}
              </div>

              {hasPhotos ? (
                <div className="pc-drawer-photos-grid">
                  {transaction.photos.map((p, idx) => (
                    <div
                      key={idx}
                      className="pc-drawer-photo-thumb"
                      onClick={() => onOpenPhotos(transaction.photos, idx)}
                      role="button"
                      title="Click to view in fullscreen"
                    >
                      <img src={p.url || p.dataUrl} alt={p.name || 'Receipt'} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pc-text-muted pc-no-photos-box">
                  <Camera size={20} className="pc-opacity-50" />
                  <span>No receipts or photos attached to this transaction</span>
                </div>
              )}
            </div>

            {/* Audit Info */}
            {(transaction.createdAt || transaction.createdByName) && (
              <div className="pc-drawer-audit-box">
                <Clock size={13} className="pc-text-muted" />
                <span>
                  Logged by {transaction.createdByName || 'User'} on{' '}
                  {new Date(transaction.createdAt || transaction.date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Drawer Footer Actions */}
          <div className="pc-drawer-footer">
            <button
              type="button"
              className="pc-btn-danger-outline"
              onClick={() => {
                onDelete(id, transaction.description, transaction.amount);
                onClose();
              }}
            >
              <Trash2 size={16} />
              <span>Delete Transaction</span>
            </button>
          </div>
        </div>
      </div>
      );
}
