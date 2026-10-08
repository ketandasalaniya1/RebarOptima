# RebarOptima BBS Phase 2G: Production-Grade Shape Library & Parametric Block Management Architecture

---

## 1. Executive Summary & Core Principle

In **Phase 2G**, RebarOptima converts its parametric CAD drawing and calculation engines into an **authoritative, production-grade Shape Library**.

### 🌟 Fundamental Architectural Rule:
$$\text{Shape Definition} \neq \text{Shape Instance}$$

- **Shape Definition**: The master, immutable parametric template containing geometry formulas, parameter definitions, associative dimensions, geometric constraints, calculation rule sets, and full version history ($v1.0, v1.1, v2.0$).
- **Shape Instance**: A specific rebar usage attached to a structural member (e.g. Column $C1$, Beam $B4$) that stores independent parameter value overrides and a frozen calculation snapshot referencing $(\text{shapeId}, \text{shapeVersionId})$.
- **Immutability Guarantee**: Changing instance parameters for Column $C1$ never mutates the master Shape Definition or other structural members. Creating version $v2.0$ never alters historical calculations performed with $v1.0$.

---

## 2. Shape Definition Data Model

```typescript
interface ShapeDefinition {
  _id: ObjectId | string;                // Backend unique immutable identifier
  companyId: string;                     // Tenant isolation identifier
  shapeCode: string;                     // Human-friendly code (e.g., 'SH-001', 'Shape 51')
  name: string;                          // Human-readable name (e.g., 'Rectangular Closed Stirrup')
  description: string;                  // Engineering description & placement notes
  category: ShapeCategory;               // 'Straight' | 'L-Bar' | 'U-Bar' | 'Cranked' | 'Closed Stirrup / Link' | 'Open Link' | 'Custom'
  subCategory?: string;
  ownership: 'STANDARD' | 'CUSTOM';      // STANDARD (System provided & protected) vs CUSTOM (Org created)
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';
  version: string;                       // Current working version string (e.g., '1.0', '1.1', '2.0')
  versionId: string;                     // Unique version snapshot ID
  tags: string[];                        // Searchable tags (['stirrup', 'column', '135-hook'])
  unit: 'mm';                            // Canonical unit system
  geometry: {
    objects: GeometryObject[];           // Rebar, lines, polylines, arcs, circles
  };
  parameters: ParameterDefinition[];     // Parametric block variables (WIDTH, HEIGHT, DIAMETER, HOOK)
  dimensions: DimensionDefinition[];     // Associative dimensions
  constraints: ConstraintDefinition[];   // Parallel, perpendicular, fixed, tangent constraints
  calculationRules: {
    ruleSet: string;                     // 'RULE_SET_CENTERLINE_EXACT' | 'RULE_SET_STANDARD_BEND_DEDUCTION' | ...
  };
  validationRules: Record<string, any>;
  versions: ShapeVersionSnapshot[];      // Full historical version snapshots
  metadata: {
    unit: string;
    usageCount: number;                  // Number of member instances referencing this shape
    favorite: boolean;
    author: string;
    templateSource?: string;
  };
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}
```

---

## 3. Shape Versioning & Historical Immutability

### Shape Version Snapshot Schema
```typescript
interface ShapeVersionSnapshot {
  versionId: string;                     // e.g. 'v_1791234_ab3f'
  version: string;                       // '1.0', '1.1', '2.0'
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';
  createdAt: Date;
  createdBy: string;
  changeSummary: string;                 // Engineering note e.g. 'Updated 135° hook tail length formula'
  geometry: { objects: GeometryObject[] };
  parameters: ParameterDefinition[];
  dimensions: DimensionDefinition[];
  constraints: ConstraintDefinition[];
  calculationRules: { ruleSet: string };
  validationRules: Record<string, any>;
}
```

### Version Lifecycle Workflow:
1. **Creation**: New shapes start at version `v1.0` in `DRAFT` status.
2. **Activation**: Upon passing geometric & engineering validation (valid bend radii, angles, continuous segments), the shape transitions to `ACTIVE`.
3. **Modification of Active Shapes**: Once active, changes create a new version (`v1.1` or `v2.0`) with an explicit `changeSummary`. The prior version becomes `DEPRECATED` (still accessible for existing BBS calculations), and the new version is drafted and published.
4. **Calculations Traceability**: Any historical BBS bill of quantities retains its pinned `(shapeId, shapeVersionId)` and original geometry parameters.

---

## 4. Standard vs Custom Shapes Protection

- **System Standard Templates (BS 8666 / IS 2502)**:
  - `Shape 00`: Straight Bar
  - `Shape 11`: L-Bend Bar (90°)
  - `Shape 21`: U-Hook Bar
  - `Shape 51`: Rectangular Closed Stirrup with dual parallel 135° seismic hooks
  - `Shape 41`: Cranked Bar
  - `Shape 74`: Open Link / Shear Link
  - `Shape 77`: Circular Hoop / Spiral
- **Protection Mechanism**: Standard shapes cannot be overwritten or deleted. Clicking "Customize in CAD" or "Duplicate" creates a new independent custom shape (`ownership: 'CUSTOM'`) with its own unique backend ID and code.

---

## 5. Shape Instance Architecture

```typescript
interface ShapeInstance {
  instanceId: string;                    // Unique instance ID
  companyId: string;
  shapeId: string;                       // Reference to master ShapeDefinition
  shapeVersionId: string;                // Reference to specific version snapshot
  shapeVersion: string;                  // '1.0'
  memberId: string;                      // Column C1, Beam B4, Footing F1
  projectId: string;
  blockId: string;
  levelId: string;
  label: string;                         // 'Main Rebar T1', 'Outer Tie'
  barMark: string;                       // e.g. '01', '02'
  barDiameter: number;                   // e.g. 8, 10, 12, 16, 20, 25, 32 mm
  parameterValues: Record<string, number>; // Overrides: { WIDTH: 350, HEIGHT: 500, DIAMETER: 10 }
  calculationSnapshot: {
    cuttingLength: number;               // mm
    developedLength: number;             // mm
    unitWeight: number;                  // kg/m
    totalWeight: number;                 // kg
    breakdown: CalculationBreakdown;     // Step-by-step bend deductions and hooks
    isTrusted: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 6. Live Parameter Playground & Centralized Calculation

The **Shape Details Modal** includes an interactive **Parameter Playground**:
- Users can dynamically manipulate parameters (e.g. `WIDTH`, `HEIGHT`, `DIAMETER`, `HOOK_EXT`).
- The playground executes the centralized **Phase 2F Calculation Engine** (`calculateRebarShape`) and **Validation Engine** (`validateRebarObject`) in real-time.
- The master Shape Definition remains completely unaltered during playground experimentation.

---

## 7. Search, Filtering, and Lifecycle Statuses

- **Status Filters**: `All`, `Active`, `Standard Catalog`, `Custom Shapes`, `Drafts`, `Deprecated`, `Archived`.
- **Category Filter**: `Straight`, `L-Bar`, `U-Bar`, `Cranked`, `Hook`, `Closed Stirrup / Link`, `Open Link`, `Custom`.
- **Sort Options**: `Recently Updated`, `Name (A-Z)`, `Shape Code`, `Most Used`.
- **Search**: Full-text regex search across `name`, `code`, `shapeCode`, `description`, and `tags`.
- **Safe Archiving & Deletion**: Default soft-archive keeps shapes recoverable and protects existing structural member references.
