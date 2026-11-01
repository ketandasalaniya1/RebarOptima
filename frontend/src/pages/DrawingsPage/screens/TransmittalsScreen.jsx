import React, { useState, useEffect } from 'react';
import './TransmittalsScreen.css';
import RoleGate from '../../../components/RoleGate';
import { useGetDrawingsQuery } from '../../../store/api/drawingsApi';
import {
  Send,
  Download,
  X,
  FileText,
  Plus,
  CheckCircle2,
  Copy,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

const PARTY_OPTIONS = [
  'Client - ABC Constructions',
  'Structural Consultant - Matrix Engineering',
  'General Contractor - Apex Infra',
  'Site Project Manager',
  'MEP Consultant'
];

const PURPOSE_OPTIONS = [
  'FOR_CONSTRUCTION',
  'FOR_APPROVAL',
  'FOR_INFORMATION',
  'TENDER',
  'AS_BUILT'
];

export default function TransmittalsScreen({
  activeProject,
  initialSelectedDrawingIds = []
}) {
  const projectId = activeProject?._id || activeProject?.id;

  // Fetch drawings to populate selector
  const { data: drawingsData } = useGetDrawingsQuery({
    projectId: projectId || undefined
  }, {
    skip: !projectId
  });
  const allDrawings = drawingsData?.drawings || [];

  // Form states
  const [toParty, setToParty] = useState(PARTY_OPTIONS[0]);
  const [purpose, setPurpose] = useState(PURPOSE_OPTIONS[0]);
  const [notes, setNotes] = useState('Please find the latest approved drawings for execution.');
  const [selectedDrawings, setSelectedDrawings] = useState([]);
  const [sending, setSending] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // Live Tracking Recipients
  const [trackingList, setTrackingList] = useState([]);
  const [loadingTracking, setLoadingTracking] = useState(false);

  const loadTransmittals = async () => {
    if (!projectId) return;
    setLoadingTracking(true);
    try {
      const token = sessionStorage.getItem('accessToken');
      const resp = await fetch(`/api/drawings/transmittals?projectId=${projectId}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (resp.ok) {
        const transList = await resp.json();
        const flatList = [];
        for (const t of (transList || [])) {
          const sentDateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
          if (t.recipients && t.recipients.length > 0) {
            for (const r of t.recipients) {
              flatList.push({
                id: r.id || `${t._id}-${r.email}`,
                recipient: r.email || r.name || 'Recipient',
                type: r.type || 'External',
                sentAt: sentDateStr,
                viewedAt: r.viewedAt ? new Date(r.viewedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—',
                acknowledgedAt: r.acknowledgedAt ? new Date(r.acknowledgedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—',
                status: r.status || (r.acknowledgedAt ? 'ACKNOWLEDGED' : r.viewedAt ? 'VIEWED' : 'SENT'),
                token: r.token || t._id
              });
            }
          } else {
            flatList.push({
              id: t._id,
              recipient: t.toParty || 'General Distribution',
              type: 'External',
              sentAt: sentDateStr,
              viewedAt: '—',
              acknowledgedAt: '—',
              status: t.status || 'SENT',
              token: t._id
            });
          }
        }
        setTrackingList(flatList);
      }
    } catch (err) {
      console.warn('Error fetching transmittals:', err);
    } finally {
      setLoadingTracking(false);
    }
  };

  useEffect(() => {
    loadTransmittals();
  }, [projectId]);

  // Pre-populate with initial drawings if passed
  useEffect(() => {
    if (allDrawings.length > 0) {
      if (initialSelectedDrawingIds.length > 0) {
        const matches = allDrawings.filter((d) => initialSelectedDrawingIds.includes(String(d._id)));
        setSelectedDrawings(matches);
      }
    }
  }, [allDrawings, initialSelectedDrawingIds]);

  const handleRemoveDrawing = (id) => {
    setSelectedDrawings((prev) => prev.filter((d) => String(d._id) !== String(id)));
  };

  const handleSendTransmittal = async (e) => {
    e.preventDefault();
    if (selectedDrawings.length === 0) {
      alert('Please select at least one drawing for the transmittal package.');
      return;
    }

    setSending(true);
    try {
      const token = sessionStorage.getItem('accessToken');
      const payload = {
        projectId,
        purpose,
        notes: notes.trim(),
        items: selectedDrawings.map((d) => ({
          drawingId: d._id,
          drawingNumber: d.drawingNumber,
          title: d.title,
          revisionNumber: d.currentRevisionNumber || 'R00'
        })),
        recipients: [
          { email: 'site.contractor@apex.com', name: toParty, organization: toParty, type: 'External' }
        ]
      };

      const resp = await fetch('/api/drawings/transmittals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        const newTrans = await resp.json();
        const nowStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        setTrackingList((prev) => [
          {
            id: `rec-${Date.now()}`,
            recipient: toParty,
            type: 'External',
            sentAt: nowStr,
            viewedAt: '—',
            acknowledgedAt: '—',
            status: 'SENT',
            token: newTrans.recipients?.[0]?.token || 't-token'
          },
          ...prev
        ]);
        setSuccessToast(`Transmittal ${newTrans.transmittalNumber || ''} created & issued.`);
        setTimeout(() => setSuccessToast(''), 4000);
        loadTransmittals();
      }
    } catch (err) {
      console.warn('Transmittal send notice:', err);
    } finally {
      setSending(false);
    }
  };

  // Download PDF Transmittal Slip
  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to view the transmittal document.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Document Transmittal — RebarOptima</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 24px; }
          .title { font-size: 22px; font-weight: bold; color: #0f172a; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
          th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 10px; }
          .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 16px; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">DOCUMENT TRANSMITTAL SLIP</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">RebarOptima Engineering &amp; Construction Platform</div>
          </div>
          <div style="text-align: right; font-size: 13px;">
            <div><strong>Project:</strong> ${activeProject?.name || 'Active Project'}</div>
            <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div><strong>To Party:</strong> ${toParty}</div>
          <div><strong>Purpose:</strong> ${purpose}</div>
          <div style="grid-column: span 2;"><strong>Notes:</strong> ${notes}</div>
        </div>

        <h3>Transmitted Drawings (${selectedDrawings.length})</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Drawing Number</th>
              <th>Title</th>
              <th>Revision</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${selectedDrawings.map((d, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${d.drawingNumber || '—'}</strong></td>
                <td>${d.title || '—'}</td>
                <td>v${d.currentRevisionNumber ? d.currentRevisionNumber.replace(/^R0*/i, '') : '1'}</td>
                <td>${d.currentStatus || 'Approved'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Please inspect drawings upon receipt. Acknowledge transmission electronically via the RebarOptima portal link.</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="ro-transmittals-screen">
      <div className="ro-transmittals-header">
        <h1 className="ro-transmittals-title">Transmittal (Share Drawings)</h1>
        <p className="ro-transmittals-subtitle">
          Package and issue verified drawing revisions to clients, consultants, and contractors with digital delivery tracking.
        </p>
      </div>

      {successToast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
          <CheckCircle2 size={16} />
          <span>{successToast}</span>
        </div>
      )}

      <div className="ro-transmittals-split-layout">
        {/* LEFT: Create Transmittal Form */}
        <div className="ro-transmittal-card">
          <h2 className="ro-card-heading">Create Transmittal</h2>

          <form onSubmit={handleSendTransmittal} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="ro-upload-field">
              <label className="ro-field-label">To Party *</label>
              <select
                className="ro-form-select"
                value={toParty}
                onChange={(e) => setToParty(e.target.value)}
              >
                {PARTY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="ro-upload-field">
              <label className="ro-field-label">Purpose *</label>
              <select
                className="ro-form-select"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              >
                {PURPOSE_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Selected Drawings Chips */}
            <div className="ro-upload-field">
              <label className="ro-field-label">
                Selected Drawings ({selectedDrawings.length})
              </label>
              <div className="ro-selected-drawings-list">
                {selectedDrawings.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>
                    No drawings selected. Choose drawings from the register to include.
                  </div>
                ) : (
                  selectedDrawings.map((dw) => (
                    <div key={dw._id} className="ro-drawing-chip">
                      <span className="ro-chip-name">
                        <FileText size={14} color="#059669" />
                        <span>{dw.drawingNumber} - {dw.title}</span>
                        <span className="ro-version-tag" style={{ marginLeft: '4px' }}>
                          v{dw.currentRevisionNumber ? dw.currentRevisionNumber.replace(/^R0*/i, '') : '1'}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="ro-chip-remove"
                        onClick={() => handleRemoveDrawing(dw._id)}
                        title="Remove from transmittal"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="ro-upload-field">
              <div className="ro-field-header-row">
                <label className="ro-field-label">Note</label>
                <span className="ro-char-counter">{notes.length}/500</span>
              </div>
              <textarea
                className="ro-textarea-input"
                maxLength={500}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                className="ro-bulk-btn"
                style={{ color: '#64748b', borderColor: '#cbd5e1' }}
                onClick={() => setSelectedDrawings([])}
              >
                Cancel
              </button>

              <RoleGate permission="drawing:distribute">
                <button
                  type="submit"
                  className="ro-btn-primary-action"
                  disabled={sending || selectedDrawings.length === 0}
                >
                  {sending ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Send Transmittal</span>
                    </>
                  )}
                </button>
              </RoleGate>
            </div>
          </form>
        </div>

        {/* RIGHT: Recipient Tracking Table */}
        <div className="ro-transmittal-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '10px' }}>
            <h2 className="ro-card-heading" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Recipient Tracking
            </h2>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Real-time audit receipts
            </span>
          </div>

          <div className="ro-table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="ro-drawings-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Type</th>
                  <th>Sent At</th>
                  <th>Viewed At</th>
                  <th>Acknowledged At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {trackingList.map((rec) => (
                  <tr key={rec.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                        {rec.recipient}
                      </div>
                      <a
                        href={`/t/${rec.token}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '10px', color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px', marginTop: '2px' }}
                      >
                        <span>Public Link</span>
                        <ExternalLink size={10} />
                      </a>
                    </td>
                    <td>
                      <span className={`ro-pill-recipient-type ${rec.type.toLowerCase()}`}>
                        {rec.type}
                      </span>
                    </td>
                    <td style={{ fontSize: '11px', color: '#64748b' }}>{rec.sentAt}</td>
                    <td style={{ fontSize: '11px', color: '#64748b' }}>{rec.viewedAt}</td>
                    <td style={{ fontSize: '11px', color: '#64748b' }}>{rec.acknowledgedAt}</td>
                    <td>
                      <span className={`ro-ack-pill status-${rec.status.toLowerCase()}`}>
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Download PDF Button */}
          <button
            type="button"
            className="ro-btn-download-pdf"
            onClick={handleDownloadPDF}
          >
            <Download size={15} />
            <span>Download Transmittal PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}

