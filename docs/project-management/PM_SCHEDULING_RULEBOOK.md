# PM Scheduling Rulebook & Mathematical Specification
**Project:** RebarOptima Construction Management SaaS  
**Standard Reference:** Primavera P6 / MS Project / Project Management Institute (PMI) PMBOK  
**Status:** Architectural Specification for Phase 0 Audit Baseline

---

## 1. Principles of CPM in Construction

In construction management, the Critical Path Method (CPM) is a deterministic mathematical network analysis algorithm used to schedule project activities. It establishes:
1. The earliest possible completion date of the project.
2. The specific sequence of dependent activities that directly dictate project completion (the **Critical Path**).
3. The scheduling flexibility (**Float** or Slack) available to non-critical activities.

---

## 2. Calendar & Working Day Rules

Construction projects do not operate on uninterrupted linear calendar time. They observe site calendars:
- **Work Days per Week:** Typically 6 days (Mon–Sat) in Indian and Middle Eastern construction, or 5 days (Mon–Fri).
- **Non-Working Days:** Sundays (or specified rest days) and designated Project Holidays.
- **Working Hours & Breaks:** Net productive working hours per shift after deducting lunch breaks and tea/recess intervals.

### Working Day Stepping Functions
Let $\mathcal{C}$ be the project calendar and $\text{isWorkingDay}(d, \mathcal{C})$ a boolean predicate.

#### Forward Stepping: $\text{addWorkingDays}(d, n, \mathcal{C})$ where $n \ge 0$
Advance date $d$ day-by-day; increment count only when $\text{isWorkingDay}(current, \mathcal{C})$ is true until $n$ working days have been added.

#### Backward Stepping: $\text{subtractWorkingDays}(d, n, \mathcal{C})$ or $\text{addWorkingDays}(d, -n, \mathcal{C})$ where $n > 0$
Step date $d$ backward day-by-day; decrement count only when $\text{isWorkingDay}(current, \mathcal{C})$ is true until $n$ working days have been subtracted.

> **CRITICAL RULE:** A robust calendar engine MUST support bidirectional stepping. If $n < 0$, it must step backward. The current engine bug (`if (workingDays <= 0) return startDateStr;`) must be corrected to step backward when negative numbers are provided.

---

## 3. Forward Pass Calculations (Early Dates)

The Forward Pass traverses the network from start to finish, calculating the Early Start ($ES$) and Early Finish ($EF$) of each activity.

### Base Single Activity Duration Formula
For an activity with duration $D \ge 1$ working days starting on working day $ES$:
$$EF = \text{addWorkingDays}(ES, D - 1, \mathcal{C})$$
*(For a 1-day activity, $D=1 \implies EF = ES$.)*

### Precedence Relationship Formulas (Forward Pass)
Let activity $J$ succeed activity $I$, with lag $L$ working days ($L > 0$ is positive lag, $L < 0$ is lead).

#### 1. Finish-to-Start (FS)
Activity $J$ cannot start until activity $I$ finishes plus lag:
$$ES_J \ge \text{addWorkingDays}(EF_I, 1 + L, \mathcal{C})$$
For multiple predecessors:
$$ES_J = \max_{I \in \text{Preds}(J)} \left( \text{addWorkingDays}(EF_I, 1 + L_{IJ}, \mathcal{C}) \right)$$

#### 2. Start-to-Start (SS)
Activity $J$ cannot start until activity $I$ starts plus lag:
$$ES_J \ge \text{addWorkingDays}(ES_I, L, \mathcal{C})$$

#### 3. Finish-to-Finish (FF)
Activity $J$ cannot finish until activity $I$ finishes plus lag:
$$EF_J \ge \text{addWorkingDays}(EF_I, L, \mathcal{C})$$
Because duration $D_J$ is fixed:
$$ES_J \ge \text{subtractWorkingDays}(EF_J, D_J - 1, \mathcal{C})$$

#### 4. Start-to-Finish (SF)
Activity $J$ cannot finish until activity $I$ starts plus lag:
$$EF_J \ge \text{addWorkingDays}(ES_I, 1 + L, \mathcal{C})$$
$$ES_J \ge \text{subtractWorkingDays}(EF_J, D_J - 1, \mathcal{C})$$

---

## 4. Backward Pass Calculations (Late Dates)

The Backward Pass traverses the network in reverse, starting from the Project Finish Date ($PF$) or Contractual Mandatory Completion Date ($T_{target}$), calculating the Late Finish ($LF$) and Late Start ($LS$) of each activity.

### Base Single Activity Duration Formula
$$LS = \text{subtractWorkingDays}(LF, D - 1, \mathcal{C})$$

### Precedence Relationship Formulas (Backward Pass)
Let activity $I$ precede activity $J$, with lag $L$.

#### 1. Finish-to-Start (FS)
Activity $I$ must finish so that successor $J$ can start on $LS_J$:
$$LF_I \le \text{subtractWorkingDays}(LS_J, 1 + L, \mathcal{C})$$
For multiple successors:
$$LF_I = \min_{J \in \text{Succs}(I)} \left( \text{subtractWorkingDays}(LS_J, 1 + L_{IJ}, \mathcal{C}) \right)$$

#### 2. Start-to-Start (SS)
Activity $I$ must start early enough for successor $J$ to start on $LS_J$:
$$LS_I \le \text{subtractWorkingDays}(LS_J, L, \mathcal{C})$$
Derived constraint on $LF_I$:
$$LF_I \le \text{addWorkingDays}(LS_I, D_I - 1, \mathcal{C})$$

#### 3. Finish-to-Finish (FF)
Activity $I$ must finish so that successor $J$ can finish on $LF_J$:
$$LF_I \le \text{subtractWorkingDays}(LF_J, L, \mathcal{C})$$

#### 4. Start-to-Finish (SF)
Activity $I$ must start early enough for successor $J$ to finish on $LF_J$:
$$LS_I \le \text{subtractWorkingDays}(LF_J, 1 + L, \mathcal{C})$$
Derived constraint on $LF_I$:
$$LF_I \le \text{addWorkingDays}(LS_I, D_I - 1, \mathcal{C})$$

---

## 5. Float & Critical Path Identification

### 5.1 Total Float (TF)
Total Float is the maximum number of working days an activity can be delayed without delaying the overall project completion date:
$$TF = \text{countWorkingDays}(ES, LS, \mathcal{C}) = \text{countWorkingDays}(EF, LF, \mathcal{C})$$
Or algebraically:
$$TF = LF - EF = LS - ES$$

#### Handling Negative Float
- When project completion is unconstrained, $LF_{\text{end}} = EF_{\text{end}}$, meaning $TF \ge 0$.
- When a project has a **Locked Contractual Baseline** or a **Mandatory Target Finish Date** ($T_{\text{contract}}$) and the calculated $EF > T_{\text{contract}}$, the activity receives **Negative Float**:
  $$TF < 0$$
- **Rule:** Never clamp negative float to zero. Negative float is the primary indicator of contractual delay.

### 5.2 Free Float (FF)
Free Float is the maximum working days an activity can be delayed without delaying the Early Start of any immediate successor:
$$FF_I = \min_{J \in \text{Succs}(I)} \left[ \text{countWorkingDays}(EF_I, ES_J, \mathcal{C}) - 1 - L_{IJ} \right]$$

### 5.3 Critical Path
Activities where:
$$TF = \min_{k} (TF_k) \quad \text{(typically } TF \le 0\text{)}$$
form the **Critical Path**. Any delay on a critical activity extends the total project duration day-for-day.

---

## 6. Work Breakdown Structure (WBS) & Summary Activity Rollup

A Work Breakdown Structure organizes tasks hierarchically (Main Activity / Summary Task $\rightarrow$ Sub-activities / Executable Tasks).

```
1.0 Raft Foundation & Substructure (Main Summary Activity) [Dynamic Rollup]
├── 1.1 Deep Excavation & Soil Dewatering (Executable Task)
├── 1.2 Plain Cement Concrete Bedding (Executable Task)
└── 1.3 Raft Bottom Rebar Mat & Shear Links (Executable Task)
```

### Summary Activity Scheduling Rules
1. **Never treat summary activities as independent CPM graph nodes.** Summary activities must NOT have independent durations or conflicting user-assigned finish dates in the network graph.
2. **Start Date Rollup:**
   $$Start_{\text{summary}} = \min_{c \in \text{Children}} \left( Start_c \right)$$
3. **Finish Date Rollup:**
   $$Finish_{\text{summary}} = \max_{c \in \text{Children}} \left( Finish_c \right)$$
4. **Duration Rollup:**
   The working days elapsed from $Start_{\text{summary}}$ to $Finish_{\text{summary}}$ on the project calendar.
5. **Physical Progress Rollup:**
   Weighted by cost or quantity:
   $$Progress_{\text{summary}} = \frac{\sum_{c \in \text{Children}} (Progress_c \times PlannedCost_c)}{\sum_{c \in \text{Children}} PlannedCost_c}$$

---

## 7. Hybrid Scheduling Architecture Proposal

To provide the best of both worlds (the automation of Primavera P6 and the flexibility of MS Project), RebarOptima will implement **Hybrid Scheduling**.

### 7.1 Scheduling Modes
Each activity in `pm_tasks` will have a field:
`schedulingMode: 'AUTO' | 'MANUAL'` (Default: `'AUTO'`)

| Mode | Behaviour | Date Driver | Overwrite Protection |
|:---|:---|:---|:---|
| **AUTO** (Automatic) | Dates dynamically calculated by CPM forward/backward passes based on durations, calendar, and dependencies. | CPM Engine | Recalculated whenever predecessors or durations change. |
| **MANUAL** (Manual) | Planned start and finish dates are explicitly locked by the project manager. | User Input | Protected from automatic overwrite by CPM engine. |

### 7.2 Interaction Rules Between Manual and Auto Tasks
1. **Manual Task as Predecessor to Auto Task:**
   An Auto successor respects the Manual predecessor's fixed finish date as its Early Start constraint ($ES_{\text{auto}} = EF_{\text{manual}} + 1 + L$).
2. **Manual Task as Successor to Auto Task:**
   - If the Auto predecessor completes **before** the Manual successor's planned start: No conflict.
   - If the Auto predecessor is delayed and completes **after** the Manual successor's planned start:
     - The system flags a **Schedule Conflict / Negative Float Warning**.
     - The manual task's date is **preserved**, but the UI displays a visual conflict banner: *"Predecessor finishes on 2026-11-15, but manual activity is set to start on 2026-11-10."*
     - The user is offered two actions:
       - **Push Manual Date:** Adjust manual date to match predecessor.
       - **Switch to Auto:** Convert task to Automatic scheduling.
3. **Cascading Recalculation:**
   When any task duration or progress changes, the engine recalculates all downstream AUTO tasks while honoring the fixed bounds of MANUAL tasks.

