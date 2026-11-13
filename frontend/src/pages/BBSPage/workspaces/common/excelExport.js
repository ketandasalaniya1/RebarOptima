/**
 * Excel / CSV Export Generator for BBS Schedules
 * Exports clean spreadsheet data conforming to standard civil engineering tabular layouts.
 */

export function exportBbsToExcelCsv({
  project,
  block,
  level,
  member,
  rebarItems = []
}) {
  const memberMark = member?.displayId || member?.member_id || 'M1';
  const memberType = member?.memberType || 'Member';

  const headers = [
    'Project',
    'Block',
    'Level',
    'Member Mark',
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
    'Rule Classification',
    'Rule Source'
  ];

  const rows = rebarItems.map((item, idx) => {
    const mark = item.barMark || String(idx + 1).padStart(2, '0');
    const cut = Number(item.cut_length) || 0;
    const qty = Number(item.quantity) || 0;
    const totL = (cut * qty) / 1000;
    const d = item.diameter || item.barDiameter || 16;
    const unitW = item.unit_weight || (Math.pow(d, 2) / 162.28);
    const totW = Number(item.total_weight) || (totL * unitW);

    return [
      `"${project?.name || 'Project'}"`,
      `"${block?.name || 'Block'}"`,
      `"${level?.name || 'Floor'}"`,
      `"${memberMark}"`,
      `"${memberType}"`,
      `"${mark}"`,
      `"${(item.description || item.label || 'Rebar').replace(/"/g, '""')}"`,
      `"${item.shapeCode || 'Shape 00'}"`,
      d,
      item.spacing || 0,
      qty,
      Math.round(cut),
      totL.toFixed(2),
      unitW.toFixed(3),
      totW.toFixed(2),
      `"${item.ruleClassification || 'DESIGNER_INPUT'}"`,
      `"${(item.ruleSource || '').replace(/"/g, '""')}"`
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `BBS_${project?.name || 'Project'}_${memberMark}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

