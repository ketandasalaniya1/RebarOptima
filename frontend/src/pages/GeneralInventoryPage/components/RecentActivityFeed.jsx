import React, { useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, RotateCcw, Printer, Clock, FileText, ChevronRight } from 'lucide-react';

export default function RecentActivityFeed({
  inwardEntries = [],
  outwardEntries = [],
  returnsEntries = [],
  stores = [],
  onOpenSlip
}) {
  const storeMap = useMemo(() => {
    const map = {};
    stores.forEach((s) => {
      map[s.id || s._id] = s.name;
    });
    return map;
  }, [stores]);

  const recentTransactions = useMemo(() => {
    const list = [];

    // Inward entries
    inwardEntries.forEach((it) => {
      const dateVal = it.receiptDate || it.createdAt || new Date().toISOString();
      const itemsSummary = (it.items || [])
        .map((i) => `${i.acceptedQuantity || i.receivedQuantity} ${i.uom || ''} ${i.materialName}`)
        .join(', ');

      list.push({
        id: it.id || it._id || `in_${Math.random()}`,
        type: 'INWARD',
        typeLabel: 'Inward (GRN)',
        badgeClass: 'inward',
        icon: ArrowDownLeft,
        referenceNumber: it.inwardNumber || 'GRN',
        date: dateVal,
        timestamp: new Date(dateVal).getTime(),
        title: itemsSummary || 'Materials Received',
        party: it.vendorName ? `Vendor: ${it.vendorName}` : 'Vendor Delivery',
        storeName: storeMap[it.storeId] || 'Main Godown',
        rawData: it
      });
    });

    // Outward entries
    outwardEntries.forEach((out) => {
      const dateVal = out.issueDateTime || out.createdAt || new Date().toISOString();
      const isReturnable = out.returnClassification === 'returnable';

      list.push({
        id: out.id || out._id || `out_${Math.random()}`,
        type: 'OUTWARD',
        typeLabel: isReturnable ? 'Tool Issued (Returnable)' : 'Material Issue',
        badgeClass: isReturnable ? 'borrowed' : 'outward',
        icon: ArrowUpRight,
        referenceNumber: out.outwardNumber || 'OUT',
        date: dateVal,
        timestamp: new Date(dateVal).getTime(),
        title: `${out.quantity} ${out.uom || ''} ${out.materialName}`,
        party: `To: ${out.personReceiving}${out.agency && out.agency !== 'Not Applicable' ? ` (${out.agency})` : ''}`,
        storeName: storeMap[out.storeId] || 'Main Godown',
        rawData: out
      });
    });

    // Return entries
    returnsEntries.forEach((ret) => {
      const dateVal = ret.returnDate || ret.createdAt || new Date().toISOString();

      list.push({
        id: ret.id || ret._id || `ret_${Math.random()}`,
        type: 'RETURN',
        typeLabel: 'Material Return',
        badgeClass: 'return',
        icon: RotateCcw,
        referenceNumber: ret.returnNumber || 'RET',
        date: dateVal,
        timestamp: new Date(dateVal).getTime(),
        title: `${ret.acceptedQuantity || 1} units returned${ret.damagedQuantity ? ` (${ret.damagedQuantity} damaged)` : ''}`,
        party: `By: ${ret.returnedByPerson || 'Site Staff'}`,
        storeName: storeMap[ret.storeId] || 'Main Godown',
        rawData: ret
      });
    });

    // Sort descending by timestamp and take top 10
    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }, [inwardEntries, outwardEntries, returnsEntries, storeMap]);

  const formatActivityTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffMins < 5) return 'Just now';
      if (diffMins < 60) return `${diffMins} mins ago`;
      if (diffHours < 24 && d.getDate() === now.getDate()) {
        return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="gi-activity-section">
      <div className="gi-activity-header">
        <div className="gi-activity-title-group">
          <Clock size={18} className="gi-activity-header-icon" />
          <h3 className="gi-activity-heading">Recent Site Activity (Last 10)</h3>
        </div>
        <span className="gi-activity-count-badge">{recentTransactions.length} items</span>
      </div>

      {recentTransactions.length === 0 ? (
        <div className="gi-activity-empty-card">
          <FileText size={32} />
          <h4>No Activity Recorded Yet</h4>
          <p>Recent receipts, issues, and returns will appear here with one-tap slip access.</p>
        </div>
      ) : (
        <div className="gi-activity-list">
          {recentTransactions.map((tx) => {
            const Icon = tx.icon;
            return (
              <div key={tx.id} className="gi-activity-row">
                <div className={`gi-activity-type-pill ${tx.badgeClass}`}>
                  <Icon size={14} />
                  <span>{tx.typeLabel}</span>
                </div>

                <div className="gi-activity-details">
                  <div className="gi-activity-title-line">
                    <span className="gi-activity-ref">{tx.referenceNumber}</span>
                    <strong className="gi-activity-title">{tx.title}</strong>
                  </div>
                  <div className="gi-activity-meta-line">
                    <span className="gi-activity-party">{tx.party}</span>
                    <span>•</span>
                    <span className="gi-activity-store">{tx.storeName}</span>
                    <span>•</span>
                    <span className="gi-activity-time">{formatActivityTime(tx.date)}</span>
                  </div>
                </div>

                <div className="gi-activity-action">
                  <button
                    type="button"
                    className="gi-btn-view-slip"
                    onClick={() => onOpenSlip(tx.type, tx.rawData)}
                    title="View & Print Official Slip"
                  >
                    <Printer size={14} />
                    <span>Slip</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

