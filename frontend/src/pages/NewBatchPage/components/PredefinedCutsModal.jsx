import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  Filter,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCircle2,
  Layers,
  ArrowRight,
  RefreshCw,
  FolderPlus,
  FileText
} from 'lucide-react';
import { predefinedCutsApi } from '../../../utils/api';
import './PredefinedCutsModal.css';
import { Input, Select } from '../../../components/ui';

const STANDARD_DIAMETERS = [8, 10, 12, 16, 20, 25, 32];

export default function PredefinedCutsModal({
  isOpen,
  onClose,
  onApplyToOptimizer,
  projectId,
  initialTab = 'library'
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'library' | 'upload'
  const [records, setRecords] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Filters & Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ diameter: 12, length: '', quantity: '', label: '', groupName: '' });

  // Schedule Management states
  const [isRenamingGroup, setIsRenamingGroup] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState('');

  // Add single cut inline state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCut, setNewCut] = useState({ diameter: 12, length: '', quantity: '1', label: '', groupName: '' });

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [csvRawText, setCsvRawText] = useState('');
  const [uploadGroupName, setUploadGroupName] = useState('');
  const [autoApplyToOptimizer, setAutoApplyToOptimizer] = useState(true);
  const [parsedPreview, setParsedPreview] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef(null);

  // Load records on open
  useEffect(() => {
    if (isOpen) {
      loadRecords();
      loadGroups();
      setSuccessMsg(null);
      setError(null);
    }
  }, [isOpen, projectId]);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await predefinedCutsApi.getAll({ projectId: projectId || '' });
      const items = Array.isArray(res) ? res : res?.data || [];
      setRecords(items);
    } catch (err) {
      setError(err.message || 'Failed to load predefined cut records');
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const res = await predefinedCutsApi.getGroups(projectId || '');
      const list = Array.isArray(res) ? res : [];
      const normalized = list.map((item) => {
        if (typeof item === 'string') {
          return { name: item, itemCount: 0, totalQuantity: 0 };
        }
        return item;
      });
      setGroups(normalized);
    } catch (e) {
      console.warn('Failed to load groups:', e);
    }
  };

  const handleRenameSchedule = async () => {
    if (!newScheduleName.trim() || newScheduleName.trim() === selectedGroup) {
      setIsRenamingGroup(false);
      return;
    }
    try {
      await predefinedCutsApi.renameGroup({
        oldGroupName: selectedGroup,
        newGroupName: newScheduleName.trim(),
        projectId: projectId || undefined,
      });
      const updatedName = newScheduleName.trim();
      setIsRenamingGroup(false);
      setSelectedGroup(updatedName);
      await loadRecords();
      await loadGroups();
      setSuccessMsg(`Schedule renamed to "${updatedName}"`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to rename schedule');
    }
  };

  const handleDeleteEntireSchedule = async () => {
    if (selectedGroup === 'all') return;
    const confirmed = window.confirm(
      `Are you sure you want to delete the entire schedule "${selectedGroup}" and all its cut records? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await predefinedCutsApi.deleteGroup(selectedGroup, projectId || undefined);
      setSelectedGroup('all');
      setSelectedIds(new Set());
      await loadRecords();
      await loadGroups();
      setSuccessMsg(`Schedule "${selectedGroup}" has been deleted.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to delete schedule');
    }
  };

  const handleMoveToNewSchedule = () => {
    const defaultName = `Schedule #${new Date().toLocaleDateString('en-GB')}`;
    setUploadGroupName(defaultName);
    setSelectedFile(null);
    setCsvRawText('');
    setParsedPreview([]);
    setParseErrors([]);
    setActiveTab('upload');
  };

  const handleExportScheduleCsv = () => {
    if (filteredRecords.length === 0) {
      alert('No cuts to export in the current view.');
      return;
    }
    let csv = 'Diameter,Length(mm),Quantity,Member/Label,Schedule/Group\n';
    filteredRecords.forEach((r) => {
      csv += `${r.diameter},${r.length},${r.quantity},"${(r.label || '').replace(/"/g, '""')}","${(r.groupName || '').replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = (selectedGroup !== 'all' ? selectedGroup : 'All_Saved_Cuts').replace(/[^a-z0-9_-]/gi, '_');
    link.setAttribute('download', `${safeName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Filtered Records ───
  const filteredRecords = records.filter((r) => {
    if (selectedGroup !== 'all' && r.groupName !== selectedGroup) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLabel = (r.label || '').toLowerCase().includes(q);
      const matchGroup = (r.groupName || '').toLowerCase().includes(q);
      const matchDia = String(r.diameter || '').includes(q);
      const matchLen = String(r.length || '').includes(q);
      return matchLabel || matchGroup || matchDia || matchLen;
    }
    return true;
  });

  // ─── Selection Handlers ───
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length && filteredRecords.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id || r._id)));
    }
  };

  // ─── Apply to Optimizer ───
  const handleApplySelected = () => {
    const toApply = records.filter((r) => selectedIds.has(r.id || r._id));
    if (toApply.length === 0) return;

    if (onApplyToOptimizer) {
      onApplyToOptimizer(toApply);
    }
    onClose();
  };

  const handleApplyAllFiltered = () => {
    if (filteredRecords.length === 0) return;
    if (onApplyToOptimizer) {
      onApplyToOptimizer(filteredRecords);
    }
    onClose();
  };

  // ─── Single Item CRUD ───
  const handleStartEdit = (r) => {
    setEditingId(r.id || r._id);
    setEditForm({
      diameter: r.diameter || 12,
      length: r.length || '',
      quantity: r.quantity || '',
      label: r.label || '',
      groupName: r.groupName || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.length || !editForm.quantity) {
      alert('Length and quantity are required');
      return;
    }
    try {
      await predefinedCutsApi.update(editingId, editForm);
      setEditingId(null);
      await loadRecords();
      await loadGroups();
    } catch (err) {
      alert(err.message || 'Failed to update record');
    }
  };

  const handleDeleteOne = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this predefined cut record?')) return;
    try {
      await predefinedCutsApi.delete(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadRecords();
      await loadGroups();
    } catch (err) {
      alert(err.message || 'Failed to delete record');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected record(s)?`)) return;

    try {
      await predefinedCutsApi.bulkDelete({ ids });
      setSelectedIds(new Set());
      await loadRecords();
      await loadGroups();
    } catch (err) {
      alert(err.message || 'Failed to delete selected records');
    }
  };

  const handleCreateSingle = async (e) => {
    e.preventDefault();
    if (!newCut.length || !newCut.quantity) return;

    try {
      await predefinedCutsApi.create({
        ...newCut,
        projectId: projectId || undefined
      });
      setNewCut({ diameter: 12, length: '', quantity: '1', label: '', groupName: '' });
      setShowAddForm(false);
      await loadRecords();
      await loadGroups();
      setSuccessMsg('New predefined cut added.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to create predefined cut');
    }
  };

  // ─── CSV Parsing & Upload ───
  const parseLocalCsv = (text) => {
    if (!text || !text.trim()) {
      setParsedPreview([]);
      setParseErrors([]);
      return;
    }

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed = [];
    const errors = [];

    let start = 0;
    if (lines.length > 0) {
      const firstCells = lines[0].split(/[,\t;]/).map((c) => c.replace(/["']/g, '').trim());
      const firstJoined = firstCells.join(' ').toLowerCase();
      if (
        !/^[0-9]+(\.[0-9]+)?\s*(mm)?$/i.test(firstCells[0]) &&
        (firstJoined.includes('dia') || firstJoined.includes('len') || firstJoined.includes('qty'))
      ) {
        start = 1;
      }
    }

    for (let i = start; i < lines.length; i++) {
      const cells = lines[i].split(/[,\t;]/).map((c) => c.replace(/["']/g, '').trim());
      if (cells.length < 2) continue;

      const rawDia = cells[0].replace(/[^0-9.]/g, '');
      const rawLen = cells[1].replace(/[^0-9.]/g, '');
      const rawQty = (cells[2] || '1').replace(/[^0-9.]/g, '');
      const label = cells[3] || '';
      const dia = Number(rawDia);
      const len = Number(rawLen);
      const qty = Math.max(1, Math.round(Number(rawQty) || 1));

      if (isNaN(dia) || dia <= 0 || isNaN(len) || len <= 0) {
        errors.push(`Row ${i + 1}: Invalid diameter or length ("${cells[0]}", "${cells[1]}")`);
        continue;
      }

      const hasCustomGroup = Boolean(cells[4] && cells[4].trim());
      const group = hasCustomGroup ? cells[4].trim() : (uploadGroupName.trim() || 'Schedule');

      parsed.push({
        diameter: dia,
        length: len,
        quantity: qty,
        label,
        groupName: group,
        hasCustomGroup,
      });
    }

    setParsedPreview(parsed);
    setParseErrors(errors);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result || '';
        setCsvRawText(text);
        parseLocalCsv(text);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.tsv'))) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result || '';
        setCsvRawText(text);
        parseLocalCsv(text);
      };
      reader.readAsText(file);
    }
  };

  const handleSaveImport = async () => {
    if (parsedPreview.length === 0) {
      alert('No valid cut rows to import. Please select a valid CSV file.');
      return;
    }

    setIsImporting(true);
    setError(null);
    try {
      const savedGroup = uploadGroupName.trim() || `Schedule #${new Date().toLocaleDateString('en-GB')}`;
      const finalizedRows = parsedPreview.map((r) => ({
        ...r,
        groupName: r.hasCustomGroup ? r.groupName : savedGroup,
      }));

      const res = await predefinedCutsApi.importCsv({
        rows: finalizedRows,
        groupName: savedGroup,
        projectId: projectId || undefined
      });

      const importedItems = res.data || [];

      // If user opted to also load into the optimizer right now
      if (autoApplyToOptimizer && onApplyToOptimizer && importedItems.length > 0) {
        onApplyToOptimizer(importedItems);
      }

      setCsvRawText('');
      setSelectedFile(null);
      setParsedPreview([]);
      setUploadGroupName('');
      setSelectedGroup(savedGroup);
      setActiveTab('library');
      await loadRecords();
      await loadGroups();

      if (autoApplyToOptimizer) {
        onClose();
      } else {
        setSuccessMsg(`Successfully saved schedule "${savedGroup}" with ${importedItems.length} cut record(s).`);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setError(err.message || 'Failed to import CSV data');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateContent =
      'Diameter,Length(mm),Quantity,Label,Group\n' +
      '12,3500,10,Beam-B1,Ground Floor Beams\n' +
      '16,4200,8,Column-C1,Main Columns\n' +
      '20,5800,15,Footing-F2,Foundation\n' +
      '25,6000,6,Plinth Beam,Ground Level\n' +
      '10,2100,24,Stirrup-S1,Shear Links\n';

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'predefined_steel_cutting_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="pc-modal-backdrop">
      <div className="pc-modal-content">
        {/* Header */}
        <div className="pc-modal-header">
          <div className="pc-header-left">
            <div className="pc-header-icon-box">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="pc-modal-title">Predefined Steel Cutting Data (CSV)</h2>
              <p className="pc-modal-subtitle">
                Manage reusable cutting schedules, import CSV files, and load cut lists directly into the Optimizer.
              </p>
            </div>
          </div>
          <button type="button" className="pc-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="pc-tabs-nav">
          <button
            type="button"
            className={`pc-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            <Layers size={15} />
            <span>Saved Cut Schedules ({records.length} cuts)</span>
          </button>
          <button
            type="button"
            className={`pc-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={15} />
            <span>+ New Schedule / Import CSV</span>
          </button>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="pc-alert-banner error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="pc-alert-banner success">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: SAVED CUT LIBRARY */}
        {activeTab === 'library' && (
          <div className="pc-tab-body">
            {/* Top Schedule Navigator Card */}
            <div className="pc-schedule-navigator-card">
              <div className="pc-schedule-nav-left">
                <div className="pc-schedule-select-wrapper">
                  <span className="pc-schedule-badge-label">Active Schedule:</span>
                  {isRenamingGroup ? (
                    <div className="pc-rename-row">
                      <Input
                        type="text"
                        value={newScheduleName}
                        onChange={(e) => setNewScheduleName(e.target.value)}
                        className="pc-rename-input"
                        placeholder="Enter new schedule name..."
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSchedule();
                          if (e.key === 'Escape') setIsRenamingGroup(false);
                        }}
                      />
                      <button
                        type="button"
                        className="pc-btn-primary pc-btn-xs"
                        onClick={handleRenameSchedule}
                        title="Save new schedule name"
                      >
                        <Check size={13} /> Save
                      </button>
                      <button
                        type="button"
                        className="pc-btn-secondary pc-btn-xs"
                        onClick={() => setIsRenamingGroup(false)}
                        title="Cancel"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="pc-schedule-view-row">
                      <Select
                        value={selectedGroup}
                        onChange={(e) => {
                          setSelectedGroup(e.target.value);
                          setSelectedIds(new Set());
                        }}
                        className="pc-schedule-dropdown"
                      >
                        <option value="all">All Saved Schedules ({records.length} cuts total)</option>
                        {groups.map((g) => (
                          <option key={g.name} value={g.name}>
                            {g.name} ({g.itemCount} cut{g.itemCount === 1 ? '' : 's'}{g.totalQuantity ? ` • ${g.totalQuantity} pcs` : ''})
                          </option>
                        ))}
                      </Select>

                      {selectedGroup !== 'all' && (
                        <div className="pc-schedule-quick-actions">
                          <button
                            type="button"
                            className="pc-btn-chip"
                            onClick={() => {
                              setNewScheduleName(selectedGroup);
                              setIsRenamingGroup(true);
                            }}
                            title="Rename this schedule"
                          >
                            <Edit2 size={12} />
                            <span>Rename</span>
                          </button>
                          <button
                            type="button"
                            className="pc-btn-chip danger"
                            onClick={handleDeleteEntireSchedule}
                            title="Delete this entire schedule"
                          >
                            <Trash2 size={12} />
                            <span>Delete Schedule</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="pc-schedule-nav-right">
                <button
                  type="button"
                  className="pc-btn-chip"
                  onClick={handleExportScheduleCsv}
                  title="Export currently displayed cuts to CSV"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  className="pc-btn-new-schedule"
                  onClick={handleMoveToNewSchedule}
                  title="Create or import a brand new cut schedule"
                >
                  <FolderPlus size={14} />
                  <span>+ New Schedule / Import</span>
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="pc-toolbar-row">
              <div className="pc-search-box">
                <Search size={15} className="pc-search-icon" />
                <Input
                  type="text"
                  placeholder={
                    selectedGroup !== 'all'
                      ? `Search in "${selectedGroup}" (label, diameter, length)...`
                      : 'Search across all saved cuts (label, diameter, length, group)...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pc-search-input"
                />
              </div>

              <div className="pc-toolbar-actions">
                <button
                  type="button"
                  className="pc-btn-secondary"
                  onClick={() => {
                    if (!showAddForm && selectedGroup !== 'all') {
                      setNewCut((prev) => ({ ...prev, groupName: selectedGroup }));
                    }
                    setShowAddForm(!showAddForm);
                  }}
                >
                  <Plus size={14} />
                  <span>{showAddForm ? 'Hide Form' : selectedGroup !== 'all' ? `+ Add Cut to ${selectedGroup}` : '+ Add Cut'}</span>
                </button>
                <button
                  type="button"
                  className="pc-btn-secondary"
                  onClick={handleDownloadTemplate}
                  title="Download sample CSV template"
                >
                  <Download size={14} />
                  <span>Template</span>
                </button>
              </div>
            </div>

            {/* Quick Add Inline Form */}
            {showAddForm && (
              <form onSubmit={handleCreateSingle} className="pc-inline-add-card">
                <div className="pc-inline-add-title">Add Predefined Cut Item</div>
                <div className="pc-inline-form-grid">
                  <div className="pc-form-group">
                    <label>Diameter (mm)</label>
                    <Select
                      value={newCut.diameter}
                      onChange={(e) => setNewCut({ ...newCut, diameter: Number(e.target.value) })}
                      className="pc-input"
                    >
                      {STANDARD_DIAMETERS.map((d) => (
                        <option key={d} value={d}>{d} mm</option>
                      ))}
                    </Select>
                  </div>
                  <div className="pc-form-group">
                    <label>Required Length (mm) *</label>
                    <Input
                      type="number"
                      placeholder="e.g. 3500"
                      value={newCut.length}
                      onChange={(e) => setNewCut({ ...newCut, length: e.target.value })}
                      className="pc-input"
                      required
                    />
                  </div>
                  <div className="pc-form-group">
                    <label>Quantity (pcs) *</label>
                    <Input
                      type="number"
                      placeholder="e.g. 10"
                      value={newCut.quantity}
                      onChange={(e) => setNewCut({ ...newCut, quantity: e.target.value })}
                      className="pc-input"
                      required
                    />
                  </div>
                  <div className="pc-form-group">
                    <label>Member Label</label>
                    <Input
                      type="text"
                      placeholder="e.g. Beam-B1"
                      value={newCut.label}
                      onChange={(e) => setNewCut({ ...newCut, label: e.target.value })}
                      className="pc-input"
                    />
                  </div>
                  <div className="pc-form-group">
                    <label>Schedule / Group</label>
                    <Input
                      type="text"
                      placeholder="e.g. GF Beams"
                      value={newCut.groupName}
                      onChange={(e) => setNewCut({ ...newCut, groupName: e.target.value })}
                      className="pc-input"
                    />
                  </div>
                </div>
                <div className="pc-inline-add-footer">
                  <button type="button" className="pc-btn-secondary" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="pc-btn-primary">
                    <Plus size={14} /> Save Cut
                  </button>
                </div>
              </form>
            )}

            {/* Selection Status Bar */}
            <div className="pc-selection-bar">
              <div className="pc-sel-left">
                <button type="button" className="pc-check-btn" onClick={toggleSelectAll}>
                  {selectedIds.size === filteredRecords.length && filteredRecords.length > 0 ? (
                    <CheckSquare size={16} className="text-emerald" />
                  ) : (
                    <Square size={16} />
                  )}
                  <span>
                    Select All ({selectedIds.size} of {filteredRecords.length} selected)
                  </span>
                </button>
              </div>

              <div className="pc-sel-right">
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    className="pc-btn-danger"
                    onClick={handleBulkDelete}
                    title="Delete selected cuts from database"
                  >
                    <Trash2 size={14} />
                    <span>Delete Selected ({selectedIds.size})</span>
                  </button>
                )}

                <button
                  type="button"
                  className="pc-btn-apply"
                  onClick={selectedIds.size > 0 ? handleApplySelected : handleApplyAllFiltered}
                  disabled={filteredRecords.length === 0}
                  title="Inject these cuts into the Optimizer cutting table"
                >
                  <ArrowRight size={15} />
                  <span>
                    {selectedIds.size > 0
                      ? `Apply Selected (${selectedIds.size}) to Optimizer`
                      : `Apply All (${filteredRecords.length}) to Optimizer`}
                  </span>
                </button>
              </div>
            </div>

            {/* Table Area */}
            {loading ? (
              <div className="pc-loading-state">
                <RefreshCw size={24} className="pc-spin-icon" />
                <span>Loading predefined cuts...</span>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="pc-empty-state">
                <FileSpreadsheet size={36} className="pc-empty-icon" />
                <h4>No predefined cuts found</h4>
                <p>
                  {records.length === 0
                    ? 'No cut records in the database. Upload a CSV file or add rows to start building your library.'
                    : 'No records matched your search and filter criteria.'}
                </p>
                {records.length === 0 && (
                  <button type="button" className="pc-btn-primary" onClick={() => setActiveTab('upload')}>
                    <Upload size={14} /> Upload CSV Now
                  </button>
                )}
              </div>
            ) : (
              <div className="pc-table-wrap">
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th style={{ width: '45px' }}>#</th>
                      <th>Diameter</th>
                      <th>Cut Length</th>
                      <th>Quantity</th>
                      <th>Member / Label</th>
                      <th>Schedule / Group</th>
                      <th style={{ width: '90px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((r, idx) => {
                      const id = r.id || r._id;
                      const isSelected = selectedIds.has(id);
                      const isEditing = editingId === id;

                      if (isEditing) {
                        return (
                          <tr key={id} className="pc-row-editing">
                            <td></td>
                            <td>{idx + 1}</td>
                            <td>
                              <Select
                                value={editForm.diameter}
                                onChange={(e) => setEditForm({ ...editForm, diameter: Number(e.target.value) })}
                                className="pc-input-sm"
                              >
                                {STANDARD_DIAMETERS.map((d) => (
                                  <option key={d} value={d}>{d} mm</option>
                                ))}
                              </Select>
                            </td>
                            <td>
                              <Input
                                type="number"
                                value={editForm.length}
                                onChange={(e) => setEditForm({ ...editForm, length: e.target.value })}
                                className="pc-input-sm"
                              />
                            </td>
                            <td>
                              <Input
                                type="number"
                                value={editForm.quantity}
                                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                className="pc-input-sm"
                              />
                            </td>
                            <td>
                              <Input
                                type="text"
                                value={editForm.label}
                                onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                                className="pc-input-sm"
                              />
                            </td>
                            <td>
                              <Input
                                type="text"
                                value={editForm.groupName}
                                onChange={(e) => setEditForm({ ...editForm, groupName: e.target.value })}
                                className="pc-input-sm"
                              />
                            </td>
                            <td>
                              <div className="pc-actions-cell">
                                <button type="button" className="pc-icon-action save" onClick={handleSaveEdit} title="Save">
                                  <Check size={14} />
                                </button>
                                <button type="button" className="pc-icon-action cancel" onClick={() => setEditingId(null)} title="Cancel">
                                  <X size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr
                          key={id}
                          className={isSelected ? 'pc-row-selected' : ''}
                          onClick={() => toggleSelect(id)}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="pc-cell-check"
                              onClick={() => toggleSelect(id)}
                            >
                              {isSelected ? <CheckSquare size={16} className="text-emerald" /> : <Square size={16} />}
                            </button>
                          </td>
                          <td className="pc-muted">{idx + 1}</td>
                          <td>
                            <span className="pc-dia-badge">{r.diameter} mm</span>
                          </td>
                          <td className="pc-len-cell">
                            <strong>{Number(r.length).toLocaleString()}</strong> mm
                          </td>
                          <td>
                            <span className="pc-qty-badge">{r.quantity} pcs</span>
                          </td>
                          <td>
                            <span className="pc-label-tag">{r.label || '—'}</span>
                          </td>
                          <td>
                            <span className="pc-group-tag">{r.groupName || 'Default'}</span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="pc-actions-cell">
                              <button
                                type="button"
                                className="pc-icon-action"
                                onClick={() => handleStartEdit(r)}
                                title="Edit cut item"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                className="pc-icon-action danger"
                                onClick={(e) => handleDeleteOne(id, e)}
                                title="Delete cut item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UPLOAD & IMPORT CSV */}
        {activeTab === 'upload' && (
          <div className="pc-tab-body">
            <div className="pc-upload-container">
              {/* Header inside Upload */}
              <div className="pc-upload-intro-row">
                <div>
                  <h3 className="pc-upload-section-title">Create / Import New Schedule</h3>
                  <p className="pc-upload-section-subtitle">
                    Give this schedule a name and upload your CSV or paste cut rows. It will be saved as an independent schedule in your library.
                  </p>
                </div>
                <button
                  type="button"
                  className="pc-btn-secondary pc-btn-xs"
                  onClick={() => setActiveTab('library')}
                >
                  ← Back to Saved Schedules
                </button>
              </div>

              {/* Upload Meta Options */}
              <div className="pc-upload-options-grid">
                <div className="pc-form-group">
                  <label>Schedule / Dataset Name *</label>
                  <Input
                    type="text"
                    placeholder="e.g. Ground Floor Footings, Tower A Beams"
                    value={uploadGroupName}
                    onChange={(e) => setUploadGroupName(e.target.value)}
                    className="pc-input"
                  />
                  <span className="pc-help-hint">Name this schedule so you can find, view, edit, or reload it anytime.</span>
                </div>

                <div className="pc-form-group">
                  <label>Sample Format</label>
                  <button type="button" className="pc-btn-secondary w-full" onClick={handleDownloadTemplate}>
                    <Download size={14} /> Download Sample CSV
                  </button>
                  <span className="pc-help-hint">Reference format: Diameter, Length, Quantity, Label</span>
                </div>
              </div>

              {/* Drag & Drop Card */}
              <div
                className={`pc-dropzone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div className="pc-dropzone-inner">
                  <div className="pc-drop-icon-box">
                    <Upload size={28} />
                  </div>
                  {selectedFile ? (
                    <div className="pc-file-selected-box">
                      <FileText size={20} className="text-emerald" />
                      <div>
                        <strong>{selectedFile.name}</strong>
                        <span>({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 className="pc-drop-title">Drop your CSV file here, or click to browse</h4>
                      <p className="pc-drop-desc">Supports .csv, .tsv, and .txt files with columns: Diameter, Length, Quantity, Label</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Checkbox: Load into Optimizer */}
              <div className="pc-auto-apply-row">
                <label className="pc-check-label">
                  <Input
                    type="checkbox"
                    checked={autoApplyToOptimizer}
                    onChange={(e) => setAutoApplyToOptimizer(e.target.checked)}
                  />
                  <span>Automatically load these cut parts into the Optimizer table upon import</span>
                </label>
              </div>

              {/* Errors if any */}
              {parseErrors.length > 0 && (
                <div className="pc-parse-errors">
                  <div className="pc-error-header">
                    <AlertCircle size={15} />
                    <span>{parseErrors.length} row warning(s):</span>
                  </div>
                  <ul>
                    {parseErrors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {parseErrors.length > 5 && <li>...and {parseErrors.length - 5} more warnings.</li>}
                  </ul>
                </div>
              )}

              {/* Live Preview Table */}
              {parsedPreview.length > 0 && (
                <div className="pc-preview-section">
                  <div className="pc-preview-header">
                    <h4>Preview of Parsed Cuts ({parsedPreview.length} rows found)</h4>
                    <span className="pc-valid-badge">
                      <Check size={12} /> Ready to save
                    </span>
                  </div>
                  <div className="pc-preview-table-wrap">
                    <table className="pc-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Diameter</th>
                          <th>Length</th>
                          <th>Quantity</th>
                          <th>Label</th>
                          <th>Group</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedPreview.slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            <td className="pc-muted">{i + 1}</td>
                            <td><span className="pc-dia-badge">{row.diameter} mm</span></td>
                            <td><strong>{row.length}</strong> mm</td>
                            <td><span className="pc-qty-badge">{row.quantity} pcs</span></td>
                            <td>{row.label || '—'}</td>
                            <td><span className="pc-group-tag">{row.groupName}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedPreview.length > 10 && (
                      <div className="pc-preview-more">
                        + {parsedPreview.length - 10} more cut rows will be imported.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pc-upload-actions-footer">
                <button
                  type="button"
                  className="pc-btn-secondary"
                  onClick={() => {
                    setSelectedFile(null);
                    setCsvRawText('');
                    setParsedPreview([]);
                    setActiveTab('library');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pc-btn-primary"
                  onClick={handleSaveImport}
                  disabled={parsedPreview.length === 0 || isImporting}
                >
                  {isImporting ? (
                    <>
                      <RefreshCw size={14} className="pc-spin-icon" /> Saving Data...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Import & Save {parsedPreview.length > 0 ? `(${parsedPreview.length} Cuts)` : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
