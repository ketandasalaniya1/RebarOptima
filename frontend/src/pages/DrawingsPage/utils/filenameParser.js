/**
 * Parses construction drawing filenames into structured metadata.
 * Example formats:
 * - DT-STR-L02-004_Slab-Plan_R03.pdf
 * - DT-ARC-GF-001_Ground-Floor-Plan_R02.dwg
 * - PRJ-MEP-B1-003_Basement-Fire-Fighting_R01.dxf
 * - DT-STR-FND-001_Foundation-Layout_R02.pdf
 * - DT-ARC-TER-001_Terrace-Floor-Plan_R01.pdf
 * - DT-STR-L02-004.pdf
 */

const DISCIPLINE_MAP = {
  STR: 'Structural',
  ARC: 'Architectural',
  ARCH: 'Architectural',
  MEP: 'MEPF',
  MEPF: 'MEPF',
  CIV: 'Civil',
  CIVIL: 'Civil',
  GEN: 'General',
  PLUMB: 'Plumbing',
  ELEC: 'Electrical',
  HVAC: 'HVAC',
  FIRE: 'Firefighting',
};

const LEVEL_MAP = {
  B2: 'Basement 2',
  B1: 'Basement 1',
  BASEMENT: 'Basement 1',
  BASEMENT1: 'Basement 1',
  BASEMENT2: 'Basement 2',
  GF: 'Ground',
  G: 'Ground',
  GROUND: 'Ground',
  TER: 'Terrace',
  TERRACE: 'Terrace',
  ROOF: 'Terrace',
  FND: 'Basement 2', // Foundation
  FOUNDATION: 'Basement 2',
};

// Also support L01 -> Level 1, L02 -> Level 2, etc.
for (let i = 1; i <= 30; i++) {
  const pad = i < 10 ? `0${i}` : `${i}`;
  LEVEL_MAP[`L${pad}`] = `Level ${i}`;
  LEVEL_MAP[`L${i}`] = `Level ${i}`;
}

export function parseDrawingFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return null;
  }

  // Strip extension
  const dotIndex = filename.lastIndexOf('.');
  const baseName = dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;
  const ext = dotIndex !== -1 ? filename.substring(dotIndex + 1).toLowerCase() : '';

  // Check for revision pattern at the end: e.g. _R03, _R3, -R03, _rev3, _v2
  let revision = '';
  let cleanedBase = baseName;
  const revMatch = baseName.match(/[_-](R\d+|REV\d+|V\d+)$/i);
  if (revMatch) {
    const rawRev = revMatch[1].toUpperCase();
    if (rawRev.startsWith('R')) {
      revision = rawRev;
    } else if (rawRev.startsWith('REV')) {
      const num = parseInt(rawRev.replace('REV', ''), 10);
      revision = `R${num < 10 ? '0' + num : num}`;
    } else if (rawRev.startsWith('V')) {
      const num = parseInt(rawRev.replace('V', ''), 10);
      revision = `R${num < 10 ? '0' + num : num}`;
    }
    cleanedBase = baseName.substring(0, revMatch.index);
  }

  // Split into drawing number and title if separated by underscore
  let drawingNumber = '';
  let title = '';

  const parts = cleanedBase.split('_');
  if (parts.length >= 2) {
    drawingNumber = parts[0].trim();
    title = parts.slice(1).join(' ').replace(/[-_]/g, ' ').trim();
  } else {
    drawingNumber = cleanedBase.trim();
  }

  // Inspect drawing number components (e.g. DT-STR-L02-004)
  const segments = drawingNumber.split('-');
  let discipline = '';
  let level = '';

  for (const seg of segments) {
    const upper = seg.toUpperCase();
    if (!discipline && DISCIPLINE_MAP[upper]) {
      discipline = DISCIPLINE_MAP[upper];
    }
    if (!level && LEVEL_MAP[upper]) {
      level = LEVEL_MAP[upper];
    }
  }

  return {
    filename,
    ext,
    drawingNumber: drawingNumber || '',
    title: title || '',
    discipline: discipline || '',
    level: level || '',
    revision: revision || 'R00',
    parsed: Boolean(drawingNumber || title || discipline || level),
  };
}

