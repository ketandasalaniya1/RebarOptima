import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Search, AlertTriangle, Image as ImageIcon, UserRound } from 'lucide-react';
import { manpowerApi } from '../../utils/api';
import { PageHeader, Button, EmptyState } from '../../components/ui';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import { SalaryControl, formatSalary } from './salaryUnits';
import './ManpowerPage.css';

const emptyForm = () => ({
  name: '',
  phone: '',
  address: '',
  labourType: '',
  aadharImage: null,
  salaryAmount: '',
  salaryUnit: 'per_day',
});

export default function CompanyLabourPage() {
  const [mode, setMode] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [labours, setLabours] = useState([]);
  const [listSearch, setListSearch] = useState('');
  const [form, setForm] = useState(emptyForm());
  const aadharInputRef = useRef(null);

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  };

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await manpowerApi.listLabours();
      setLabours(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Failed to load labour');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const filtered = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return labours;
    return labours.filter((row) =>
      `${row.name} ${row.labourType} ${row.phone} ${row.address}`.toLowerCase().includes(q)
    );
  }, [labours, listSearch]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setMode('form');
    setError('');
  };

  const openEdit = (row) => {
    setEditingId(row.id || row._id);
    setForm({
      name: row.name || '',
      phone: row.phone || '',
      address: row.address || '',
      labourType: row.labourType || '',
      aadharImage: row.aadharImage || null,
      salaryAmount: row.salaryAmount ?? '',
      salaryUnit: row.salaryUnit || 'per_day',
    });
    setMode('form');
    setError('');
  };

  const backToList = () => {
    setMode('list');
    setEditingId(null);
    setForm(emptyForm());
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
    reader.onload = () => updateField('aadharImage', reader.result);
    reader.readAsDataURL(file);
  };

  const validate = () => {
    if (!form.name.trim()) return 'Labour name is required';
    if (!form.labourType.trim()) return 'Labour type is required';
    const amount = Number(form.salaryAmount);
    if (!Number.isFinite(amount) || amount < 0) return 'Valid salary amount is required';
    if (!form.salaryUnit) return 'Salary unit is required';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        labourType: form.labourType.trim(),
        aadharImage: form.aadharImage,
        salaryAmount: Number(form.salaryAmount),
        salaryUnit: form.salaryUnit,
      };
      if (editingId) {
        await manpowerApi.updateLabour(editingId, payload);
        flashSuccess('Labour updated');
      } else {
        await manpowerApi.createLabour(payload);
        flashSuccess('Labour created');
      }
      await loadList();
      backToList();
    } catch (err) {
      setError(err.message || 'Failed to save labour');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (row) => {
    if (!confirm(`Deactivate labour "${row.name}"?`)) return;
    try {
      await manpowerApi.deleteLabour(row.id || row._id);
      flashSuccess('Labour deactivated');
      await loadList();
    } catch (err) {
      setError(err.message || 'Failed to deactivate');
    }
  };

  if (loading && mode === 'list') {
    return <LoadingSpinner message="Loading labour…" minHeight="50vh" />;
  }

  return (
    <div className="mp-page">
      {mode === 'list' ? (
        <>
          <PageHeader
            title="Labour"
            subtitle="Company-wide labour records. Not tied to a project."
            actions={
              <Button variant="primary" onClick={openCreate}>
                <Plus size={16} /> Add Labour
              </Button>
            }
          />

          {error && (
            <div className="mp-banner mp-banner--error">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          {success && <div className="mp-banner mp-banner--ok">{success}</div>}

          <div className="mp-toolbar">
            <div className="mp-search">
              <Search size={16} />
              <input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Search name, type, phone…"
              />
            </div>
          </div>

          <div className="mp-table-wrap">
            {filtered.length === 0 ? (
              <EmptyState
                icon={<UserRound size={24} />}
                title="No labour yet"
                description="Add company labour with salary amount and unit."
                action={
                  <Button variant="primary" onClick={openCreate}>
                    <Plus size={16} /> Add Labour
                  </Button>
                }
              />
            ) : (
              <table className="mp-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Phone</th>
                    <th>Salary</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id || row._id}>
                      <td>
                        <div className="mp-name">{row.name}</div>
                        {row.address ? <div className="mp-muted">{row.address}</div> : null}
                      </td>
                      <td>{row.labourType || '—'}</td>
                      <td>{row.phone || '—'}</td>
                      <td>{formatSalary(row.salaryAmount, row.salaryUnit)}</td>
                      <td className="mp-actions">
                        <button type="button" className="mp-icon-btn" title="Edit" onClick={() => openEdit(row)}>
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="mp-icon-btn mp-icon-btn--danger"
                          title="Deactivate"
                          onClick={() => handleDeactivate(row)}
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
            <h2>{editingId ? 'Edit Labour' : 'Add Labour'}</h2>
            <Button variant="secondary" onClick={backToList}>
              Back to list
            </Button>
          </div>

          {error && (
            <div className="mp-banner mp-banner--error">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <form className="mp-card" onSubmit={handleSubmit} noValidate>
            <div className="mp-grid-2">
              <div className="mp-field">
                <label>
                  Name <span className="req">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  required
                />
              </div>
              <div className="mp-field">
                <label>
                  Labour type <span className="req">*</span>
                </label>
                <input
                  value={form.labourType}
                  onChange={(e) => updateField('labourType', e.target.value)}
                  placeholder="e.g. Mason, Helper"
                  required
                />
              </div>
              <div className="mp-field">
                <label>
                  Phone <span className="mp-optional">(optional)</span>
                </label>
                <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
              </div>
              <div className="mp-field">
                <label>
                  Address <span className="mp-optional">(optional)</span>
                </label>
                <input value={form.address} onChange={(e) => updateField('address', e.target.value)} />
              </div>
            </div>

            <SalaryControl
              amount={form.salaryAmount}
              unit={form.salaryUnit}
              onAmountChange={(v) => updateField('salaryAmount', v)}
              onUnitChange={(v) => updateField('salaryUnit', v)}
            />

            <div className="mp-field">
              <label>
                Aadhar image <span className="mp-optional">(optional)</span>
              </label>
              <div className="mp-upload">
                <Button type="button" variant="secondary" onClick={() => aadharInputRef.current?.click()}>
                  <ImageIcon size={16} /> Upload
                </Button>
                {form.aadharImage && (
                  <button type="button" className="mp-clear-upload" onClick={() => updateField('aadharImage', null)}>
                    Remove
                  </button>
                )}
                <input
                  ref={aadharInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  hidden
                  onChange={(e) => onAadharFile(e.target.files?.[0])}
                />
              </div>
              {form.aadharImage && String(form.aadharImage).startsWith('data:image') && (
                <img src={form.aadharImage} alt="Aadhar preview" className="mp-preview" />
              )}
            </div>

            <div className="mp-form-actions">
              <Button type="button" variant="secondary" onClick={backToList} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create labour'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
