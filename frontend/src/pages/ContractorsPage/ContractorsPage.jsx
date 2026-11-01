import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  ChevronDown,
  HardHat,
  AlertTriangle,
  Image as ImageIcon,
  Info,
} from 'lucide-react';
import { contractorsApi } from '../../utils/api';
import { useActiveProject } from '../../hooks/useActiveProject';
import { PageHeader, Button, EmptyState } from '../../components/ui';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import './ContractorsPage.css';

const ATTENDANCE_OPTIONS = [
  {
    value: 'count_of_workers',
    label: 'Count of Workers',
    description: 'Add total count of Mason, Carpenter, and other type of labours present that day.',
    preview: [
      { text: 'Mason', badge: '12 Present', tone: 'ok' },
      { text: 'Carpenter', badge: '22 Present', tone: 'ok' },
    ],
  },
  {
    value: 'each_worker_separately',
    label: 'Each Worker Separately',
    description: "Add each labour's name according to the contractor which are present that day.",
    preview: [
      { text: 'Ramesh', badge: 'P', tone: 'ok' },
      { text: 'Mahesh', badge: 'A', tone: 'bad' },
    ],
  },
];

const emptyForm = () => ({
  name: '',
  email: '',
  address: '',
  phone: '',
  businessName: '',
  businessGst: '',
  aadharNumber: '',
  aadharImage: null,
  attendanceMethod: 'count_of_workers',
  departmentIds: [],
  sourceContractorId: null,
});

function attendanceLabel(value) {
  return ATTENDANCE_OPTIONS.find((o) => o.value === value)?.label || value || '—';
}

export default function ContractorsPage() {
  const { projectId, projectEpoch, selectedProject } = useActiveProject();
  const [mode, setMode] = useState('list'); // list | form
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [contractors, setContractors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [companyDeptSuggestions, setCompanyDeptSuggestions] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [listSearch, setListSearch] = useState('');

  const [nameSuggestOpen, setNameSuggestOpen] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [deptQuery, setDeptQuery] = useState('');
  const [deptSuggestOpen, setDeptSuggestOpen] = useState(false);
  const [deptLocalSuggest, setDeptLocalSuggest] = useState([]);
  const [deptCompanySuggest, setDeptCompanySuggest] = useState([]);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [creatingDept, setCreatingDept] = useState(false);

  const suggestTimer = useRef(null);
  const deptTimer = useRef(null);
  const aadharInputRef = useRef(null);

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  };

  const loadList = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const [list, deps] = await Promise.all([
        contractorsApi.list(),
        contractorsApi.getDepartments(),
      ]);
      setContractors(Array.isArray(list) ? list : []);
      setDepartments(deps?.departments || []);
      setCompanyDeptSuggestions(deps?.companySuggestions || []);
    } catch (err) {
      setError(err.message || 'Failed to load contractors');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadList();
  }, [loadList, projectEpoch]);

  const filteredList = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return contractors;
    return contractors.filter((c) => {
      const hay = `${c.name} ${c.email} ${c.phone} ${c.businessName} ${(c.departments || [])
        .map((d) => d.name)
        .join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [contractors, listSearch]);

  const selectedDepartments = useMemo(() => {
    const ids = new Set(form.departmentIds.map(String));
    return departments.filter((d) => ids.has(String(d.id || d._id)));
  }, [departments, form.departmentIds]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setMode('form');
    setError('');
    setNameSuggestions([]);
    setNameSuggestOpen(false);
  };

  const openEdit = async (row) => {
    setError('');
    setEditingId(row.id || row._id);
    setForm({
      name: row.name || '',
      email: row.email || '',
      address: row.address || '',
      phone: row.phone || '',
      businessName: row.businessName || '',
      businessGst: row.businessGst || '',
      aadharNumber: row.aadharNumber || '',
      aadharImage: row.aadharImage || null,
      attendanceMethod: row.attendanceMethod || 'count_of_workers',
      departmentIds: (row.departmentIds || []).map(String),
      sourceContractorId: null,
    });
    setMode('form');
  };

  const backToList = () => {
    setMode('list');
    setEditingId(null);
    setForm(emptyForm());
    setAttendanceOpen(false);
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onNameChange = (value) => {
    updateField('name', value);
    updateField('sourceContractorId', null);
    if (editingId) return;
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(async () => {
      const q = value.trim();
      if (q.length < 2) {
        setNameSuggestions([]);
        setNameSuggestOpen(false);
        return;
      }
      try {
        const res = await contractorsApi.suggest(q);
        setNameSuggestions(res?.suggestions || []);
        setNameSuggestOpen(true);
      } catch {
        setNameSuggestions([]);
      }
    }, 280);
  };

  const applySuggestion = (s) => {
    setForm((prev) => ({
      ...prev,
      name: s.name || '',
      email: s.email || '',
      address: s.address || '',
      phone: s.phone || '',
      businessName: s.businessName || '',
      businessGst: s.businessGst || '',
      aadharNumber: s.aadharNumber || '',
      aadharImage: s.aadharImage || null,
      attendanceMethod: s.attendanceMethod || 'count_of_workers',
      sourceContractorId: s.id,
    }));
    setNameSuggestOpen(false);
    setNameSuggestions([]);
  };

  const onDeptQueryChange = (value) => {
    setDeptQuery(value);
    setDeptSuggestOpen(true);
    if (deptTimer.current) clearTimeout(deptTimer.current);
    deptTimer.current = setTimeout(async () => {
      try {
        const res = await contractorsApi.suggestDepartments(value.trim());
        setDeptLocalSuggest(res?.local || []);
        setDeptCompanySuggest(res?.company || []);
      } catch {
        setDeptLocalSuggest([]);
        setDeptCompanySuggest([]);
      }
    }, 200);
  };

  const ensureDepartmentSelected = async (dept) => {
    const id = String(dept.id || dept._id || '');
    if (!id) return;
    setDepartments((prev) => {
      if (prev.some((d) => String(d.id || d._id) === id)) return prev;
      return [...prev, { id, _id: id, name: dept.name }];
    });
    setForm((prev) => {
      if (prev.departmentIds.map(String).includes(id)) return prev;
      return { ...prev, departmentIds: [...prev.departmentIds.map(String), id] };
    });
    setDeptQuery('');
    setDeptSuggestOpen(false);
  };

  const addCompanyDeptSuggestion = async (name) => {
    setCreatingDept(true);
    setError('');
    try {
      const created = await contractorsApi.createDepartment({ name });
      await ensureDepartmentSelected(created);
      const deps = await contractorsApi.getDepartments();
      setDepartments(deps?.departments || []);
      setCompanyDeptSuggestions(deps?.companySuggestions || []);
    } catch (err) {
      setError(err.message || 'Failed to add department');
    } finally {
      setCreatingDept(false);
    }
  };

  const createNewDepartment = async () => {
    const name = deptQuery.trim();
    if (!name) return;
    await addCompanyDeptSuggestion(name);
  };

  const removeDepartment = (id) => {
    setForm((prev) => ({
      ...prev,
      departmentIds: prev.departmentIds.map(String).filter((d) => d !== String(id)),
    }));
  };

  const onAadharFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Aadhar file must be an image or PDF');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Aadhar file must be under 4 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateField('aadharImage', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    if (!form.name.trim()) return 'Contractor name is required';
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Enter a valid email address, or leave email blank';
    }
    if (!form.phone.trim()) return 'Phone number is required';
    if (!form.attendanceMethod) return 'Attendance method is required';
    if (!form.departmentIds.length) return 'Select at least one department';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const v = validateForm();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const email = form.email.trim().toLowerCase();
      const payload = {
        name: form.name.trim(),
        email: email || null,
        address: form.address.trim(),
        phone: form.phone.trim(),
        businessName: form.businessName.trim(),
        businessGst: form.businessGst.trim(),
        aadharNumber: form.aadharNumber.trim(),
        aadharImage: form.aadharImage,
        attendanceMethod: form.attendanceMethod,
        departmentIds: form.departmentIds,
      };
      if (!editingId && form.sourceContractorId) {
        payload.sourceContractorId = form.sourceContractorId;
      }

      if (editingId) {
        await contractorsApi.update(editingId, payload);
        flashSuccess('Contractor updated');
      } else {
        await contractorsApi.create(payload);
        flashSuccess('Contractor created');
      }
      await loadList();
      backToList();
    } catch (err) {
      setError(err.message || 'Failed to save contractor');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (row) => {
    if (!confirm(`Deactivate contractor "${row.name}"?`)) return;
    try {
      await contractorsApi.remove(row.id || row._id);
      flashSuccess('Contractor deactivated');
      await loadList();
    } catch (err) {
      setError(err.message || 'Failed to deactivate');
    }
  };

  const selectedAttendance = ATTENDANCE_OPTIONS.find((o) => o.value === form.attendanceMethod);

  if (!projectId) {
    return (
      <div className="contractors-page">
        <EmptyState title="Select a project" description="Contractors are managed per project." />
      </div>
    );
  }

  if (loading && mode === 'list') {
    return <LoadingSpinner message="Loading contractors…" minHeight="50vh" />;
  }

  return (
    <div className="contractors-page">
      {mode === 'list' ? (
        <>
          <PageHeader
            title="Contractors"
            subtitle={`Manage contractors for ${selectedProject?.name || 'this project'}. Attendance tracking will come later.`}
            actions={
              <Button variant="primary" onClick={openCreate}>
                <Plus size={16} /> Create Contractor
              </Button>
            }
          />

          {error && (
            <div className="ctr-banner ctr-banner--error">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          {success && <div className="ctr-banner ctr-banner--ok">{success}</div>}

          <div className="ctr-toolbar">
            <div className="ctr-search">
              <Search size={16} />
              <input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Search name, email, phone, department…"
              />
            </div>
          </div>

          <div className="ctr-table-wrap">
            {filteredList.length === 0 ? (
              <EmptyState
                icon={<HardHat size={24} />}
                title="No contractors yet"
                description="Create a contractor for this project to get started."
                action={
                  <Button variant="primary" onClick={openCreate}>
                    <Plus size={16} /> Create Contractor
                  </Button>
                }
              />
            ) : (
              <table className="ctr-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Business</th>
                    <th>Phone</th>
                    <th>Departments</th>
                    <th>Attendance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((c) => (
                    <tr key={c.id || c._id}>
                      <td>
                        <div className="ctr-name">{c.name}</div>
                        <div className="ctr-muted">{c.email}</div>
                      </td>
                      <td>{c.businessName || '—'}</td>
                      <td>{c.phone || '—'}</td>
                      <td>
                        <div className="ctr-chips">
                          {(c.departments || [])
                            .filter((d) => d.name)
                            .map((d) => (
                              <span key={d.id} className="ctr-chip">
                                {d.name}
                              </span>
                            ))}
                          {!(c.departments || []).some((d) => d.name) && '—'}
                        </div>
                      </td>
                      <td>{attendanceLabel(c.attendanceMethod)}</td>
                      <td className="ctr-actions">
                        <button type="button" className="ctr-icon-btn" title="Edit" onClick={() => openEdit(c)}>
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="ctr-icon-btn ctr-icon-btn--danger"
                          title="Deactivate"
                          onClick={() => handleDeactivate(c)}
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
        <form className="ctr-form" onSubmit={handleSubmit} noValidate>
          <div className="ctr-form-head">
            <h2>{editingId ? 'Edit Contractor' : 'Create a New Contractor'}</h2>
            <button type="button" className="ctr-icon-btn" onClick={backToList} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="ctr-banner ctr-banner--error">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div className="ctr-card">
            <div className="ctr-grid-2">
              <div className="ctr-field ctr-field--suggest">
                <label>
                  Contractor Name <span className="req">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => onNameChange(e.target.value)}
                  onFocus={() => nameSuggestions.length && setNameSuggestOpen(true)}
                  placeholder="Enter contractor name"
                  autoComplete="off"
                />
                {!editingId && nameSuggestOpen && nameSuggestions.length > 0 && (
                  <div className="ctr-suggest-panel">
                    <div className="ctr-suggest-hint">From other projects in your company</div>
                    {nameSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="ctr-suggest-item"
                        onClick={() => applySuggestion(s)}
                      >
                        <strong>{s.name}</strong>
                        <span className="ctr-muted">
                          {s.email}
                          {s.businessName ? ` · ${s.businessName}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="ctr-field">
                <label>
                  Phone Number <span className="req">*</span>
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="Phone number"
                />
              </div>
            </div>

            <div className="ctr-field">
              <label>Contractor Email <span className="ctr-optional">(optional)</span></label>
              <input
                type="text"
                inputMode="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="email@example.com"
              />
            </div>

            <div className="ctr-field">
              <label>Address</label>
              <textarea
                rows={2}
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Contractor address"
              />
            </div>

            <div className="ctr-grid-2">
              <div className="ctr-field">
                <label>Business Name</label>
                <input
                  value={form.businessName}
                  onChange={(e) => updateField('businessName', e.target.value)}
                  placeholder="Business / agency name"
                />
              </div>
              <div className="ctr-field">
                <label>Business GST</label>
                <input
                  value={form.businessGst}
                  onChange={(e) => updateField('businessGst', e.target.value)}
                  placeholder="GSTIN"
                />
              </div>
            </div>

            <div className="ctr-grid-2">
              <div className="ctr-field">
                <label>Aadhar Card ID Number</label>
                <input
                  value={form.aadharNumber}
                  onChange={(e) => updateField('aadharNumber', e.target.value)}
                  placeholder="Aadhar number"
                />
              </div>
              <div className="ctr-field">
                <label>Aadhar Card Image</label>
                <div className="ctr-upload">
                  <input
                    ref={aadharInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    hidden
                    onChange={(e) => onAadharFile(e.target.files?.[0])}
                  />
                  <Button type="button" variant="secondary" onClick={() => aadharInputRef.current?.click()}>
                    <ImageIcon size={16} /> {form.aadharImage ? 'Replace file' : 'Upload file'}
                  </Button>
                  {form.aadharImage && (
                    <button
                      type="button"
                      className="ctr-clear-upload"
                      onClick={() => updateField('aadharImage', null)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {form.aadharImage && String(form.aadharImage).startsWith('data:image') && (
                  <img src={form.aadharImage} alt="Aadhar preview" className="ctr-aadhar-preview" />
                )}
              </div>
            </div>

            <div className="ctr-field">
              <label>
                Attendance Method <span className="req">*</span>
              </label>
              <div className="ctr-attendance">
                <button
                  type="button"
                  className="ctr-attendance-trigger"
                  onClick={() => setAttendanceOpen((o) => !o)}
                >
                  <span>{selectedAttendance?.label || 'Select method'}</span>
                  <ChevronDown size={16} />
                </button>
                {attendanceOpen && (
                  <div className="ctr-attendance-menu">
                    {ATTENDANCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`ctr-attendance-option ${form.attendanceMethod === opt.value ? 'is-active' : ''}`}
                        onClick={() => {
                          updateField('attendanceMethod', opt.value);
                          setAttendanceOpen(false);
                        }}
                      >
                        <div className="ctr-attendance-copy">
                          <strong>{opt.label}</strong>
                          <p>{opt.description}</p>
                        </div>
                        <div className="ctr-attendance-preview">
                          {opt.preview.map((p) => (
                            <span key={p.text} className={`ctr-preview-badge ${p.tone}`}>
                              {p.text} [{p.badge}]
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="ctr-help">Preference only — attendance entry will be added in a later phase.</p>
            </div>

            <div className="ctr-field">
              <label>
                Contractor Department <span className="req">*</span>
              </label>
              <div className="ctr-dept-selected">
                {selectedDepartments.map((d) => (
                  <span key={d.id || d._id} className="ctr-chip ctr-chip--removable">
                    {d.name}
                    <button type="button" onClick={() => removeDepartment(d.id || d._id)} aria-label="Remove">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="ctr-dept-search">
                <Search size={15} />
                <input
                  value={deptQuery}
                  onChange={(e) => onDeptQueryChange(e.target.value)}
                  onFocus={() => {
                    setDeptSuggestOpen(true);
                    onDeptQueryChange(deptQuery);
                  }}
                  placeholder="Search or create department…"
                />
              </div>
              {deptSuggestOpen && (
                <div className="ctr-suggest-panel ctr-suggest-panel--dept">
                  {(deptLocalSuggest.length > 0 || departments.length > 0) && (
                    <>
                      <div className="ctr-suggest-hint">This project</div>
                      {(deptLocalSuggest.length
                        ? deptLocalSuggest
                        : departments.filter((d) =>
                            String(d.name)
                              .toLowerCase()
                              .includes(deptQuery.trim().toLowerCase()),
                          )
                      ).map((d) => (
                        <button
                          key={d.id || d._id || d.name}
                          type="button"
                          className="ctr-suggest-item"
                          onClick={() => ensureDepartmentSelected(d)}
                        >
                          {d.name}
                        </button>
                      ))}
                    </>
                  )}
                  {(deptCompanySuggest.length > 0 ||
                    companyDeptSuggestions.some((s) =>
                      s.name.toLowerCase().includes(deptQuery.trim().toLowerCase()),
                    )) && (
                    <>
                      <div className="ctr-suggest-hint">From other company projects</div>
                      {(deptCompanySuggest.length
                        ? deptCompanySuggest
                        : companyDeptSuggestions.filter((s) =>
                            s.name.toLowerCase().includes(deptQuery.trim().toLowerCase()),
                          )
                      ).map((s) => (
                        <button
                          key={s.nameLower || s.name}
                          type="button"
                          className="ctr-suggest-item"
                          disabled={creatingDept}
                          onClick={() => addCompanyDeptSuggestion(s.name)}
                        >
                          {s.name}
                        </button>
                      ))}
                    </>
                  )}
                  {deptQuery.trim() && (
                    <button
                      type="button"
                      className="ctr-suggest-item ctr-suggest-create"
                      disabled={creatingDept}
                      onClick={createNewDepartment}
                    >
                      <Plus size={14} /> Create “{deptQuery.trim()}”
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="ctr-note">
            <Info size={14} />
            Attendance tracking is not available yet. This form saves the contractor profile and preferred method only.
          </div>

          <div className="ctr-form-footer">
            <Button type="button" variant="secondary" onClick={backToList} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {editingId ? 'Update Contractor' : 'Create Contractor'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
