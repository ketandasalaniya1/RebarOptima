import fs from 'node:fs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readSurface } from './session.mjs';

const fixtures = JSON.parse(fs.readFileSync(new URL('../fixtures/users.json', import.meta.url), 'utf8'));
const routes = ['/crm/tasks', '/crm/import', '/attendance/mark', '/roles', '/activity-logs', '/projects'];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const signin = await page.request.post('http://127.0.0.1:3100/api/auth/signin', {
  data: { email: fixtures.admin.email, password: fixtures.password },
});
const body = await signin.json();
const projects = await (await page.request.get('http://127.0.0.1:3100/api/projects', {
  headers: { authorization: `Bearer ${body.accessToken}` },
})).json();
const yard = projects.find((item) => item.name === 'E2E Yard') || projects[0];
await page.goto('http://127.0.0.1:5174/login');
await page.evaluate(({ token, refresh, user, projectId }) => {
  sessionStorage.setItem('accessToken', token);
  sessionStorage.setItem('refreshToken', refresh);
  sessionStorage.setItem('user', JSON.stringify(user));
  sessionStorage.setItem('lastActivity', String(Date.now()));
  localStorage.setItem('rebar_active_project_id', projectId);
}, { token: body.accessToken, refresh: body.refreshToken, user: body.user, projectId: String(yard._id) });

const rules = new Map();
for (const theme of ['light', 'dark']) {
  await page.evaluate((next) => {
    localStorage.setItem('themeMode', next);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.style.colorScheme = next;
  }, theme);
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:5174${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const surface = await readSurface(page);
    if (surface.wrongTheme) console.log(`WRONG\t${route}\t${theme}\t${surface.wrongSample.join(' | ')}`);
    const axe = await new AxeBuilder({ page }).analyze();
    for (const violation of axe.violations) {
      if (violation.impact !== 'critical') continue;
      for (const node of violation.nodes.slice(0, 4)) {
        console.log(`CRIT\t${route}\t${theme}\t${violation.id}\t${(node.target || []).join(' ')}\t${(node.html || '').slice(0, 180)}`);
      }
      const key = `${violation.id}`;
      rules.set(key, (rules.get(key) || 0) + violation.nodes.length);
    }
  }
}
for (const [key, count] of rules) console.log(`SUM\t${count}\t${key}`);
await page.setViewportSize({ width: 360, height: 800 });
for (const route of ['/', '/projects', '/inventory', '/history', '/ledger', '/bbs']) {
  await page.goto(`http://127.0.0.1:5174${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const surface = await readSurface(page);
  const themeBtn = await page.evaluate(() => {
    const el = document.querySelector('.ro-theme-pill-btn');
    if (!el) return 'none';
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return `${style.visibility} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
  });
  console.log(`TOUCH\t${route}\t${surface.smallTargets}\t${surface.pageScroll ? 'SCROLL' : 'ok'}\t${(surface.smallSample || []).join(' | ')}\tpill ${themeBtn}`);
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:5174/projects', { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Open navigation menu' }).click();
await page.locator('.sidenav.open').waitFor({ state: 'visible', timeout: 3000 });
await page.keyboard.press('Escape');
await page.locator('.sidenav.open').waitFor({ state: 'hidden', timeout: 3000 });
await page.locator('.ro-filterbar__open').click();
await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 3000 });
await page.locator('#pp-status-filter').selectOption('active');
await page.keyboard.press('Escape');
await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 3000 });
const beforeTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
await page.getByRole('button', { name: /theme/i }).first().click();
const afterTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
await page.getByRole('button', { name: 'Reset' }).click();
const status = await page.locator('#pp-status-filter').inputValue();
const search = page.locator('.ro-search-input, input[type="search"]').first();
await search.fill('zzz-no-such-project');
const countText = await page.locator('.pp-filter-count').innerText();
await page.getByRole('button', { name: 'Reset' }).click();
const cleared = await search.inputValue();
const projectButton = page.getByRole('button', { name: /Select Project|Currently Selected/ }).first();
if (await projectButton.count()) await projectButton.click({ timeout: 3000 });
console.log(`STATES theme ${beforeTheme}->${afterTheme} status-after-reset ${status} count ${JSON.stringify(countText)} search-cleared ${JSON.stringify(cleared)}`);
await browser.close();
