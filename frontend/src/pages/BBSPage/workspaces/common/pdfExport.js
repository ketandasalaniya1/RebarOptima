/**
 * PDF / Print Report Generator for BBS Schedules
 * Creates an authoritative, professional civil engineering Bar Bending Schedule sheet.
 */

export function exportBbsToPrintPdf({
  project,
  block,
  level,
  member,
  rebarItems = [],
  summary = {}
}) {
  const memberMark = member?.displayId || member?.member_id || 'M1';
  const memberType = member?.memberType || 'Structural Member';
  const concreteGrade = member?.concrete_grade || member?.concreteGrade || 'M25';
  const steelGrade = member?.steel_grade || member?.steelGrade || 'Fe500D';
  const totalWeightKg = Number(summary?.totalSteelWeight) || rebarItems.reduce((s, r) => s + (Number(r.total_weight) || 0), 0);
  const totalWeightMT = (totalWeightKg / 1000).toFixed(3);
  const volumeM3 = Number(summary?.concreteVolume) || 0;
  const rebarRatio = volumeM3 > 0 ? (totalWeightKg / volumeM3).toFixed(1) : '—';
  const totalPieces = rebarItems.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

  // Group by diameter for the summary table
  const diameterSummary = {};
  rebarItems.forEach(item => {
    const d = item.diameter || item.barDiameter || 16;
    if (!diameterSummary[d]) {
      diameterSummary[d] = { pieces: 0, lengthM: 0, weightKg: 0 };
    }
    const pcs = Number(item.quantity) || 0;
    const cutMm = Number(item.cut_length) || 0;
    const lenM = (pcs * cutMm) / 1000;
    const wtKg = Number(item.total_weight) || (lenM * (Math.pow(d, 2) / 162.28));

    diameterSummary[d].pieces += pcs;
    diameterSummary[d].lengthM += lenM;
    diameterSummary[d].weightKg += wtKg;
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup window was blocked by your browser. Please allow popups for RebarOptima in your browser settings to preview and print the Bar Bending Schedule report.');
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>BBS Report - ${memberMark} (${memberType})</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm 15mm;
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
      border: 2px solid #1e293b;
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
    }
    .title-row span {
      font-size: 11px;
      color: #94a3b8;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding: 10px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
    }
    .meta-item strong {
      color: #475569;
      display: block;
      font-size: 10px;
      text-transform: uppercase;
    }
    .meta-item span {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    th {
      background: #f1f5f9;
      border: 1px solid #94a3b8;
      padding: 6px 8px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      text-align: left;
    }
    td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      font-size: 11px;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .mark-tag {
      font-weight: 700;
      font-family: monospace;
      color: #1d4ed8;
      background: #eff6ff;
      padding: 2px 5px;
      border-radius: 3px;
    }
    .total-row {
      background: #f8fafc;
      font-weight: 700;
    }
    .summary-section {
      display: flex;
      gap: 20px;
      margin-top: 10px;
    }
    .dia-table {
      width: 50%;
    }
    .signoff-box {
      width: 50%;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border: 1px solid #94a3b8;
      height: 70px;
    }
    .signoff-cell {
      padding: 6px;
      border-right: 1px solid #cbd5e1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 10px;
    }
    .signoff-cell:last-child { border-right: none; }
    .rule-tag {
      font-size: 9px;
      font-weight: 600;
      padding: 1px 4px;
      border-radius: 3px;
      background: #f1f5f9;
      color: #475569;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="title-row">
      <h1>BAR BENDING SCHEDULE (BBS)</h1>
      <span>RebarOptima Engineering System</span>
    </div>
    <div class="meta-grid">
      <div class="meta-item">
        <strong>Project</strong>
        <span>${project?.name || 'Project'}</span>
      </div>
      <div class="meta-item">
        <strong>Block & Level</strong>
        <span>${block?.name || 'Block A'} / ${level?.name || 'Floor 1'}</span>
      </div>
      <div class="meta-item">
        <strong>Structural Member</strong>
        <span>${memberMark} (${memberType})</span>
      </div>
      <div class="meta-item">
        <strong>Material Grades</strong>
        <span>${concreteGrade} / ${steelGrade}</span>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50px;">Mark</th>
        <th>Description / Role</th>
        <th style="width: 80px;">Shape Code</th>
        <th style="width: 60px;" class="text-right">Dia (mm)</th>
        <th style="width: 70px;" class="text-right">Spacing</th>
        <th style="width: 50px;" class="text-right">Pcs</th>
        <th style="width: 90px;" class="text-right">Cutting L (mm)</th>
        <th style="width: 80px;" class="text-right">Total L (m)</th>
        <th style="width: 75px;" class="text-right">Unit Wt</th>
        <th style="width: 90px;" class="text-right">Total Wt (kg)</th>
        <th>Verification Reference</th>
      </tr>
    </thead>
    <tbody>
      ${rebarItems.map((item, idx) => {
        const mark = item.barMark || String(idx + 1).padStart(2, '0');
        const cut = Number(item.cut_length) || 0;
        const qty = Number(item.quantity) || 0;
        const totL = (cut * qty) / 1000;
        const d = item.diameter || item.barDiameter || 16;
        const unitW = item.unit_weight || (Math.pow(d, 2) / 162.28);
        const totW = Number(item.total_weight) || (totL * unitW);

        return `
          <tr>
            <td class="text-center"><span class="mark-tag">${mark}</span></td>
            <td><strong>${item.description || item.label || 'Rebar'}</strong></td>
            <td><code>${item.shapeCode || 'Shape 00'}</code></td>
            <td class="text-right">Ø${d}</td>
            <td class="text-right">${item.spacing > 0 ? item.spacing + ' mm' : '—'}</td>
            <td class="text-right">${qty}</td>
            <td class="text-right"><strong>${Math.round(cut)}</strong></td>
            <td class="text-right">${totL.toFixed(2)}</td>
            <td class="text-right">${unitW.toFixed(3)}</td>
            <td class="text-right"><strong>${totW.toFixed(2)}</strong></td>
            <td><span class="rule-tag">${item.ruleSource || 'Designer Input'}</span></td>
          </tr>
        `;
      }).join('')}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="5" class="text-right">MEMBER TOTALS:</td>
        <td class="text-right">${totalPieces}</td>
        <td></td>
        <td class="text-right">${(rebarItems.reduce((s, r) => s + ((r.cut_length * r.quantity) / 1000), 0)).toFixed(2)} m</td>
        <td></td>
        <td class="text-right">${totalWeightKg.toFixed(2)} kg</td>
        <td><strong>${totalWeightMT} MT</strong></td>
      </tr>
    </tfoot>
  </table>

  <div class="summary-section">
    <table class="dia-table">
      <thead>
        <tr>
          <th>Diameter</th>
          <th class="text-right">Total Pieces</th>
          <th class="text-right">Total Length (m)</th>
          <th class="text-right">Total Weight (kg)</th>
        </tr>
      </thead>
      <tbody>
        ${Object.keys(diameterSummary).sort((a,b) => a-b).map(d => `
          <tr>
            <td><strong>Ø${d} mm</strong></td>
            <td class="text-right">${diameterSummary[d].pieces}</td>
            <td class="text-right">${diameterSummary[d].lengthM.toFixed(2)}</td>
            <td class="text-right"><strong>${diameterSummary[d].weightKg.toFixed(2)}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="signoff-box">
      <div class="signoff-cell">
        <strong>Prepared By</strong>
        <span>Structural Detailer</span>
      </div>
      <div class="signoff-cell">
        <strong>Checked By</strong>
        <span>QA / Senior Engineer</span>
      </div>
      <div class="signoff-cell">
        <strong>Approved By</strong>
        <span>Consultant / Project Mgr</span>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

