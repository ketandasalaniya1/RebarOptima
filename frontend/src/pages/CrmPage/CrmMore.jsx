import React from 'react';
import { Building2, FileText, CreditCard, Users, MapPin, Target, BarChart3, Settings } from 'lucide-react';

const CARDS = [
  { id: 'inventory', title: 'Units', text: 'View and manage project units', icon: Building2 },
  { id: 'bookings', title: 'Bookings', text: 'Unit bookings and status', icon: FileText },
  { id: 'payments', title: 'Payments', text: 'Receipts and payment records', icon: CreditCard },
  { id: 'customers', title: 'Customers', text: 'Customers and their interests', icon: Users },
  { id: 'visits-tasks', title: 'Site Visits', text: 'Schedule and track site visits', icon: MapPin },
  { id: 'pipeline', title: 'Pipeline', text: 'Visual sales pipeline', icon: Target },
  { id: 'reports', title: 'Reports', text: 'Sales and activity reports', icon: BarChart3 },
  { id: 'settings', title: 'Settings', text: 'Lead sources, stages, templates', icon: Settings },
];

export default function CrmMore({ onOpen }) {
  return (
    <div className="cx">
      <div className="cx-head">
        <div>
          <h2>More Modules</h2>
          <p>Manage units, bookings, customers and other CRM operations for this project.</p>
        </div>
      </div>
      <div className="cx-more">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button key={card.id} type="button" className="cx-more-card" onClick={() => onOpen(card.id)}>
              <span><Icon size={20} /></span>
              <strong>{card.title}</strong>
              <small>{card.text}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
