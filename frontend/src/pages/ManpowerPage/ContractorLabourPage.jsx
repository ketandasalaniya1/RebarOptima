import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Image as ImageIcon,
  HardHat,
  UserRound,
  History,
} from 'lucide-react';
import { contractorsApi, manpowerApi } from '../../utils/api';
import { useActiveProject } from '../../hooks/useActiveProject';
import { PageHeader, Button, EmptyState } from '../../components/ui';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import { SalaryControl, formatSalary } from './salaryUnits';
import './ManpowerPage.css';

const emptyWorkerForm = () => ({
  photo: null,
  name: '',
  phone: '',
  address: '',
  labourType: '',
  aadharImage: null,
  salaryAmount: '',
  salaryUnit: 'per_day',
});

const emptyWorkforceRow = () => ({
  labourType: '',
  count: '',
  salaryAmount: '',
  salaryUnit: 'per_day',
});

function formatHistoryDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

/** Depart labour agency / each-worker contractors use named worker forms. */
function isDepartLabourDeptName(name) {
  const normalized = String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const compacted = normalized.replace(/\s/g, '');
  return (
    normalized.includes('depart labour') ||
    compacted.includes('departlabour') ||
    compacted.includes('departlabor')
  );
}

function resolveLabourMode(contractor) {
  if (!contractor) return null;
  const hasDepart = (contractor.departments || []).some((d) => isDepartLabourDeptName(d.name));
  if (hasDepart || contractor.attendanceMethod === 'each_worker_separately') return 'named';
  return 'workforce';
}

export default function ContractorLabourPage() {
  const { projectId, projectEpoch, selectedProject } = useActiveProject();
  const [contractors, setContractors] = useState([]);
  const [contractorId, setContractorId] = useState('');
  const [mode, setMode] = useState(null); // named | workforce
  const [loadingContractors, setLoadingContractors] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [workers, setWorkers] = useState([]);
  const [workerMode, setWorkerMode] = useState('list'); // list | form
  const [editingWorkerId, setEditingWorkerId] = useState(null);
  const [workerForm, setWorkerForm] = useState(emptyWorkerForm());

  const [workforceRows, setWorkforceRows] = useState([emptyWorkforceRow()]);
  const [history, setHistory] = useState([]);

  const photoInputRef = useRef(null);
  const aadharInputRef = useRef(null);

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  };

  const selectedContractor = useMemo(
    () => contractors.find((c) => String(c.id || c._id) === String(contractorId)),
    [contractors, contractorId]
  );

  // Prefer contractor list departments/attendance (already correct in Contractors UI)
  const effectiveMode = useMemo(
    () => resolveLabourMode(selectedContractor) || mode,
    [selectedContractor, mode]
  );

  const loadContractors = useCallback(async () => {
    if (!projectId) return;
    setLoadingContractors(true);
    setError('');
    try {
      const list = await contractorsApi.list();
      const rows = Array.isArray(list) ? list : [];
      setContractors(rows);
      setContractorId((prev) => {
        if (prev && rows.some((c) => String(c.id || c._id) === String(prev))) return prev;
        return rows[0] ? String(rows[0].id || rows[0]._id) : '';
      });
    } catch (err) {
      setError(err.message || 'Failed to load contractors');
      setContractors([]);
      setContractorId('');
    } finally {
      setLoadingContractors(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadContractors();
  }, [loadContractors, projectEpoch]);

  const loadContractorData = useCallback(async () => {
    if (!projectId || !contractorId) {
      setMode(null);
      setWorkers([]);
      setWorkforceRows([emptyWorkforceRow()]);
      setHistory([]);
      return;
    }
    setLoadingData(true);
    setError('');
    try {
      const contractor = contractors.find((c) => String(c.id || c._id) === String(contractorId));
      const clientMode = resolveLabourMode(contractor);
      const data = await manpowerApi.getContractorLabours(contractorId);
      const resolvedMode = clientMode || data.mode || null;
      setMode(resolvedMode);
      if (resolvedMode === 'named') {
        setWorkers(Array.isArray(data.workers) ? data.workers : []);
        setWorkerMode('list');
        setEditingWorkerId(null);
        setWorkerForm(emptyWorkerForm());
      } else {
        const rows = data.workforce?.rows?.length
          ? data.workforce.rows.map((r) => ({
              labourType: r.labourType || '',
              count: r.count ?? '',
              salaryAmount: r.salaryAmount ?? '',
              salaryUnit: r.salaryUnit || 'per_day',
            }))
          : [emptyWorkforceRow()];
        setWorkforceRows(rows);
        setHistory(Array.isArray(data.workforce?.history) ? data.workforce.history : []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load contractor labour');
      setMode(null);
    } finally {
      setLoadingData(false);
    }
  }, [projectId, contractorId, contractors]);

  useEffect(() => {
    loadContractorData();
  }, [loadContractorData]);

  const updateWorkerField = (key, value) => {
    setWorkerForm((prev) => ({ ...prev, [key]: value }));
  };

  const readImageFile = (file, onDone, label = 'Image') => {
    if (!file) return;
    if (!file.type.startsWith('image/') && !(label === 'Aadhar' && file.type === 'application/pdf')) {
      setError(`${label} must be an image${label === 'Aadhar' ? ' or PDF' : ''}`);
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError(`${label} must be under 4 MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onDone(reader.result);
    reader.readAsDataURL(file);
  };

  const openCreateWorker = () => {
    setEditingWorkerId(null);
    setWorkerForm(emptyWorkerForm());
    setWorkerMode('form');
    setError('');
  };

  const openEditWorker = (row) => {
    setEditingWorkerId(row.id || row._id);
    setWorkerForm({
      photo: row.photo || null,
      name: row.name || '',
      phone: row.phone || '',
      address: row.address || '',
      labourType: row.labourType || '',
      aadharImage: row.aadharImage || null,
      salaryAmount: row.salaryAmount ?? '',
      salaryUnit: row.salaryUnit || 'per_day',
    });
    setWorkerMode('form');
    setError('');
  };

  const backToWorkerList = () => {
    setWorkerMode('list');
    setEditingWorkerId(null);
    setWorkerForm(emptyWorkerForm());
  };

  const validateWorker = () => {
    if (!workerForm.name.trim()) return 'Labour name is required';
    if (!workerForm.labourType.trim()) return 'Labour type is required';
    const amount = Number(workerForm.salaryAmount);
    if (!Number.isFinite(amount) || amount < 0) return 'Valid salary amount is required';
    if (!workerForm.salaryUnit) return 'Salary unit is required';
    return '';
  };

  const submitWorker = async (e) => {
    e.preventDefault();
    const v = validateWorker();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        contractorId,
        photo: workerForm.photo,
        name: workerForm.name.trim(),
        phone: workerForm.phone.trim(),
        address: workerForm.address.trim(),
        labourType: workerForm.labourType.trim(),
        aadharImage: workerForm.aadharImage,
        salaryAmount: Number(workerForm.salaryAmount),
        salaryUnit: workerForm.salaryUnit,
      };
      if (editingWorkerId) {
        await manpowerApi.updateWorker(editingWorkerId, payload);
        flashSuccess('Worker updated');
      } else {
        await manpowerApi.createWorker(payload);
        flashSuccess('Worker added');
      }
      await loadContractorData();
      backToWorkerList();
    } catch (err) {
      setError(err.message || 'Failed to save worker');
    } finally {
      setSaving(false);
    }
  };

  const deactivateWorker = async (row) => {
    if (!confirm(`Deactivate worker "${row.name}"?`)) return;
    try {
      await manpowerApi.deleteWorker(row.id || row._id);
      flashSuccess('Worker deactivated');
      await loadContractorData();
    } catch (err) {
      setError(err.message || 'Failed to deactivate');
    }
  };

  const updateWorkforceRow = (index, key, value) => {
    setWorkforceRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addWorkforceRow = () => {
    setWorkforceRows((prev) => [...prev, emptyWorkforceRow()]);
  };

  const removeWorkforceRow = (index) => {
    setWorkforceRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const validateWorkforce = () => {
    const seen = new Set();
    for (const row of workforceRows) {
      const type = String(row.labourType || '').trim();
      if (!type) return 'Labour type is required on each row';
      const key = type.toLowerCase();
      if (seen.has(key)) return `Duplicate labour type: ${type}`;
      seen.add(key);
      const count = Number(row.count);
      if (!Number.isFinite(count) || count <= 0) return `Valid labour count required for ${type}`;
      const amount = Number(row.salaryAmount);
      if (!Number.isFinite(amount) || amount < 0) return `Valid salary required for ${type}`;
      if (!row.salaryUnit) return `Salary unit required for ${type}`;
    }
    return '';
  };

  const saveWorkforce = async () => {
    const v = validateWorkforce();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await manpowerApi.saveWorkforce({
        contractorId,
        rows: workforceRows.map((r) => ({
          labourType: String(r.labourType).trim(),
          count: Number(r.count),
          salaryAmount: Number(r.salaryAmount),
          salaryUnit: r.salaryUnit,
        })),
      });
      setWorkforceRows(
        (res.rows || []).map((r) => ({
          labourType: r.labourType || '',
          count: r.count ?? '',
          salaryAmount: r.salaryAmount ?? '',
          salaryUnit: r.salaryUnit || 'per_day',
        }))
      );
      setHistory(Array.isArray(res.history) ? res.history : []);
      flashSuccess('Workforce saved — previous version recorded in history');
    } catch (err) {
      setError(err.message || 'Failed to save workforce');
    } finally {
      setSaving(false);
    }
  };

  if (!projectId) {
    return (
      <div className="mp-page">
        <EmptyState title="Select a project" description="Contractor labour is managed for the active project." />
      </div>
    );
  }

  if (loadingContractors) {
    return <LoadingSpinner message="Loading contractors…" minHeight="50vh" />;
  }

  return (
    <div className="mp-page">
      <PageHeader
        title="Contractor Labour"
        subtitle={`Labour under contractors for ${selectedProject?.name || 'this project'}.`}
      />

      {error && (
        <div className="mp-banner mp-banner--error">
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      {success && <div className="mp-banner mp-banner--ok">{success}</div>}

      {contractors.length === 0 ? (
        <EmptyState
          icon={<HardHat size={24} />}
          title="No contractors on this project"
          description="Create a contractor first, then manage their labour here."
        />
      ) : (
        <>
          <div className="mp-toolbar">
            <select
              className="mp-contractor-select"
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value)}
            >
              {contractors.map((c) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            {effectiveMode && (
              <span className="mp-mode-badge">
                {effectiveMode === 'named' ? 'Named workers (Depart labour)' : 'Workforce rows'}
              </span>
            )}
          </div>

          {loadingData ? (
            <LoadingSpinner message="Loading labour…" minHeight="30vh" />
          ) : effectiveMode === 'named' ? (
            workerMode === 'list' ? (
              <>
                <div className="mp-toolbar" style={{ justifyContent: 'space-between' }}>
                  <div className="mp-muted">
                    Workers for <strong>{selectedContractor?.name || 'contractor'}</strong>
                  </div>
                  <Button variant="primary" onClick={openCreateWorker}>
                    <Plus size={16} /> Add worker
                  </Button>
                </div>
                <div className="mp-table-wrap">
                  {workers.length === 0 ? (
                    <EmptyState
                      icon={<UserRound size={24} />}
                      title="No workers yet"
                      description="Add named labourers for this Depart labour contractor."
                      action={
                        <Button variant="primary" onClick={openCreateWorker}>
                          <Plus size={16} /> Add worker
                        </Button>
                      }
                    />
                  ) : (
                    <table className="mp-table">
                      <thead>
                        <tr>
                          <th>Photo</th>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Phone</th>
                          <th>Salary</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {workers.map((row) => (
                          <tr key={row.id || row._id}>
                            <td>
                              {row.photo ? (
                                <img src={row.photo} alt="" className="mp-worker-photo" />
                              ) : (
                                <span className="mp-worker-photo--placeholder">
                                  <UserRound size={16} />
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="mp-name">{row.name}</div>
                            </td>
                            <td>{row.labourType || '—'}</td>
                            <td>{row.phone || '—'}</td>
                            <td>{formatSalary(row.salaryAmount, row.salaryUnit)}</td>
                            <td className="mp-actions">
                              <button
                                type="button"
                                className="mp-icon-btn"
                                title="Edit"
                                onClick={() => openEditWorker(row)}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="mp-icon-btn mp-icon-btn--danger"
                                title="Deactivate"
                                onClick={() => deactivateWorker(row)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mp-form-head">
                  <h2>{editingWorkerId ? 'Edit worker' : 'Add worker'}</h2>
                  <Button variant="secondary" onClick={backToWorkerList}>
                    Back to list
                  </Button>
                </div>
                <form className="mp-card" onSubmit={submitWorker} noValidate>
                  <div className="mp-field">
                    <label>
                      Labour photo <span className="mp-optional">(optional)</span>
                    </label>
                    <div className="mp-upload">
                      <Button type="button" variant="secondary" onClick={() => photoInputRef.current?.click()}>
                        <ImageIcon size={16} /> Upload photo
                      </Button>
                      {workerForm.photo && (
                        <button
                          type="button"
                          className="mp-clear-upload"
                          onClick={() => updateWorkerField('photo', null)}
                        >
                          Remove
                        </button>
                      )}
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) =>
                          readImageFile(e.target.files?.[0], (v) => updateWorkerField('photo', v), 'Photo')
                        }
                      />
                    </div>
                    {workerForm.photo && (
                      <img src={workerForm.photo} alt="Worker" className="mp-preview mp-preview--avatar" />
                    )}
                  </div>

                  <div className="mp-grid-2">
                    <div className="mp-field">
                      <label>
                        Name <span className="req">*</span>
                      </label>
                      <input
                        value={workerForm.name}
                        onChange={(e) => updateWorkerField('name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="mp-field">
                      <label>
                        Labour type <span className="req">*</span>
                      </label>
                      <input
                        value={workerForm.labourType}
                        onChange={(e) => updateWorkerField('labourType', e.target.value)}
                        required
                      />
                    </div>
                    <div className="mp-field">
                      <label>
                        Phone <span className="mp-optional">(optional)</span>
                      </label>
                      <input
                        value={workerForm.phone}
                        onChange={(e) => updateWorkerField('phone', e.target.value)}
                      />
                    </div>
                    <div className="mp-field">
                      <label>
                        Address <span className="mp-optional">(optional)</span>
                      </label>
                      <input
                        value={workerForm.address}
                        onChange={(e) => updateWorkerField('address', e.target.value)}
                      />
                    </div>
                  </div>

                  <SalaryControl
                    amount={workerForm.salaryAmount}
                    unit={workerForm.salaryUnit}
                    onAmountChange={(v) => updateWorkerField('salaryAmount', v)}
                    onUnitChange={(v) => updateWorkerField('salaryUnit', v)}
                  />

                  <div className="mp-field">
                    <label>
                      Aadhar image <span className="mp-optional">(optional)</span>
                    </label>
                    <div className="mp-upload">
                      <Button type="button" variant="secondary" onClick={() => aadharInputRef.current?.click()}>
                        <ImageIcon size={16} /> Upload
                      </Button>
                      {workerForm.aadharImage && (
                        <button
                          type="button"
                          className="mp-clear-upload"
                          onClick={() => updateWorkerField('aadharImage', null)}
                        >
                          Remove
                        </button>
                      )}
                      <input
                        ref={aadharInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        hidden
                        onChange={(e) =>
                          readImageFile(e.target.files?.[0], (v) => updateWorkerField('aadharImage', v), 'Aadhar')
                        }
                      />
                    </div>
                    {workerForm.aadharImage && String(workerForm.aadharImage).startsWith('data:image') && (
                      <img src={workerForm.aadharImage} alt="Aadhar" className="mp-preview" />
                    )}
                  </div>

                  <div className="mp-form-actions">
                    <Button type="button" variant="secondary" onClick={backToWorkerList} disabled={saving}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={saving}>
                      {saving ? 'Saving…' : editingWorkerId ? 'Save changes' : 'Add worker'}
                    </Button>
                  </div>
                </form>
              </>
            )
          ) : effectiveMode === 'workforce' ? (
            <>
              <div className="mp-card">
                <div className="mp-workforce-rows">
                  {workforceRows.map((row, index) => (
                    <div key={index} className="mp-workforce-row">
                      <div className="mp-field">
                        <label>
                          Labour type <span className="req">*</span>
                        </label>
                        <input
                          value={row.labourType}
                          onChange={(e) => updateWorkforceRow(index, 'labourType', e.target.value)}
                          placeholder="e.g. Mason"
                        />
                      </div>
                      <div className="mp-field">
                        <label>
                          Count <span className="req">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={row.count}
                          onChange={(e) => updateWorkforceRow(index, 'count', e.target.value)}
                        />
                      </div>
                      <div className="mp-field">
                        <label>
                          Salary amount <span className="req">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.salaryAmount}
                          onChange={(e) => updateWorkforceRow(index, 'salaryAmount', e.target.value)}
                        />
                      </div>
                      <div className="mp-field">
                        <label>
                          Unit <span className="req">*</span>
                        </label>
                        <select
                          value={row.salaryUnit}
                          onChange={(e) => updateWorkforceRow(index, 'salaryUnit', e.target.value)}
                        >
                          <option value="per_month">Per month</option>
                          <option value="per_day">Per day</option>
                          <option value="per_hour">Per hour</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        className="mp-icon-btn mp-icon-btn--danger"
                        title="Remove row"
                        onClick={() => removeWorkforceRow(index)}
                        disabled={workforceRows.length <= 1}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mp-form-actions" style={{ justifyContent: 'space-between' }}>
                  <Button type="button" variant="secondary" onClick={addWorkforceRow}>
                    <Plus size={16} /> Add row
                  </Button>
                  <Button type="button" variant="primary" onClick={saveWorkforce} disabled={saving}>
                    {saving ? 'Saving…' : 'Save workforce'}
                  </Button>
                </div>
              </div>

              <div className="mp-card mp-history">
                <h3>
                  <History size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                  Version history
                </h3>
                {history.length === 0 ? (
                  <p className="mp-history-empty">No previous versions yet. Save edits to build history.</p>
                ) : (
                  history.map((entry, idx) => (
                    <div key={idx} className="mp-history-item">
                      <div className="mp-history-meta">{formatHistoryDate(entry.at)}</div>
                      {(entry.rows || []).length === 0 ? (
                        <p className="mp-history-empty">Empty snapshot</p>
                      ) : (
                        <table className="mp-history-table">
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Count</th>
                              <th>Salary</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(entry.rows || []).map((r, i) => (
                              <tr key={i}>
                                <td>{r.labourType}</td>
                                <td>{r.count}</td>
                                <td>
                                  {formatSalary(r.salaryAmount, r.salaryUnit)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
