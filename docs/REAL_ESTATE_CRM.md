# Real Estate CRM

How the CRM works inside RebarOptima: who uses it, what each screen does, and how a click becomes a MongoDB write.

The CRM does not keep its own project list. It follows the project already selected in the app header. Sales records stay in the existing CRM collections. Projects and blocks stay in the global `projects` and `project_blocks` collections.

The screen does not show a unit price, a budget, or a rupee amount. A booking still stores `agreementPrice` on the server (the form sends `0`) because the booking record requires that field.

## Who it is for

A salesperson opens the CRM in the morning and works one project:

1. **Today** — who to call, which visit is today, which task is due.
2. **Leads** — every person interested in this project.
3. **Calendar** — the same follow-ups, visits, and tasks on a month.
4. **Tasks** — work items on those people, as a board or a list.

Units, bookings, customers, the pipeline board, reports, and settings sit under **More**. They are the same project. They are not a second CRM.

## Where it lives

| Layer | Path |
| --- | --- |
| Page | `frontend/src/pages/CrmPage/CrmPage.jsx` |
| Daily screens | `CrmToday.jsx`, `CrmLeads.jsx`, `CrmCalendar.jsx`, `CrmTasks.jsx`, `CrmPayments.jsx` |
| Dialogs | `frontend/src/pages/CrmPage/crmDeskModals.jsx` |
| Dates and WhatsApp links | `frontend/src/pages/CrmPage/crmFormat.js` |
| API client | `frontend/src/utils/crmApi.js` |
| HTTP mount | `app.use('/api/crm', …)` in `backend/src/main.ts` |
| Router | `backend/src/crm/crm.routes.ts` |
| Daily desk logic | `backend/src/crm/crm.desk.service.ts` |
| App entry | `view === 'crm'` in `frontend/src/App.jsx` |

Every CRM call goes through `apiRequest`. That sends the signed-in user and the header `X-Project-Id` of the active project. The desk screens also pass `projectId` on the query or body. The server resolves that id to the canonical global project. A string id and an ObjectId for the same project are treated as the same record.

If the header has no project, the page does not render the desk. It shows “Choose a project” and a button that opens Projects.

## UX map

```text
App header (active project)
        │
        ▼
Real Estate CRM
  Search (customer, unit, booking)
  New Customer    New Lead
        │
        ├─ Today
        ├─ Leads
        ├─ Calendar
        ├─ Tasks
        └─ More
             Units · Bookings · Payments · Customers
             Site visits · Pipeline · Reports · Settings
```

### Daily screens

| Screen | What the user sees | What they do |
| --- | --- | --- |
| Today | Greeting, project name, four counts, today’s visits, today’s tasks, payments due, then lead groups: Overdue, Due today, Coming up this week, No follow-up date | Open a person, send WhatsApp, log the result, or add a lead |
| Leads | Table: name, phone, stage, interest, source, next follow-up | Search, filter by stage, import CSV, add a lead, follow up |
| Calendar | Month grid (Monday–Sunday). Today is marked. The selected day lists its events | Move months, add a visit or a task, follow up from an event |
| Tasks | Board: To do, In progress, Done. A list view is the same records | Add a task on a lead, move its status |

Empty states say what to do next: pick a project, add a lead, or add a visit. They do not offer sample data.

### Dialogs

| Dialog | Opens from | Fields | Result |
| --- | --- | --- | --- |
| Add lead | Today, Leads, or the header **New Lead** | Name, WhatsApp number, source, stage, interested in, next follow-up date, email, notes | One customer plus one open lead on this project |
| Follow-up | A row on Today, Leads, or Calendar | Message template, editable text, WhatsApp link, four results | Updates the lead and writes an activity |
| New appointment | Calendar → **Add to calendar** | Meeting, Call, Site visit, Demo, or Follow-up; lead; date and time; notes | A site visit, or a task, on that lead |
| New task | Tasks → **New task** | Lead, title, due date, priority, type, notes | A task, and that lead’s next follow-up date moves to the due date |

**Deal won** closes the follow-up dialog and opens the booking dialog with that customer and this project already filled in. The lead becomes **Booked** only when the booking API books a unit. Until then the stage is **Negotiation**.

### More screens

These are the older full workspace. They share the same project id.

| Tab | Job |
| --- | --- |
| Units | Chessboard, grid, and table of `crm_units`. Filter by tower, area, floor, rooms, and status. Inspect a unit, block or unblock it, export CSV. No price column and no price filter. |
| Bookings | Booking reference, customer, unit, date, status. **New Unit Booking** asks for buyer, project, and unit only. |
| Payments | Receipt list: number, customer, booking, date, status. Opening a receipt does not print an amount. |
| Customers | Directory and a customer profile (interests, bookings, notes). |
| Site visits | Visit list and the older schedule form. A visit saved here is the same `crm_site_visits` row the calendar reads. |
| Pipeline | Kanban of the same leads. Dragging a card calls the stage API. |
| Reports | Counts: customers, visits, tasks due, confirmed bookings, pipeline stages, salesperson activity. |
| Settings | Lead sources, pipeline stage labels, timezone, WhatsApp templates. |

Header search (two or more characters) calls `GET /api/crm/search` and can jump to a customer profile, a unit profile, or the bookings tab.

## One record, four screens

A lead is one document in `crm_unit_interests`. Today, Leads, Calendar, Tasks, and the pipeline all read that document for the active project.

```text
Add lead
  crm_customers          (person, once per phone in the company)
  crm_unit_interests     (the lead: stage, nextFollowUpDate, projectId)
  crm_activities         ("Lead created")

Follow-up result
  crm_unit_interests     (stage, nextFollowUpDate, lastContactDate)
  crm_activities         (WhatsApp outcome)

Add to calendar → Site visit / Meeting / Demo
  crm_site_visits        (visitDateTime, projectId, unitInterestId)
  crm_unit_interests     (stage = Visit Scheduled, nextFollowUpDate = visit time)
  crm_activities         (Site Visit Scheduled)

Add to calendar → Call / Follow-up, or New task
  crm_follow_ups         (dueDateTime, projectId, unitInterestId)
  crm_unit_interests     (nextFollowUpDate = due time)

Book the unit
  crm_bookings
  crm_units              (availability + activeBookingId)
  crm_payment_schedules
  crm_unit_interests     (stage = Booked)
  crm_activities
```

Calendar events for a month are not a separate collection. `GET /api/crm/calendar` builds them:

| Event type | Source | Shown when |
| --- | --- | --- |
| `followup` | `crm_unit_interests.nextFollowUpDate` | Stage is not Lost or Booked, and the date is in the month |
| `visit` | `crm_site_visits.visitDateTime` | Not cancelled, and the visit belongs to this project or to a lead on this project |
| `task` | `crm_follow_ups.dueDateTime` | Not cancelled, and the task’s project, lead, or customer matches |
| `payment` | unpaid `crm_payment_schedules` | Due date is in the month. The event has no amount |

Dates typed as `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` are wall-clock times in the project timezone. They are stored as UTC. The grid labels the day in that same timezone, so an evening visit stays on the day the user picked.

## Request path

```text
CrmToday / CrmLeads / CrmCalendar / CrmTasks
        │
        ▼
crmApi  →  GET/POST /api/crm/...   (cookie/session auth, X-Project-Id)
        │
        ▼
createCrmMasterRouter
        │
        ├─ /today, /calendar          crm.desk.routes.ts     permission crm.view
        ├─ /leads, /leads/import,
        │  /leads/:id/follow-up       crm.lead.routes.ts     permission crm.leads on writes
        ├─ /visits, /tasks            crm.visit-task.routes.ts
        ├─ /customers                 crm.customer.routes.ts
        ├─ /projects, /units, /blocks crm.project-unit.routes.ts
        ├─ /bookings                  crm.booking.routes.ts
        ├─ /payments                  crm.payment.routes.ts
        ├─ /reports                   crm.report.routes.ts
        └─ /settings, /search         settings + master router
        │
        ▼
loadProjectScope
  resolveUserAndCompany
  resolveCanonicalProjectId          projects collection
  also include crm_projects rows whose orgProjectId is that project
  time zone: project, else company, else crm_settings, else Asia/Kolkata
        │
        ▼
MongoDB, always filtered by companyId and projectId
```

Writes that need a transaction use `session.withTransaction`. If the database cannot run a transaction, the same writes run without one.

Company ids are matched as both ObjectId and string. Lead, visit, and task ids are matched the same way.

### Permissions

| Check | Where |
| --- | --- |
| Signed in | Every `/api/crm` route |
| `crm.view` | `GET /today`, `GET /calendar` |
| `crm.leads` | Create lead, import, follow-up, and moving a task status |

The buttons **Add lead**, **Import CSV**, **Add to calendar**, and **New task** are wrapped in `RoleGate` for `crm.leads`. A user id that is not a 24-character ObjectId skips the permission check so older acceptance tokens still work. Other CRM routes stay auth-only, which is how they behaved before the desk existed.

## Lead lifecycle

Stages, in order: **New → Contacted → Qualified → Visit Scheduled → Visited → Negotiation → Booked**. **Lost** and **On Hold** sit beside that line. **Lost** and **Booked** are closed. A closed lead cannot take another follow-up (`409`).

| Follow-up result | Stage | Next date |
| --- | --- | --- |
| No reply yet | At least Contacted | 3 days ahead, 09:00 in the project timezone |
| They replied | At least Contacted | 1 day ahead, 09:00 |
| Not interested | Lost | Cleared. `lostReason` is stored |
| Deal won | At least Negotiation | Unchanged until a unit is booked. Response `handoff: "booking"` |

The stage only moves forward. A lead already in Negotiation stays there after “They replied”.

WhatsApp is a `https://wa.me/` link with the message filled in. The product does not call the WhatsApp Business API. Templates live on `crm_settings.messageTemplates`. If none are saved, the desk uses three defaults: Follow-up 2, First hello, and Site visit. Placeholders are `{{name}}`, `{{project}}`, and `{{interest}}`.

### Adding a lead

`POST /api/crm/leads`

1. Require a name and a usable phone (at least 8 digits after normalisation).
2. Store the phone as `+91…` when the user typed 10 digits, plus a `phoneKey` of digits only.
3. Find an existing customer in this company by `phoneKey`, then by the same digits on `phone` or `altPhone`.
4. If none exists, insert `crm_customers` with a `CUST…` code. A unique partial index `crm_customer_phone_key` on `{companyId, phoneKey}` stops two customers with the same number. A duplicate-key error re-reads the existing customer.
5. If that customer already has an open lead on this project, return that lead with `reused: true` and HTTP 200. The dialog tells the user a second lead was not created.
6. Otherwise insert `crm_unit_interests` and an activity.

CSV import is the same function, one row at a time, up to 500 rows. Accepted headers include name, phone, email, source, stage, interested in, notes, next follow-up, and tags. The response counts `created`, `reused`, and `failed` (with the spreadsheet row number).

## Units, bookings, and payments

Projects are created only with `POST /api/projects`. `POST /api/crm/projects` returns `400` and `USE_GLOBAL_PROJECTS`. `GET /api/crm/projects` lists global projects the user can access. It reads `crm_projects` only when the company has no global projects. `GET /api/crm/blocks` merges global `project_blocks` with any CRM blocks.

Unit availability used on the chessboard: Available, Held, Reserved, Booked, Sold, Blocked. Hold expiry is calculated in `crm.reservation.service.ts`. Blocking a unit is a management hold. It does not delete the unit.

`POST /api/crm/bookings` needs a customer, a project, and a unit. The server writes the booking as **Reserved**, generates a `BK…` reference, reserves the unit, and builds installment rows in `crm_payment_schedules`. Confirm moves the booking to confirmed and the unit toward booked. Cancel releases the unit. The UI does not ask for or display the agreement price.

`POST /api/crm/payments` still records a transaction and a receipt. The payments tab lists receipts and can open one. It does not show an amount and it does not offer a record button on that list.

## Collections

No new collection was added for the desk.

| Collection | Role |
| --- | --- |
| `projects` | The project the header selected. Source of the name and timezone |
| `project_blocks` | Towers and blocks for that project |
| `crm_projects` | Legacy. Read only when a company has no global projects, or when an old row’s `orgProjectId` points at the current project |
| `crm_customers` | The person. One phone per company |
| `crm_unit_interests` | The lead for a person on a project |
| `crm_activities` | History on the customer and the lead |
| `crm_site_visits` | Appointments that are visits, meetings, or demos |
| `crm_follow_ups` | Tasks. This is not a collection named `crm_followup_tasks` |
| `crm_units` | Inventory |
| `crm_bookings` | A unit allocated to a customer |
| `crm_payment_schedules` | Installments |
| `crm_payment_transactions` | Receipts |
| `crm_settings` | Sources, stage labels, timezone, message templates |

## API

Base path: `/api/crm`. All routes require auth.

| Method | Path | Used by |
| --- | --- | --- |
| GET | `/today?projectId=` | Today |
| GET | `/calendar?projectId=&from=YYYY-MM-DD` | Calendar. `from` is the first of the visible month |
| POST | `/leads` | Add lead |
| POST | `/leads/import` | CSV. Body `{ csv, projectId }` or `{ rows, projectId }` |
| POST | `/leads/:id/follow-up` | `{ outcome, message }` |
| GET | `/leads?projectId=&stage=&search=` | Leads, Tasks, Calendar |
| GET | `/leads/pipeline-stats` | Pipeline and reports |
| PUT | `/leads/:id/stage` | Pipeline drag |
| GET | `/visits?projectId=` | Site visits |
| POST | `/visits` | Calendar appointment and the visit form |
| PUT | `/visits/:id/status` | Visit outcome |
| GET | `/tasks?projectId=` | Tasks and Today |
| POST | `/tasks` | New task and call/follow-up appointments |
| PUT | `/tasks/:id/status` | Board columns. Also Deferred and Cancelled |
| PUT | `/tasks/:id/complete` | Older complete action |
| GET | `/customers`, `POST /customers`, `GET /customers/:id` | Directory and profile |
| GET | `/units`, `GET /units/:id`, `POST /units` | Inventory |
| POST | `/units/:id/block`, `/unblock`, `/reserve`, `/release` | Unit actions |
| GET | `/blocks`, `POST /blocks` | Towers |
| GET | `/bookings`, `POST /bookings` | Bookings |
| PUT | `/bookings/:id/confirm`, `/cancel` | Booking status |
| GET | `/payments`, `GET /payments/:id/receipt` | Payments tab and the receipt |
| GET | `/reports/dashboard`, `/reports/salespersons` | Reports |
| GET | `/settings`, `PUT /settings` | Templates, sources, timezone |
| GET | `/search?q=` | Header search |

`GET /today` returns `timeZone`, `dayKey`, `counts` (overdue follow-ups, open tasks, appointments today, done today), `appointmentsToday`, `tasksToday`, `paymentsDue`, `overdue`, `dueToday`, `upcoming`, `unscheduled`, `queue` (overdue then due today), and `messageTemplates`.

## Time and phone rules

- Timezone order: `project.timezone` or `project.timeZone`, then the company, then `crm_settings.timezone`, then `Asia/Kolkata`.
- “Today” is midnight to midnight in that zone, not the server’s local midnight.
- A date-only follow-up is stored as 09:00 in that zone.
- A 10-digit Indian number is stored as `+91` plus those digits. `phoneKey` is the digits used for duplicate checks.
- The WhatsApp link uses `91` plus the 10-digit number.

## What the desk deliberately does not do

- It does not create a second project catalog.
- It does not create a new Mongo collection.
- It does not seed demo customers from the screen.
- It does not show prices on the CRM screens.
- It does not send WhatsApp through a business API. The user sends the message from their own WhatsApp.
- It does not mark a lead Booked when someone taps Deal won. Booking the unit does that.
