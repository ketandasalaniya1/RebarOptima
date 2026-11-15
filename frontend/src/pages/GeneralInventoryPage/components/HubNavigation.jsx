import React from 'react';
import { Zap, Package, ClipboardCheck, FileText } from 'lucide-react';

export default function HubNavigation({
  activeHub = 'daily',
  onChangeHub,
  overdueCount = 0,
  alertStockCount = 0
}) {
  const hubs = [
    {
      id: 'daily',
      label: 'Daily',
      icon: Zap,
      badge: overdueCount > 0 ? `${overdueCount} overdue` : null,
      badgeType: 'danger'
    },
    {
      id: 'stock',
      label: 'Stock',
      icon: Package,
      badge: alertStockCount > 0 ? `${alertStockCount} alert` : null,
      badgeType: 'warning'
    },
    {
      id: 'audit',
      label: 'Audit',
      icon: ClipboardCheck,
      badge: null
    },
    {
      id: 'ledger',
      label: 'Ledger',
      icon: FileText,
      badge: null
    }
  ];

  return (
    <div className="gi-hub-nav-bar">
      <div className="gi-hub-nav-tabs">
        {hubs.map((hub) => {
          const Icon = hub.icon;
          const isActive = activeHub === hub.id;
          return (
            <button
              key={hub.id}
              type="button"
              className={`gi-hub-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onChangeHub(hub.id)}
            >
              <Icon size={18} className="gi-hub-icon" />
              <span className="gi-hub-label">{hub.label}</span>
              {hub.badge && (
                <span className={`gi-hub-badge ${hub.badgeType}`}>
                  {hub.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

