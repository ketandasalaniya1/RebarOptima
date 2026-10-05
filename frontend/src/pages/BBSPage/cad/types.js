/**
 * RebarOptima CAD - Geometry, Dimension, Parameter & Constraint Constants and Models (Phase 2D)
 * Pure JavaScript with JSDoc typing for full runtime and bundler compatibility.
 */

/**
 * CAD Tool Constants (Drawing, Modifying & Dimensioning)
 */
export const CAD_TOOLS = {
  // Drawing Tools
  SELECT: 'select',
  LINE: 'line',
  POLYLINE: 'polyline',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  ARC: 'arc',
  DIMENSION: 'dimension',
  PAN: 'pan',

  // Editing & Modification Tools
  MOVE: 'move',
  ROTATE: 'rotate',
  COPY: 'copy',
  MIRROR: 'mirror',
  OFFSET: 'offset',
  TRIM: 'trim',
  EXTEND: 'extend',
  FILLET: 'fillet',

  // Dimension Tools (Phase 2C)
  DIM_LINEAR: 'dim_linear',
  DIM_ALIGNED: 'dim_aligned',
  DIM_ANGULAR: 'dim_angular',
  DIM_RADIUS: 'dim_radius',
  DIM_DIAMETER: 'dim_diameter'
};

/**
 * Dimension Types Constants
 */
export const DIMENSION_TYPES = {
  LINEAR: 'linear',
  ALIGNED: 'aligned',
  ANGULAR: 'angular',
  RADIUS: 'radius',
  DIAMETER: 'diameter'
};

/**
 * Parameter Types Constants
 */
export const PARAMETER_TYPES = {
  LENGTH: 'length',
  ANGLE: 'angle',
  NUMBER: 'number'
};

/**
 * Parameter Categories Constants
 */
export const PARAMETER_CATEGORIES = {
  GEOMETRY: 'Geometry',
  REBAR: 'Rebar',
  BENDING: 'Bending',
  CALCULATION: 'Calculation'
};

/**
 * Constraint Types Constants (Phase 2D)
 */
export const CONSTRAINT_TYPES = {
  COINCIDENT: 'coincident',         // Point A == Point B
  HORIZONTAL: 'horizontal',         // Line or points: Start Y == End Y
  VERTICAL: 'vertical',             // Line or points: Start X == End X
  PARALLEL: 'parallel',             // Line A angle == Line B angle
  PERPENDICULAR: 'perpendicular',   // Line A angle - Line B angle == 90°
  EQUAL: 'equal',                   // Line length == Line length OR Circle radius == Circle radius
  FIXED: 'fixed',                   // Point or entity position locked
  DISTANCE: 'distance',             // Distance between 2 points or line length == specified value/parameter
  ANGLE: 'angle',                   // Angle between 2 lines == specified degrees/parameter
  RADIUS: 'radius',                 // Circle/Arc radius == specified value/parameter
  DIAMETER: 'diameter'              // Circle diameter == specified value/parameter
};

/**
 * Constraint Status Constants (Phase 2D)
 */
export const CONSTRAINT_STATUS = {
  VALID: 'valid',           // Solved and fully satisfied
  WARNING: 'warning',       // Approximated / near limit
  CONFLICT: 'conflict',     // Directly contradictory with another constraint
  UNRESOLVED: 'unresolved', // Orphaned or missing target reference
  SUPPRESSED: 'suppressed'  // Temporarily disabled by user
};

/**
 * Centralized Solver Configuration & Numerical Tolerances (Phase 2D)
 */
export const SOLVER_CONFIG = {
  maxIterations: 40,
  linearTolerance: 1e-3,      // 0.001 mm
  angularTolerance: 1e-2,     // 0.01 deg
  dampingFactor: 0.85,
  showConstraintGlyphs: true
};

/**
 * Snap Types Constants
 */
export const SNAP_TYPES = {
  GRID: 'grid',
  ENDPOINT: 'endpoint',
  MIDPOINT: 'midpoint',
  CENTER: 'center',
  INTERSECTION: 'intersection',
  PERPENDICULAR: 'perpendicular',
  NEAREST: 'nearest'
};

/**
 * Default Snap Configuration
 */
export const DEFAULT_SNAP_SETTINGS = {
  enabled: true,
  grid: true,
  endpoint: true,
  midpoint: true,
  center: true,
  intersection: true,
  perpendicular: true,
  nearest: false,
  gridSize: 10,       // 10 mm default engineering grid
  tolerancePx: 14     // 14px screen snap capture radius
};

/**
 * Default Viewport State
 */
export const DEFAULT_VIEWPORT = {
  panX: 0,
  panY: 0,
  zoom: 1.0,
  width: 800,
  height: 600
};

/**
 * Centralized Dimension Styling Standard
 */
export const DEFAULT_DIMENSION_STYLE = {
  color: '#f59e0b',          // Amber/gold engineering dimension line
  textColor: '#fbbf24',      // Readable amber text
  highlightColor: '#22c55e', // Green when selected
  fontSize: 11,              // Base font size in px
  arrowSize: 8,              // Engineering arrow / tick length
  extensionGap: 6,           // Gap from geometry (mm)
  extensionOvershoot: 6,     // Extension line overshoot (mm)
  precision: 1,              // 1 decimal place (e.g. 350.0 mm)
  showUnits: true
};
