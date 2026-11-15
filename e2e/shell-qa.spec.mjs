import fs from 'node:fs';
import { test } from '@playwright/test';
import { KEY_ROUTES, openAs, measureShell } from './qa/session.mjs';

const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/users.json', import.meta.url), 'utf8'));
const MATRIX = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

test('shell invariants on the local app', async ({ page, request }) => {
  test.setTimeout(600_000);
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
      for (const route of KEY_ROUTES) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.locator('.sidenav').waitFor({ state: 'attached', timeout: 8000 });
        const shell = await measureShell(page);
        rows.push({ theme, w: size.width, route, ...shell });
      }
    }
  }
  console.log('SHELL\ttheme\twidth\troute\tnav\ttoken\tmismatch\tstrip\thidden\tmainLeft\tscroll\tclipped\tnatives');
  for (const row of rows) {
    console.log([
      'SHELL', row.theme, row.w, row.route, row.navWidth, row.token, row.shellMismatch ? 1 : 0,
      row.strip, row.hidden ? 1 : 0, row.mainLeft, row.pageScroll ? 1 : 0, row.clipped, row.natives,
    ].join('\t'));
  }
  const bad = rows.filter((row) => row.shellMismatch || row.strip > 0 || !row.hidden || row.pageScroll || row.clipped > 0 || row.natives > 0);
  if (bad.length) throw new Error(`shell failures ${bad.length}`);
});
