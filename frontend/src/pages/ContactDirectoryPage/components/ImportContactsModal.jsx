import React, { useState } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { contactsApi } from '../../../utils/contactsApi';

export default function ImportContactsModal({
  isOpen,
  onClose,
  onImportComplete,
}) {
  const [step, setStep] = useState(1); // 1: Upload, 2: Preview
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [previewSummary, setPreviewSummary] = useState(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    // Generate sample CSV template
    const headers = [
      'Full Name',
      'Primary Mobile',
      'Alternate Mobile',
      'Category',
      'Company Name',
      'Designation',
      'Email Address',
      'Projects',
      'Notes',
    ];
    const sampleRow1 = [
      'Rajesh Patel',
      '9876543210',
      '0261234567',
      'Contractor',
      'Patel Infrastructure',
      'Senior Contractor',
      'rajesh@patelinfra.com',
      'Skyhight',
      'Steel and RCC agency',
    ];
    const sampleRow2 = [
      'Amit Shah',
      '9825123456',
      '',
      'Supplier',
      'Shah Steels Ltd',
      'Director',
      'sales@shahsteels.in',
      'Skyhight',
      'Primary TMT supplier',
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), sampleRow1.join(','), sampleRow2.join(',')].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'CraveToBuild_Contacts_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg('');
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result;
        if (typeof text !== 'string') {
          throw new Error('Could not read CSV file');
        }

        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          throw new Error('CSV file must have a header row and at least one contact row');
        }

        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          const rowObj = {};
          headers.forEach((h, idx) => {
            rowObj[h] = cells[idx] || '';
          });
          rows.push(rowObj);
        }

        setParsedRows(rows);

        // Send to backend preview endpoint
        const preview = await contactsApi.previewImport(rows);
        setPreviewSummary(preview);
        setStep(2);
      } catch (err) {
        setErrorMsg(err.message || 'Error parsing CSV file');
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setIsLoading(false);
      setErrorMsg('Failed to read file');
    };

    reader.readAsText(file);
  };

  const handleCommit = async () => {
    if (!previewSummary || !previewSummary.previewRows) return;
    try {
      setIsLoading(true);
      setErrorMsg('');

      const validContacts = previewSummary.previewRows
        .filter((r) => r.isValid)
        .map((r) => ({
          name: r.name,
          mobile: r.mobile,
          alternateMobile: r.alternateMobile,
          email: r.email,
          companyName: r.companyName,
          designation: r.designation,
          category: r.category,
          projectIds: r.projectIds,
          notes: r.notes,
        }));

      await contactsApi.commitImport(validContacts, skipDuplicates);
      onImportComplete?.();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Import failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ro-modal-backdrop" onClick={onClose}>
      <div className="ro-modal-container ro-import-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ro-modal-header">
          <div className="ro-modal-title-group">
            <FileSpreadsheet size={18} className="ro-modal-icon" />
            <div>
              <h3 className="ro-modal-title">Bulk Import Contacts</h3>
              <p className="ro-modal-subtitle">
                Upload CSV or Excel • Validates phone numbers, formats, and duplicates
              </p>
            </div>
          </div>
          <button type="button" className="ro-modal-btn-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="ro-modal-body">
          {errorMsg && (
            <div className="ro-form-error-alert">
              <AlertTriangle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 1 ? (
            <div className="ro-import-step-upload">
              {/* Template Download Card */}
              <div className="ro-template-download-card">
                <div className="ro-template-icon-wrap">
                  <FileText size={24} />
                </div>
                <div className="ro-template-text">
                  <strong>Need the proper column structure?</strong>
                  <p>Download our pre-formatted CSV template with sample data.</p>
                </div>
                <button
                  type="button"
                  className="ro-btn-download-template"
                  onClick={handleDownloadTemplate}
                >
                  <Download size={14} />
                  <span>Download Sample CSV</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="ro-import-dropzone">
                <input
                  type="file"
                  id="csvContactUpload"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="ro-hidden-file-input"
                />
                <label htmlFor="csvContactUpload" className="ro-dropzone-label">
                  <div className="ro-dropzone-icon">
                    <Upload size={32} />
                  </div>
                  <strong>Choose a CSV file or drag it here</strong>
                  <p>Supports .csv files up to 10MB</p>
                  <span className="ro-btn ro-btn--secondary ro-btn-browse">Browse File</span>
                </label>
              </div>

              {isLoading && (
                <div className="ro-import-parsing-loader">
                  <div className="ro-spinner" />
                  <span>Parsing and validating records…</span>
                </div>
              )}
            </div>
          ) : (
            <div className="ro-import-step-preview">
              {/* Summary Badges */}
              <div className="ro-preview-stats-bar">
                <div className="ro-stat-badge">
                  <span className="ro-stat-lbl">Total Records</span>
                  <span className="ro-stat-val">{previewSummary?.totalRows || 0}</span>
                </div>
                <div className="ro-stat-badge text-success">
                  <span className="ro-stat-lbl">Valid</span>
                  <span className="ro-stat-val">{previewSummary?.validCount || 0}</span>
                </div>
                <div className="ro-stat-badge text-warning">
                  <span className="ro-stat-lbl">Duplicates</span>
                  <span className="ro-stat-val">{previewSummary?.duplicateCount || 0}</span>
                </div>
                <div className="ro-stat-badge text-danger">
                  <span className="ro-stat-lbl">Invalid Rows</span>
                  <span className="ro-stat-val">{previewSummary?.invalidCount || 0}</span>
                </div>
              </div>

              {/* Skip duplicates option */}
              <div className="ro-skip-duplicates-row">
                <label className="ro-check-label">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                  />
                  <span>
                    <strong>Skip duplicate numbers</strong> (Existing organization contacts will remain intact)
                  </span>
                </label>
              </div>

              {/* Preview Table */}
              <div className="ro-import-table-wrap">
                <table className="ro-import-preview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Full Name</th>
                      <th>Mobile</th>
                      <th>Category</th>
                      <th>Company</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(previewSummary?.previewRows || []).slice(0, 50).map((row, idx) => (
                      <tr key={idx} className={row.isValid ? '' : 'is-invalid-row'}>
                        <td>{row.rowNumber}</td>
                        <td>
                          <strong>{row.name || '—'}</strong>
                        </td>
                        <td>{row.mobile}</td>
                        <td>{row.category}</td>
                        <td>{row.companyName || '—'}</td>
                        <td>
                          {row.isValid ? (
                            row.isDuplicate ? (
                              <span className="ro-pill-warning">Duplicate Phone</span>
                            ) : (
                              <span className="ro-pill-success">Ready</span>
                            )
                          ) : (
                            <span className="ro-pill-danger" title={row.errors.join('; ')}>
                              {row.errors[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {previewSummary?.previewRows?.length > 50 && (
                <div className="ro-preview-more-note">
                  Showing first 50 of {previewSummary.previewRows.length} records…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ro-modal-footer">
          {step === 2 && (
            <button
              type="button"
              className="ro-btn ro-btn--secondary"
              onClick={() => setStep(1)}
              disabled={isLoading}
            >
              Back to Upload
            </button>
          )}

          <button type="button" className="ro-btn ro-btn--secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>

          {step === 2 && (
            <button
              type="button"
              className="ro-btn ro-btn--primary"
              onClick={handleCommit}
              disabled={isLoading || (previewSummary?.validCount || 0) === 0}
            >
              {isLoading ? 'Importing…' : `Confirm Import (${previewSummary?.validCount || 0} Contacts)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

