# RebarOptima Project Management User Guide
**Audience:** Project Managers, Planning Engineers, Site Supervisors, and Non-Technical Founders  
**Module:** Projects & Task Management  
**Application:** RebarOptima Construction Management SaaS

---

## 1. Introduction

The **Project & Task Management** module in RebarOptima helps construction teams plan projects, schedule activities with mathematical precision (Critical Path Method), track daily progress from the construction site, ensure quality inspections are completed before concrete pours, and balance labor across trades.

---

## 2. Navigating the Module

From the left sidebar, click **Projects & Tasks**. At the top of the page, you will see the active project selector and 8 specialized tabs:

1. **Overview / Dashboard:** High-level project KPIs, progress gauge, critical activities count, budget spend.
2. **Projects:** List of all company projects, baseline lock status, and "New Project" creation.
3. **Tasks & WBS:** Detailed Work Breakdown Structure showing main phases and executable sub-activities.
4. **Gantt Schedule:** Interactive timeline chart displaying activity bars, relationships, and the Critical Path in red.
5. **Manpower & Workforce:** Labor allocation matrix across trades (Steel Fixers, Carpenters, Masons, Riggers).
6. **Calendar & Hours:** Project working days (e.g. 6 days/week), shift timings, lunch breaks, and official project holidays.
7. **Daily Reports (DPR):** Daily site logs submitted by site supervisors with executed quantities and labor counts.
8. **Quality & QA:** Pre-pour inspection checklists, sign-offs, and rework tracking.

---

## 3. Work Breakdown Structure (WBS) & Tasks

### 3.1 Main Activities vs Sub-Activities
Construction projects are divided hierarchically:
- **Main Activity (Parent Phase):** A major stage of construction, such as `1.0 Raft Foundation & Substructure` or `2.0 Basement Columns & Perimeter Wall`. It represents a summary package.
- **Sub-Activity (Executable Task):** The actual on-site work performed by labor gangs, such as `1.1 Deep Excavation`, `1.2 PCC Bedding`, or `1.3 Raft Bottom Rebar Mat`.

### 3.2 Adding a New Activity
1. Click **+ Add Activity**.
2. Select whether this is a **Main Activity** or a **Sub-Activity**.
   - If Sub-Activity, select which Main Activity it belongs to.
3. Enter:
   - **Activity Name:** Clear, actionable description.
   - **Duration (Days):** Working days required to execute the work.
   - **Planned Quantity & Unit:** E.g., `145 MT` of rebar or `1250 m3` of concrete.
   - **Assigned Trade / Role:** E.g., `Steel Fixer Lead`, `Formwork Foreman`.
   - **Inspection Required:** Check this if the activity requires a QA inspection before subsequent work can start.
4. Click **Create Activity**. The schedule will automatically calculate start and finish dates.

---

## 4. Setting Up Dependencies (Logic Links)

Dependencies define the order of construction:

| Dependency Type | Name | Practical Construction Example |
|:---:|:---|:---|
| **FS** | Finish-to-Start | Raft rebar must finish before raft concrete pouring can start. |
| **SS** | Start-to-Start | Column shuttering can start 2 days after column rebar tying starts. |
| **FF** | Finish-to-Finish | Dewatering pumps must finish running when backfilling finishes. |
| **SF** | Start-to-Finish | Security night lighting starts when daylight shift ends. |

### Adding Lag (Waiting Time)
- **Lag:** A waiting period between tasks (e.g., Concrete Curing requires 7 days lag after pouring before striking formwork).

---

## 5. The Gantt Schedule & The Critical Path

The Gantt chart provides a visual timeline of your project:
- **Red Bars (Critical Path):** Activities with **0 Float**. If any red activity is delayed by even 1 day, the **entire project completion date slips by 1 day**. Pay closest attention to these!
- **Blue Bars (Standard Activities):** Activities that have **Float** (flexibility). They can be delayed by a few days without delaying the overall project.
- **Milestones (Diamonds):** Zero-duration key events, such as "Foundation Sign-off & Handover".

---

## 6. Daily Progress Reporting (DPR)

Site execution is tracked daily:
1. Site supervisors go to **Daily Reports (DPR)** and click **Submit Daily Progress**.
2. They select the activity worked on (e.g., `1.3 Raft Bottom Rebar Mat`), enter the quantity completed today (e.g., `14 MT`), number of workers on site, and optional photos.
3. The Project Manager reviews the report:
   - Clicking **Approve DPR** automatically increments the cumulative completed quantity, recalculates the task's progress percentage, and updates the overall project completion percentage.

---

## 7. Quality Assurance (QA/QC) Gates

To prevent pouring concrete before steel reinforcement is verified:
1. Activities marked as `Requires Inspection` trigger an inspection gate.
2. The QA Engineer or Structural Consultant records an inspection under **Quality & QA**.
3. If the inspection **Passes**, the activity is marked `Inspection Passed`, clearing the gate for the next trade.
4. If the inspection **Fails**, the task status automatically shifts to `REWORK_REQUIRED`, and successor work is prevented from starting until rework is resolved.

---

## 8. Baselines & Delay Tracking

### Locking a Baseline
When the client or management approves the project schedule:
1. Go to **Projects** and click **Lock Baseline**.
2. The current dates become the permanent contractual benchmark.
3. As actual work progresses, RebarOptima compares **Forecast Finish** against **Baseline Finish**. If work falls behind, the project status shifts to **DELAYED** and displays the exact variance in days.

