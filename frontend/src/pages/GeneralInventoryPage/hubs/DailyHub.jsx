import React from 'react';
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  ChevronRight,
  Plus
} from 'lucide-react';
import OverdueToolsStrip from '../components/OverdueToolsStrip';
import RecentActivityFeed from '../components/RecentActivityFeed';

export default function DailyHub({
  kpis = { totalMaterials: 0, normalCount: 0, lowStockCount: 0, outOfStockCount: 0 },
  onKpiClick,
  onOpenInward,
  onOpenOutward,
  onOpenReturn,
  overdueItems = [],
  onReturnNow,
  onExtendThreeDays,
  inwardEntries = [],
  outwardEntries = [],
  returnsEntries = [],
  stores = [],
  onOpenSlip
}) {
  return (
    <div className="gi-daily-hub-container">
      {/* ── 1. 4 Tappable KPI Summary Cards ── */}
      <div className="gi-kpi-grid">
        <div
          className="gi-kpi-card tappable"
          onClick={() => onKpiClick && onKpiClick('all')}
          title="Click to view all registered materials in Stock Hub"
          role="button"
          tabIndex={0}
        >
          <div className="gi-kpi-icon primary">
            <Package size={26} />
          </div>
          <div className="gi-kpi-info">
            <span className="gi-kpi-label">Registered Materials</span>
            <span className="gi-kpi-value">{kpis.totalMaterials}</span>
            <span className="gi-kpi-tap-hint">Tap to view stock →</span>
          </div>
        </div>

        <div
          className="gi-kpi-card tappable"
          onClick={() => onKpiClick && onKpiClick('normal')}
          title="Click to view healthy stock items"
          role="button"
          tabIndex={0}
        >
          <div className="gi-kpi-icon success">
            <CheckCircle2 size={26} />
          </div>
          <div className="gi-kpi-info">
            <span className="gi-kpi-label">Healthy Stock</span>
            <span className="gi-kpi-value">{kpis.normalCount}</span>
            <span className="gi-kpi-tap-hint success">Above threshold →</span>
          </div>
        </div>

        <div
          className="gi-kpi-card tappable"
          onClick={() => onKpiClick && onKpiClick('low')}
          title="Click to view low stock materials needing reorder"
          role="button"
          tabIndex={0}
        >
          <div className="gi-kpi-icon warning">
            <AlertTriangle size={26} />
          </div>
          <div className="gi-kpi-info">
            <span className="gi-kpi-label">Low-Stock Alert</span>
            <span className="gi-kpi-value">{kpis.lowStockCount}</span>
            <span className="gi-kpi-tap-hint warning">Reorder required →</span>
          </div>
        </div>

        <div
          className="gi-kpi-card tappable"
          onClick={() => onKpiClick && onKpiClick('out')}
          title="Click to view materials completely out of stock"
          role="button"
          tabIndex={0}
        >
          <div className="gi-kpi-icon danger">
            <Clock size={26} />
          </div>
          <div className="gi-kpi-info">
            <span className="gi-kpi-label">Out of Stock</span>
            <span className="gi-kpi-value">{kpis.outOfStockCount}</span>
            <span className="gi-kpi-tap-hint danger">Critical zero balance →</span>
          </div>
        </div>
      </div>

      {/* ── 2. Three Big Site Storekeeper Action Buttons ── */}
      <div className="gi-storekeeper-actions-section">
        <h3 className="gi-section-subtitle">Storekeeper Quick Actions (2-Tap Operations)</h3>
        <div className="gi-big-buttons-grid">
          {/* + Inward Button */}
          <button
            type="button"
            className="gi-big-action-btn inward"
            onClick={onOpenInward}
          >
            <div className="gi-big-btn-icon-box inward">
              <ArrowDownLeft size={28} />
            </div>
            <div className="gi-big-btn-content">
              <div className="gi-big-btn-title">
                <span>+ Inward (GRN)</span>
              </div>
              <p className="gi-big-btn-desc">Receive vendor goods or supplier delivery</p>
            </div>
          </button>

          {/* − Issue Button */}
          <button
            type="button"
            className="gi-big-action-btn issue"
            onClick={onOpenOutward}
          >
            <div className="gi-big-btn-icon-box issue">
              <ArrowUpRight size={28} />
            </div>
            <div className="gi-big-btn-content">
              <div className="gi-big-btn-title">
                <span>− Issue Material</span>
              </div>
              <p className="gi-big-btn-desc">Issue tools or materials to contractor/team</p>
            </div>
          </button>

          {/* ↩ Return Button */}
          <button
            type="button"
            className="gi-big-action-btn return"
            onClick={onOpenReturn}
          >
            <div className="gi-big-btn-icon-box return">
              <RotateCcw size={28} />
            </div>
            <div className="gi-big-btn-content">
              <div className="gi-big-btn-title">
                <span>↩ Return Item</span>
              </div>
              <p className="gi-big-btn-desc">Return borrowed equipment or unused stock</p>
            </div>
          </button>
        </div>
      </div>

      {/* ── 3. Overdue Tools Strip ── */}
      <OverdueToolsStrip
        overdueItems={overdueItems}
        onReturnNow={onReturnNow}
        onExtendThreeDays={onExtendThreeDays}
      />

      {/* ── 4. Recent Activity Feed (Last 10) with Slip Preview ── */}
      <RecentActivityFeed
        inwardEntries={inwardEntries}
        outwardEntries={outwardEntries}
        returnsEntries={returnsEntries}
        stores={stores}
        onOpenSlip={onOpenSlip}
      />
    </div>
  );
}

