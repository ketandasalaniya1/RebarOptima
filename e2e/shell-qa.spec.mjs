import fs from 'node:fs';
import { test } from '@playwright/test';
import { ROUTES, openAs, measureShell } from './qa/session.mjs';

const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/users.json', import.meta.url), 'utf8'));
const MATRIX = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

test('shell invariants on every route', async ({ page, request }) => {
  test.setTimeout(1_200_000);
  page.setDefaultTimeout(8_000);
  page.setDefaultNavigationTimeout(12_000);
  await openAs(page, request, fixtures.admin.email, fixtures.password, 'light');
  const rows = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate((next) => {
      localStorage.setItem('themeMode', next);
      document.documentElement.setAttribute('data-theme', next);
      document.documentElement.style.colorScheme = next;
    }, theme);
    for (const size of MATRIX) {
      await page.setViewportSize(size);
      for (const route of ROUTES) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.locator('.sidenav').waitFor({ state: 'attached', timeout: 8000 });
        const shell = await measureShell(page);
        rows.push({ theme, w: size.width, route, ...shell });
        if (rows.length % 40 === 0) console.log(`SHELL_PROGRESS ${rows.length}`);
      }
    }
  }

  const shellBad = rows.filter((row) => row.shellMismatch || row.strip > 0 || !row.hidden || row.clipped > 0 || row.natives > 0);
  const contrast = rows.reduce((sum, row) => sum + (row.contrast || 0), 0);
  const scroll = rows.filter((row) => row.pageScroll).length;
  console.log(`SHELL_ROWS ${rows.length} CONTRAST ${contrast} SCROLL ${scroll} SHELL_BAD ${shellBad.length}`);
  if (shellBad.length) {
    const sample = shellBad.slice(0, 8).map((row) => `${row.theme} ${row.w} ${row.route} clip=${row.clipped} native=${row.natives} hidden=${row.hidden}`);
    throw new Error(sample.join('\n'));
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.locator('.sidenav.open').waitFor({ state: 'visible', timeout: 3000 });
  await page.keyboard.press('Escape');
  await page.locator('.sidenav.open').waitFor({ state: 'hidden', timeout: 3000 });
  const filters = page.locator('.ro-filterbar__open');
  if (await filters.count()) {
    await filters.click();
    await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 3000 });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 3000 });
  }
  const themeButton = page.getByRole('button', { name: /Change theme/ });
  const beforeTheme = await themeButton.getAttribute('aria-label');
  await themeButton.click();
  const afterTheme = await themeButton.getAttribute('aria-label');
  if (beforeTheme === afterTheme) throw new Error('theme toggle did not change');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.locator('.sidenav.open').waitFor({ state: 'visible', timeout: 3000 });
  await page.getByRole('button', { name: /active project/i }).click();
  await page.locator('.ps-dropdown, .project-selector-dropdown, .ps-list').first().waitFor({ state: 'visible', timeout: 3000 });
  await page.keyboard.press('Escape');
});
