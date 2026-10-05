import React from 'react';

/**
 * Authentic CAD Software Vector Icons (AutoCAD / SolidWorks / DraftSight Style)
 * Crisp 20x20 / 24x24 vector paths with CAD endpoints, witness lines, and snap symbols.
 */

// 1. SELECT / CROSSHAIR & PICKBOX
export function IconCadSelect({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={size ? className : ""}>
      {/* CAD Pickbox in center */}
      <rect x="9" y="9" width="6" height="6" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      {/* Crosshair lines */}
      <line x1="12" y1="2" x2="12" y2="7" />
      <line x1="12" y1="17" x2="12" y2="22" />
      <line x1="2" y1="12" x2="7" y2="12" />
      <line x1="17" y1="12" x2="22" y2="12" />
    </svg>
  );
}

// 2. LINE (2 end nodes with connecting vector)
export function IconCadLine({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <line x1="5" y1="19" x2="19" y2="5" strokeLinecap="round" />
      {/* Node 1 */}
      <rect x="3" y="17" width="4" height="4" fill="#38bdf8" stroke="currentColor" strokeWidth="1" />
      {/* Node 2 */}
      <rect x="17" y="3" width="4" height="4" fill="#38bdf8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// 3. POLYLINE (Multi-joint continuous segments)
export function IconCadPolyline({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <polyline points="4,18 10,8 15,14 20,4" strokeLinejoin="round" strokeLinecap="round" />
      <rect x="2" y="16" width="4" height="4" fill="#38bdf8" stroke="currentColor" strokeWidth="1" />
      <rect x="8" y="6" width="4" height="4" fill="#38bdf8" stroke="currentColor" strokeWidth="1" />
      <rect x="13" y="12" width="4" height="4" fill="#38bdf8" stroke="currentColor" strokeWidth="1" />
      <rect x="18" y="2" width="4" height="4" fill="#38bdf8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// 4. RECTANGLE (2-Point Diagonal CAD Box)
export function IconCadRectangle({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <rect x="4" y="5" width="16" height="14" rx="0.5" strokeDasharray="none" />
      {/* Diagonal Point 1 */}
      <rect x="2" y="3" width="4" height="4" fill="#38bdf8" stroke="currentColor" strokeWidth="1" />
      {/* Diagonal Point 2 */}
      <rect x="18" y="17" width="4" height="4" fill="#38bdf8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// 5. CIRCLE (Center crosshair + circumference)
export function IconCadCircle({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <circle cx="12" cy="12" r="8.5" />
      {/* Center crosshair */}
      <line x1="9" y1="12" x2="15" y2="12" strokeWidth="1.2" stroke="#38bdf8" />
      <line x1="12" y1="9" x2="12" y2="15" strokeWidth="1.2" stroke="#38bdf8" />
      {/* Perimeter grip */}
      <rect x="18.5" y="10" width="4" height="4" fill="#38bdf8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// 6. 3-POINT ARC
export function IconCadArc({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path d="M4 18 A 14 14 0 0 1 19 6" strokeLinecap="round" />
      {/* Start node */}
      <rect x="2" y="16" width="4" height="4" fill="#38bdf8" stroke="currentColor" strokeWidth="1" />
      {/* Mid node */}
      <rect x="10" y="7" width="4" height="4" fill="#38bdf8" stroke="currentColor" strokeWidth="1" />
      {/* End node */}
      <rect x="17" y="4" width="4" height="4" fill="#38bdf8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// 7. LINEAR DIMENSION (Extension lines, arrows & measurement line)
export function IconCadDimLinear({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      {/* Witness/Extension lines */}
      <line x1="4" y1="4" x2="4" y2="20" strokeWidth="1.2" strokeDasharray="none" />
      <line x1="20" y1="4" x2="20" y2="20" strokeWidth="1.2" strokeDasharray="none" />
      {/* Main dimension line */}
      <line x1="4" y1="12" x2="20" y2="12" strokeWidth="1.5" stroke="#38bdf8" />
      {/* Left CAD Arrowhead */}
      <polygon points="4,12 8,9.5 8,14.5" fill="#38bdf8" stroke="none" />
      {/* Right CAD Arrowhead */}
      <polygon points="20,12 16,9.5 16,14.5" fill="#38bdf8" stroke="none" />
      {/* Text tick badge */}
      <rect x="10" y="10" width="4" height="4" fill="currentColor" opacity="0.8" rx="0.5" />
    </svg>
  );
}

// 8. ALIGNED DIMENSION (Diagonal angled dimension)
export function IconCadDimAligned({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <line x1="3" y1="17" x2="7" y2="21" strokeWidth="1.2" />
      <line x1="17" y1="3" x2="21" y2="7" strokeWidth="1.2" />
      <line x1="5" y1="19" x2="19" y2="5" strokeWidth="1.5" stroke="#38bdf8" />
      <polygon points="5,19 7,14 10,17" fill="#38bdf8" stroke="none" />
      <polygon points="19,5 14,7 17,10" fill="#38bdf8" stroke="none" />
    </svg>
  );
}

// 9. RADIUS DIMENSION (R with leader arrow to circle center)
export function IconCadDimRadius({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      {/* Arc portion */}
      <path d="M4 20 A 16 16 0 0 1 20 4" strokeDasharray="2 2" strokeOpacity="0.6" />
      {/* Center point */}
      <circle cx="4" cy="20" r="1.5" fill="#38bdf8" />
      {/* Leader line from center to arc */}
      <line x1="4" y1="20" x2="16" y2="8" stroke="#38bdf8" strokeWidth="1.5" />
      <polygon points="16,8 12,9 15,12" fill="#38bdf8" stroke="none" />
      {/* 'R' symbol */}
      <text x="16" y="19" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="sans-serif" stroke="none">R</text>
    </svg>
  );
}

// 10. DIAMETER DIMENSION (Ø symbol with through line)
export function IconCadDimDiameter({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="12" cy="12" r="7.5" strokeOpacity="0.7" />
      {/* Diameter dimension line through circle */}
      <line x1="5" y1="19" x2="19" y2="5" stroke="#38bdf8" strokeWidth="1.5" />
      <polygon points="5,19 6,15 9,18" fill="#38bdf8" stroke="none" />
      <polygon points="19,5 18,9 15,6" fill="#38bdf8" stroke="none" />
      {/* Ø symbol */}
      <text x="13" y="21" fill="#38bdf8" fontSize="8" fontWeight="bold" fontFamily="sans-serif" stroke="none">Ø</text>
    </svg>
  );
}

// 11. ANGULAR DIMENSION (Curved dimension between 2 lines)
export function IconCadDimAngular({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      {/* Two intersecting rays */}
      <line x1="4" y1="20" x2="20" y2="20" strokeWidth="1.2" />
      <line x1="4" y1="20" x2="17" y2="5" strokeWidth="1.2" />
      {/* Angle dimension arc */}
      <path d="M12 20 A 8 8 0 0 0 11 12" stroke="#38bdf8" strokeWidth="1.5" />
      <polygon points="12,20 12,17 15,19" fill="#38bdf8" stroke="none" />
      <polygon points="11,12 8,13 10,15" fill="#38bdf8" stroke="none" />
      {/* Degree indicator */}
      <circle cx="15" cy="11" r="1.5" fill="#38bdf8" stroke="none" />
    </svg>
  );
}

// 12. MOVE (4-Way CAD Transform Cross)
export function IconCadMove({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <line x1="12" y1="3" x2="12" y2="21" stroke="#38bdf8" strokeWidth="1.5" />
      <line x1="3" y1="12" x2="21" y2="12" stroke="#38bdf8" strokeWidth="1.5" />
      {/* 4 arrowheads */}
      <polygon points="12,2 9,5 15,5" fill="#38bdf8" stroke="none" />
      <polygon points="12,22 9,19 15,19" fill="#38bdf8" stroke="none" />
      <polygon points="2,12 5,9 5,15" fill="#38bdf8" stroke="none" />
      <polygon points="22,12 19,9 19,15" fill="#38bdf8" stroke="none" />
      <rect x="10.5" y="10.5" width="3" height="3" fill="#38bdf8" />
    </svg>
  );
}

// 13. ROTATE (Circular trajectory arrow around pivot)
export function IconCadRotate({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="12" cy="12" r="2" fill="#38bdf8" stroke="none" />
      <path d="M12 4 A 8 8 0 1 1 5 9" stroke="#38bdf8" strokeWidth="1.75" strokeLinecap="round" />
      <polygon points="5,4 5,10 11,8" fill="#38bdf8" stroke="none" />
    </svg>
  );
}

// 14. COPY (Original + Offset Duplicate)
export function IconCadCopy({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      {/* Base object */}
      <rect x="4" y="9" width="10" height="10" strokeOpacity="0.5" strokeDasharray="2 2" />
      {/* Duplicated object */}
      <rect x="10" y="5" width="10" height="10" stroke="#38bdf8" strokeWidth="1.5" />
      <polygon points="9,14 13,11 13,17" fill="#38bdf8" stroke="none" />
    </svg>
  );
}

// 15. MIRROR (Symmetric triangles flipped across centerline)
export function IconCadMirror({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      {/* Centerline mirror axis */}
      <line x1="12" y1="2" x2="12" y2="22" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2" />
      {/* Left object */}
      <polygon points="4,7 10,12 4,17" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2" />
      {/* Right mirrored object */}
      <polygon points="20,7 14,12 20,17" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="1.5" />
    </svg>
  );
}

// 16. OFFSET (Concentric/Parallel CAD Offset curves)
export function IconCadOffset({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      {/* Original curve */}
      <path d="M4 18 C 8 10, 14 10, 20 4" stroke="currentColor" strokeWidth="1.5" />
      {/* Offset curve */}
      <path d="M8 21 C 12 13, 17 13, 22 8" stroke="#38bdf8" strokeWidth="1.75" />
      {/* Distance arrow */}
      <line x1="10" y1="12" x2="13" y2="15" stroke="#38bdf8" strokeWidth="1.2" />
      <polygon points="13,15 11,14 12,16" fill="#38bdf8" stroke="none" />
    </svg>
  );
}

// 17. TRIM (CAD Scissors cutting across line)
export function IconCadTrim({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      {/* Line being trimmed (dashed on cut side) */}
      <line x1="3" y1="12" x2="11" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="12" x2="21" y2="12" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2 2" />
      {/* Scissors blades */}
      <circle cx="6" cy="7" r="2" stroke="#38bdf8" />
      <circle cx="6" cy="17" r="2" stroke="#38bdf8" />
      <line x1="8" y1="8" x2="15" y2="16" stroke="#38bdf8" strokeWidth="1.5" />
      <line x1="8" y1="16" x2="15" y2="8" stroke="#38bdf8" strokeWidth="1.5" />
    </svg>
  );
}

// 18. EXTEND (Boundary fence + projection arrow)
export function IconCadExtend({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      {/* Boundary line */}
      <line x1="18" y1="3" x2="18" y2="21" stroke="#38bdf8" strokeWidth="2" />
      {/* Line being extended */}
      <line x1="4" y1="12" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12" y1="12" x2="18" y2="12" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="2 2" />
      <polygon points="18,12 14,10 14,14" fill="#38bdf8" stroke="none" />
    </svg>
  );
}

// 19. FILLET (Perpendicular corner rounded by tangential arc)
export function IconCadFillet({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      {/* Sharp original phantom corner */}
      <line x1="4" y1="4" x2="19" y2="4" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.4" />
      <line x1="19" y1="4" x2="19" y2="19" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.4" />
      {/* Tangent fillet lines and arc */}
      <line x1="4" y1="4" x2="11" y2="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 4 A 8 8 0 0 1 19 12" stroke="#38bdf8" strokeWidth="2" fill="none" />
      <line x1="19" y1="12" x2="19" y2="19" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// 20. PAN (Hand navigation)
export function IconCadPan({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M18 11V6a2 2 0 0 0-4 0v4M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a5 5 0 0 0 5 5h3a5 5 0 0 0 5-5v-4a2 2 0 0 0-4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 21. ZOOM EXTENTS / FIT ALL
export function IconCadZoomExtents({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      {/* 4 Framing Corner Brackets */}
      <path d="M4 8V4h4M16 4h4v4M4 16v4h4M20 16v4h-4" stroke="#38bdf8" strokeWidth="1.75" />
      <rect x="8" y="8" width="8" height="8" rx="1" fill="#38bdf8" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

// 22. ORTHO MODE (90 Degree Right Angle drafting indicator)
export function IconCadOrtho({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      {/* 90-degree corner */}
      <polyline points="5,5 5,19 19,19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Square perpendicular mark */}
      <rect x="5" y="14" width="5" height="5" fill="#38bdf8" fillOpacity="0.4" stroke="#38bdf8" strokeWidth="1" />
    </svg>
  );
}

// 23. OSNAP / SNAP MAGNET
export function IconCadSnap({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      {/* CAD Endpoint Snap box with crossed diagonals */}
      <rect x="5" y="5" width="14" height="14" fill="#10b981" fillOpacity="0.2" stroke="#10b981" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" fill="#10b981" stroke="none" />
    </svg>
  );
}

// 24. GRID MESH
export function IconCadGrid({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  );
}

// 25. PARAMETRIC ENGINE / CONSTRAINTS ICON
export function IconCadParametric({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <text x="3" y="17" fill="#38bdf8" fontSize="13" fontWeight="bold" fontFamily="monospace">fx</text>
      <circle cx="18" cy="7" r="3" stroke="#38bdf8" strokeWidth="1.5" />
      <path d="M15 17h6M18 14v6" stroke="#38bdf8" strokeWidth="1.5" />
    </svg>
  );
}

// 26. UNDO
export function IconCadUndo({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M3 7v6h6" />
      <path d="M3 13C6 6 15 5 19 9c4 4 3 10-1 13" />
    </svg>
  );
}

// 27. REDO
export function IconCadRedo({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M21 7v6h-6" />
      <path d="M21 13C18 6 9 5 5 9c-4 4-3 10 1 13" />
    </svg>
  );
}

// 28. REBAR HOOK / STIRRUP ICON
export function IconCadRebar({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" className={className}>
      <path d="M4 16 L4 8 A 4 4 0 0 1 8 4 L16 4 A 4 4 0 0 1 20 8 L20 16 A 4 4 0 0 1 16 20 L8 20 A 4 4 0 0 1 4 16 Z" fill="none" />
      <path d="M7 6 L9 9 M15 6 L17 9" strokeWidth="1.5" stroke="#f59e0b" />
    </svg>
  );
}

// 29. CONSTRAINT: HORIZONTAL (— H —)
export function IconCadConstraintHorizontal({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <line x1="2" y1="12" x2="22" y2="12" stroke="#38bdf8" strokeWidth="2" />
      <path d="M8 8v8M16 8v8M8 12h8" stroke="#38bdf8" strokeWidth="1.5" />
    </svg>
  );
}

// 30. CONSTRAINT: VERTICAL (│ V │)
export function IconCadConstraintVertical({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <line x1="12" y1="2" x2="12" y2="22" stroke="#38bdf8" strokeWidth="2" />
      <path d="M8 8l4 8 4-8" stroke="#38bdf8" strokeWidth="1.5" />
    </svg>
  );
}

// 31. CONSTRAINT: PARALLEL (//)
export function IconCadConstraintParallel({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" className={className}>
      <line x1="7" y1="20" x2="13" y2="4" />
      <line x1="12" y1="20" x2="18" y2="4" />
    </svg>
  );
}

// 32. CONSTRAINT: PERPENDICULAR (⊥)
export function IconCadConstraintPerpendicular({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" className={className}>
      <line x1="4" y1="19" x2="20" y2="19" />
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="12,14 17,14 17,19" strokeWidth="1.5" />
    </svg>
  );
}

// 33. CONSTRAINT: EQUAL (=)
export function IconCadConstraintEqual({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" className={className}>
      <line x1="5" y1="9" x2="19" y2="9" />
      <line x1="5" y1="15" x2="19" y2="15" />
    </svg>
  );
}

// 34. CONSTRAINT: COINCIDENT (●)
export function IconCadConstraintCoincident({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="12" cy="12" r="5" fill="#10b981" stroke="#10b981" />
      <circle cx="12" cy="12" r="9" stroke="#10b981" strokeDasharray="2 2" />
    </svg>
  );
}

// 35. CONSTRAINT: FIXED (🔒)
export function IconCadConstraintFixed({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.75" className={className}>
      <rect x="5" y="11" width="14" height="10" rx="2" fill="rgba(239,68,68,0.2)" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1.5" fill="#ef4444" />
    </svg>
  );
}

// 36. CONSTRAINT: DISTANCE (↔)
export function IconCadConstraintDistance({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.75" className={className}>
      <line x1="4" y1="12" x2="20" y2="12" />
      <polygon points="4,12 8,9 8,15" fill="#38bdf8" />
      <polygon points="20,12 16,9 16,15" fill="#38bdf8" />
      <line x1="4" y1="6" x2="4" y2="18" strokeWidth="1.2" />
      <line x1="20" y1="6" x2="20" y2="18" strokeWidth="1.2" />
    </svg>
  );
}

// 37. CONSTRAINT: ANGLE (∠)
export function IconCadConstraintAngle({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="1.75" className={className}>
      <line x1="4" y1="19" x2="20" y2="19" />
      <line x1="4" y1="19" x2="17" y2="5" />
      <path d="M11 19 A 7 7 0 0 0 9 14" strokeWidth="1.5" />
    </svg>
  );
}

