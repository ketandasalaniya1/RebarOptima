/**
 * PDF / Print Report Generator for Dynamic BBS Summary Dashboard
 * Generates an authoritative, professional civil engineering Bar Bending Schedule Summary sheet.
 */

export function exportSummaryToPdf({
  project,
  filters = {},
  kpis = {},
  diameterSummary = [],
  blockSummary = [],
  floorSummary = [],
  memberTypeSummary = [],
  memberSummary = [],
  detailedRecords = []
}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup window was blocked by your browser. Please allow popups for RebarOptima in your browser settings to preview and print the BBS Summary Report.');
    return;
  }

  const projectName = project?.name || 'Project BBS Summary';
  const timestamp = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  // Describe active filters
  const filterDesc = [
    `Blocks: ${filters.blocks?.length ? filters.blocks.join(', ') : 'All Blocks'}`,
    `Floors: ${filters.floors?.length ? filters.floors.join(', ') : 'All Floors'}`,
    `Member Types: ${filters.types?.length ? filters.types.join(', ') : 'All Types'}`,
    filters.memberCount ? `Individual Members: ${filters.memberCount} selected` : null
  ].filter(Boolean).join(' | ');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>BBS Summary Report - ${projectName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 10px;
      font-size: 11px;
    }
    .header-box {
      border: 2px solid #0f172a;
      margin-bottom: 12px;
    }
    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #ffffff;
      padding: 8px 14px;
    }
    .title-row h1 {
      margin: 0;
      font-size: 16px;
      letter-spacing: 0.5px;
      font-weight: 700;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      padding: 8px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
      font-size: 10.5px;
    }
    .meta-item strong {
      color: #475569;
    }
    .filter-banner {
      background: #eff6ff;
      border-bottom: 1px solid #bfdbfe;
      padding: 6px 14px;
      font-size: 10.5px;
      color: #1e40af;
    }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }
    .kpi-card {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: center;
    }
    .kpi-card .val {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .kpi-card .lbl {
      font-size: 9.5px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    h2.section-title {
      font-size: 12px;
      color: #0f172a;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 3px;
      margin: 14px 0 6px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 10px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 5px 7px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .font-bold {
      font-weight: 700;
    }
    .sign-row {
      margin-top: 20px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      page-break-inside: avoid;
    }
    .sign-box {
      border-top: 1px dashed #64748b;
      padding-top: 6px;
      text-align: center;
      font-size: 10px;
      color: #475569;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 12px; text-align: right;">
    <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 7px 16px; border-radius: 4px; font-weight: 600; cursor: pointer;">
      Print / Save as PDF
    </button>
  </div>

  <div class="header-box">
    <div class="title-row">
      <h1>REBAROPTIMA — DYNAMIC BAR BENDING SCHEDULE SUMMARY</h1>
      <span>IS 456:2000 • SP:34 • IS 13920:2016</span>
    </div>
    <div class="meta-grid">
      <div class="meta-item"><strong>Project:</strong> ${projectName}</div>
      <div class="meta-item"><strong>Generated On:</strong> ${timestamp}</div>
      <div class="meta-item"><strong>Status:</strong> Active Revisions Only</div>
      <div class="meta-item"><strong>Engine:</strong> RebarOptima BBS Option B</div>
    </div>
    <div class="filter-banner">
      <strong>Active Filter Scope:</strong> ${filterDesc}
    </div>
  </div>

  <!-- KPI SUMMARY CARDS -->
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="lbl">Calculated Members</div>
      <div class="val">${kpis.totalMembers || 0}</div>
    </div>
    <div class="kpi-card">
      <div class="lbl">Total Bar Pieces</div>
      <div class="val">${(kpis.totalPieces || 0).toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="lbl">Total Steel Weight</div>
      <div class="val">${(kpis.totalWeightKg || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg</div>
    </div>
    <div class="kpi-card">
      <div class="lbl">Total Steel Tonnage</div>
      <div class="val">${(kpis.totalWeightMT || 0).toFixed(3)} MT</div>
    </div>
  </div>

  <!-- 1. DIAMETER-WISE SUMMARY -->
  <h2 class="section-title">1. Reinforcement Summary by Bar Diameter</h2>
  <table>
    <thead>
      <tr>
        <th class="text-center">Diameter (mm)</th>
        <th class="text-right">No. of Pieces</th>
        <th class="text-right">Total Cut Length (m)</th>
        <th class="text-right">Unit Weight (kg/m)</th>
        <th class="text-right">Total Weight (kg)</th>
        <th class="text-right">Total Weight (MT)</th>
        <th class="text-right">% of Steel</th>
      </tr>
    </thead>
    <tbody>
      ${diameterSummary.map(row => `
        <tr>
          <td class="text-center font-bold">Ø${row.diameter}</td>
          <td class="text-right">${(row.pieces || 0).toLocaleString()}</td>
          <td class="text-right">${(row.lengthM || 0).toFixed(2)}</td>
          <td class="text-right">${(row.unitWeight || (Math.pow(row.diameter, 2) / 162.28)).toFixed(3)}</td>
          <td class="text-right font-bold">${(row.weightKg || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
          <td class="text-right font-bold">${(row.weightMT || 0).toFixed(3)}</td>
          <td class="text-right">${(row.percentage || 0).toFixed(1)}%</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr style="background: #e2e8f0; font-weight: bold;">
        <td class="text-center">Total</td>
        <td class="text-right">${(kpis.totalPieces || 0).toLocaleString()}</td>
        <td class="text-right">${(kpis.totalLengthM || 0).toFixed(2)}</td>
        <td class="text-right">—</td>
        <td class="text-right">${(kpis.totalWeightKg || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
        <td class="text-right">${(kpis.totalWeightMT || 0).toFixed(3)} MT</td>
        <td class="text-right">100.0%</td>
      </tr>
    </tfoot>
  </table>

  <!-- 2. BLOCK-WISE & MEMBER TYPE-WISE SUMMARY -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
    <div>
      <h2 class="section-title">2. Summary by Block / Building</h2>
      <table>
        <thead>
          <tr>
            <th>Block Name</th>
            <th class="text-center">Members</th>
            <th class="text-right">Bar Pieces</th>
            <th class="text-right">Weight (kg)</th>
            <th class="text-right">Weight (MT)</th>
          </tr>
        </thead>
        <tbody>
          ${blockSummary.map(b => `
            <tr>
              <td class="font-bold">${b.name}</td>
              <td class="text-center">${b.memberCount}</td>
              <td class="text-right">${b.pieces.toLocaleString()}</td>
              <td class="text-right">${b.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
              <td class="text-right font-bold">${b.weightMT.toFixed(3)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div>
      <h2 class="section-title">3. Summary by Structural Member Type</h2>
      <table>
        <thead>
          <tr>
            <th>Member Type</th>
            <th class="text-center">Members</th>
            <th class="text-right">Bar Pieces</th>
            <th class="text-right">Weight (kg)</th>
            <th class="text-right">Weight (MT)</th>
          </tr>
        </thead>
        <tbody>
          ${memberTypeSummary.map(t => `
            <tr>
              <td class="font-bold">${t.name}</td>
              <td class="text-center">${t.memberCount}</td>
              <td class="text-right">${t.pieces.toLocaleString()}</td>
              <td class="text-right">${t.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
              <td class="text-right font-bold">${t.weightMT.toFixed(3)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- 4. FLOOR-WISE SUMMARY -->
  <h2 class="section-title">4. Summary by Floor / Level</h2>
  <table>
    <thead>
      <tr>
        <th>Floor / Level</th>
        <th>Block</th>
        <th class="text-center">Members</th>
        <th class="text-right">Bar Pieces</th>
        <th class="text-right">Total Length (m)</th>
        <th class="text-right">Weight (kg)</th>
        <th class="text-right">Weight (MT)</th>
      </tr>
    </thead>
    <tbody>
      ${floorSummary.map(f => `
        <tr>
          <td class="font-bold">${f.name}</td>
          <td>${f.blockName}</td>
          <td class="text-center">${f.memberCount}</td>
          <td class="text-right">${f.pieces.toLocaleString()}</td>
          <td class="text-right">${f.lengthM.toFixed(2)}</td>
          <td class="text-right">${f.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
          <td class="text-right font-bold">${f.weightMT.toFixed(3)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- 5. DETAILED FILTERED BBS SCHEDULE (Top records for printable sheet) -->
  <h2 class="section-title">5. Filtered Bar Bending Schedule (Detailed Records: ${detailedRecords.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Member ID</th>
        <th>Type</th>
        <th>Block / Level</th>
        <th class="text-center">Mark</th>
        <th>Description</th>
        <th class="text-center">Shape</th>
        <th class="text-center">Dia</th>
        <th class="text-center">Qty</th>
        <th class="text-right">Cut (mm)</th>
        <th class="text-right">Tot L (m)</th>
        <th class="text-right">Tot Wt (kg)</th>
      </tr>
    </thead>
    <tbody>
      ${detailedRecords.slice(0, 100).map(r => `
        <tr>
          <td class="font-bold">${r.memberMark}</td>
          <td>${r.memberType}</td>
          <td>${r.blockName} / ${r.floorName}</td>
          <td class="text-center font-bold">${r.barMark}</td>
          <td>${r.description}</td>
          <td class="text-center">${r.shapeCode}</td>
          <td class="text-center">Ø${r.diameter}</td>
          <td class="text-center">${r.quantity}</td>
          <td class="text-right">${Math.round(r.cutLength)}</td>
          <td class="text-right">${r.totalLengthM.toFixed(2)}</td>
          <td class="text-right font-bold">${r.totalWeightKg.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ${detailedRecords.length > 100 ? `<div style="font-size: 10px; color: #64748b; margin-top: 4px;">* Note: Displaying first 100 of ${detailedRecords.length} filtered bar records for print formatting. Full records available via CSV / Excel export.</div>` : ''}

  <!-- SIGNATURE BLOCKS -->
  <div class="sign-row">
    <div class="sign-box">
      <strong>Prepared By (BBS Engineer)</strong><br><br>
      Signature & Date
    </div>
    <div class="sign-box">
      <strong>Checked By (Senior Structural Engineer)</strong><br><br>
      Signature & Date
    </div>
    <div class="sign-box">
      <strong>Approved By (Project Manager)</strong><br><br>
      Signature & Date
    </div>
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

