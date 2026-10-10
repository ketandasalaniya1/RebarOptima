# RebarOptima BBS Module — Phase 2D: Parametric Constraint Engine Architecture

## 1. Executive Summary & Overview

Phase 2D transforms the CAD workspace and Phase 2C Parametric Foundation into a **true 2D Parametric Geometric Constraint System**. 

The engine maintains mathematical and topological relationships across rebar geometric primitives (e.g. stirrups, links, hooks, and column ties) as parameters, dimensions, and vertices change.

---

## 2. Distinction: Dimensions vs Parameters vs Constraints

| Concept | Purpose | Example |
| :--- | :--- | :--- |
| **Dimension** | Visual & engineering measurement representation attached to geometry | `Width = 350.0 mm` |
| **Parameter** | Named variable value that can drive single or multiple geometry entities | `WIDTH = 350 mm` |
| **Constraint** | Geometric rule enforcing relationships between entities | `Line 1 is Horizontal`, `Line 1 ⊥ Line 2` |

---

## 3. Constraint Data Model

```typescript
interface Constraint {
  id: string;                               // Unique constraint ID (e.g. cst_1728189...)
  type: 'coincident' | 'horizontal' | 'vertical' | 'parallel' | 
        'perpendicular' | 'equal' | 'fixed' | 'distance' | 
        'angle' | 'radius' | 'diameter';
  references: Array<{                       // Referenced geometric entities
    objectId: string;
    subTarget?: 'p1' | 'p2' | 'center' | 'start' | 'end' | 'line' | 'width' | 'height';
    pointIndex?: number;
  }>;
  value?: number | { x: number; y: number }; // Target numeric value or coordinate
  parameterId?: string;                     // Optional link to named parameter
  parameterName?: string;
  enabled: boolean;                         // True if active, false if suppressed
  status: 'valid' | 'warning' | 'conflict' | 'unresolved' | 'suppressed';
  message?: string;
  metadata?: Record<string, any>;
}
```

---

## 4. Implemented Constraint Types

1. **`coincident`**: Enforces that vertex $P_A$ and vertex $P_B$ share the exact same $(X, Y)$ coordinate in world space.
2. **`horizontal`**: Enforces that $Y_1 = Y_2$ on a line segment.
3. **`vertical`**: Enforces that $X_1 = X_2$ on a line segment.
4. **`parallel`**: Enforces that $\theta_1 = \theta_2$ (or $\theta_2 = \theta_1 + \pi$) between two lines.
5. **`perpendicular`**: Enforces that $\theta_2 = \theta_1 \pm 90^\circ$ between two lines.
6. **`equal`**: Enforces equal geometric lengths between lines, or equal radii between circles/arcs.
7. **`fixed`**: Locks the $(X, Y)$ coordinates of a point or anchor node.
8. **`distance`**: Enforces $\|P_2 - P_1\| = d$ for a segment or point pair in millimeters.
9. **`angle`**: Enforces an explicit angle $\alpha^\circ$ between two intersecting or non-parallel rays.
10. **`radius`**: Enforces circle or arc radius $R = r$.
11. **`diameter`**: Enforces circle diameter $\varnothing = 2r$.

---

## 5. Constraint Solver Architecture

```
User Action (Edit Parameter / Move Grip / Add Constraint)
                       │
                       ▼
            Input Validation Layer
                       │
                       ▼
           Constraint Graph Extraction
                       │
                       ▼
   Gauss-Seidel Relaxation & Projection Solver
                       │
                       ▼
          Geometric Solution Validator
           ┌───────────┴───────────┐
      [Valid]                  [Conflict]
           │                        │
     Commit Solution           Rollback State
           │                        │
 Recalculate Dimensions      Display Diagnostic
           │                        │
    Render to Canvas          Maintain Previous
```

### Numerical Solver Characteristics
- **Algorithm**: Iterative projection & relaxation (Gauss-Seidel).
- **Max Iterations**: 40 iterations.
- **Linear Tolerance**: $\epsilon_{linear} = 0.001\text{ mm}$.
- **Angular Tolerance**: $\epsilon_{angular} = 0.01^\circ$.
- **Transactional Safety**: If solving produces non-finite coordinates or negative dimensions, the state rolls back to the previous valid snapshot with a clear error prompt.

---

## 6. Degrees of Freedom (DOF) Analysis

- **Total Variables**: Each 2D line has 4 DOFs ($X_1, Y_1, X_2, Y_2$). Each circle has 3 DOFs ($C_X, C_Y, R$).
- **Removed DOFs**: Fixed removes 2 DOFs; Coincident removes 2 DOFs; Horizontal, Vertical, Equal, Distance, Parallel, Perpendicular remove 1 DOF each.
- **States**:
  - `UNDER_CONSTRAINED` ($\text{DOF} > 0$): Normal for flexible parametric shapes.
  - `FULLY_CONSTRAINED` ($\text{DOF} = 0$): Exact rigid shape.
  - `OVER_CONSTRAINED` ($\text{DOF} < 0$): Redundant or conflicting constraints.

---

## 7. UI & Interaction Workflow

1. **Context-Sensitive Actions**:
   - Single line selected: Apply Horizontal, Vertical, Fixed, or Distance constraint.
   - Two lines selected: Apply Parallel, Perpendicular, Equal, or Coincident constraint.
   - Circle selected: Apply Radius, Diameter, or Fix Center constraint.
2. **Dedicated "Rules" (Constraints) Tab**:
   - Live DOF status card.
   - List of all active rules with suppression toggle (`✓` / `⏸`) and delete (`✕`).
   - "Re-Solve Constraints" trigger button.
3. **Canvas Constraint Badges**:
   - CAD-style glyph overlays (`—H—`, `│V│`, `//`, `⊥`, `=`, `🔒`, `●`) rendered in real-time with toggle overlay button (`X`).

---

## 8. Save/Draft JSON Schema

```json
{
  "id": "shape_1728189...",
  "name": "Parametric Stirrup T1",
  "code": "ST-001",
  "category": "Stirrup",
  "unit": "mm",
  "geometry": {
    "objects": [ ... ]
  },
  "dimensions": [ ... ],
  "parameters": [ ... ],
  "constraints": [
    {
      "id": "cst_h1",
      "type": "horizontal",
      "references": [{ "objectId": "line_1", "subTarget": "line" }],
      "enabled": true,
      "status": "valid"
    },
    {
      "id": "cst_v1",
      "type": "vertical",
      "references": [{ "objectId": "line_2", "subTarget": "line" }],
      "enabled": true,
      "status": "valid"
    }
  ],
  "updatedAt": "2026-10-06T01:34:00.000Z"
}
```

---

## 9. Next Steps: Phase 2E Scope

When prompted, Phase 2E will introduce:
- **Rebar Bend Engine**: Arc-to-line tangent transitions for standard mandrel bend diameters ($4d$, $6d$, $8d$).
- **Hook Allowance Engine**: $90^\circ$, $135^\circ$ seismic, and $180^\circ$ hooks with automatic extension length calculation.
- **IS 2502 / BS 8666 / ACI 318 Standard Bending Rule Evaluation**.
