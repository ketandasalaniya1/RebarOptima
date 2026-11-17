import React, { useState } from 'react';
import { X, MessageSquare, Copy, Check, ExternalLink } from 'lucide-react';
import { formatINR } from '../../../utils/money';

export default function WhatsAppQuote({ unit, project, customer, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!unit) return null;

  const price = Number(unit.askingPrice || unit.basePrice || 0);
  const gst = Math.round(price * 0.05);
  const totalPackage = price + gst;
  const holdToken = Math.round(price * 0.05);

  const projectName = project?.name || unit.projectName || 'Property Development';
  const location = project?.address || project?.city || 'Prime Location';

  const quoteText = `🏢 *${projectName.toUpperCase()} — UNIT ${unit.unitCode}*
📍 Location: ${location}
📐 Carpet Area: ${unit.carpetAreaSqFt || 0} Sq.Ft (${unit.configuration || 'Apartment'})
🧭 Orientation: ${unit.facing || 'East Facing'}
━━━━━━━━━━━━━━━━━━━━━━
💰 *Agreement Value* : ${formatINR(price)}
🏛️ *Statutory GST (5%)*: ${formatINR(gst)}
━━━━━━━━━━━━━━━━━━━━━━
✨ *Total Package*     : ${formatINR(totalPackage)}
━━━━━━━━━━━━━━━━━━━━━━
🔒 *48-Hr Hold Token*  : ${formatINR(holdToken)}

_Offer valid subject to availability. Contact our sales desk for floorplan drawings & construction schedule._`;

  const handleCopy = () => {
    navigator.clipboard.writeText(quoteText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanPhone = customer?.phone ? String(customer.phone).replace(/[^\d]/g, '') : '';
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(quoteText)}`
    : `https://wa.me/?text=${encodeURIComponent(quoteText)}`;

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal-container" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="crm-modal-header">
          <span className="crm-modal-title">
            <MessageSquare size={18} style={{ color: '#25D366' }} /> WhatsApp Price Quote
          </span>
          <button className="crm-modal-close-btn" onClick={onClose} aria-label="Close quote modal">
            <X size={20} />
          </button>
        </div>

        <div className="crm-modal-body">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Instant formatted quote ready to share with prospective buyers:
          </p>

          <div className="crm-whatsapp-preview-bubble">
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.82rem', lineHeight: 1.5 }}>
              {quoteText}
            </pre>
          </div>
        </div>

        <div className="crm-modal-footer">
          <button
            className="crm-btn-secondary"
            onClick={handleCopy}
            style={{ gap: '0.35rem' }}
          >
            {copied ? <Check size={16} style={{ color: 'var(--accent-text)' }} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy Text'}
          </button>

          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="crm-btn-primary"
            style={{ background: '#25D366', color: '#fff', gap: '0.35rem' }}
          >
            <MessageSquare size={16} /> Open WhatsApp <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

