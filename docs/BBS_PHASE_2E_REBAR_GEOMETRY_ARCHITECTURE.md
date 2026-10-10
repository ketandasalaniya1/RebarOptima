# Phase 2E — Rebar Geometry & Bending Engine Architecture

## 1. Executive Summary

Phase 2E transforms the RebarOptima 2D CAD environment from a generic parametric drawing tool into a **Semantic Rebar Engineering Geometry System**.

In rebar detailing, a reinforcement bar is **not** merely a graphical stroke or static vector curve:
- It possesses a mathematical **neutral centerline axis** governing length and spatial paths.
- It possesses a semantic **bar diameter ($\Phi$)** that controls physical envelope, visual thickness, and mandrel spacing.
- It possesses **tangent fillet arc bends** governed by independent **mandrel bend radii ($R$)** rather than sharp geometric corners.
- It incorporates standard **hook configurations (90°, 135°, 180°)** with defined extension lengths.
- It operates under structured **parametric categories** (`GEOMETRY`, `REBAR`, `BENDING`, `HOOK`, `CALCULATION`).
- It cleanly isolates the **Geometry Engine** from downstream **Engineering Code Rules** (e.g. IS 2502, IS 456, BS 8666, ACI 318, Eurocode 2) and **BBS Calculations** (Phase 2F).

---

## 2. Rebar Geometry Object Model

### 2.1 Centerline vs Visual Thickness

All spatial transformations, vertex dragging, snap detection, and constraint relations operate on the **centerline path** $[P_0, P_1, \dots, P_n]$.

```
Visual Bar Envelope (Outer Edge)
┌──────────────────────────────────────────────────┐
│                                                  │
- - - - - - - - Neutral Centerline Axis - - - - - -  (Length = L)
│                                                  │
└──────────────────────────────────────────────────┘
Visual Bar Envelope (Inner Edge)
│<──────────────── Bar Diameter (Ø) ──────────────>│
```

- **Engineering Centerline**: Used for exact coordinates, arc tangents, length measurement, and parametric solver equations.
- **Visual Bar Thickness**: Scaled dynamically at runtime based on `ctx.lineWidth = diameter * zoom`, rendered with smooth rounded caps (`ctx.lineCap = 'round'`) and joined arcs.

---

## 3. Mathematical Mandrel Fillet Bend Construction

For any corner vertex $P_1$ flanked by segments $P_0 \to P_1$ and $P_1 \to P_2$:

1. Compute unit vectors:
   $$\vec{u}_{10} = \frac{P_0 - P_1}{\|P_0 - P_1\|}, \quad \vec{u}_{12} = \frac{P_2 - P_1}{\|P_2 - P_1\|}$$
2. Compute deflection angle $\theta = \arccos(\vec{u}_{10} \cdot \vec{u}_{12})$.
3. Compute tangent distance $T = R \tan\left(\frac{\pi - \theta}{2}\right)$.
4. Clamp $T$ to avoid inverted geometry:
   $$T_{\text{clamped}} = \min\left(T, 0.9 \times \min(\|P_1 - P_0\|, \|P_1 - P_2\|)\right)$$
5. Derive tangent touchpoints $T_1 = P_1 + \vec{u}_{10} T_{\text{clamped}}$ and $T_2 = P_1 + \vec{u}_{12} T_{\text{clamped}}$.
6. Compute fillet center $C$ by intersecting perpendicular offsets from $T_1$ and $T_2$.
7. Render exact arc between start angle $\alpha_1 = \text{atan2}(T_1.y - C.y, T_1.x - C.x)$ and end angle $\alpha_2 = \text{atan2}(T_2.y - C.y, T_2.x - C.x)$.

---

## 4. Rebar Types Implemented

| Rebar Shape Type | Description | Key Driving Parameters |
| :--- | :--- | :--- |
| **Straight Bar** | Single linear neutral axis | `length`, `diameter` |
| **L-Bar (Shape 11)** | Standard 2-leg corner bar with fillet | `legA`, `legB`, `diameter`, `bendRadius`, `bendAngle` |
| **U-Bar (Shape 21)** | 3-segment channel bar with dual bends | `legA`, `baseLength`, `legC`, `diameter`, `bendRadius` |
| **Cranked / Joggle Bar** | Column starter / lap crank bar | `mainLength`, `crankLength`, `crankAngle`, `offsetDistance`, `diameter`, `bendRadius` |
| **Hook Object** | Terminal anchorage hook (90° / 135° / 180°) | `hookAngle`, `hookExtension`, `radius`, `diameter` |
| **Mandrel Bend** | Isolated curved bend entity | `bendAngle`, `radius`, `diameter` |
| **Closed Stirrup / Link** | 4-leg closed column/beam tie with 135° seismic hooks | `width`, `height`, `diameter`, `bendRadius`, `hookAngle`, `hookExtension` |
| **Open Link / U-Stirrup** | 3-leg open tie with return hooks | `width`, `height`, `opening`, `diameter`, `bendRadius`, `hookAngle`, `hookExtension` |
| **Custom Rebar Path** | Multi-segment continuous centerline with auto-fillets | `diameter`, `bendRadius`, vertices array |

---

## 5. Parameter Categories

The parameter system organizes variables into 5 semantic domains:

1. **`GEOMETRY`**: Overall spatial dimensions (`WIDTH`, `HEIGHT`, `LEG_A`, `LEG_B`, `BASE_B`, `LENGTH`, `OFFSET`).
2. **`REBAR`**: Physical reinforcement bar specifications (`BAR_DIA` $\in [6, 8, 10, 12, 16, 20, 25, 32, 40, \dots]\text{ mm}$).
3. **`BENDING`**: Mandrel radii and corner deflection angles (`BEND_RAD`, `BEND_ANG`).
4. **`HOOK`**: Seismic and terminal anchorage definitions (`HOOK_ANG`, `HOOK_EXT`).
5. **`CALCULATION`**: *(Reserved for Phase 2F)* Cutting length, bend deductions, hook allowances, and bar mass.

---

## 6. Shape Definition vs Shape Instance Architecture

```
ShapeDefinition (Master Catalog Blueprint)
└── ID: "SH-001" (Rectangular Closed Stirrup)
    ├── Master Parameters: { A: 300, B: 450, Ø: 8, Hook: 135°, R: 16 }
    └── Constraints: Rectangular Closed Centerline + Dual Corner Fillets

            │ Instantiated
            ▼
┌─────────────────────────────────┬─────────────────────────────────┐
│ Instance 1: Column C1           │ Instance 2: Column C2           │
│ A = 300 mm, B = 450 mm, Ø = 8 mm│ A = 350 mm, B = 500 mm, Ø = 10mm│
└─────────────────────────────────┴─────────────────────────────────┘
```

Modifying an instance's dimensions on the canvas updates only that instance's parameters without corrupting the master template.

---

## 7. Safety & Clean Isolation

- **Non-Destructive**: Zero database schema changes or data modifications.
- **Module Isolation**: BBS CAD components are isolated in `frontend/src/pages/BBSPage/cad/` with zero ripple into Steel, Inventory, Optimizer, Ledger, or Procurement modules.
- **Phase 2F Boundary**: Cutting length calculations, bend deductions, steel weight, and BBS scheduling tables are strictly deferred to Phase 2F.
