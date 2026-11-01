import React, { useState, useEffect } from 'react';
import './PublicTransmittalPage.css';
import {
  FileText,
  Download,
  CheckCircle2,
  Building2,
  Calendar,
  Send,
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function PublicTransmittalPage() {
  const [transmittal, setTransmittal] = useState(null);
  const [recipient, setRecipient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  // Extract token from URL /t/:token
  const token = window.location.pathname.replace(/^\/t\/?/, '').trim();

  useEffect(() => {
    async function fetchTransmittal() {
      if (!token) {
        setError('Missing transmittal access token.');
        setLoading(false);
        return;
      }

      try {
        const resp = await fetch(`/api/drawings/public/t/${token}`);
        if (!resp.ok) {
          throw new Error('Transmittal not found or invalid link.');
        }
        const data = await resp.json();
        setTransmittal(data.transmittal);
        setRecipient(data.recipient);
        if (data.recipient?.status === 'ACKNOWLEDGED' || data.recipient?.acknowledgedAt) {
          setAcknowledged(true);
        }
      } catch (err) {
        setError(err.message || 'Error loading transmittal.');
      } finally {
        setLoading(false);
      }
    }

    fetchTransmittal();
  }, [token]);

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      const resp = await fetch(`/api/drawings/public/t/${token}/acknowledge`, {
        method: 'POST'
      });
      if (resp.ok) {
        setAcknowledged(true);
      }
    } catch (err) {
      console.warn('Acknowledgment notice:', err);
    } finally {
      setAcknowledging(false);
    }
  };

  if (loading) {
    return (
      <div className="ro-public-transmittal-page">
        <div style={{ textAlign: 'center', marginTop: '100px', color: '#94a3b8' }}>
          <Loader2 size={36} className="spin" style={{ margin: '0 auto 12px' }} />
          <div>Loading transmittal package...</div>
        </div>
      </div>
    );
  }

  if (error || !transmittal) {
    return (
      <div className="ro-public-transmittal-page">
        <div className="ro-public-card" style={{ textAlign: 'center', maxWidth: '480px' }}>
          <AlertCircle size={44} style={{ color: '#ef4444', margin: '0 auto 12px' }} />
          <h2>Transmittal Unavailable</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px' }}>{error || 'Invalid or expired transmission link.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ro-public-transmittal-page">
      <div className="ro-public-card">
        {/* Brand Header */}
        <div className="ro-public-header">
          <div>
            <div className="ro-public-brand">
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#059669' }}>RebarOptima</span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>DOCUMENT TRANSMITTAL</span>
            </div>
            <div className="ro-public-trans-no">{transmittal.transmittalNumber || 'TR-2026-001'}</div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
              {transmittal.projectName || 'Project'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Issued by {transmittal.issuedByName || 'Lead Engineer'}
            </div>
          </div>
        </div>

        {/* Metadata Details */}
        <div className="ro-public-meta-grid">
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>PURPOSE</div>
            <div style={{ fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>{transmittal.purpose}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>ISSUE DATE</div>
            <div style={{ fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>{transmittal.issueDate}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>RECIPIENT</div>
            <div style={{ fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>{recipient?.name || recipient?.email || 'Valued Partner'}</div>
          </div>
        </div>

        {transmittal.notes && (
          <div style={{ backgroundColor: '#0d1527', borderLeft: '3px solid #059669', padding: '12px 14px', borderRadius: '0 6px 6px 0', fontSize: '13px', fontStyle: 'italic', color: '#cbd5e1' }}>
            "{transmittal.notes}"
          </div>
        )}

        {/* Drawing Items Table */}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>
            Transmitted Documents ({transmittal.items?.length || 0})
          </h3>
          <table className="ro-public-drawings-table">
            <thead>
              <tr>
                <th>Drawing Number</th>
                <th>Title</th>
                <th>Version</th>
                <th style={{ textAlign: 'right' }}>Download</th>
              </tr>
            </thead>
            <tbody>
              {(transmittal.items || []).map((item, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700 }}>{item.drawingNumber}</td>
                  <td>{item.title}</td>
                  <td>
                    <span style={{ fontSize: '11px', backgroundColor: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>
                      {item.revisionNumber}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <a
                      href={`/api/drawings/drawings/${item.drawingId}/download`}
                      download
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: '#059669', color: '#fff', borderRadius: '4px', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Acknowledgment Action Card */}
        <div className="ro-public-ack-card">
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#ffffff' }}>
              Electronic Receipt Acknowledgment
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Confirm that you have received this drawing transmission package for execution.
            </div>
          </div>

          {acknowledged ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 700, fontSize: '13px' }}>
              <CheckCircle2 size={18} />
              <span>Receipt Acknowledged</span>
            </div>
          ) : (
            <button
              type="button"
              className="ro-btn-ack-receipt"
              disabled={acknowledging}
              onClick={handleAcknowledge}
            >
              {acknowledging ? (
                <>
                  <Loader2 size={15} className="spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Acknowledge Receipt</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

