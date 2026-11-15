import React, { useState } from 'react';
import { Phone, MessageSquare, MoreVertical, Eye, ArrowRight, Ban, PauseCircle } from 'lucide-react';
import { formatShortINR } from '../../../utils/money';

export default function LeadCard({
  lead,
  onOpenCustomer360,
  onAdvanceStage,
  onMarkLost,
  onPutOnHold
}) {
  const [showMenu, setShowMenu] = useState(false);

  const cleanPhone = String(lead.customerPhone || '').replace(/[^\d]/g, '');

  return (
    <div className="crm-lead-card" onClick={() => onOpenCustomer360(lead.customerId)}>
      <div className="crm-lead-card-header">
        <div className="crm-lead-card-title-group">
          <strong className="crm-lead-card-name">{lead.customerName}</strong>
          <span className="crm-lead-card-project">
            {lead.projectName} {lead.unitCode ? `• Unit ${lead.unitCode}` : ''}
          </span>
        </div>
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button
            className="crm-btn-icon-subtle"
            onClick={() => setShowMenu(!showMenu)}
            aria-label="More lead actions"
          >
            <MoreVertical size={16} />
          </button>
          {showMenu && (
            <div className="crm-dropdown-menu">
              <button
                onClick={() => { setShowMenu(false); onOpenCustomer360(lead.customerId); }}
                className="crm-dropdown-item"
              >
                <Eye size={14} /> Open Customer 360°
              </button>
              <button
                onClick={() => { setShowMenu(false); onPutOnHold(lead); }}
                className="crm-dropdown-item"
              >
                <PauseCircle size={14} /> Put On Hold
              </button>
              <button
                onClick={() => { setShowMenu(false); onMarkLost(lead); }}
                className="crm-dropdown-item danger"
              >
                <Ban size={14} /> Mark as Lost
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="crm-lead-card-meta-row">
        <span className="crm-lead-card-budget">
          Budget: <strong>{formatShortINR(lead.budget || 0)}</strong>
        </span>
        <span className={`crm-badge priority-${(lead.priority || 'medium').toLowerCase()}`}>
          {lead.priority || 'Medium'}
        </span>
      </div>

      <div className="crm-lead-card-footer" onClick={e => e.stopPropagation()}>
        <div className="crm-lead-card-contact-strip">
          {lead.customerPhone && (
            <>
              <a
                href={`tel:${lead.customerPhone}`}
                className="crm-btn-circle"
                title={`Call ${lead.customerName}`}
                aria-label={`Call ${lead.customerName}`}
              >
                <Phone size={14} />
              </a>
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noreferrer"
                className="crm-btn-circle whatsapp"
                title={`WhatsApp ${lead.customerName}`}
                aria-label={`WhatsApp ${lead.customerName}`}
              >
                <MessageSquare size={14} />
              </a>
            </>
          )}
        </div>

        {onAdvanceStage && (
          <button
            className="crm-btn-secondary crm-btn-advance"
            onClick={() => onAdvanceStage(lead)}
            title="Advance Stage"
            aria-label={`Advance ${lead.customerName} to next stage`}
          >
            Advance <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

