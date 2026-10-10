# RebarOptima BBS Module — Phase 2A & 2B: Parametric Rebar CAD Engine Architecture

## 1. Overview & Objectives
Phase 2A established the 2D CAD workspace foundation, and **Phase 2B** elevated it into a functional drawing, editing, and transformation engine.
The system allows detailers and structural engineers to author rebar shapes and parametric blocks using interactive drawing tools, geometric transformations, and live dimension property editing.

---

## 2. Architectural Structure

```
frontend/src/pages/BBSPage/
├── BBSPage.jsx                   # Main BBS Controller (Projects Hierarchy ↔ Shape Library ↔ CAD Workspace)
├── BBSPage.css                   # Module styling & tab switcher
├── ShapeLibrary.jsx              # Shape Library Catalog (BS 8666 / IS 2502 & Custom Parametric Blocks)
├── ShapeLibrary.css              # Shape cards, SVG mini-previews, category filters
├── bbsApi.js                     # Additive API endpoints for BBS shapes
└── cad/
    ├── types.js                  # Geometry schemas, tool definitions (Draw & Modify), snap settings
    ├── viewport.js               # Logical world (mm) ↔ Screen pixel transformations & camera controls
    ├── geometry.js               # Object factories, distance math, hit-testing, canvas renderers
    ├── snapEngine.js             # Precision Snap Engine (Grid, Endpoint, Midpoint, Center, Intersection)
    ├── editEngine.js             # Phase 2B Transformations: Move, Rotate, Copy, Mirror, Offset, Trim, Extend, Fillet, Grips, Ortho
    ├── history.js                # Undo/Redo snapshot history manager
    ├── CADCanvas.jsx             # Interactive 2D drawing canvas with live construction previews & grip drag
    ├── CADEditor.jsx             # CAD Workspace (Topbar, Left Toolbar, Properties Panel, Status Bar)
    └── CADEditor.css             # Engineering CAD workspace dark theme styles
```

---

## 3. Core Capabilities Implemented in Phase 2B

### A. Drawing Tools
- **Line (`L`)**: 2-click interaction with live length (mm) and angle ($^\circ$) badges.
- **Polyline (`P`)**: Multi-vertex chain with live segment dimensions (Enter / Double click to finish).
- **Rectangle (`R`)**: 2-corner interaction with live width $\times$ height dimensions.
- **Circle (`C`)**: Center $\rightarrow$ Radius interaction with real-time radius ($R$) and diameter ($\varnothing$) display.
- **Arc (`A`)**: 3-Point arc interaction (Start $\rightarrow$ End $\rightarrow$ Bulge).
- **Dimension (`D`)**: Visual dimension measurement tool with draggable leader offset.

### B. CAD Modify & Transformation Tools (`editEngine.js`)
- **Move (`M`)**: Select base point $\rightarrow$ live transformation offset $\rightarrow$ destination point.
- **Rotate (`RO`)**: Select center point $\rightarrow$ live angular preview $\rightarrow$ destination angle.
- **Copy (`CO`)**: Creates independent duplicates with new unique IDs translated by $(\Delta X, \Delta Y)$.
- **Mirror (`MI`)**: Mirrors geometry across any 2-point axis line.
- **Offset (`O`)**: Parallel offset for lines and rectangles by specified distance (e.g. 25 mm).
- **Trim (`TR`)**: Trims intersecting line segments cleanly based on cutting geometry.
- **Extend (`EX`)**: Extends lines to meet boundary edges.
- **Corner Fillet (`F`)**: Computes tangent arcs between intersecting lines with a configurable radius $R$ (essential for future rebar bend foundations!).

### C. Selection Engine & CAD Grips
- **Single & Multi-Selection**: Direct click & Shift+Click multi-select.
- **Box Selection**:
  - Left-to-Right (**Window Selection**, Blue solid box): Selects objects completely enclosed within the box.
  - Right-to-Left (**Crossing Selection**, Green dashed box): Selects objects touching or crossing the box.
- **CAD Grip Handles**: Interactive control points on selected objects (Line endpoints, Rectangle corners, Circle center/radius, Polyline vertices, Arc endpoints). Dragging a grip adjusts geometry in real time.

### D. Live Properties Editing Foundation
- The Right Properties Panel allows **direct numerical editing** of:
  - Line coordinates ($X_1, Y_1, X_2, Y_2$) and displays Length / Angle.
  - Rectangle ($X, Y$, Width, Height) and displays Perimeter / Area.
  - Circle (Radius, Center $X, Y$) and displays Diameter / Circumference / Area.
- Editing an input field instantly updates the geometry on canvas and pushes a snapshot to history.
- Quick transformation buttons: `↻ Rotate 90°`, `❐ Duplicate`, `⮂ Mirror H`, `⮃ Mirror V`.

### E. Ortho Mode & Precision Snapping
- **Ortho Mode (`F8`)**: Constrains drawing, moving, and dragging to orthogonal axes ($0^\circ, 90^\circ, 180^\circ, 270^\circ$).
- **Precision Snapping (`snapEngine.js`)**: Centralized snapping subsystem supporting:
  - **Endpoints**: Green square (`#22c55e`).
  - **Midpoints**: Cyan triangle (`#06b6d4`).
  - **Centers**: Amber circle (`#f59e0b`).
  - **Intersections**: Purple cross (`#c084fc`).
  - **Grid**: Adaptive blue crosshair (`#38bdf8`).

### F. Context Menu & Command Feedback
- Right-clicking on selected objects opens a floating context menu: `Move`, `Rotate`, `Duplicate`, `Mirror`, `Offset`, `Delete`.
- Real-time tool prompts in the bottom status bar guide the user at every step.

---

## 4. Roadmap for Phase 2C (Parametric Dimensions & Constraints)
- **Phase 2C (Parametric Variables & Formulas)**: Assigning algebraic variables ($A, B, C, D, E, R$) to geometry segments.
- **Phase 2D (Constraints Engine)**: Coincident, Tangent, Perpendicular, and Parallel constraints.
- **Phase 2E (Rebar Bend & Hook Geometry)**: Automatic bend radius calculation from bar diameter ($\varnothing 8, \varnothing 10, \varnothing 12, \varnothing 16$), standard $90^\circ, 135^\circ, 180^\circ$ hooks.
- **Phase 2F (BBS Calculation Engine)**: Cutting length formulas, bend deductions, unit weights ($kg/m$).
- **Phase 2G (Member BBS Integration)**: Embedding parametric shapes into Column/Beam/Slab BBS schedules.
