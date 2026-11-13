# Project Management REST API Documentation
**Project:** RebarOptima Construction Management SaaS  
**Base URL:** `/api/pm`  
**Authentication:** HTTP Bearer Token (`Authorization: Bearer <jwt_token>`)  
**Tenant Scoping:** All operations are strictly scoped to the authenticated user's `companyId`.

---

## 1. Projects API

### 1.1 List Projects
- **Endpoint:** `GET /api/pm/projects`
- **Description:** Returns all projects belonging to the authenticated company.
- **Response (200 OK):**
  ```json
  [
    {
      "_id": "671e3b...",
      "companyId": "comp_123",
      "code": "SKY-TOW-01",
      "name": "Skyline Pinnacle Tower",
      "status": "ACTIVE",
      "plannedStart": "2026-10-04",
      "plannedFinish": "2026-12-30",
      "forecastFinish": "2026-12-30",
      "baselineFinish": "2026-12-30",
      "isBaselineLocked": true,
      "progressPercentage": 24,
      "criticalPathLengthDays": 72
    }
  ]
  ```

### 1.2 Create Project
- **Endpoint:** `POST /api/pm/projects`
- **Request Body:**
  ```json
  {
    "code": "PRJ-002",
    "name": "Commercial Complex Phase 1",
    "description": "Foundation & Basement",
    "plannedStart": "2026-11-15",
    "approvedBudget": 15000000,
    "calendar": {
      "workingDaysPerWeek": 6,
      "workStartTime": "08:00",
      "workEndTime": "17:30"
    }
  }
  ```
- **Response (201 Created):** Full `PmProject` object.

### 1.3 Lock Project Baseline
- **Endpoint:** `POST /api/pm/projects/:id/baseline`
- **Description:** Freezes current forecast dates as the official baseline against which future project delays and variances are tracked.
- **Response (200 OK):** Updated project object with `isBaselineLocked: true`.

### 1.4 Seed Sample Project
- **Endpoint:** `POST /api/pm/seed`
- **Description:** Seeds an enterprise construction demonstration project (Skyline Pinnacle Tower) with complete WBS, CPM network, manpower assignments, calendar, and inspections.
- **Response (200 OK):** `{ "message": "Demo project successfully seeded", "project": { ... } }`

---

## 2. Tasks & WBS API

### 2.1 Get Project Tasks
- **Endpoint:** `GET /api/pm/projects/:projectId/tasks`
- **Description:** Fetches all tasks, summary activities, and milestones for a project, sorted by `sortOrder`.
- **Response (200 OK):** Array of `PmTask` objects.

### 2.2 Create Task
- **Endpoint:** `POST /api/pm/projects/:projectId/tasks`
- **Request Body:**
  ```json
  {
    "name": "Raft Bottom Rebar Mat & Shear Links",
    "wbsCode": "1.3",
    "parentId": "671e3b...",
    "durationDays": 7,
    "plannedQty": 145,
    "unit": "MT",
    "plannedCost": 870000,
    "assignedRole": "Steel Fixer Lead",
    "priority": "HIGH",
    "isMilestone": false,
    "requiresInspection": true
  }
  ```
- **Response (201 Created):** Newly created task with initial CPM calculations.

### 2.3 Update Task
- **Endpoint:** `PUT /api/pm/tasks/:id`
- **Description:** Updates task properties and automatically triggers project CPM recalculation.
- **Request Body:** Partial `PmTask` fields (`name`, `durationDays`, `status`, `assignedRole`, etc.).
- **Response (200 OK):** Updated `PmTask` object.

### 2.4 Delete Task
- **Endpoint:** `DELETE /api/pm/tasks/:id`
- **Description:** Deletes the task, removes all associated dependency relationships, and recalculates downstream CPM dates.
- **Response (200 OK):** `{ "success": true }`

---

## 3. Dependencies & CPM Scheduling API

### 3.1 Get Project Dependencies
- **Endpoint:** `GET /api/pm/projects/:projectId/dependencies`
- **Response (200 OK):** Array of `PmDependency` objects (`taskId`, `predecessorTaskId`, `type`, `lagDays`).

### 3.2 Create Dependency (With Circular Dependency Check)
- **Endpoint:** `POST /api/pm/dependencies`
- **Request Body:**
  ```json
  {
    "projectId": "671e3b...",
    "taskId": "task_successor_id",
    "predecessorTaskId": "task_predecessor_id",
    "type": "FS",
    "lagDays": 0
  }
  ```
- **Error Response (400 Bad Request):**
  If adding the dependency creates a circular loop:
  ```json
  { "error": "Circular dependency detected: Task A -> Task B -> Task A" }
  ```
- **Success Response (201 Created):** Newly created dependency record and updated schedule.

### 3.3 Delete Dependency
- **Endpoint:** `DELETE /api/pm/dependencies/:id`
- **Response (200 OK):** `{ "success": true }`

### 3.4 Delay Impact Simulation (What-If Analysis)
- **Endpoint:** `POST /api/pm/projects/:projectId/simulate-delay`
- **Request Body:**
  ```json
  {
    "taskId": "task_id",
    "delayDays": 5
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "originalProjectFinish": "2026-12-23",
    "simulatedProjectFinish": "2026-12-28",
    "delayOnProjectDays": 5,
    "affectedTasksCount": 4,
    "newCriticalPath": ["1.1", "1.2", "1.3", "1.5"]
  }
  ```

---

## 4. Daily Progress Reporting (DPR) API

### 4.1 Get DPR Records
- **Endpoint:** `GET /api/pm/projects/:projectId/dpr`
- **Response (200 OK):** Array of `PmDailyProgressReport` records.

### 4.2 Submit Daily Progress Report
- **Endpoint:** `POST /api/pm/dpr`
- **Request Body:**
  ```json
  {
    "projectId": "671e3b...",
    "taskId": "task_id",
    "reportDate": "2026-11-10",
    "shift": "DAY",
    "supervisorName": "Ramesh Kumar",
    "completedQty": 14,
    "acceptedQty": 14,
    "unit": "MT",
    "labourCount": 18,
    "actualLabourHours": 144,
    "remarks": "Completed rebar tying for bay 3"
  }
  ```
- **Response (201 Created):** Created report with status `'SUBMITTED'`.

### 4.3 Approve DPR
- **Endpoint:** `PUT /api/pm/dpr/:id/approve`
- **Description:** Approves the daily progress report, updates task cumulative completed/accepted quantities, recalculates task completion percentage, and triggers project CPM progress rollup.
- **Response (200 OK):** Updated DPR with status `'APPROVED'`.

---

## 5. Quality Inspections API

### 5.1 Get Inspections
- **Endpoint:** `GET /api/pm/projects/:projectId/inspections`
- **Response (200 OK):** Array of quality inspection records.

### 5.2 Record Inspection Outcome
- **Endpoint:** `POST /api/pm/inspections`
- **Request Body:**
  ```json
  {
    "projectId": "671e3b...",
    "taskId": "task_id",
    "inspectionName": "Pre-Pour Rebar & Cover Inspection",
    "inspectorName": "Dev Patel (Consultant QA)",
    "inspectionDate": "2026-11-10",
    "outcome": "PASSED",
    "checklistItems": [
      { "checkItem": "Rebar spacing & lap lengths", "passed": true, "notes": "Verified as per GFC drawing S-04" },
      { "checkItem": "Cover blocks placement", "passed": true, "notes": "50mm concrete cover blocks placed at 1m grid" }
    ]
  }
  ```
- **Response (201 Created):** Inspection record; updates task `inspectionPassed: true`.

---

## 6. Executive Analytics API

### 6.1 Get Executive KPIs
- **Endpoint:** `GET /api/pm/executive-kpis`
- **Description:** Portfolio-wide aggregation across all projects of the tenant.
- **Response (200 OK):**
  ```json
  {
    "totalProjects": 3,
    "activeProjects": 2,
    "delayedProjects": 1,
    "totalTasks": 48,
    "completedTasks": 18,
    "criticalTasks": 12,
    "overdueTasks": 2,
    "totalBudget": 45000000,
    "actualSpend": 12500000,
    "averageProgress": 38
  }
  ```

