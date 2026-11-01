import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { attendanceApi } from '../../utils/api';
import { useActiveProject } from '../../hooks/useActiveProject';
import { PageHeader, Button, EmptyState } from '../../components/ui';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import { selectHasFeature } from '../../store/slices/permissionsSlice';
import AttendanceReportPreview from './AttendanceReportPreview';
import {
  REPORT_TYPES,
  buildReportQuery,
  defaultFilters,
  filtersForReportType,
} from './reportTypes';
import './AttendancePage.css';

export default function AttendanceReportsPage() {
  const { projectId, projectEpoch, selectedProject } = useActiveProject();
  const canExport = useSelector((state) => selectHasFeature(state, 'attendance', 'export'));

  const [filters, setFilters] = useState(defaultFilters);
  const [meta, setMeta] = useState(null);
  const [report, setReport] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const visible = useMemo(
    () => filtersForReportType(filters.reportType),
    [filters.reportType],
  );

  const setField = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: key === 'page' ? value : 1 }));
  };

  const loadMeta = useCallback(async () => {
    if (!projectId) return;
    setLoadingMeta(true);
    try {
      const data = await attendanceApi.reportMeta();
      setMeta(data);
    } catch (err) {
      setError(err.message || 'Failed to load report filters');
      setMeta(null);
    } finally {
      setLoadingMeta(false);
    }
  }, [projectId]);

  useEffect(() => {
    setReport(null);
    setFilters(defaultFilters());
    loadMeta();
  }, [projectId, projectEpoch, loadMeta]);

  const generate = async (pageOverride) => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const next = {
        ...filters,
        page: pageOverride != null ? pageOverride : filters.page || 1,
      };
      if (pageOverride != null) setFilters(next);
      const q = buildReportQuery(next);
      if (visible.contractorId && filters.reportType === 'contractor' && !q.contractorId) {
        throw new Error('Select a contractor for this report');
      }
      if (visible.worker && !q.subjectId) {
        throw new Error('Select a worker for individual history');
      }
      const data = await attendanceApi.reportPreview(q);
      setReport(data);
    } catch (err) {
      setError(err.message || 'Failed to generate report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters(defaultFilters());
    setReport(null);
    setError('');
  };

  const exportFile = async (kind) => {
    setError('');
    try {
      const q = buildReportQuery({ ...filters, page: 1, limit: 50 });
      delete q.page;
      delete q.limit;
      await attendanceApi.downloadExport(kind, q);
    } catch (err) {
      setError(err.message || 'Export failed');
    }
  };

  const workers = meta?.workers || [];
  const filteredWorkers = useMemo(() => {
    if (!filters.contractorId) return workers;
    return workers.filter(
      (w) =>
        w.subjectType === 'company_labour' ||
        String(w.contractorId) === String(filters.contractorId),
    );
  }, [workers, filters.contractorId]);

  if (!projectId) {
    return (
      <div className="att-page">
        <EmptyState title="Select a project" description="Attendance reports are project-scoped." />
      </div>
    );
  }

  return (
    <div className="att-page">
      <PageHeader
        title="Attendance Reports"
        subtitle={`Professional attendance reports for ${selectedProject?.name || 'this project'}.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => generate()} disabled={loading}>
              <RefreshCw size={16} /> Generate
            </Button>
            {canExport && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => exportFile('xlsx')}
                  disabled={loading || !report}
                >
                  <Download size={16} /> Excel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => exportFile('pdf')}
                  disabled={loading || !report}
                >
                  <Download size={16} /> PDF
                </Button>
              </>
            )}
          </>
        }
      />

      {error && (
        <div className="att-banner att-banner--error">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div className="att-card att-filter-panel">
        <div className="att-toolbar" style={{ flexWrap: 'wrap' }}>
          <div className="att-field">
            <label>Report type</label>
            <select
              value={filters.reportType}
              onChange={(e) => setField('reportType', e.target.value)}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {visible.date && (
            <div className="att-field">
              <label>Date</label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setField('date', e.target.value)}
              />
            </div>
          )}
          {visible.from && (
            <div className="att-field">
              <label>From</label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setField('from', e.target.value)}
              />
            </div>
          )}
          {visible.to && (
            <div className="att-field">
              <label>To</label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setField('to', e.target.value)}
              />
            </div>
          )}
          {visible.monthYear && (
            <>
              <div className="att-field">
                <label>Month</label>
                <select value={filters.month} onChange={(e) => setField('month', e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                      {new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="att-field">
                <label>Year</label>
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={filters.year}
                  onChange={(e) => setField('year', e.target.value)}
                />
              </div>
            </>
          )}
          {visible.shift && (
            <div className="att-field">
              <label>Shift</label>
              <select value={filters.shift} onChange={(e) => setField('shift', e.target.value)}>
                {(meta?.shifts || [
                  { value: '', label: 'All shifts' },
                  { value: 'day', label: 'Day' },
                  { value: 'night', label: 'Night' },
                ]).map((s) => (
                  <option key={s.value || 'all'} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {visible.source && (
            <div className="att-field">
              <label>Source</label>
              <select value={filters.source} onChange={(e) => setField('source', e.target.value)}>
                {(meta?.sources || [{ value: '', label: 'All sources' }]).map((s) => (
                  <option key={s.value || 'all'} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {visible.labourScope && (
            <div className="att-field">
              <label>Labour scope</label>
              <select
                value={filters.labourScope}
                onChange={(e) => setField('labourScope', e.target.value)}
              >
                {(meta?.labourScopes || []).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {visible.contractorId && (
            <div className="att-field">
              <label>Contractor</label>
              <select
                value={filters.contractorId}
                onChange={(e) => setField('contractorId', e.target.value)}
              >
                <option value="">
                  {filters.reportType === 'contractor' ? 'Select contractor…' : 'All contractors'}
                </option>
                {(meta?.contractors || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {visible.labourType && (
            <div className="att-field">
              <label>Labour type</label>
              <select
                value={filters.labourType}
                onChange={(e) => setField('labourType', e.target.value)}
              >
                <option value="">All types</option>
                {(meta?.labourTypes || []).map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {visible.status && (
            <div className="att-field">
              <label>Status</label>
              <select value={filters.status} onChange={(e) => setField('status', e.target.value)}>
                {(meta?.statuses || [{ value: '', label: 'All statuses' }]).map((s) => (
                  <option key={s.value || 'all'} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {visible.worker && (
            <div className="att-field" style={{ minWidth: 220 }}>
              <label>Worker</label>
              <select
                value={
                  filters.subjectId
                    ? `${filters.subjectType}:${filters.subjectId}`
                    : ''
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) {
                    setFilters((prev) => ({
                      ...prev,
                      subjectId: '',
                      subjectType: '',
                      page: 1,
                    }));
                    return;
                  }
                  const [subjectType, ...rest] = v.split(':');
                  setFilters((prev) => ({
                    ...prev,
                    subjectType,
                    subjectId: rest.join(':'),
                    page: 1,
                  }));
                }}
              >
                <option value="">Select worker…</option>
                {filteredWorkers.map((w) => (
                  <option key={`${w.subjectType}:${w.id}`} value={`${w.subjectType}:${w.id}`}>
                    {w.name} ({w.labourType || '—'})
                    {w.subjectType === 'company_labour' ? ' · Company' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="att-actions" style={{ marginTop: 12 }}>
          <Button variant="primary" onClick={() => generate(1)} disabled={loading || loadingMeta}>
            {loading ? 'Generating…' : 'Generate Report'}
          </Button>
          <Button variant="secondary" onClick={clearFilters} disabled={loading}>
            Clear Filters
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Building report…" minHeight="30vh" />
      ) : (
        <AttendanceReportPreview
          report={report}
          page={filters.page}
          onPageChange={(p) => generate(p)}
        />
      )}
    </div>
  );
}
