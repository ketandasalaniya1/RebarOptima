import React from 'react';
import { ShieldAlert, RotateCcw, Clock, AlertTriangle, ArrowRight } from 'lucide-react';

export default function OverdueToolsStrip({
  overdueItems = [],
  onReturnNow,
  onExtendThreeDays
}) {
  if (!overdueItems || overdueItems.length === 0) {
    return null;
  }

  return (
    <div className="gi-overdue-strip">
      <div className="gi-overdue-header">
        <div className="gi-overdue-title-group">
          <div className="gi-overdue-icon-box">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="gi-overdue-heading">
              {overdueItems.length} Borrowed Tool{overdueItems.length > 1 ? 's' : ''} Past Return Date
            </h3>
            <p className="gi-overdue-subtext">
              Action required: Accept physical return back to godown or grant 3-day extension.
            </p>
          </div>
        </div>
      </div>

      <div className="gi-overdue-items-grid">
        {overdueItems.map((item) => {
          const dueDate = new Date(item.expectedReturnDate);
          const daysOverdue = Math.max(1, Math.floor((new Date() - dueDate) / (1000 * 60 * 60 * 24)));

          return (
            <div key={item.id || item._id} className="gi-overdue-card">
              <div className="gi-overdue-card-left">
                <div className="gi-overdue-card-title">
                  <strong>{item.materialName}</strong>
                  <span className="gi-overdue-badge">
                    {item.outstandingQuantity} {item.uom}
                  </span>
                </div>
                <div className="gi-overdue-card-meta">
                  <span className="gi-overdue-borrower">
                    Issued to: <strong>{item.personReceiving}</strong> {item.agency && item.agency !== 'Not Applicable' ? `(${item.agency})` : ''}
                  </span>
                  <span className="gi-overdue-days">
                    <Clock size={13} />
                    Overdue by {daysOverdue} day{daysOverdue > 1 ? 's' : ''} (Due {dueDate.toLocaleDateString()})
                  </span>
                </div>
              </div>

              <div className="gi-overdue-card-actions">
                <button
                  type="button"
                  className="gi-btn-return-now"
                  onClick={() => onReturnNow(item)}
                  title="Record return of this item now"
                >
                  <RotateCcw size={14} />
                  <span>Return now</span>
                </button>
                <button
                  type="button"
                  className="gi-btn-extend-days"
                  onClick={() => onExtendThreeDays(item)}
                  title="Extend return deadline by 3 days"
                >
                  <span>+3 days</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

