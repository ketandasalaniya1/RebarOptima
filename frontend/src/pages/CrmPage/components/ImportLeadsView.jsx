import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, ArrowRight,
  ArrowLeft, Download, RefreshCw, FileText, Check, Database, AlertCircle,
  Users, Building2, HelpCircle, ExternalLink, Filter
} from 'lucide-react';
import { crmApi } from '../../../utils/crmApi';
import { formatINR } from '../../../utils/money';
import { Input, Select } from '../../../components/ui';

// Standard target CRM fields available for mapping
const TARGET_FIELDS = [
  { key: 'fullName', label: 'Full Name *', required: true, description: 'Customer or buyer full name' },
  { key: 'firstName', label: 'First Name', description: 'Used if full name is split' },
  { key: 'lastName', label: 'Last Name', description: 'Used if full name is split' },
  { key: 'phone', label: 'Mobile / Phone Number *', required: true, description: '10-digit Indian phone number' },
  { key: 'altPhone', label: 'Alternate Phone', description: 'Secondary mobile number' },
  { key: 'email', label: 'Email Address', description: 'Customer email' },
  { key: 'projectName', label: 'Project Name', description: 'Target property project' },
  { key: 'interestedUnit', label: 'Interested Unit / Typology', description: 'e.g. 2BHK, 3BHK, Unit 402' },
  { key: 'budget', label: 'Budget Range', description: 'Estimated budget (₹ or Lakhs)' },
  { key: 'leadSource', label: 'Lead Source', description: 'e.g. 99acres, MagicBricks, Website, Facebook Ads' },
  { key: 'leadStatus', label: 'Lead Stage / Status', description: 'e.g. New enquiry, Qualified, Contacted' },
  { key: 'nextFollowupDate', label: 'Next Follow-up Date', description: 'YYYY-MM-DD format' },
  { key: 'assignedEmployee', label: 'Assigned Salesperson', description: 'Sales executive name or email' },
  { key: 'city', label: 'City / Location', description: 'Customer residence city' },
  { key: 'notes', label: 'Notes / Remarks', description: 'Initial inquiry notes or comments' }
];

export default function ImportLeadsView({
  projects = [],
  selectedProjectId,
  onSwitchScreen,
  onRefreshData
}) {
  // Wizard Step: 1 = Upload, 2 = Map, 3 = Preview & Validate, 4 = Strategy, 5 = Execute & Results
  const [currentStep, setCurrentStep] = useState(1);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Parsed File Data from Server
  const [parsedData, setParsedData] = useState(null); // { fileName, totalRows, headers, rows, previewRows, detectedMapping }
  const [columnMapping, setColumnMapping] = useState({});

  // Duplicate Strategy & Target Project State
  const [duplicateStrategy, setDuplicateStrategy] = useState('skip'); // 'skip' | 'update' | 'new_only'
  const [targetProjectId, setTargetProjectId] = useState(selectedProjectId || '');

  // Execution & Results State
  const [executing, setExecuting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Import History State
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Update targetProjectId when selectedProjectId prop changes
  useEffect(() => {
    if (selectedProjectId) {
      setTargetProjectId(String(selectedProjectId));
    } else if (projects.length > 0 && !targetProjectId) {
      setTargetProjectId(String(projects[0]._id));
    }
  }, [selectedProjectId, projects]);

  // Load Import History
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await crmApi.getImportHistory();
      setHistory(Array.isArray(res) ? res : res?.history || []);
    } catch (err) {
      console.warn('Failed to load import history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file) => {
    setUploadError('');
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setUploadError('Please select a valid CSV or Excel (.xlsx, .xls) file.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File size exceeds the 20MB limit.');
      return;
    }
    setSelectedFile(file);
  };

  // Upload and parse file
  const handleUploadAndParse = async () => {
    if (!selectedFile) return;
    setUploadLoading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await crmApi.uploadImportFile(formData);

      setParsedData(res);
      // Initialize mappings with server detected mappings
      const initialMap = {};
      (res.headers || []).forEach(header => {
        initialMap[header] = res.detectedMapping?.[header] || 'ignore';
      });
      setColumnMapping(initialMap);
      setCurrentStep(2); // Move to Column Mapping
    } catch (err) {
      setUploadError(err.response?.data?.message || err.message || 'Failed to upload and parse file.');
    } finally {
      setUploadLoading(false);
    }
  };

  // Change individual column mapping
  const handleMappingChange = (fileCol, targetField) => {
    setColumnMapping(prev => ({
      ...prev,
      [fileCol]: targetField
    }));
  };

  // Validation Check before proceeding to Preview (Check required fields)
  const isIdentityMapped = () => {
    const mappedValues = Object.values(columnMapping);
    const hasName = mappedValues.includes('fullName') || (mappedValues.includes('firstName') && mappedValues.includes('lastName'));
    const hasPhone = mappedValues.includes('phone');
    return hasName && hasPhone;
  };

  // Preview Row Validation Helper
  const validateRow = (row) => {
    const mapped = {};
    Object.entries(columnMapping).forEach(([col, target]) => {
      if (target && target !== 'ignore') {
        mapped[target] = row[col] !== undefined ? String(row[col]).trim() : '';
      }
    });

    let name = mapped.fullName || `${mapped.firstName || ''} ${mapped.lastName || ''}`.trim();
    name = name.replace(/^[~\s]+/, '').trim() || name.trim();
    const phone = (mapped.phone || '').replace(/\D/g, '');

    const errors = [];
    if (!name) errors.push('Missing customer name');
    if (!phone || phone.length < 10) errors.push('Invalid phone (min 10 digits)');

    return {
      isValid: errors.length === 0,
      errors,
      name,
      phone,
      email: mapped.email || '',
      project: mapped.projectName || 'Default Project',
      unit: mapped.interestedUnit || '-',
      budget: mapped.budget || '-',
      source: mapped.leadSource || 'CSV Import'
    };
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (!parsedData || executing) return;
    setExecuting(true);
    try {
      const payload = {
        rows: parsedData.rows || [],
        mapping: columnMapping,
        duplicateStrategy,
        projectId: targetProjectId || undefined,
        fileName: parsedData.fileName || selectedFile?.name || 'Import'
      };

      const res = await crmApi.executeLeadImport(payload);
      setImportResult(res);
      setCurrentStep(5); // Show Results
      loadHistory();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert('Import execution failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setExecuting(false);
    }
  };

  // Download Sample CSV
  const handleDownloadSample = () => {
    const csvContent =
      "Full Name,Phone Number,Email,Project Name,Interested Unit,Budget,Lead Source,Next Follow-up Date,Notes,City\n" +
      "Vikram Malhotra,9876543210,vikram.m@example.com,Grand Horizon,3BHK Luxury,8500000,99acres,2026-11-20,Looking for East facing higher floor,Mumbai\n" +
      "Sneha Sharma,9823456789,sneha.s@example.com,Skyline Heights,2BHK,6500000,MagicBricks,2026-11-22,Pre-approved home loan with HDFC,Pune\n" +
      "Rajesh Verma,9811223344,rajesh.verma@example.com,Grand Horizon,4BHK Penthouse,15000000,Facebook Ads,2026-11-18,Interested in duplex configuration,Bangalore\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_real_estate_leads_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Error CSV Report
  const handleDownloadErrorReport = () => {
    if (!importResult?.errors || importResult.errors.length === 0) return;
    const headers = ['Row Number', 'Failure Reason', 'Correction Hint', 'Raw Data'];
    const rows = importResult.errors.map(e => [
      e.rowNumber,
      `"${(e.reason || '').replace(/"/g, '""')}"`,
      `"${(e.correction || '').replace(/"/g, '""')}"`,
      `"${JSON.stringify(e.data || {}).replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `import_errors_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset wizard to start another import
  const handleStartNew = () => {
    setSelectedFile(null);
    setParsedData(null);
    setColumnMapping({});
    setImportResult(null);
    setUploadError('');
    setCurrentStep(1);
  };

  return (
    <div className="crm-import-leads-view" style={{ padding: '24px', maxWidth: '1360px', margin: '0 auto', color: "var(--text-primary)" }}>
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--info-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: "var(--accent)" }}>
              <Upload size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800 }}>Lead Import Pipeline</h1>
              <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: "var(--text-secondary)" }}>
                Bulk import real estate leads from Excel/CSV with auto column mapping and duplicate resolution
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleDownloadSample}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: "var(--input-bg)",
              color: "var(--accent)",
              border: "1px solid var(--card-border)",
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Download size={15} /> Download Sample Template
          </button>
        </div>
      </div>

      {/* ── STEPPER PROGRESS BAR ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: '12px',
        padding: '12px 20px',
        marginBottom: '24px',
        overflowX: 'auto'
      }}>
        {[
          { num: 1, label: 'Upload File' },
          { num: 2, label: 'Map Columns' },
          { num: 3, label: 'Preview & Validate' },
          { num: 4, label: 'Duplicate Strategy' },
          { num: 5, label: 'Execute & Results' }
        ].map((step, idx, arr) => {
          const isDone = currentStep > step.num;
          const isCurrent = currentStep === step.num;
          return (
            <React.Fragment key={step.num}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: isDone ? 'var(--accent)' : (isCurrent ? 'var(--accent)' : 'var(--input-bg)'),
                  color: (isDone || isCurrent) ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.82rem'
                }}>
                  {isDone ? <Check size={16} /> : step.num}
                </div>
                <span style={{
                  fontSize: '0.86rem',
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? 'var(--text-primary)' : (isDone ? 'var(--accent-text)' : 'var(--text-secondary)')
                }}>
                  {step.label}
                </span>
              </div>
              {idx < arr.length - 1 && (
                <div style={{
                  flex: 1,
                  height: '2px',
                  background: isDone ? 'var(--accent)' : 'var(--input-bg)',
                  margin: '0 16px',
                  minWidth: '24px'
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── STEP 1: FILE UPLOAD ─────────────────────────────────────────────── */}
      {currentStep === 1 && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', padding: '32px' }}>
          <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px' }}>Upload Leads Spreadsheet</h2>
            <p style={{ fontSize: '0.86rem', color: "var(--text-secondary)", margin: '0 0 24px' }}>
              Upload lead exports from 99acres, MagicBricks, Housing.com, Facebook Ads, or your internal CSV.
            </p>

            {/* Drag & Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? 'var(--accent)' : (selectedFile ? 'var(--accent)' : 'var(--card-border)')}`,
                background: dragActive ? 'var(--info-subtle)' : (selectedFile ? 'var(--success-subtle)' : 'var(--input-bg)'),
                borderRadius: '16px',
                padding: '40px 24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: '20px'
              }}
            >
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {selectedFile ? (
                <div>
                  <FileSpreadsheet size={48} color="var(--accent-text)" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: "var(--text-primary)" }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: "var(--text-secondary)", marginTop: '4px' }}>
                    {(selectedFile.size / 1024).toFixed(1)} KB • Click or drop another file to replace
                  </div>
                </div>
              ) : (
                <div>
                  <Upload size={44} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: "var(--text-primary)" }}>
                    Drag &amp; drop your CSV or Excel file here
                  </div>
                  <div style={{ fontSize: '0.82rem', color: "var(--text-secondary)", marginTop: '6px' }}>
                    Supports .CSV, .XLSX, and .XLS files (up to 20MB)
                  </div>
                  <button
                    type="button"
                    style={{
                      marginTop: '16px',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: "var(--accent)", color: "var(--accent-contrast)",
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Browse Files
                  </button>
                </div>
              )}
            </div>

            {uploadError && (
              <div style={{
                background: 'var(--danger-subtle)',
                border: '1px solid var(--danger)',
                color: 'var(--danger-text)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px',
                textAlign: 'left'
              }}>
                <AlertCircle size={16} />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                disabled={!selectedFile || uploadLoading}
                onClick={handleUploadAndParse}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  background: (!selectedFile || uploadLoading) ? 'var(--input-bg)' : 'var(--accent)',
                  color: (!selectedFile || uploadLoading) ? 'var(--text-secondary)' : 'var(--accent-contrast)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: (!selectedFile || uploadLoading) ? 'not-allowed' : 'pointer'
                }}
              >
                {uploadLoading ? (
                  <>
                    <RefreshCw size={16} className="crm-spin" /> Uploading &amp; Parsing...
                  </>
                ) : (
                  <>
                    Continue to Mapping <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: COLUMN MAPPING ──────────────────────────────────────────── */}
      {currentStep === 2 && parsedData && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Map File Columns to CRM Fields</h2>
              <p style={{ fontSize: '0.84rem', color: "var(--text-secondary)", margin: '4px 0 0' }}>
                Detected {parsedData.totalRows} records from <strong>{parsedData.fileName}</strong>. Confirm field mapping below.
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '8px',
              background: isIdentityMapped() ? 'var(--success-subtle)' : 'var(--danger-subtle)',
              border: `1px solid ${isIdentityMapped() ? 'var(--accent)' : 'var(--danger)'}`,
              color: isIdentityMapped() ? 'var(--accent-text)' : 'var(--danger-text)',
              fontSize: '0.82rem',
              fontWeight: 600
            }}>
              {isIdentityMapped() ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{isIdentityMapped() ? 'Required Identity Fields Mapped (Name & Phone)' : 'Missing Required Mappings: Full Name & Phone'}</span>
            </div>
          </div>

          <div style={{ border: "1px solid var(--card-border)", borderRadius: '10px', overflow: 'hidden', marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: "var(--input-bg)", borderBottom: '1px solid var(--card-border)', color: "var(--text-secondary)" }}>
                  <th style={{ padding: '12px 16px', width: '30%' }}>File Column Header</th>
                  <th style={{ padding: '12px 16px', width: '35%' }}>First Row Sample</th>
                  <th style={{ padding: '12px 16px', width: '35%' }}>Map to CRM Field</th>
                </tr>
              </thead>
              <tbody>
                {(parsedData.headers || []).map((header, idx) => {
                  const sampleVal = parsedData.previewRows?.[0]?.[header] || '-';
                  const currentMapped = columnMapping[header] || 'ignore';
                  const isMapped = currentMapped && currentMapped !== 'ignore';

                  return (
                    <tr key={header} style={{ borderBottom: "1px solid var(--card-border)", background: idx % 2 === 0 ? 'var(--main-bg)' : 'var(--card-bg)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: "var(--text-primary)" }}>
                        {header}
                      </td>
                      <td style={{ padding: '12px 16px', color: "var(--text-secondary)", fontStyle: 'italic', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {String(sampleVal)}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <Select
                          value={currentMapped}
                          onChange={(e) => handleMappingChange(header, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: isMapped ? 'var(--input-bg)' : 'var(--card-bg)',
                            color: isMapped ? 'var(--info-text)' : 'var(--text-secondary)',
                            border: `1px solid ${isMapped ? 'var(--accent)' : 'var(--card-border)'}`,
                            fontSize: '0.84rem',
                            fontWeight: isMapped ? 600 : 400,
                            cursor: 'pointer'
                          }}
                        >
                          <option value="ignore">❌ Ignore (Do not import)</option>
                          <optgroup label="Standard CRM Fields">
                            {TARGET_FIELDS.map(f => (
                              <option key={f.key} value={f.key}>
                                {f.label}
                              </option>
                            ))}
                          </optgroup>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Nav Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                border: "1px solid var(--card-border)",
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} /> Back to File Upload
            </button>

            <button
              type="button"
              disabled={!isIdentityMapped()}
              onClick={() => setCurrentStep(3)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '8px',
                background: !isIdentityMapped() ? 'var(--input-bg)' : 'var(--accent)',
                color: !isIdentityMapped() ? 'var(--text-secondary)' : 'var(--accent-contrast)',
                fontWeight: 700,
                fontSize: '0.9rem',
                border: 'none',
                cursor: !isIdentityMapped() ? 'not-allowed' : 'pointer'
              }}
            >
              Preview &amp; Validate Data <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: PREVIEW & VALIDATE ──────────────────────────────────────── */}
      {currentStep === 3 && parsedData && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Preview &amp; Pre-Validation</h2>
              <p style={{ fontSize: '0.84rem', color: "var(--text-secondary)", margin: '4px 0 0' }}>
                Reviewing the first 15 records. Invalid records will be flagged with reason.
              </p>
            </div>
          </div>

          {/* Validation Summary Pills */}
          {(() => {
            const previewRows = (parsedData.previewRows || []).map(validateRow);
            const validCount = previewRows.filter(r => r.isValid).length;
            const invalidCount = previewRows.filter(r => !r.isValid).length;

            return (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
                <div style={{ background: "var(--input-bg)", padding: '10px 16px', borderRadius: '8px', border: "1px solid var(--card-border)" }}>
                  <div style={{ fontSize: '0.74rem', color: "var(--text-secondary)" }}>Total File Rows</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: "var(--text-primary)" }}>{parsedData.totalRows}</div>
                </div>
                <div style={{ background: "var(--input-bg)", padding: '10px 16px', borderRadius: '8px', border: "1px solid var(--card-border)" }}>
                  <div style={{ fontSize: '0.74rem', color: "var(--text-secondary)" }}>Preview Sample Valid</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-text)' }}>{validCount}</div>
                </div>
                {invalidCount > 0 && (
                  <div style={{ background: "var(--input-bg)", padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--danger)' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--danger-text)' }}>Preview Sample Invalid</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--danger-text)' }}>{invalidCount}</div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Preview Table */}
          <div style={{ border: "1px solid var(--card-border)", borderRadius: '10px', overflowX: 'auto', marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: "var(--input-bg)", borderBottom: '1px solid var(--card-border)', color: "var(--text-secondary)" }}>
                  <th style={{ padding: '10px 14px' }}>Row #</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px' }}>Customer Name</th>
                  <th style={{ padding: '10px 14px' }}>Phone</th>
                  <th style={{ padding: '10px 14px' }}>Email</th>
                  <th style={{ padding: '10px 14px' }}>Project</th>
                  <th style={{ padding: '10px 14px' }}>Interest</th>
                  <th style={{ padding: '10px 14px' }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {(parsedData.previewRows || []).slice(0, 15).map((row, idx) => {
                  const v = validateRow(row);
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--card-border)", background: idx % 2 === 0 ? 'var(--main-bg)' : 'var(--card-bg)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {v.isValid ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-text)', fontWeight: 600, fontSize: '0.78rem' }}>
                            <CheckCircle2 size={14} /> Ready
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--danger-text)', fontWeight: 600, fontSize: '0.78rem' }} title={v.errors.join(', ')}>
                            <XCircle size={14} /> {v.errors[0]}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: "var(--text-primary)" }}>{v.name || <span style={{ color: 'var(--danger-text)' }}>Missing</span>}</td>
                      <td style={{ padding: '10px 14px', color: "var(--accent)" }}>{v.phone || <span style={{ color: 'var(--danger-text)' }}>Missing</span>}</td>
                      <td style={{ padding: '10px 14px', color: "var(--text-secondary)" }}>{v.email || '-'}</td>
                      <td style={{ padding: '10px 14px', color: "var(--text-primary)" }}>{v.project}</td>
                      <td style={{ padding: '10px 14px', color: "var(--text-secondary)" }}>{v.unit}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--warning-text)' }}>{v.source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Navigation Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                border: "1px solid var(--card-border)",
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} /> Back to Mapping
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '8px',
                background: "var(--accent)", color: "var(--accent-contrast)",
                fontWeight: 700,
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Configure Strategy <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: DUPLICATE STRATEGY & TARGET PROJECT ─────────────────────── */}
      {currentStep === 4 && parsedData && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', padding: '28px', maxWidth: '780px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px' }}>Duplicate Handling &amp; Project Target</h2>
          <p style={{ fontSize: '0.86rem', color: "var(--text-secondary)", margin: '0 0 24px' }}>
            Specify how RebarOptima should handle duplicate phone numbers found either within this file or in the existing customer database.
          </p>

          {/* Target Project Dropdown */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: "var(--text-primary)", marginBottom: '8px' }}>
              Target Project Assignment
            </label>
            <Select
              value={targetProjectId}
              onChange={(e) => setTargetProjectId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                border: "1px solid var(--card-border)",
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="">Use Project Name from File / Default Project</option>
              {projects.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </Select>
            <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", marginTop: '6px' }}>
              If a row has its own project column mapped, that project takes precedence.
            </div>
          </div>

          {/* Duplicate Strategies Radio Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: "var(--text-primary)" }}>
              Duplicate Resolution Strategy *
            </label>

            {[
              {
                id: 'skip',
                title: 'Skip duplicates (Recommended)',
                desc: 'If a customer with the same phone number already exists, skip the row and keep the existing record untouched.'
              },
              {
                id: 'update',
                title: 'Update existing leads',
                desc: 'If a matching phone number exists, append the new inquiry notes and update the next follow-up date while preserving identity.'
              },
              {
                id: 'new_only',
                title: 'Import new leads only',
                desc: 'Strict import: Discard duplicate phone numbers in both the database and intra-file repetitions.'
              }
            ].map(strat => {
              const isSelected = duplicateStrategy === strat.id;
              return (
                <div
                  key={strat.id}
                  onClick={() => setDuplicateStrategy(strat.id)}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--card-border)'}`,
                    background: isSelected ? 'var(--info-subtle)' : 'var(--input-bg)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}
                >
                  <Input
                    type="radio"
                    name="duplicateStrategy"
                    checked={isSelected}
                    onChange={() => setDuplicateStrategy(strat.id)}
                    style={{ marginTop: '3px', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: isSelected ? 'var(--info-text)' : 'var(--text-primary)' }}>
                      {strat.title}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: "var(--text-secondary)", marginTop: '4px', lineHeight: 1.4 }}>
                      {strat.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nav Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                border: "1px solid var(--card-border)",
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} /> Back to Preview
            </button>

            <button
              type="button"
              disabled={executing}
              onClick={handleExecuteImport}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 26px',
                borderRadius: '8px',
                background: executing ? 'var(--input-bg)' : 'var(--accent)',
                color: executing ? 'var(--text-secondary)' : 'var(--accent-contrast)',
                fontWeight: 700,
                fontSize: '0.92rem',
                border: 'none',
                cursor: executing ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)'
              }}
            >
              {executing ? (
                <>
                  <RefreshCw size={16} className="crm-spin" /> Executing Batch Import...
                </>
              ) : (
                <>
                  <Database size={16} /> Run Import ({parsedData.totalRows} Leads)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 5: RESULTS & SUMMARY ───────────────────────────────────────── */}
      {currentStep === 5 && importResult && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--success-subtle)',
            color: 'var(--accent-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <CheckCircle2 size={36} />
          </div>

          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 6px' }}>Import Completed!</h2>
          <p style={{ fontSize: '0.88rem', color: "var(--text-secondary)", margin: '0 0 28px' }}>
            Batch execution finished. Records have been saved to your CRM customer &amp; lead registry.
          </p>

          {/* Results Counters */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
            maxWidth: '720px',
            margin: '0 auto 28px'
          }}>
            <div style={{ background: "var(--input-bg)", padding: '14px', borderRadius: '10px', border: "1px solid var(--card-border)" }}>
              <div style={{ fontSize: '0.74rem', color: "var(--text-secondary)", textTransform: "none" }}>Processed</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: "var(--text-primary)", marginTop: '4px' }}>
                {importResult.totalProcessed || 0}
              </div>
            </div>
            <div style={{ background: "var(--input-bg)", padding: '14px', borderRadius: '10px', border: '1px solid var(--accent)' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--accent-text)', textTransform: "none" }}>New Leads Created</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-text)', marginTop: '4px' }}>
                {importResult.createdCount || 0}
              </div>
            </div>
            <div style={{ background: "var(--input-bg)", padding: '14px', borderRadius: '10px', border: '1px solid var(--accent)' }}>
              <div style={{ fontSize: '0.74rem', color: "var(--accent)", textTransform: "none" }}>Updated</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: "var(--accent)", marginTop: '4px' }}>
                {importResult.updatedCount || 0}
              </div>
            </div>
            <div style={{ background: "var(--input-bg)", padding: '14px', borderRadius: '10px', border: '1px solid var(--warning)' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--warning-text)', textTransform: "none" }}>Skipped</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning-text)', marginTop: '4px' }}>
                {importResult.skippedCount || 0}
              </div>
            </div>
            {importResult.errorCount > 0 && (
              <div style={{ background: "var(--input-bg)", padding: '14px', borderRadius: '10px', border: '1px solid var(--danger)' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--danger-text)', textTransform: "none" }}>Errors</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger-text)', marginTop: '4px' }}>
                  {importResult.errorCount}
                </div>
              </div>
            )}
          </div>

          {/* Download Error CSV if any errors occurred */}
          {importResult.errorCount > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <button
                type="button"
                onClick={handleDownloadErrorReport}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'var(--danger-subtle)',
                  color: 'var(--danger-text)',
                  border: '1px solid var(--danger)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Download size={15} /> Download CSV Error Report ({importResult.errorCount} failed rows)
              </button>
            </div>
          )}

          {/* CTAs */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleStartNew}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                border: "1px solid var(--card-border)",
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer'
              }}
            >
              Import Another File
            </button>

            {onSwitchScreen && (
              <>
                <button
                  type="button"
                  onClick={() => onSwitchScreen('leads')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: "var(--accent)", color: "var(--accent-contrast)",
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Users size={16} /> Go to Leads Board
                </button>

                <button
                  type="button"
                  onClick={() => onSwitchScreen('followups')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: 'var(--accent)',
                    color: 'var(--accent-contrast)',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Start Follow-ups <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── IMPORT HISTORY SECTION ──────────────────────────────────────────── */}
      <div style={{ marginTop: '36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Import History &amp; Audit Log</h3>
            <p style={{ fontSize: '0.8rem', color: "var(--text-secondary)", margin: '2px 0 0' }}>
              Past spreadsheet imports executed across your team
            </p>
          </div>
          <button
            type="button"
            onClick={loadHistory}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: "var(--input-bg)",
              color: "var(--text-secondary)",
              border: "1px solid var(--card-border)",
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} className={historyLoading ? 'crm-spin' : ''} /> Refresh
          </button>
        </div>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '12px', overflow: 'hidden' }}>
          {history.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: "var(--text-secondary)", fontSize: '0.86rem' }}>
              No import history records yet. Upload a file above to execute your first import.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: "var(--input-bg)", borderBottom: '1px solid var(--card-border)', color: "var(--text-secondary)" }}>
                  <th style={{ padding: '10px 14px' }}>Date &amp; Time</th>
                  <th style={{ padding: '10px 14px' }}>File Name</th>
                  <th style={{ padding: '10px 14px' }}>Total Rows</th>
                  <th style={{ padding: '10px 14px' }}>Created</th>
                  <th style={{ padding: '10px 14px' }}>Updated</th>
                  <th style={{ padding: '10px 14px' }}>Skipped</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px' }}>Uploaded By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={h._id || i} style={{ borderBottom: "1px solid var(--card-border)", background: i % 2 === 0 ? 'var(--main-bg)' : 'var(--card-bg)' }}>
                    <td style={{ padding: '10px 14px', color: "var(--text-secondary)" }}>
                      {new Date(h.importedAt || h.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: "var(--text-primary)" }}>
                      {h.fileName}
                    </td>
                    <td style={{ padding: '10px 14px', color: "var(--text-primary)" }}>{h.totalRows}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--accent-text)', fontWeight: 700 }}>+{h.createdCount}</td>
                    <td style={{ padding: '10px 14px', color: "var(--accent)" }}>{h.updatedCount || 0}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--warning-text)' }}>{h.skippedCount || 0}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: h.status === 'Completed' ? 'var(--success-subtle)' : 'var(--danger-subtle)',
                        color: h.status === 'Completed' ? 'var(--accent-text)' : 'var(--danger-text)'
                      }}>
                        {h.status || 'Completed'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: "var(--text-secondary)" }}>{h.importedByName || 'Sales Admin'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

