# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/ai-theme-check.spec.mjs >> ai-assistant matches light and dark theme tokens cleanly with no mixed dark elements in light theme
- Location: e2e/ai-theme-check.spec.mjs:16:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: apiRequestContext.post: Request context disposed.
Call log:
  - → POST http://127.0.0.1:3100/api/auth/signin
    - user-agent: Playwright/1.65.1 (arm64; macOS 27.2) node/26.13
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - content-type: application/json
    - content-length: 59

```

# Test source

```ts
  1   | const API = 'http://127.0.0.1:3100/api';
  2   | 
  3   | export const ROUTES = [
  4   |   '/',
  5   |   '/projects',
  6   |   '/inventory',
  7   |   '/inputs',
  8   |   '/results',
  9   |   '/history',
  10  |   '/ledger',
  11  |   '/bbs',
  12  |   '/bbs/dashboard',
  13  |   '/bbs/wizard',
  14  |   '/bbs/shapes',
  15  |   '/bbs/reports',
  16  |   '/casting',
  17  |   '/general-inventory',
  18  |   '/crm/today',
  19  |   '/crm/dashboard',
  20  |   '/crm/leads',
  21  |   '/crm/pipeline',
  22  |   '/crm/tasks',
  23  |   '/crm/calendar',
  24  |   '/crm/followups',
  25  |   '/crm/inventory',
  26  |   '/crm/templates',
  27  |   '/crm/import',
  28  |   '/project-management',
  29  |   '/drawings',
  30  |   '/petty-cash',
  31  |   '/contractors',
  32  |   '/manpower/labour',
  33  |   '/manpower/contractor-labour',
  34  |   '/attendance/mark',
  35  |   '/attendance/history',
  36  |   '/attendance/reports',
  37  |   '/users',
  38  |   '/roles',
  39  |   '/activity-logs',
  40  |   '/chat',
  41  |   '/profile',
  42  |   '/reports',
  43  |   '/settings',
  44  |   '/drawings/matrix',
  45  |   '/drawings/versions',
  46  | ];
  47  | 
  48  | export async function openAs(page, request, email, password, theme = 'light') {
> 49  |   const res = await request.post(`${API}/auth/signin`, { data: { email, password } });
      |                             ^ Error: apiRequestContext.post: Request context disposed.
  50  |   if (!res.ok()) throw new Error(`signin ${res.status()} for ${email}`);
  51  |   const body = await res.json();
  52  |   const token = body.accessToken;
  53  |   let projectId = '';
  54  |   const projectsRes = await request.get(`${API}/projects`, {
  55  |     headers: { Authorization: `Bearer ${token}` },
  56  |   });
  57  |   if (projectsRes.ok()) {
  58  |     const list = await projectsRes.json();
  59  |     const projects = Array.isArray(list) ? list : [];
  60  |     const yard = projects.find((item) => item.name === 'E2E Yard') || projects[0];
  61  |     if (yard) projectId = String(yard._id || yard.id);
  62  |   }
  63  |   await page.goto('/login');
  64  |   await page.evaluate(({ token, refresh, user, projectId, theme }) => {
  65  |     sessionStorage.setItem('accessToken', token);
  66  |     if (refresh) sessionStorage.setItem('refreshToken', refresh);
  67  |     sessionStorage.setItem('user', JSON.stringify(user));
  68  |     sessionStorage.setItem('lastActivity', String(Date.now()));
  69  |     if (projectId) localStorage.setItem('rebar_active_project_id', projectId);
  70  |     localStorage.setItem('themeMode', theme);
  71  |     document.documentElement.setAttribute('data-theme', theme);
  72  |     document.documentElement.style.colorScheme = theme;
  73  |   }, { token, refresh: body.refreshToken, user: body.user, projectId, theme });
  74  | }
  75  | 
  76  | export const KEY_ROUTES = [
  77  |   '/',
  78  |   '/projects',
  79  |   '/inventory',
  80  |   '/ledger',
  81  |   '/bbs',
  82  |   '/casting',
  83  |   '/general-inventory',
  84  |   '/history',
  85  |   '/users',
  86  |   '/reports',
  87  | ];
  88  | 
  89  | export async function readSurface(page) {
  90  |   return page.evaluate(() => {
  91  |     const root = document.querySelector('#root');
  92  |     const text = (root?.innerText || '').replace(/\s+/g, ' ').trim();
  93  |     function luminance(rgb) {
  94  |       if (!rgb) return null;
  95  |       const parts = String(rgb).match(/[\d.]+/g)?.map(Number) || [];
  96  |       if (parts.length < 3) return null;
  97  |       const channel = (value) => {
  98  |         const c = value / 255;
  99  |         return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  100 |       };
  101 |       return 0.2126 * channel(parts[0]) + 0.7152 * channel(parts[1]) + 0.0722 * channel(parts[2]);
  102 |     }
  103 |     function visible(el) {
  104 |       const style = getComputedStyle(el);
  105 |       if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  106 |       const rect = el.getBoundingClientRect();
  107 |       return rect.width > 0 && rect.height > 0;
  108 |     }
  109 |     function backgroundOf(el) {
  110 |       let current = el;
  111 |       while (current) {
  112 |         const color = getComputedStyle(current).backgroundColor;
  113 |         const parts = color.match(/[\d.]+/g)?.map(Number) || [];
  114 |         if (parts.length >= 3 && (parts.length < 4 || parts[3] > 0.5) && color !== 'rgba(0, 0, 0, 0)') return color;
  115 |         current = current.parentElement;
  116 |       }
  117 |       return null;
  118 |     }
  119 |     function contrast(a, b) {
  120 |       if (a == null || b == null) return null;
  121 |       return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  122 |     }
  123 |     const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  124 |     const groups = {
  125 |       card: '.ro-card, .ro-kpi-card, [class*="card"]',
  126 |       table: 'table, thead, th, td',
  127 |       header: 'h1, h2, h3, header',
  128 |       input: 'input, select, textarea',
  129 |       tab: '[role="tab"], .tab-btn, .ro-tab-btn, .gi-tab-btn, .gi-hub-tab-btn, .casting-tab-btn',
  130 |       chip: '.ro-badge, .badge, [class*="chip"]',
  131 |       drawer: '.ro-drawer, .ro-drawer__header, .ro-drawer__body',
  132 |     };
  133 |     const wrong = [];
  134 |     const seen = new Set();
  135 |     for (const [group, selector] of Object.entries(groups)) {
  136 |       for (const el of document.querySelectorAll(selector)) {
  137 |         if (seen.has(el) || !visible(el)) continue;
  138 |         seen.add(el);
  139 |         if (el.closest('.sidebar, [class*="sidebar"], [role="tooltip"], .tooltip')) continue;
  140 |         if (el.closest('.ro-btn--primary, .ro-btn--danger')) continue;
  141 |         const bg = backgroundOf(el);
  142 |         const lum = luminance(bg);
  143 |         if (lum == null) continue;
  144 |         const ownBg = getComputedStyle(el).backgroundColor;
  145 |         const ownParts = ownBg.match(/[\d.]+/g)?.map(Number) || [];
  146 |         const paints = ownParts.length >= 3 && (ownParts.length < 4 || ownParts[3] > 0.5) && ownBg !== 'rgba(0, 0, 0, 0)';
  147 |         if (paints && ((theme === 'light' && lum < 0.4) || (theme === 'dark' && lum > 0.7))) {
  148 |           wrong.push(`${group} surface ${String(el.className || el.tagName).slice(0, 60)}`);
  149 |         }
```