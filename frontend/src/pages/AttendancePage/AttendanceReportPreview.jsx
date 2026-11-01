import React from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  CalendarDays,
  Gift,
  Sigma,
  Users,
  User,
  Building2,
  HardHat,
} from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { recordKindLabel, STATUS_CODE_LEGEND } from './reportTypes';

function fmt(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? v : Number(v).toFixed(1);
  return v;
}

function formatDateFormatted(isoOrDate) {
  if (!isoOrDate || isoOrDate === '—') return '—';
  try {
    const raw = String(isoOrDate).slice(0, 10);
    const parts = raw.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
        return `${day} ${months[monthIdx]} ${year}`;
      }
    }
    return isoOrDate;
  } catch {
    return isoOrDate;
  }
}

function periodFormattedLabel(meta) {
  const from = meta.from || meta.date || '—';
  const to = meta.to || meta.date || from;
  if (from === '—') return '—';
  const f = formatDateFormatted(from);
  const t = formatDateFormatted(to);
  return f === t ? f : `${f} to ${t}`;
}

function formatShiftLabel(shift) {
  if (!shift || shift === 'all') return 'All Shifts';
  return String(shift).charAt(0).toUpperCase() + String(shift).slice(1);
}

function statusTone(statusOrCode) {
  if (!statusOrCode) return 'missing';
  const s = String(statusOrCode).toLowerCase().replace(/\s+/g, '_');
  const map = {
    present: 'present',
    half_day: 'half_day',
    absent: 'absent',
    leave: 'leave',
    weekly_off: 'weekly_off',
    holiday: 'holiday',
    p: 'present',
    hd: 'half_day',
    a: 'absent',
    l: 'leave',
    wo: 'weekly_off',
    h: 'holiday',
    '—': 'missing',
    '-': 'missing',
  };
  return map[s] || map[String(statusOrCode)] || 'missing';
}

function StatusPill({ status, code, children }) {
  const tone = statusTone(status || code);
  const label =
    children ||
    (status === 'present'
      ? 'Present'
      : status === 'half_day'
        ? 'Half Day'
        : status === 'absent'
          ? 'Absent'
          : status === 'leave'
            ? 'Leave'
            : status === 'weekly_off'
              ? 'Weekly Off'
              : status === 'holiday'
                ? 'Holiday'
                : code || status || '—');
  return (
    <span className={`att-status-pill att-status-pill--${tone}`}>
      {label}
    </span>
  );
}

function sourceLabel(row) {
  if (row.source === 'company_labour') return 'Company Labour';
  if (row.source === 'contractor_named' || row.source === 'contractor_labour') {
    return 'Contractor Labour (Named)';
  }
  if (row.source === 'contractor_workforce' || row.recordKind === 'workforce_aggregate') {
    return 'Contractor Workforce';
  }
  return row.source || '—';
}

function partyLabel(row) {
  if (row.source === 'company_labour') return 'Company';
  return row.contractorName || '—';
}

function workerLabel(row) {
  if (row.recordKind === 'workforce_aggregate' || row.recordKind === 'workforce') {
    return row.labourType || 'Workforce';
  }
  return row.name ? (row.labourType ? `${row.name} (${row.labourType})` : row.name) : '—';
}

function statusDisplay(row) {
  if (row.recordKind === 'workforce_aggregate' || row.recordKind === 'workforce') {
    if (row.status === 'present') return 'Present';
    if (row.status === 'half_day') return 'Half Day';
    if (row.present > 0 && !row.halfDay && !row.absent && !row.leave && !row.weeklyOff && !row.holiday) {
      return 'Present';
    }
    return `P:${row.present ?? 0} HD:${row.halfDay ?? 0} A:${row.absent ?? 0}`;
  }
  const s = row.status || row.statusCode || '—';
  if (s === 'present') return 'Present';
  if (s === 'half_day') return 'Half Day';
  if (s === 'absent') return 'Absent';
  if (s === 'leave') return 'Leave';
  if (s === 'weekly_off') return 'Weekly Off';
  if (s === 'holiday') return 'Holiday';
  return s;
}

export default function AttendanceReportPreview({ report, page, onPageChange }) {
  if (!report) {
    return (
      <EmptyState
        title="Generate a report"
        description="Choose a report type and filters, then click Generate Report."
      />
    );
  }

  const summary = report.summary || {};
  const meta = report.meta || {};
  const pagination = report.pagination || {};
  const reportType = meta.reportType || 'daily';
  const isMonthly = Array.isArray(meta.dayKeys) && meta.dayKeys.length > 0;
  const rows = isMonthly ? report.matrixRows || report.rows || [] : report.rows || [];
  const metrics = report.metrics || [];

  return (
    <div className="att-report-preview">
      {/* Branded Header & Metadata */}
      <div className="att-report-meta att-report-meta--branded">
        <div className="att-report-header-top">
          <div className="att-report-brand-wrap">
            <div className="att-report-brand">
              <span className="att-brand-rebar">REBAR</span>
              <span className="att-brand-optima"> OPTIMA</span>
            </div>
            <div className="att-report-tagline">Construction Management System</div>
          </div>
          <h3 className="att-report-title">{meta.reportTitle || 'Daily Attendance Report'}</h3>
        </div>

        <div className="att-divider" />

        {/* Worker Profile Header for Individual Report */}
        {reportType === 'individual' && meta.workerName ? (
          <div className="att-worker-card">
            <div className="att-worker-avatar">
              <User size={32} />
            </div>
            <div className="att-worker-info">
              <h4>{meta.workerName} {meta.labourType ? `(${meta.labourType})` : ''}</h4>
              <div className="att-worker-sub">
                <span><strong>Source:</strong> {meta.subjectType === 'company_labour' ? 'Company Labour' : `Contractor: ${meta.contractorName || '—'}`}</span>
                <span><strong>Project:</strong> {meta.projectName || '—'}</span>
                <span><strong>Period:</strong> {periodFormattedLabel(meta)}</span>
              </div>
            </div>
          </div>
        ) : (
          <dl className="att-report-meta-grid">
            <div>
              <dt>Company</dt>
              <dd>: {meta.companyName || '—'}</dd>
            </div>
            <div>
              <dt>Project</dt>
              <dd>: {meta.projectName || '—'}</dd>
            </div>
            {meta.contractorName ? (
              <div>
                <dt>Contractor</dt>
                <dd>: {meta.contractorName}{meta.mode ? ` (${meta.mode})` : ''}</dd>
              </div>
            ) : null}
            <div>
              <dt>Period</dt>
              <dd>: {periodFormattedLabel(meta)}</dd>
            </div>
            <div>
              <dt>Shift</dt>
              <dd>: {formatShiftLabel(meta.shift)}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* Summary KPI Cards */}
      {reportType === 'labour_only' ? (
        <div className="att-summary-stacked">
          {/* Top Row: Labour Headcounts */}
          <div className="att-summary att-summary--report">
            <div className="att-kpi att-kpi--neutral">
              <div className="att-kpi-icon"><Building2 size={16} /></div>
              <div className="lbl">Company Labour</div>
              <div className="val">{fmt(summary.companyLabourCount ?? summary.eligibleCompanyLabour ?? 0)}</div>
            </div>
            <div className="att-kpi att-kpi--neutral">
              <div className="att-kpi-icon"><HardHat size={16} /></div>
              <div className="lbl">Contractor Labour</div>
              <div className="val">{fmt(summary.contractorLabourCount ?? summary.namedContractorWorkers ?? 0)}</div>
            </div>
            <div className="att-kpi att-kpi--neutral">
              <div className="att-kpi-icon"><Users size={16} /></div>
              <div className="lbl">Workforce Count</div>
              <div className="val">{fmt(summary.workforceHeadcount ?? summary.currentWorkforceConfigHeadcount ?? 0)}</div>
            </div>
          </div>
          {/* Bottom Row: Attendance Totals */}
          <div className="att-summary att-summary--report">
            <div className="att-kpi att-kpi--present">
              <div className="att-kpi-icon"><CheckCircle2 size={16} /></div>
              <div className="lbl">Present</div>
              <div className="val">{fmt(summary.present)}</div>
            </div>
            <div className="att-kpi att-kpi--half_day">
              <div className="att-kpi-icon"><Clock size={16} /></div>
              <div className="lbl">Half Day</div>
              <div className="val">{fmt(summary.halfDay)}</div>
            </div>
            <div className="att-kpi att-kpi--absent">
              <div className="att-kpi-icon"><XCircle size={16} /></div>
              <div className="lbl">Absent</div>
              <div className="val">{fmt(summary.absent)}</div>
            </div>
            <div className="att-kpi att-kpi--worked">
              <div className="att-kpi-icon"><Sigma size={16} /></div>
              <div className="lbl">Worked Days</div>
              <div className="val">{fmt(summary.workedDays)}</div>
            </div>
          </div>
        </div>
      ) : reportType === 'individual' ? (
        <div className="att-summary-stacked">
          <div className="att-summary att-summary--report">
            <div className="att-kpi att-kpi--present">
              <div className="att-kpi-icon"><CheckCircle2 size={16} /></div>
              <div className="lbl">Present</div>
              <div className="val">{fmt(summary.present)}</div>
            </div>
            <div className="att-kpi att-kpi--half_day">
              <div className="att-kpi-icon"><Clock size={16} /></div>
              <div className="lbl">Half Day</div>
              <div className="val">{fmt(summary.halfDay)}</div>
            </div>
            <div className="att-kpi att-kpi--absent">
              <div className="att-kpi-icon"><XCircle size={16} /></div>
              <div className="lbl">Absent</div>
              <div className="val">{fmt(summary.absent)}</div>
            </div>
            <div className="att-kpi att-kpi--worked">
              <div className="att-kpi-icon"><Sigma size={16} /></div>
              <div className="lbl">Worked Days</div>
              <div className="val">{fmt(summary.workedDays)}</div>
            </div>
          </div>
          <div className="att-summary att-summary--report">
            <div className="att-kpi att-kpi--leave">
              <div className="att-kpi-icon"><Calendar size={16} /></div>
              <div className="lbl">Leave</div>
              <div className="val">{fmt(summary.leave)}</div>
            </div>
            <div className="att-kpi att-kpi--weekly_off">
              <div className="att-kpi-icon"><CalendarDays size={16} /></div>
              <div className="lbl">Weekly Off</div>
              <div className="val">{fmt(summary.weeklyOff)}</div>
            </div>
            <div className="att-kpi att-kpi--holiday">
              <div className="att-kpi-icon"><Gift size={16} /></div>
              <div className="lbl">Holiday</div>
              <div className="val">{fmt(summary.holiday)}</div>
            </div>
            <div className="att-kpi att-kpi--worked">
              <div className="att-kpi-icon"><Sigma size={16} /></div>
              <div className="lbl">Total Worked</div>
              <div className="val">{fmt(summary.workedDays)}</div>
            </div>
          </div>
        </div>
      ) : reportType === 'monthly' || reportType === 'contractor' ? (
        <div className="att-summary att-summary--report">
          <div className="att-kpi att-kpi--neutral">
            <div className="att-kpi-icon"><Users size={16} /></div>
            <div className="lbl">Total Workers</div>
            <div className="val">{fmt(summary.totalWorkers ?? rows.length)}</div>
          </div>
          <div className="att-kpi att-kpi--present">
            <div className="att-kpi-icon"><CheckCircle2 size={16} /></div>
            <div className="lbl">Present Days</div>
            <div className="val">{fmt(summary.present)}</div>
          </div>
          <div className="att-kpi att-kpi--half_day">
            <div className="att-kpi-icon"><Clock size={16} /></div>
            <div className="lbl">Half Days</div>
            <div className="val">{fmt(summary.halfDay)}</div>
          </div>
          <div className="att-kpi att-kpi--absent">
            <div className="att-kpi-icon"><XCircle size={16} /></div>
            <div className="lbl">Absent Days</div>
            <div className="val">{fmt(summary.absent)}</div>
          </div>
          <div className="att-kpi att-kpi--leave">
            <div className="att-kpi-icon"><Calendar size={16} /></div>
            <div className="lbl">Leave Days</div>
            <div className="val">{fmt(summary.leave)}</div>
          </div>
          <div className="att-kpi att-kpi--weekly_off">
            <div className="att-kpi-icon"><CalendarDays size={16} /></div>
            <div className="lbl">Weekly Off</div>
            <div className="val">{fmt(summary.weeklyOff)}</div>
          </div>
          <div className="att-kpi att-kpi--holiday">
            <div className="att-kpi-icon"><Gift size={16} /></div>
            <div className="lbl">Holiday</div>
            <div className="val">{fmt(summary.holiday)}</div>
          </div>
          <div className="att-kpi att-kpi--worked">
            <div className="att-kpi-icon"><Sigma size={16} /></div>
            <div className="lbl">Worked Days</div>
            <div className="val">{fmt(summary.workedDays)}</div>
          </div>
        </div>
      ) : (
        /* Daily / Default 8-card summary matching mockup */
        <div className="att-summary att-summary--report">
          <div className="att-kpi att-kpi--neutral">
            <div className="att-kpi-icon"><Users size={16} /></div>
            <div className="lbl">Sessions</div>
            <div className="val">{fmt(summary.sessions)}</div>
          </div>
          <div className="att-kpi att-kpi--present">
            <div className="att-kpi-icon"><CheckCircle2 size={16} /></div>
            <div className="lbl">Present</div>
            <div className="val">{fmt(summary.present)}</div>
          </div>
          <div className="att-kpi att-kpi--half_day">
            <div className="att-kpi-icon"><Clock size={16} /></div>
            <div className="lbl">Half Day</div>
            <div className="val">{fmt(summary.halfDay)}</div>
          </div>
          <div className="att-kpi att-kpi--absent">
            <div className="att-kpi-icon"><XCircle size={16} /></div>
            <div className="lbl">Absent</div>
            <div className="val">{fmt(summary.absent)}</div>
          </div>
          <div className="att-kpi att-kpi--leave">
            <div className="att-kpi-icon"><Calendar size={16} /></div>
            <div className="lbl">Leave</div>
            <div className="val">{fmt(summary.leave)}</div>
          </div>
          <div className="att-kpi att-kpi--weekly_off">
            <div className="att-kpi-icon"><CalendarDays size={16} /></div>
            <div className="lbl">Weekly Off</div>
            <div className="val">{fmt(summary.weeklyOff)}</div>
          </div>
          <div className="att-kpi att-kpi--holiday">
            <div className="att-kpi-icon"><Gift size={16} /></div>
            <div className="lbl">Holiday</div>
            <div className="val">{fmt(summary.holiday)}</div>
          </div>
          <div className="att-kpi att-kpi--worked">
            <div className="att-kpi-icon"><Sigma size={16} /></div>
            <div className="lbl">Worked</div>
            <div className="val">{fmt(summary.workedDays)}</div>
          </div>
        </div>
      )}

      {/* Project Summary Metrics Table (if project_summary) */}
      {reportType === 'project_summary' && metrics.length > 0 && (
        <div className="att-card att-table-wrap">
          <h4 className="att-section-title">Project-Wise Attendance Summary</h4>
          <table className="att-table att-report-table att-metrics-table">
            <thead>
              <tr>
                <th>Metric Category</th>
                <th style={{ textAlign: 'center' }}>Value</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.key}>
                  <td><strong>{m.label}</strong></td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{fmt(m.value)}</td>
                  <td className="att-muted">{m.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Details Table Card */}
      <div className="att-card att-table-wrap">
        <h4 className="att-section-title">Details</h4>
        {rows.length === 0 ? (
          <EmptyState title="No rows" description="No attendance matches these filters." />
        ) : isMonthly ? (
          /* Monthly Matrix View */
          <div className="att-matrix-scroll">
            <table className="att-table att-matrix-table">
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center' }}>#</th>
                  <th>Shift</th>
                  <th>Worker / Labour Type</th>
                  {(meta.dayKeys || []).map((d) => (
                    <th key={d} style={{ minWidth: 26, textAlign: 'center' }}>{d.replace(/^0/, '')}</th>
                  ))}
                  <th style={{ textAlign: 'center' }}>Worked</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                    <td>{formatShiftLabel(r.shift)}</td>
                    <td>
                      {r.recordKind === 'workforce_aggregate'
                        ? `[WF] ${r.contractorName ? `${r.contractorName}: ` : ''}${r.labourType || 'Workforce'}`
                        : `${r.name || '—'} (${r.labourType || '—'})`}
                    </td>
                    {(meta.dayKeys || []).map((d) => (
                      <td key={d} className="att-matrix-cell">
                        <StatusPill code={r.days?.[d] ?? '—'}>{r.days?.[d] ?? '—'}</StatusPill>
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{fmt(r.workedDays)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : reportType === 'contractor' ? (
          /* Contractor-Wise Table: # | Worker / Labour Type | P | HD | A | L | Worked */
          <table className="att-table att-report-table">
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: 'center' }}>#</th>
                <th>Worker / Labour Type</th>
                <th style={{ textAlign: 'center' }}>Present (P)</th>
                <th style={{ textAlign: 'center' }}>Half Day (HD)</th>
                <th style={{ textAlign: 'center' }}>Absent (A)</th>
                <th style={{ textAlign: 'center' }}>Leave (L)</th>
                <th style={{ textAlign: 'center' }}>Worked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                  <td>
                    {r.recordKind === 'workforce_aggregate'
                      ? (r.labourType || 'Workforce')
                      : `${r.name || '—'} (${r.labourType || '—'})`}
                  </td>
                  <td style={{ textAlign: 'center' }}>{r.present ?? 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.halfDay ?? 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.absent ?? 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.leave ?? 0}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{fmt(r.workedDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : reportType === 'labour_only' ? (
          /* Labour-Only Table: # | Source | Worker / Labour Type | P | HD | A | Worked */
          <table className="att-table att-report-table">
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: 'center' }}>#</th>
                <th>Source</th>
                <th>Worker / Labour Type</th>
                <th style={{ textAlign: 'center' }}>Present (P)</th>
                <th style={{ textAlign: 'center' }}>Half Day (HD)</th>
                <th style={{ textAlign: 'center' }}>Absent (A)</th>
                <th style={{ textAlign: 'center' }}>Worked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                  <td>{sourceLabel(r)}</td>
                  <td>
                    {r.recordKind === 'workforce_aggregate'
                      ? (r.labourType || 'Workforce')
                      : `${r.name || '—'} (${r.labourType || '—'})`}
                  </td>
                  <td style={{ textAlign: 'center' }}>{r.present ?? 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.halfDay ?? 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.absent ?? 0}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{fmt(r.workedDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : reportType === 'individual' ? (
          /* Individual Worker History Table: Date | Shift | Status | Worked | Remarks */
          <table className="att-table att-report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Shift</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Worked</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{formatShiftLabel(r.shift)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusPill status={r.status} code={r.statusCode}>
                      {r.status || r.statusCode || '—'}
                    </StatusPill>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{fmt(r.workedDays)}</td>
                  <td className="att-muted">{r.remark || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* Daily / Default Details Table matching reference mockup */
          <table className="att-table att-report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Shift</th>
                <th>Manpower Source</th>
                <th>Company / Contractor</th>
                <th>Worker / Labour Type</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Worked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{formatShiftLabel(r.shift)}</td>
                  <td>{sourceLabel(r)}</td>
                  <td>{partyLabel(r)}</td>
                  <td>{workerLabel(r)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {r.recordKind === 'workforce_aggregate' && !r.status ? (
                      <span className="att-wf-counts">
                        P:{r.present} HD:{r.halfDay} A:{r.absent}
                      </span>
                    ) : (
                      <StatusPill status={r.status} code={r.statusCode}>
                        {statusDisplay(r)}
                      </StatusPill>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{fmt(r.workedDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination (if applicable) */}
      {pagination.totalPages > 1 && (
        <div className="att-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="att-muted">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} rows)
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="att-tab"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="att-tab"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange?.(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Status Legend Strip matching mockup */}
      <div className="att-legend-strip" aria-label="Status legend">
        <span className="att-legend-title">Legend:</span>
        {STATUS_CODE_LEGEND.map((L) => (
          <span key={L.code} className="att-legend-item">
            <StatusPill code={L.code}>{`${L.code} = ${L.label}`}</StatusPill>
          </span>
        ))}
      </div>
    </div>
  );
}
