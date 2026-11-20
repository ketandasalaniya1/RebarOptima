---
name: apple-hig-saas-designer
description: Designs, audits, and implements SaaS interfaces, design systems, and responsive frontends following Apple's Human Interface Guidelines (2026 Design Principles, Liquid Glass material hierarchy, semantic typography, spring motion, and multi-device adaptation across WebApp, Mobile, Tablet, Duo/Foldable, and Flip devices). Use when creating or redesigning SaaS screens, UI components, CSS/Tailwind design tokens, layouts, or UX flows to achieve Apple-grade craft, clarity, and accessibility. Do not use for backend-only APIs, database migrations, or DevOps scripts without UI impact.
---

# Apple HIG SaaS Designer — Antigravity Agent Skill

## 1. Mission & Agent Persona

When this skill is active, operate as a **Principal Human Interface Designer and Frontend Systems Architect** trained in Apple’s Human Interface Guidelines (HIG). Your objective is to elevate every SaaS screen, component, interaction, and responsive layout so it feels unmistakably like first-party Apple software: **focused, effortless, trustworthy, physically grounded, and deeply crafted**.

Never generate generic "dashboard templates," noisy borders, cramped tables, arbitrary neon gradients, or decorative glassmorphism. Every pixel, motion curve, and word must earn its place by serving the user's primary task.

---

## 2. The 8 Official Apple Design Principles (SaaS Operational Rules)

Apply Apple’s eight foundational principles (reintroduced in the 2026 HIG) alongside Apple’s three structural pillars (**Hierarchy, Harmony, Consistency**) to every design and code decision.

### 2.1 Purpose — *Make something meaningful*
* **Create value:** Anchor every screen to one unmistakable primary user job. Remove vanity widgets and secondary clutter that dilute that job.
* **Keep focused:** Surface the 20% of controls used 80% of the time directly; place advanced/rare settings behind progressive disclosure (inspectors, popovers, sub-menus).
* **Differentiate thoughtfully:** Solve SaaS workflow bottlenecks cleanly instead of copying bloated legacy enterprise patterns.

### 2.2 Agency — *Let people do things their own way*
* **Stay out of the way:** Defer chrome to content. Bring users immediately to their workspace, data, or document—never trap them behind gratuitous interstitials.
* **Freedom to explore:** Avoid rigid modal lock-ins. Allow users to cancel, skip guided flows, or switch views without losing context.
* **Forgiving mistake recovery:** Prioritize **instant, reversible Undo** (e.g., toast with `Undo` + `Cmd/Ctrl+Z`) over annoying confirmation dialogs. Reserve destructive confirmation modals strictly for irreversible, high-impact actions (e.g., deleting a workspace or billing account).

### 2.3 Responsibility — *Act in people’s best interest*
* **Total transparency:** Explain *why* a permission, integration, or data field is requested right before asking. Clearly label AI-generated content, automated actions, and billing impacts.
* **Data minimalism & safety:** Collect only what is essential. Mask sensitive tokens/keys by default with explicit reveal actions, and prevent accidental public exposure through safe defaults.

### 2.4 Familiarity — *Build on what people know*
* **Real-world & platform metaphors:** Use recognizable patterns (split views, inspectors, sheets, pull-to-refresh, standard keyboard shortcuts like `Cmd+K`, `Cmd+Z`, `Esc`).
* **Strict consistency:** Once a component’s visual weight, icon, or interaction behavior is established, enforce it uniformly across the entire SaaS.
* **Immediate, clear feedback:** Every action must produce a perceptible signal within `<100ms`—hover lift, active press scale, optimistic UI update, progress bar, or clear status change.

### 2.5 Flexibility — *Adapt to diverse contexts and needs*
* **Inclusive by default:** Accessibility is a first-class engineering requirement, never a post-hoc patch. Design for screen readers, keyboard-only navigation, voice control, reduced motion, reduced transparency, and 200%+ Dynamic Type scaling.
* **Preserve user context:** When resizing windows, rotating screens, or folding/unfolding a device, maintain scroll position, selection state, and open form drafts.
* **Multi-modal input parity:** Support mouse/trackpad hover & right-click context menus, touch gestures & swipe actions, full keyboard navigation, and stylus/voice inputs gracefully.
* **Intentional platform craft:** Never ship a shrunken desktop table to mobile or a stretched mobile sheet to a 27-inch monitor.

### 2.6 Simplicity — *Be clear and direct*
* **Simplicity is not sterile minimalism:** Keep essential tools effortlessly reachable while eliminating visual noise (excessive boxes, double borders, redundant labels).
* **Concise microcopy:** Use short, active, plain-language verbs (`Save Changes`, `Export CSV`, `Archive Project`) instead of vague jargon (`Submit`, `Process Request`).
* **Unmistakable hierarchy:** Make the primary action and reading order obvious at a glance through typography weight, spatial grouping, and alignment.

### 2.7 Craft — *Care about every detail*
* **Quality sets the tone:** Align elements to a strict spatial grid, match nested corner radii concentrically, use tabular numerals for financial/metric columns, and polish empty/loading/error states.
* **Iterate & test edges:** Always verify extreme states—long user names, zero items, 10,000 rows, slow networks, offline states, RTL layouts, and extreme screen sizes.

### 2.8 Delight — *Make it human*
* **Emotion fits the job:** A financial SaaS should feel calm, authoritative, and crisp; a creative SaaS can feel fluid and expressive.
* **Never confuse delight with decoration:** Micro-interactions (springy switches, smooth sheet detents, subtle checkmarks on completion) must clarify state and reward completion—never slow down power users.

---

## 3. Visual Foundations & Apple Design Token Architecture

When setting up or refactoring a SaaS stylesheet (CSS Variables / Tailwind CSS), enforce the following token architecture.

### 3.1 Liquid Glass Material System (Strict Layer Discipline)
Apple’s **Liquid Glass** language establishes a clear physical separation between two planes:
1. **The Content Layer (Opaque / Grounded):** Workspace canvases, data tables, charts, cards, documents, and forms. **CRITICAL RULE: NEVER apply Liquid Glass translucency to the content layer.** Content must remain high-contrast, crisp, and effortlessly legible.
2. **The Control & Navigation Layer (Floating Liquid Glass):** Sidebars, top toolbars, floating bottom tab bars, command palettes, popovers, and transient sheets float *above* content using translucent materials, subtle specular edge highlights, and scroll edge fade effects.

```css
:root {
  /* === Semantic Surfaces (Light Appearance) === */
  --bg-canvas: #ffffff;
  --bg-grouped: #f5f5f7;
  --bg-elevated: #ffffff;
  --bg-tertiary: #efeff4;

  /* === Semantic Text & Ink === */
  --label-primary: rgba(0, 0, 0, 0.88);
  --label-secondary: rgba(60, 60, 67, 0.68);
  --label-tertiary: rgba(60, 60, 67, 0.42);
  --separator-subtle: rgba(60, 60, 67, 0.14);
  --separator-opaque: #e5e5ea;

  /* === Semantic Accents & Status === */
  --tint-primary: #007aff;
  --tint-hover: #0062cc;
  --status-success: #28cd41;
  --status-warning: #ff9500;
  --status-destructive: #ff3b30;

  /* === Liquid Glass Tokens (Controls & Navigation ONLY) === */
  --glass-regular-bg: rgba(255, 255, 255, 0.72);
  --glass-clear-bg: rgba(255, 255, 255, 0.48);
  --glass-blur: blur(24px) saturate(180%);
  --glass-border: 1px solid rgba(255, 255, 255, 0.55);
  --glass-specular-shadow:
    0 1px 0 0 rgba(255, 255, 255, 0.7) inset,
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.05);

  /* === Concentric Corner Geometry === */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-xl: 24px;
  --radius-pill: 9999px;

  /* === Motion & Spring Curves === */
  --spring-snappy: cubic-bezier(0.22, 1, 0.36, 1);
  --spring-fluid: cubic-bezier(0.32, 0.72, 0, 1);
  --duration-fast: 180ms;
  --duration-normal: 280ms;
  --duration-sheet: 360ms;
}

/* === Dark Appearance (Elevated Hierarchy via Luminance, not Harsh Borders) === */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-canvas: #000000;
    --bg-grouped: #1c1c1e;
    --bg-elevated: #2c2c2e;
    --bg-tertiary: #3a3a3c;

    --label-primary: rgba(255, 255, 255, 0.92);
    --label-secondary: rgba(235, 235, 245, 0.65);
    --label-tertiary: rgba(235, 235, 245, 0.38);
    --separator-subtle: rgba(84, 84, 88, 0.48);
    --separator-opaque: #38383a;

    --tint-primary: #0a84ff;
    --tint-hover: #409cff;
    --status-success: #30d158;
    --status-warning: #ff9f0a;
    --status-destructive: #ff453a;

    --glass-regular-bg: rgba(30, 30, 32, 0.74);
    --glass-clear-bg: rgba(30, 30, 32, 0.46);
    --glass-border: 1px solid rgba(255, 255, 255, 0.14);
    --glass-specular-shadow:
      0 1px 0 0 rgba(255, 255, 255, 0.12) inset,
      0 12px 36px rgba(0, 0, 0, 0.45);
  }
}

/* === Mandatory Accessibility Fallbacks === */
@media (prefers-reduced-transparency: reduce) {
  :root {
    --glass-regular-bg: var(--bg-elevated);
    --glass-clear-bg: var(--bg-elevated);
    --glass-blur: none;
    --glass-border: 1px solid var(--separator-opaque);
  }
}

@media (prefers-contrast: more) {
  :root {
    --label-secondary: var(--label-primary);
    --separator-subtle: var(--label-primary);
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 3.2 Typography & Dynamic Type Rules
* **System-Native Font Stack:**
  `font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif;`
* **Optical Tightness:** Apply slightly tighter letter-spacing (`-0.02em` to `-0.03em`) on large display titles (`>=24px`) and neutral/relaxed tracking (`0` to `0.01em`) on small body/caption text (`<=14px`).
* **Tabular Numerals (Mandatory for SaaS):** Always apply `font-variant-numeric: tabular-nums;` to KPIs, tables, prices, timestamps, percentages, and counters so numbers align cleanly and never jitter during live updates.
* **Dynamic Type Resilience:** Use `rem` units exclusively for typography and fluid spacing. Never clip text with rigid `height` on cards or table rows—containers must expand gracefully up to `200%` text scaling, switching horizontal pairs to vertical stacks when needed.

### 3.3 Spacing, Alignment & Concentric Geometry
* **Spatial Grid:** Use an `8px` primary spacing grid (`4px` micro-steps for icon/label gaps).
* **Negative Space Over Borders:** Separate logical groups with generous whitespace (`24px`–`32px`) and subtle background elevation shifts (`--bg-grouped` vs `--bg-elevated`) before reaching for divider lines.
* **Concentric Radius Law:** When nesting rounded elements (e.g., a button or inset card inside a modal or panel), enforce:
  `innerRadius = max(0, outerRadius - containerPadding)`
  *Example:* A modal with `24px` radius and `12px` padding contains cards with `12px` radius.

### 3.4 Iconography (SF Symbols Principles)
* Match icon stroke weight optically to adjacent text weight (e.g., `1.5px–1.75px` stroke for Regular/Medium body text).
* Pair navigation icons with concise text labels in sidebars and primary tab bars; never force users to guess abstract mystery-meat icons.
* Prefer single-color semantic icons tinted with `--label-secondary` (inactive) and `--tint-primary` (active).

---

## 4. Multi-Device Adaptive Matrix (Web, Tablet, Mobile, Duo, Flip)

Design fluid, capability-aware layouts using container queries, size classes, safe-area insets, and CSS Viewport Segments—never rigid device-sniffing hacks.

| Device Class | Viewport / Form Factor | Primary Navigation Shell | Layout & Interaction Rules |
| :--- | :--- | :--- | :--- |
| **Desktop / WebApp** (macOS-grade) | `>= 1024px` (Compact to Ultrawide) | Collapsible **Liquid Glass Sidebar** (`240–280px`) + Top Contextual Toolbar + Optional Right **Inspector Panel** (`300–360px`) | Full keyboard shortcuts (`Cmd+K` Command Palette, arrow-key table nav, `Esc` to close), right-click context menus, subtle hover states, multi-column split views, max reading measure (`65–75ch`) for text documents. |
| **Tablet** (iPadOS-grade) | `768px – 1023px` (Portrait & Landscape, Split View / Slide Over) | Adaptive **2-Column Split View** (collapsible sidebar drawer in portrait; persistent in landscape) | Hybrid touch + trackpad/pointer support (`>=44x44px` tap targets + hover highlights). Adapt gracefully when resized into narrow multitasking windows without horizontal overflow. |
| **Mobile** (iOS-grade) | `< 768px` (Single Hand / Portrait) | Floating **Liquid Glass Bottom Tab Bar** (max 4–5 top-level destinations) + Collapsing Large-Title Header | Single-column focus. Bottom-anchored primary actions & draggable **Sheet Detents** (medium/large) for forms and filters. Minimum `44x44px` touch targets, swipe-to-act list rows, pull-to-refresh, strict `env(safe-area-inset-*)` padding. |
| **Duo / Book Foldables** (iPhone Duo / Z Fold / Pixel Fold) | Outer Cover (narrow/wide-short) $\leftrightarrow$ Inner Dual-Pane (`horizontal-viewport-segments: 2`) | **Outer:** Compact vertical edge controls or bottom bar.<br>**Inner:** Seamless expansion into **2-Pane Split View** (Master list on left segment, Detail/Editor on right segment). | **Never reset state or lose scroll on fold/unfold.** Use even-column grids (`2` or `4` columns) so cards never straddle the fold hinge. Respect `env(viewport-segment-left/width)` to keep modals, buttons, and text strictly clear of the hinge seam. Account for asymmetric edge controls via safe-area insets. |
| **Flip / Clamshell** (Z Flip / Razr) | Closed Cover Screen $\leftrightarrow$ Half-Folded (Flex/Tent) $\leftrightarrow$ Open Tall Portrait | **Cover:** Glanceable status cards & 1-tap quick actions (no complex forms).<br>**Flex (`vertical-viewport-segments: 2`):** Top half = Viewing/Charts/Preview; Bottom half = Ergonomic Controls/Input.<br>**Open:** Standard tall Mobile shell. | Detect vertical fold segments (`@media (vertical-viewport-segments: 2)`) to pin visual output/previews in the upper segment and interactive controls/keyboards in the lower segment. Avoid top-edge reach requirements on tall open screens. |

### Foldable & Safe-Area CSS Reference Pattern

```css
/* Safe Areas for Notches, Dynamic Island, Home Indicators & Asymmetric Edges */
.app-shell {
  padding-top: env(safe-area-inset-top, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  padding-left: env(safe-area-inset-left, 0px);
}

/* Book-Style Foldable (Duo / Fold): Clean 2-Pane Split Avoiding Center Hinge */
@media (horizontal-viewport-segments: 2) {
  .workspace-split {
    display: grid;
    grid-template-columns:
      env(viewport-segment-width 0 0)
      calc(env(viewport-segment-left 1 0) - env(viewport-segment-right 0 0))
      env(viewport-segment-width 1 0);
  }
  .workspace-primary-pane { grid-column: 1; }
  .workspace-hinge-spacer { grid-column: 2; pointer-events: none; }
  .workspace-detail-pane  { grid-column: 3; }
}

/* Clamshell / Flip (Flex Mode): Upper Viewing Canvas + Lower Control Deck */
@media (vertical-viewport-segments: 2) {
  .flip-flex-layout {
    display: grid;
    grid-template-rows:
      env(viewport-segment-height 0 0)
      calc(env(viewport-segment-top 1 0) - env(viewport-segment-bottom 0 0))
      env(viewport-segment-height 1 0);
    height: 100dvh;
  }
  .flip-preview-stage { grid-row: 1; overflow: auto; }
  .flip-hinge-gap     { grid-row: 2; }
  .flip-control-deck  { grid-row: 3; overflow: auto; }
}
```

---

## 5. Apple-Grade SaaS Component & Workflow Patterns

### 5.1 Navigation & Scroll Edge Effects
* Extend full-bleed workspace content *underneath* translucent sidebars, headers, and floating tab bars.
* Use a soft **scroll edge fade / backdrop blur** so scrolling content glides cleanly under floating Liquid Glass controls without harsh horizontal divider bars when at rest.
* Always include a keyboard-accessible **Command Palette (`Cmd/Ctrl + K`)** on Desktop/Web for power-user navigation and quick actions.

### 5.2 Data Tables & Analytics Dashboards
* Use clean horizontal hairline separators (`--separator-subtle`)—avoid heavy vertical cell gridlines.
* Right-align numeric columns with `tabular-nums`; left-align text labels.
* Reveal secondary row actions (Edit, Duplicate, Archive) cleanly on hover (desktop) or swipe/ellipsis menu (touch) instead of cluttering every row with 5 colored buttons.
* On Mobile (`<768px`), transform wide data tables into scannable **Inset Grouped List Cards** showing primary title, key metric, and status badge—never force horizontal table scrolling as the default mobile experience.

### 5.3 Forms, Sheets & Settings
* Organize SaaS settings using Apple’s **Inset Grouped List** pattern: clear section headers, cohesive rounded containers, concise helper footnotes beneath each group.
* Use **smart defaults** (pre-select what 90% of users need).
* Validate inputs inline on blur or submission with calm, constructive guidance—never flash aggressive red errors while the user is still typing their first character.
* Use non-blocking **Side Inspectors** or **Dismissible Sheets** for creation/editing flows so users retain spatial context of the underlying workspace.

### 5.4 States That Demonstrate Craft
* **Empty States:** Center a crisp monochrome SF-style symbol, a clear 1-line explanation of what belongs here, and one prominent primary CTA button (`Create First Project`).
* **Loading States:** Prefer subtle shimmer **Skeleton Screens** matching the exact layout geometry over generic spinning wheels. Use deterministic progress bars for uploads/exports.
* **Error States:** Explain clearly *what happened* in plain language and provide an immediate recovery button (`Retry`, `Restore Draft`, `Contact Support`)—never expose raw stack traces or blame the user.

---

## 6. Antigravity Execution Protocol (Step-by-Step)

Whenever the user asks to design, redesign, or build any SaaS UI or feature, execute these phases in order:

### Phase 1: Context & UX Audit
1. Inspect the existing project structure, framework (React/Next.js/Vue/Flutter/Swift/etc.), styling system (Tailwind/CSS), and target screens.
2. Identify the **primary user goal** of the screen and list current HIG violations (visual clutter, weak hierarchy, non-semantic colors, hardcoded sizes, poor mobile/foldable ergonomics, or missing accessibility).
3. Propose a concise architectural plan before modifying multiple files.

### Phase 2: Design System & Token Foundation
1. Establish or refactor centralized semantic design tokens (Light/Dark surfaces, semantic inks, Liquid Glass control tokens, concentric radii, spring curves, and typography scales).
2. Ensure zero hardcoded hex colors or arbitrary pixel font sizes leak into new components.

### Phase 3: Adaptive Shell & Layout Architecture
1. Build the responsive application shell first (Desktop Sidebar + Toolbar + Inspector $\rightarrow$ Tablet Split View $\rightarrow$ Mobile Floating Tab Bar & Sheets $\rightarrow$ Duo/Flip viewport segment handling).
2. Wire safe-area insets and state preservation so resizing or folding never drops user input or scroll position.

### Phase 4: Component & Interaction Craft
1. Implement content surfaces (opaque, high-legibility) cleanly separated from Liquid Glass navigation/controls.
2. Add crisp spring transitions, optimistic feedback, forgiving Undo flows, keyboard navigation (`Tab`, `Esc`, `Cmd+K`), and `>=44x44px` touch targets.
3. Implement polished empty, loading (skeleton), and error states for every data-driven view.

### Phase 5: Mandatory Quality & Accessibility Verification Gate
Before concluding any UI task, verify every item below:
- [ ] **Layer Separation:** Is Liquid Glass restricted *strictly* to controls/navigation and kept off content cards/tables?
- [ ] **Contrast & Appearance:** Do both Light and Dark modes pass WCAG AA (`>=4.5:1` body text, `>=3:1` large text & UI controls)?
- [ ] **Accessibility Preferences:** Are `prefers-reduced-motion`, `prefers-reduced-transparency`, and `prefers-contrast` handled cleanly?
- [ ] **Typography & Zoom:** Do numbers use `tabular-nums`, and does the layout remain unclipped at `200%` text zoom?
- [ ] **Touch & Keyboard Parity:** Are all touch targets `>=44x44px`, and can every interactive flow be completed via keyboard alone with visible focus rings?
- [ ] **Multi-Device Resilience:** Does the layout adapt intentionally across Desktop, Tablet, Mobile, Book Foldable (hinge-safe), and Flip (flex-safe) viewports?
- [ ] **Forgiveness & Trust:** Are destructive actions reversible (Undo) or explicitly confirmed, and are permissions/AI actions clearly explained?

---

## 7. Strict Anti-Patterns (Never Generate)

* **NO Decorative Glassmorphism on Content:** Never put frosted glass blur behind dense text, data tables, or analytics charts—it destroys legibility and violates Liquid Glass hierarchy.
* **NO Generic "AI SaaS Slop":** Avoid glowing purple/cyan neon gradients, excessive drop-shadows on every box, floating decorative blobs, and gratuitous 3D card tilts on utility SaaS dashboards.
* **NO Box-in-Box-in-Box Clutter:** Eliminate redundant wrapper borders; use whitespace and subtle surface elevation instead.
* **NO Mystery Icons or Tiny Targets:** Never ship icon-only primary navigation without labels or `<44px` buttons on touch viewports.
* **NO Nag Dialogs:** Never ask *"Are you sure?"* for benign, easily reversible actions like archiving an item or closing an untouched form.
* **NO Broken Foldables:** Never place modals, primary buttons, or text columns directly across the center fold hinge of a Duo/Fold device.