/**
 * Excel & CSV Export Generator for Dynamic BBS Summary Dashboard
 * Generates structured spreadsheets preserving numbers and units.
 */

// Helper to escape CSV values cleanly
function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Clean CSV export containing all filtered detailed BBS records
 */
export function exportSummaryToCsv({
  project,
  detailedRecords = []
}) {
  const headers = [
    'Project',
    'Block',
    'Floor',
    'Member ID',
    'Member Type',
    'Bar Mark',
    'Description',
    'Shape Code',
    'Diameter (mm)',
    'Spacing (mm)',
    'No. of Bars',
    'Cutting Length (mm)',
    'Total Length (m)',
    'Unit Weight (kg/m)',
    'Total Weight (kg)',
    'Total Weight (MT)',
    'Rule Classification',
    'Rule Source'
  ];

  const rows = detailedRecords.map(r => [
    escapeCsv(project?.name || 'Project'),
    escapeCsv(r.blockName || ''),
    escapeCsv(r.floorName || ''),
    escapeCsv(r.memberMark || ''),
    escapeCsv(r.memberType || ''),
    escapeCsv(r.barMark || ''),
    escapeCsv(r.description || ''),
    escapeCsv(r.shapeCode || 'Shape 00'),
    r.diameter || 16,
    r.spacing || 0,
    r.quantity || 1,
    Math.round(r.cutLength || 0),
    (r.totalLengthM || 0).toFixed(2),
    (r.unitWeight || 0).toFixed(3),
    (r.totalWeightKg || 0).toFixed(2),
    ((r.totalWeightKg || 0) / 1000).toFixed(3),
    escapeCsv(r.ruleClassification || 'DESIGNER_PROVIDED_VALUE'),
    escapeCsv(r.ruleSource || '')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `BBS_Summary_${(project?.name || 'Project').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formatted Excel Workbook (.xls HTML XML format) with structured multi-tables
 */
export function exportSummaryToExcel({
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
  const projectName = project?.name || 'Project';
  const timestamp = new Date().toLocaleString('en-IN');

  const filterDesc = [
    `Blocks: ${filters.blocks?.length ? filters.blocks.join(', ') : 'All Blocks'}`,
    `Floors: ${filters.floors?.length ? filters.floors.join(', ') : 'All Floors'}`,
    `Member Types: ${filters.types?.length ? filters.types.join(', ') : 'All Types'}`,
    filters.memberCount ? `Individual Members: ${filters.memberCount} selected` : null
  ].filter(Boolean).join(' | ');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; border: 1px solid #94a3b8; padding: 6px; }
        td { border: 1px solid #cbd5e1; padding: 5px; text-align: left; }
        .num { text-align: right; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .title { font-size: 16pt; font-weight: bold; color: #0f172a; }
        .subtitle { font-size: 11pt; color: #475569; }
        .section-header { font-size: 13pt; font-weight: bold; background-color: #3b82f6; color: #ffffff; padding: 6px; }
        .kpi-th { background-color: #0f172a; color: #ffffff; }
        .kpi-val { font-size: 14pt; font-weight: bold; text-align: center; background-color: #f1f5f9; }
        .total-row { background-color: #e2e8f0; font-weight: bold; }
      </style>
    </head>
    <body>
      <!-- TITLE & METADATA -->
      <table>
        <tr>
          <td colspan="8" class="title">REBAROPTIMA — DYNAMIC BAR BENDING SCHEDULE SUMMARY</td>
        </tr>
        <tr>
          <td colspan="8" class="subtitle">Project: <b>${projectName}</b> | Generated On: <b>${timestamp}</b></td>
        </tr>
        <tr>
          <td colspan="8" style="background-color: #eff6ff; color: #1e40af;"><b>Active Filter Scope:</b> ${filterDesc}</td>
        </tr>
      </table>

      <!-- KPI CARDS -->
      <table>
        <tr>
          <th class="kpi-th center">Total Calculated Members</th>
          <th class="kpi-th center">Total Bar Pieces</th>
          <th class="kpi-th center">Total Steel Weight (kg)</th>
          <th class="kpi-th center">Total Steel Weight (MT)</th>
        </tr>
        <tr>
          <td class="kpi-val">${kpis.totalMembers || 0}</td>
          <td class="kpi-val">${(kpis.totalPieces || 0).toLocaleString()}</td>
          <td class="kpi-val">${(kpis.totalWeightKg || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg</td>
          <td class="kpi-val">${(kpis.totalWeightMT || 0).toFixed(3)} MT</td>
        </tr>
      </table>

      <!-- 1. DIAMETER-WISE SUMMARY -->
      <table>
        <tr>
          <th colspan="7" class="section-header">1. REINFORCEMENT SUMMARY BY BAR DIAMETER</th>
        </tr>
        <tr>
          <th class="center">Diameter</th>
          <th class="num">No. of Pieces</th>
          <th class="num">Total Cut Length (m)</th>
          <th class="num">Unit Weight (kg/m)</th>
          <th class="num">Total Weight (kg)</th>
          <th class="num">Total Weight (MT)</th>
          <th class="num">% of Total Steel</th>
        </tr>
        ${diameterSummary.map(r => `
          <tr>
            <td class="center bold">Ø${r.diameter} mm</td>
            <td class="num">${r.pieces}</td>
            <td class="num">${r.lengthM.toFixed(2)}</td>
            <td class="num">${r.unitWeight.toFixed(3)}</td>
            <td class="num bold">${r.weightKg.toFixed(2)}</td>
            <td class="num bold">${r.weightMT.toFixed(3)}</td>
            <td class="num">${r.percentage.toFixed(1)}%</td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td class="center">TOTAL</td>
          <td class="num">${kpis.totalPieces || 0}</td>
          <td class="num">${(kpis.totalLengthM || 0).toFixed(2)}</td>
          <td class="center">—</td>
          <td class="num">${(kpis.totalWeightKg || 0).toFixed(2)}</td>
          <td class="num">${(kpis.totalWeightMT || 0).toFixed(3)} MT</td>
          <td class="num">100.0%</td>
        </tr>
      </table>

      <!-- 2. BLOCK-WISE SUMMARY -->
      <table>
        <tr>
          <th colspan="6" class="section-header">2. SUMMARY BY BLOCK / BUILDING</th>
        </tr>
        <tr>
          <th>Block Name</th>
          <th class="center">Members</th>
          <th class="num">Bar Pieces</th>
          <th class="num">Total Length (m)</th>
          <th class="num">Total Weight (kg)</th>
          <th class="num">Total Weight (MT)</th>
        </tr>
        ${blockSummary.map(b => `
          <tr>
            <td class="bold">${b.name}</td>
            <td class="center">${b.memberCount}</td>
            <td class="num">${b.pieces}</td>
            <td class="num">${b.lengthM.toFixed(2)}</td>
            <td class="num bold">${b.weightKg.toFixed(2)}</td>
            <td class="num bold">${b.weightMT.toFixed(3)}</td>
          </tr>
        `).join('')}
      </table>

      <!-- 3. FLOOR-WISE SUMMARY -->
      <table>
        <tr>
          <th colspan="7" class="section-header">3. SUMMARY BY FLOOR / LEVEL</th>
        </tr>
        <tr>
          <th>Floor / Level</th>
          <th>Block</th>
          <th class="center">Members</th>
          <th class="num">Bar Pieces</th>
          <th class="num">Total Length (m)</th>
          <th class="num">Total Weight (kg)</th>
          <th class="num">Total Weight (MT)</th>
        </tr>
        ${floorSummary.map(f => `
          <tr>
            <td class="bold">${f.name}</td>
            <td>${f.blockName}</td>
            <td class="center">${f.memberCount}</td>
            <td class="num">${f.pieces}</td>
            <td class="num">${f.lengthM.toFixed(2)}</td>
            <td class="num bold">${f.weightKg.toFixed(2)}</td>
            <td class="num bold">${f.weightMT.toFixed(3)}</td>
          </tr>
        `).join('')}
      </table>

      <!-- 4. MEMBER TYPE-WISE SUMMARY -->
      <table>
        <tr>
          <th colspan="6" class="section-header">4. SUMMARY BY STRUCTURAL MEMBER TYPE</th>
        </tr>
        <tr>
          <th>Member Type</th>
          <th class="center">Members</th>
          <th class="num">Bar Pieces</th>
          <th class="num">Total Length (m)</th>
          <th class="num">Total Weight (kg)</th>
          <th class="num">Total Weight (MT)</th>
        </tr>
        ${memberTypeSummary.map(t => `
          <tr>
            <td class="bold">${t.name}</td>
            <td class="center">${t.memberCount}</td>
            <td class="num">${t.pieces}</td>
            <td class="num">${t.lengthM.toFixed(2)}</td>
            <td class="num bold">${t.weightKg.toFixed(2)}</td>
            <td class="num bold">${t.weightMT.toFixed(3)}</td>
          </tr>
        `).join('')}
      </table>

      <!-- 5. MEMBER-WISE SUMMARY -->
      <table>
        <tr>
          <th colspan="8" class="section-header">5. SUMMARY BY INDIVIDUAL MEMBER</th>
        </tr>
        <tr>
          <th>Member ID</th>
          <th>Member Type</th>
          <th>Block</th>
          <th>Floor</th>
          <th class="num">Bar Pieces</th>
          <th class="num">Total Length (m)</th>
          <th class="num">Total Weight (kg)</th>
          <th class="num">Total Weight (MT)</th>
        </tr>
        ${memberSummary.map(m => `
          <tr>
            <td class="bold">${m.memberMark}</td>
            <td>${m.memberType}</td>
            <td>${m.blockName}</td>
            <td>${m.floorName}</td>
            <td class="num">${m.pieces}</td>
            <td class="num">${m.lengthM.toFixed(2)}</td>
            <td class="num bold">${m.weightKg.toFixed(2)}</td>
            <td class="num bold">${m.weightMT.toFixed(3)}</td>
          </tr>
        `).join('')}
      </table>

      <!-- 6. DETAILED FILTERED BBS SCHEDULE -->
      <table>
        <tr>
          <th colspan="13" class="section-header">6. FILTERED DETAILED BAR BENDING SCHEDULE (${detailedRecords.length} Items)</th>
        </tr>
        <tr>
          <th>Block</th>
          <th>Floor</th>
          <th>Member</th>
          <th>Type</th>
          <th class="center">Mark</th>
          <th>Description</th>
          <th class="center">Shape</th>
          <th class="center">Dia (mm)</th>
          <th class="center">Qty</th>
          <th class="num">Cut (mm)</th>
          <th class="num">Total (m)</th>
          <th class="num">Unit (kg/m)</th>
          <th class="num">Total (kg)</th>
        </tr>
        ${detailedRecords.map(r => `
          <tr>
            <td>${r.blockName}</td>
            <td>${r.floorName}</td>
            <td class="bold">${r.memberMark}</td>
            <td>${r.memberType}</td>
            <td class="center bold">${r.barMark}</td>
            <td>${r.description}</td>
            <td class="center">${r.shapeCode}</td>
            <td class="center">Ø${r.diameter}</td>
            <td class="center">${r.quantity}</td>
            <td class="num">${Math.round(r.cutLength)}</td>
            <td class="num">${r.totalLengthM.toFixed(2)}</td>
            <td class="num">${r.unitWeight.toFixed(3)}</td>
            <td class="num bold">${r.totalWeightKg.toFixed(2)}</td>
          </tr>
        `).join('')}
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `BBS_Summary_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xls`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

