import React, { useState } from 'react';
import './PlanPassScreen.css';
import StatusPill from '../../../components/Drawings/StatusPill';
import RoleGate from '../../../components/RoleGate';
import AppModal from '../../../components/ui/AppModal';
import { useGetDrawingsQuery } from '../../../store/api/drawingsApi';
import {
  FileText,
  Upload,
  Eye,
  MoreVertical,
  Download,
  Plus,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

const STANDARD_PLAN_PASS_TYPES = [
  { name: 'Sanctioned Plan', defaultStatus: 'CURRENT', version: 'v1' },
  { name: 'Commencement Certificate', defaultStatus: 'CURRENT', version: 'v1' },
  { name: 'Fire NOC', defaultStatus: 'IN_REVIEW', version: 'v1' },
  { name: 'Environmental Clearance', defaultStatus: 'CURRENT', version: 'v1' },
  { name: 'Other Approvals', defaultStatus: 'DRAFT', version: 'v1' }
];

export default function PlanPassScreen({
  activeProject,
  onViewDrawing,
  onUploadDocument
}) {
  const projectId = activeProject?._id || activeProject?.id;
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'history'

  // Fetch plan pass drawings
  const { data, isLoading, refetch } = useGetDrawingsQuery({
    projectId: projectId || undefined,
    disciplineId: 'PASS'
  }, {
    skip: !projectId
  });

  const existingDocs = data?.drawings || [];

  // Merge standard types with existing uploaded drawings
  const displayItems = STANDARD_PLAN_PASS_TYPES.map((std) => {
    const matched = existingDocs.find(
      (d) => d.title?.toLowerCase() === std.name.toLowerCase() || d.drawingType === std.name
    );
    if (matched) {
      return {
        ...matched,
        documentType: matched.title || std.name,
        isCustom: false
      };
    }
      return {
        _id: `std-${std.name.toLowerCase().replace(/\s+/g, '-')}`,
        documentType: std.name,
        title: std.name,
        drawingNumber: `PASS-${std.name.substring(0, 3).toUpperCase()}`,
        currentRevisionNumber: '—',
        currentStatus: 'DRAFT',
        updatedAt: null,
        isCustom: false
      };
    }
  );

  const formatDate = (rawDate) => {
    if (!rawDate) return '—';
    try {
      const d = new Date(rawDate);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(rawDate);
    }
  };

  return (
    <div className="ro-plan-pass-screen">
      {/* Header */}
      <div className="ro-plan-pass-header">
        <div>
          <h1 className="ro-plan-pass-title">Plan Pass (No Floor/Level)</h1>
          <p className="ro-plan-pass-subtitle">
            Statutory sanction drawings, commencement approvals, and municipal clearances.
          </p>
        </div>

        <RoleGate permission="drawing:upload">
          <button
            type="button"
            className="ro-btn-primary-action"
            onClick={() => onUploadDocument && onUploadDocument({ disciplineCode: 'PASS' })}
          >
            <Plus size={16} />
            <span>+ Upload Document</span>
          </button>
        </RoleGate>
      </div>

      {/* Tabs */}
      <div className="ro-tabs-search-row">
        <div className="ro-nav-tabs">
          <button
            type="button"
            className={`ro-nav-tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            Plan Pass Documents
          </button>
          <button
            type="button"
            className={`ro-nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Version History
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="ro-table-container">
        <table className="ro-drawings-table">
          <thead>
            <tr>
              <th>Document Type</th>
              <th>Current Version</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th style={{ textAlign: 'right', paddingRight: '20px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map((doc) => (
              <tr key={doc._id}>
                <td>
                  <span className="ro-drawing-title" style={{ fontWeight: 600 }}>
                    {doc.documentType || doc.title}
                  </span>
                </td>
                <td>
                  <span className="ro-version-tag">
                    {doc.currentRevisionNumber ? `v${doc.currentRevisionNumber.replace(/^R0*/i, '') || '1'}` : 'v1'}
                  </span>
                </td>
                <td>
                  <StatusPill status={doc.currentStatus} />
                </td>
                <td style={{ color: 'var(--text-secondary, #475569)' }}>
                  {formatDate(doc.updatedAt)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      className="ro-btn-view-action"
                      onClick={() => onViewDrawing && onViewDrawing(doc)}
                    >
                      View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

