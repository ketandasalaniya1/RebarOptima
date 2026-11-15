const API = 'http://127.0.0.1:3100/api';

export const ROUTES = [
  '/',
  '/projects',
  '/inventory',
  '/inputs',
  '/results',
  '/history',
  '/ledger',
  '/bbs',
  '/bbs/dashboard',
  '/bbs/wizard',
  '/bbs/shapes',
  '/bbs/reports',
  '/casting',
  '/general-inventory',
  '/crm/today',
  '/crm/dashboard',
  '/crm/leads',
  '/crm/pipeline',
  '/crm/tasks',
  '/crm/calendar',
  '/crm/followups',
  '/crm/inventory',
  '/crm/templates',
  '/crm/import',
  '/project-management',
  '/drawings',
  '/petty-cash',
  '/contractors',
  '/manpower/labour',
  '/manpower/contractor-labour',
  '/attendance/mark',
  '/attendance/history',
  '/attendance/reports',
  '/users',
  '/roles',
  '/activity-logs',
  '/chat',
  '/profile',
  '/reports',
];

export async function openAs(page, request, email, password, theme = 'light') {
  const res = await request.post(`${API}/auth/signin`, { data: { email, password } });
  if (!res.ok()) throw new Error(`signin ${res.status()} for ${email}`);
  const body = await res.json();
  const token = body.accessToken;
  let projectId = '';
  const projectsRes = await request.get(`${API}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (projectsRes.ok()) {
    const list = await projectsRes.json();
    const projects = Array.isArray(list) ? list : [];
    const yard = projects.find((item) => item.name === 'E2E Yard') || projects[0];
    if (yard) projectId = String(yard._id || yard.id);
  }
  await page.goto('/login');
  await page.evaluate(({ token, refresh, user, projectId, theme }) => {
    sessionStorage.setItem('accessToken', token);
    if (refresh) sessionStorage.setItem('refreshToken', refresh);
    sessionStorage.setItem('user', JSON.stringify(user));
    sessionStorage.setItem('lastActivity', String(Date.now()));
    if (projectId) localStorage.setItem('rebar_active_project_id', projectId);
    localStorage.setItem('themeMode', theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }, { token, refresh: body.refreshToken, user: body.user, projectId, theme });
}

export const KEY_ROUTES = [
  '/',
  '/projects',
  '/inventory',
  '/ledger',
  '/bbs',
  '/casting',
  '/general-inventory',
  '/history',
  '/users',
  '/reports',
];

export async function readSurface(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#root');
    const text = (root?.innerText || '').replace(/\s+/g, ' ').trim();
    function luminance(rgb) {
      if (!rgb) return null;
      const parts = String(rgb).match(/[\d.]+/g)?.map(Number) || [];
      if (parts.length < 3) return null;
      const channel = (value) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(parts[0]) + 0.7152 * channel(parts[1]) + 0.0722 * channel(parts[2]);
    }
    function visible(el) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
    function backgroundOf(el) {
      let current = el;
      while (current) {
        const color = getComputedStyle(current).backgroundColor;
        const parts = color.match(/[\d.]+/g)?.map(Number) || [];
        if (parts.length >= 3 && (parts.length < 4 || parts[3] > 0.5) && color !== 'rgba(0, 0, 0, 0)') return color;
        current = current.parentElement;
      }
      return null;
    }
    function contrast(a, b) {
      if (a == null || b == null) return null;
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const groups = {
      card: '.ro-card, .ro-kpi-card, [class*="card"]',
      table: 'table, thead, th, td',
      header: 'h1, h2, h3, header',
      input: 'input, select, textarea',
      tab: '[role="tab"], .tab-btn, .ro-tab-btn, .gi-tab-btn, .gi-hub-tab-btn, .casting-tab-btn',
      chip: '.ro-badge, .badge, [class*="chip"]',
      drawer: '.ro-drawer, .ro-drawer__header, .ro-drawer__body',
    };
    const wrong = [];
    const seen = new Set();
    for (const [group, selector] of Object.entries(groups)) {
      for (const el of document.querySelectorAll(selector)) {
        if (seen.has(el) || !visible(el)) continue;
        seen.add(el);
        if (el.closest('.sidebar, [class*="sidebar"], [role="tooltip"], .tooltip')) continue;
        if (el.closest('.ro-btn--primary, .ro-btn--danger')) continue;
        const bg = backgroundOf(el);
        const lum = luminance(bg);
        if (lum == null) continue;
        const ownBg = getComputedStyle(el).backgroundColor;
        const ownParts = ownBg.match(/[\d.]+/g)?.map(Number) || [];
        const paints = ownParts.length >= 3 && (ownParts.length < 4 || ownParts[3] > 0.5) && ownBg !== 'rgba(0, 0, 0, 0)';
        if (paints && ((theme === 'light' && lum < 0.4) || (theme === 'dark' && lum > 0.7))) {
          wrong.push(`${group} surface ${String(el.className || el.tagName).slice(0, 60)}`);
        }
        const sample = (el.innerText || el.getAttribute('placeholder') || '').trim();
        if (!sample) continue;
        const ratio = contrast(luminance(getComputedStyle(el).color), lum);
        const size = parseFloat(getComputedStyle(el).fontSize) || 14;
        const weight = parseInt(getComputedStyle(el).fontWeight, 10) || 400;
        const large = size >= 18 || (size >= 14 && weight >= 700);
        if (ratio != null && ratio < (large ? 3 : 4.5)) {
          wrong.push(`${group} contrast ${ratio.toFixed(2)} ${String(el.className || el.tagName).slice(0, 60)}`);
        }
      }
    }
    const smallTargets = [];
    for (const el of document.querySelectorAll('button, [role="button"], [role="tab"], a[class*="btn"], input, select, textarea')) {
      if (!visible(el)) continue;
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio' || type === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        const label = (el.getAttribute('aria-label') || el.innerText || el.className || el.tagName).toString().trim().slice(0, 40);
        smallTargets.push(`${Math.round(rect.width)}x${Math.round(rect.height)} ${label}`);
      }
    }
    const documentScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const overflowers = [];
    if (documentScroll) overflowers.push('document');
    for (const el of document.body.querySelectorAll('*')) {
      if (!visible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.right <= window.innerWidth + 1) continue;
      if (el.closest('.sidenav, .sidebar, .mobile-header')) continue;
      let parent = el.parentElement;
      let clipped = false;
      while (parent) {
        const overflow = getComputedStyle(parent).overflowX;
        if (parent !== document.body && parent !== document.documentElement && (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden')) {
          const box = parent.getBoundingClientRect();
          if (box.left >= -1 && box.right <= window.innerWidth + 1) {
            clipped = true;
            break;
          }
        }
        parent = parent.parentElement;
      }
      if (!clipped) overflowers.push(String(el.className || el.tagName).slice(0, 60));
      if (overflowers.length > 8) break;
    }
    const surface = document.querySelector('.ro-page-layout') || root;
    return {
      blank: text.length < 12,
      luminance: luminance(backgroundOf(surface)),
      pageScroll: documentScroll || overflowers.length > 0,
      overflowers: overflowers.slice(0, 6),
      wrongTheme: wrong.length,
      wrongSample: wrong.slice(0, 4),
      smallTargets: smallTargets.length,
      smallSample: smallTargets.slice(0, 4),
      text: text.slice(0, 80),
    };
  });
}

export async function measureShell(page) {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const token = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 0;
    const nav = document.querySelector('.sidenav');
    const navStyle = nav ? getComputedStyle(nav) : null;
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const collapsed = Boolean(nav?.classList.contains('collapsed'));
    const navWidth = navRect ? Math.round(navRect.width) : 0;
    const shellMismatch = width > 1024 && nav && !collapsed && Math.abs(navWidth - token) > 2;
    let strip = 0;
    if (width <= 1024 && nav && navStyle.visibility !== 'hidden') {
      const right = Math.min(60, navRect.right);
      const left = Math.max(0, navRect.left);
      if (right > left) strip = Math.round(right - left);
    }
    const hidden = !nav || width > 1024 || (
      navStyle.visibility === 'hidden' &&
      nav.hasAttribute('inert') &&
      navStyle.pointerEvents === 'none'
    );
    const main = document.querySelector('.main-viewport');
    const mainLeft = main ? Math.round(main.getBoundingClientRect().left) : null;
    const pageScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      || (main && main.scrollWidth > main.clientWidth + 1);
    let clipped = 0;
    const clippedSample = [];
    for (const el of document.querySelectorAll('h1, h2, .bc-current, .bc-link, .page-title')) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (el.closest('.gi-pdf-document, .batch-print-portal, .ledger-print-template')) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const onScreen = rect.right > 0 && rect.left < width && rect.bottom > 0 && rect.top < window.innerHeight;
      if (onScreen && (rect.left < -1 || rect.right > width + 1)) {
        clipped += 1;
        if (clippedSample.length < 3) {
          clippedSample.push(`${Math.round(rect.left)}..${Math.round(rect.right)} ${(el.innerText || el.className || '').toString().slice(0, 40)}`);
        }
      }
    }
    const natives = [];
    for (const el of document.querySelectorAll('input, select, textarea')) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (['checkbox', 'radio', 'hidden', 'range', 'color'].includes(type)) continue;
      if (el.classList.contains('ro-search-input')) continue;
      const border = parseFloat(style.borderTopWidth) || 0;
      const radius = parseFloat(style.borderTopLeftRadius) || 0;
      const bareSelect = el.tagName === 'SELECT' && style.appearance !== 'none';
      if (border < 1 || radius < 1 || bareSelect) natives.push((el.className || el.tagName).toString().slice(0, 40));
    }
    const money = /₹|\bRs\.?\b/.test(document.body.innerText) && document.body.innerText.includes('Rs');
    return {
      shellMismatch,
      navWidth,
      token,
      strip,
      hidden,
      mainLeft,
      pageScroll,
      clipped,
      clippedSample,
      natives: natives.length,
      nativeSample: natives.slice(0, 3),
      money,
    };
  });
}
