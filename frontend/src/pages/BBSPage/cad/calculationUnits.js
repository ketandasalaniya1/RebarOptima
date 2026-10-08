/**
 * RebarOptima Phase 2F — Centralized Engineering Unit System & Precision Utilities
 * 
 * Canonical Internal Engineering Units:
 * - Length: Millimeters (mm)
 * - Weight / Mass: Kilograms (kg)
 * - Angle: Degrees (deg) internally with explicit Radian conversions
 * - Density: kg/m³ (Standard Carbon Reinforcing Steel = 7850 kg/m³)
 */

export const CANONICAL_UNITS = {
  LENGTH: 'mm',
  WEIGHT: 'kg',
  ANGLE: 'deg',
  UNIT_WEIGHT: 'kg/m',
  STEEL_DENSITY_KG_M3: 7850
};

/**
 * Standard Supported Length Units
 */
export const LENGTH_UNITS = {
  MM: 'mm',
  CM: 'cm',
  M: 'm'
};

/**
 * Standard Supported Weight Units
 */
export const WEIGHT_UNITS = {
  KG: 'kg',
  G: 'g',
  TONNE: 't'
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. UNIT CONVERSIONS (LENGTH)
// ══════════════════════════════════════════════════════════════════════════════

export function mmToMeters(mm) {
  if (typeof mm !== 'number' || isNaN(mm)) return 0;
  return mm / 1000;
}

export function metersToMm(meters) {
  if (typeof meters !== 'number' || isNaN(meters)) return 0;
  return meters * 1000;
}

export function mmToCm(mm) {
  if (typeof mm !== 'number' || isNaN(mm)) return 0;
  return mm / 10;
}

export function cmToMm(cm) {
  if (typeof cm !== 'number' || isNaN(cm)) return 0;
  return cm * 10;
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. UNIT CONVERSIONS (WEIGHT / MASS)
// ══════════════════════════════════════════════════════════════════════════════

export function kgToTonnes(kg) {
  if (typeof kg !== 'number' || isNaN(kg)) return 0;
  return kg / 1000;
}

export function tonnesToKg(tonnes) {
  if (typeof tonnes !== 'number' || isNaN(tonnes)) return 0;
  return tonnes * 1000;
}

export function kgToGrams(kg) {
  if (typeof kg !== 'number' || isNaN(kg)) return 0;
  return kg * 1000;
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. ANGULAR CONVERSIONS
// ══════════════════════════════════════════════════════════════════════════════

export function degToRad(deg) {
  if (typeof deg !== 'number' || isNaN(deg)) return 0;
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad) {
  if (typeof rad !== 'number' || isNaN(rad)) return 0;
  return (rad * 180) / Math.PI;
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. DISPLAY FORMATTING (HIGH PRECISION INTERNALS -> CLEAN DISPLAY)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Format length value in mm to target unit string
 */
export function formatLength(valMm, targetUnit = 'mm', precision = 2) {
  if (typeof valMm !== 'number' || isNaN(valMm)) return '0 ' + targetUnit;
  let converted = valMm;
  if (targetUnit === 'm') converted = mmToMeters(valMm);
  else if (targetUnit === 'cm') converted = mmToCm(valMm);

  const rounded = Number(converted.toFixed(precision));
  return `${rounded.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: precision })} ${targetUnit}`;
}

/**
 * Format weight value in kg to target unit string
 */
export function formatWeight(valKg, targetUnit = 'kg', precision = 3) {
  if (typeof valKg !== 'number' || isNaN(valKg)) return '0 ' + targetUnit;
  let converted = valKg;
  if (targetUnit === 't') converted = kgToTonnes(valKg);
  else if (targetUnit === 'g') converted = kgToGrams(valKg);

  const rounded = Number(converted.toFixed(precision));
  return `${rounded.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })} ${targetUnit}`;
}

/**
 * Format unit weight (kg/m)
 */
export function formatUnitWeight(valKgPerM, precision = 3) {
  if (typeof valKgPerM !== 'number' || isNaN(valKgPerM)) return '0.000 kg/m';
  const rounded = Number(valKgPerM.toFixed(precision));
  return `${rounded.toFixed(precision)} kg/m`;
}

/**
 * Format angle in degrees
 */
export function formatAngle(valDeg, precision = 1) {
  if (typeof valDeg !== 'number' || isNaN(valDeg)) return '0°';
  const rounded = Number(valDeg.toFixed(precision));
  return `${rounded}°`;
}
