# RebarOptima Phase 2F — Rebar Calculation & Engineering Validation Engine Architecture

## 1. Executive Summary & Core Principle

**Phase 2F** elevates the 2D/3D parametric reinforcement geometry built in Phases 2A–2E into an **Authoritative, Deterministic, and Traceable Engineering Calculation Model**.

### The Golden Separation Principle
The system enforces a strict architectural boundary:

$$\text{Geometry Engine} \neq \text{Calculation Engine} \neq \text{Engineering Rule Engine} \neq \text{Validation Engine}$$

```
                Rebar Geometry (Centerline, Segments, Bends, Hooks)
                                      │
                                      ▼
                      Immutable Calculation Snapshot
                                      │
                        Calculation Pipeline (2F)
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
     Geometric Measurements                          Engineering Rule Evaluation
 (Straight Segments, Arcs, Hooks)             (Bend Deductions, Mandrel Check, Unit Wt)
              │                                               │
              └───────────────────────┬───────────────────────┘
                                      ▼
                        Engineering Validation Engine
                      (Continuity, Closure, Tolerances)
                                      │
                                      ▼
                      Structured Calculation Result
               (Cutting Length, Weights, Trace, Audit Logs)
```

No calculation formulas are embedded in canvas renderers, tool handlers, or React components. All future BBS modules (Column BBS, Beam BBS, Slab BBS, Footing BBS, Wall BBS) consume this single authoritative calculation engine.

---

## 2. Canonical Engineering Unit System (`calculationUnits.js`)

All internal calculations operate on standardized canonical units. Display formatting is applied only at the UI boundary.

| Quantity | Canonical Internal Unit | Supported Display Units | Conversion Method |
| :--- | :--- | :--- | :--- |
| **Length** | Millimeter ($\text{mm}$) | $\text{mm}$, $\text{cm}$, $\text{m}$ | $\text{m} = \text{mm} / 1000$ |
| **Mass / Weight** | Kilogram ($\text{kg}$) | $\text{kg}$, $\text{g}$, $\text{t}$ | $\text{t} = \text{kg} / 1000$ |
| **Unit Weight** | $\text{kg/m}$ | $\text{kg/m}$ | $\text{Weight per meter of bar}$ |
| **Angle** | Degree ($^\circ$) | $^\circ$, $\text{rad}$ | $\text{rad} = \text{deg} \times \frac{\pi}{180}$ |
| **Steel Density** | $7,850\text{ kg/m}^3$ | $\text{kg/m}^3$ | Standard Carbon Reinforcing Steel |

---

## 3. Mathematical Foundations

### 3.1 Straight Segments
For each straight segment between points $P_1(x_1, y_1)$ and $P_2(x_2, y_2)$:
$$L = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$
$$\theta = \text{atan2}(y_2 - y_1, x_2 - x_1) \times \frac{180}{\pi}$$

### 3.2 Bends and Mandrel Arcs
For an arc of nominal/mandrel radius $R$ and deflection angle $\theta$ (in radians):
$$L_{\text{arc}} = R \times \theta_{\text{rad}}$$

### 3.3 Theoretical & Nominal Steel Unit Weight
1. **Theoretical Steel Density Formula ($7,850\text{ kg/m}^3$):**
   $$\text{Area} = \pi \times \left(\frac{d}{2000}\right)^2 \text{ m}^2$$
   $$\text{Unit Weight} = \text{Area} \times 7850 = \frac{\pi \times 7850}{4 \times 10^6} \times d^2 \approx 0.0061654 \times d^2 \text{ kg/m}$$

2. **Standard Trade Approximation:**
   $$\text{Unit Weight} \approx \frac{d^2}{162} \text{ kg/m}$$

### 3.4 Total Bar Weight
$$\text{Total Weight (kg)} = \left(\frac{\text{Cutting Length (mm)}}{1000}\right) \times \text{Unit Weight (kg/m)}$$

---

## 4. Modular Engineering Rule Engine (`engineeringRules.js`)

The `EngineeringRuleProvider` interface enables hot-swappable, versioned rule sets. Geometry remains identical while engineering calculations adapt to statutory or workshop rules.

### Built-in Rule Sets:

1. **Standard Centerline Model (`RULE_SET_CENTERLINE_EXACT` v1.0)**
   - *Description:* Pure continuous centerline geometry.
   - *Cutting Length:* $\text{Cutting Length} = \text{Developed Length}$ (0 deductions).
   - *Unit Weight:* Exact Theoretical Density ($7,850\text{ kg/m}^3$).

2. **Standard Bend Deduction Model (`RULE_SET_STANDARD_BEND_DEDUCTION` v1.0)**
   - *Description:* Standard workshop empirical bend allowance.
   - *Bend Deductions:*
     - $\le 45^\circ \implies 1d$ deduction
     - $90^\circ \implies 2d$ deduction
     - $135^\circ \implies 3d$ deduction
     - $180^\circ \implies 4d$ deduction
   - *Unit Weight:* Trade standard nominal ($\frac{d^2}{162}\text{ kg/m}$).

3. **BS 8666 / Eurocode Reference Model (`RULE_SET_EUROCODE_BS8666` v1.0)**
   - *Description:* BS 8666 scheduling rules with mandatory mandrel checks ($\ge 2d$ for $d \le 16\text{mm}$, $\ge 3.5d$ for $d > 16\text{mm}$) and standard hook extensions.

4. **IS 2502 Standard Practice Reference Model (`RULE_SET_IS_PRACTICE` v1.0)**
   - *Description:* Indian Standard practice for bar bending schedule calculations with $2d$ deduction for $90^\circ$ bends and standard hook allowances.

---

## 5. Engineering Validation Engine (`validationEngine.js`)

Validates geometry and engineering constraints before calculation:

| Validation Code | Severity | Trigger Condition |
| :--- | :--- | :--- |
| `INVALID_DIAMETER` | `ERROR` | $d \le 0$ or $d$ is NaN. |
| `INVALID_DIAMETER` | `WARNING` | $d > 60\text{ mm}$ (Exceeds standard structural rebar). |
| `MISSING_GEOMETRY` | `ERROR` | $< 2$ points or 0 segments. |
| `INVALID_LENGTH` | `ERROR` | Segment length $\le 0\text{ mm}$. |
| `INVALID_RADIUS` | `ERROR` | Bend radius $\le 0\text{ mm}$. |
| `TIGHT_BEND_RADIUS` | `WARNING` | Bend radius $< 1.5d$ (Risk of bar fracture during fabrication). |
| `INVALID_ANGLE` | `ERROR` | Angle $\le 0^\circ$ or $> 180^\circ$. |
| `SHORT_HOOK_EXTENSION` | `WARNING` | Hook straight extension $< 4d$. |
| `PATH_DISCONTINUOUS` | `WARNING` | Segment end to next segment start gap $> 1.0\text{ mm}$. |
| `CLOSED_SHAPE_OPEN` | `ERROR` | Closed stirrup perimeter loop start and end vertices do not meet ($> 2.0\text{ mm}$). |
| `POTENTIAL_SELF_INTERSECTION` | `WARNING` | Non-adjacent segments intersect unintentionally. |

---

## 6. Calculation Traceability & Audit Logs (`CalculationTraceModal.jsx`)

Every calculation returns a comprehensive step-by-step trace object explaining:
1. **Setup:** Shape identifier, bar diameter, selected rule set, and rule version.
2. **Straight Segments:** ID, name, start point, end point, direction angle, and length.
3. **Bends:** Vertex, tangent points, bend angle, radius, centerline arc length, and statutory adjustments.
4. **Hooks:** Angle, extension length, tip coordinates, and anchor allowance.
5. **Developed Length:** Sum of centerline path.
6. **Cutting Length:** Rule evaluation formula and adjustments breakdown.
7. **Unit Weight:** Specific formula derivation ($\text{kg/m}$).
8. **Total Steel Weight:** Final multiplication and unit conversion ($\text{kg}$).

---

## 7. Downstream BBS Integration

Future BBS modules consume the calculation engine via a unified signature:

```javascript
import { calculateRebarShape } from './cad/calculationEngine';

// Inside Column BBS, Beam BBS, or Slab BBS:
const calcResult = calculateRebarShape(rebarShapeEntity, selectedProjectRuleSetId);

console.log(calcResult.cuttingLength); // Fabricated cutting length in mm
console.log(calcResult.totalWeight);   // Steel weight in kg
console.log(calcResult.isTrusted);     // Boolean compliance status
console.log(calcResult.trace);         // Audit trail
```
