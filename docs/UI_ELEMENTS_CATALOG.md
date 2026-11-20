# UI Elements Catalog — CraveToBuild

This document catalogs all the standard UI components and design elements used across the CraveToBuild SaaS application, organized by functional category with real-world use cases.

---

## 1. Layout & Structure Components

| Element Name | Component / Token | Primary Use Case |
| :--- | :--- | :--- |
| **Page Layout** | `<PageLayout>` | Standardized master page container that manages page padding, title headers, subtitle descriptions, breadcrumbs, and top-right action buttons. |
| **Card Surface** | `<Card>` | Elevated surface with subtle 1px border and rounded corners (`radius-md`) used to group related metrics, forms, or content sections cleanly. |
| **KPI Metric Card** | `<KpiCard>` | Displays prominent high-level statistics (e.g. Total Steel Tonnage, Scrap Rate, Active Workforce) with trend indicators, icons, and tabular numbers. |
| **Sidebar Navigation** | `<SideNavbar>` | Primary application menu supporting dual modes: expanded sidebar (240px) and compact icon rail (68px) with expandable accordion sections and mobile off-canvas drawer. |
| **Bottom Navigation Bar** | `<BottomNavBar>` | Mobile-first sticky bottom navigation for smartphones allowing quick single-thumb switching between core pages. |
| **Breadcrumbs** | `<Breadcrumbs>` | Hierarchical path trail showing the active project and page location (e.g., `Projects > Tower A > Rebar Inventory`) with back-navigation links. |

---

## 2. Form & Data Entry Elements

| Element Name | Component / Token | Primary Use Case |
| :--- | :--- | :--- |
| **Text & Number Input** | `<Input>` | Base input field for single-line text, email, numbers, and dates. Includes built-in `tabular-nums` for dimensions and currency, and focus rings. |
| **Search Input** | `<SearchInput>` | Specialized input with a magnifying glass icon, real-time typing clear button (×), and search debounce for filtering tables and directories. |
| **Dropdown Select** | `<Select>` | Styled dropdown selector with custom arrow icons used for picking godowns, contractors, steel diameters, project stages, and role types. |
| **Text Area** | `<Textarea>` | Multi-line expandable text box for notes, remarks, activity descriptions, delivery instructions, and voucher details. |
| **Form Field Wrapper** | `<Field>` | Layout primitive that wraps an input control with its uppercase label, mandatory asterisk (`*`), helper tooltip, and inline validation error text. |
| **Checkbox & Radio** | Native styled inputs | Used for selecting multi-row items in tables, toggling "Remember Me" on login, and picking single options in wizards. |

---

## 3. Action & Interactive Elements

| Element Name | Component / Token | Primary Use Case |
| :--- | :--- | :--- |
| **Primary Button** | `<Button variant="primary">` | Main call-to-action on a screen (e.g., "Run Optimization", "Add Inward Entry", "Save Batch", "Mark Attendance"). Styled with the firm's accent color. |
| **Secondary Button** | `<Button variant="secondary">` | Neutral auxiliary action (e.g., "Cancel", "Reset Filters", "Export Excel", "Previous Step"). |
| **Outline & Ghost Button** | `<Button variant="outline" | "ghost">` | Low-emphasis buttons used for row actions in tables (Edit, View, Duplicate) or toolbar icon buttons without visual clutter. |
| **Danger Button** | `<Button variant="danger">` | High-alert destructive action button (e.g., "Delete Project", "Remove User", "Scrap Bar") styled in red to prevent accidental clicks. |
| **Theme Toggle** | `<ThemeToggle>` | Accessible toggle switch in sidebar and headers to switch instantly between Light Mode, Dark Mode, and System Theme preference. |
| **Scroll To Top** | `<ScrollToTop>` | Floating action button that appears when scrolling long data tables or reports, allowing instant return to page headers. |

---

## 4. Data Display & Tables

| Element Name | Component / Token | Primary Use Case |
| :--- | :--- | :--- |
| **Data Table** | `<Table>` | Dense enterprise table for tabular data (Steel Ledger, Worker Attendance, Leads, Inventory) featuring sortable columns, tabular figures, and sticky headers. |
| **Status Badge** | `<StatusBadge>` / `<Badge>` | Color-coded status pills indicating record lifecycle: `Active`/`Completed` (Green), `Pending`/`In-Progress` (Amber), `Overdue`/`Rejected` (Red), `Draft` (Gray). |
| **Data Filter Bar** | `<FilterBar>` / `<DataToolbar>` | Sticky bar placed above tables combining search boxes, status dropdowns, date range pickers, and export/add buttons in one row. |
| **Tabs / Segmented Control** | `<Tabs>` | Horizontal pill switcher allowing users to toggle between related sub-views (e.g., `All Leads`, `Site Visits`, `Bookings`) without full page reloads. |

---

## 5. Overlays, Modals & Slide-Overs

| Element Name | Component / Token | Primary Use Case |
| :--- | :--- | :--- |
| **Slide-Over Drawer** | `<Drawer>` | Smooth right-sliding panel used for complex creation and editing flows (e.g., Create Inward Entry, Add Contact, Assign Member) without navigating away. |
| **Centered Modal** | `<Modal>` / `<AppModal>` | Focused dialog box with backdrop blur for critical confirmations, geofencing setup, password resets, and quick single-step forms. |
| **Toast Notifications** | `<ChatNotificationToaster>` | Non-intrusive floating alert toasts appearing in screen corners for incoming chat messages, system alerts, or asynchronous task notifications. |

---

## 6. Feedback & Empty States

| Element Name | Component / Token | Primary Use Case |
| :--- | :--- | :--- |
| **Loading Skeletons** | `<TableSkeleton>`, `<CardSkeleton>`, `<KpiSkeleton>` | Shimmer placeholders that mimic exact content layout while backend APIs load data, eliminating jarring layout shifts. |
| **Spinner** | `<LoadingSpinner>` | Centered circular animation used during full-page initializations, authentication checks, or heavy optimization algorithm calculations. |
| **Empty State** | `<EmptyState>` | Informative placeholder shown when a table or list has no records, featuring a contextual icon, explanation, and a direct "Create New" button. |
| **Error Boundary** | `<ErrorBoundary>` | Fail-safe wrapper that isolates component runtime errors and displays a user-friendly recovery screen with a "Reload" button. |

---

## 7. Specialized Construction & Engineering Elements

| Element Name | Component / Token | Primary Use Case |
| :--- | :--- | :--- |
| **BBS Shape Renderer** | `<ShapeRenderer>` | Custom 2D parametric vector canvas rendering standard IS 2502 rebar shapes (straight bars, L-bends, U-hooks, stirrups, crank bars) with dimension labels. |
| **CAD & PDF Blueprint Viewer** | `<CADViewer>` | High-performance interactive blueprint viewer with pan, zoom, layer control, and dimension measurement tools for AutoCAD `.dwg`, `.dxf`, and vector PDF files. |
| **Cutting Pattern Bar** | Custom graphical element | Visual layout strip representing a 12m stock rebar cut into ordered pieces, color-coding usable parts versus scrap cut-offs. |
| **Deal Pipeline (Kanban)** | Custom Kanban board | Drag-and-drop card columns in the Real Estate CRM tracking customer stages from initial lead inquiry through site visit to finalized unit booking. |
| **AI Assistant Copilot Widget**| `<AiAssistantWidget>` | Interactive floating chat pill that expands into a conversational panel for structural questions, BBS calculations, and site advice. |
