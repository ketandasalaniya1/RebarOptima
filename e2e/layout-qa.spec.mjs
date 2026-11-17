import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { openAs } from './qa/session.mjs';

const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/users.json', import.meta.url), 'utf8'));
const shots = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../design-qa/screenshots');
const SCREENS = [
  ['/projects', 'projects'],
  ['/inventory', 'inventory'],
  ['/contractors', 'contractors'],
  ['/inputs', 'optimizer'],
];

async function setTheme(page, theme) {
  await page.evaluate((next) => {
    localStorage.setItem('themeMode', next);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.style.colorScheme = next;
  }, theme);
}

async function pageOverflows(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

test('named layout fixes stay on one voucher and one governance group', async ({ page, request }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(shots, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem('cravetobuild_sidebar_collapsed', 'false');
  });
  await openAs(page, request, fixtures.admin.email, fixtures.password, 'light');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  await page.locator('.sidenav:not(.collapsed)').waitFor({ state: 'visible', timeout: 8000 });

  const governance = page.getByRole('button', { name: 'Access & Governance' });
  await expect(governance).toHaveCount(1);
  await governance.click();
  await expect(page.getByRole('button', { name: 'User Management' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roles & Permissions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activity Logs' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();

  await page.evaluate(() => {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    user.role = 'PROJECT_PARTNER_ADMIN';
    sessionStorage.setItem('user', JSON.stringify(user));
  });
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  await page.locator('.sidenav').waitFor({ state: 'visible', timeout: 8000 });
  await expect(page.getByRole('button', { name: 'Access & Governance' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'User Management' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Roles & Permissions' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Activity Logs' })).toHaveCount(0);

  await openAs(page, request, fixtures.admin.email, fixtures.password, 'light');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/inventory', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#inward-voucher-form')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Inward' }).first().click();
  await expect(page.locator('#inward-voucher-form')).toHaveCount(1);
  await expect(page.locator('#inward-voucher-form')).toBeVisible();

  const overflows = [];
  for (const theme of ['light', 'dark']) {
    for (const [route, slug] of SCREENS) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.locator('#root').waitFor({ state: 'visible', timeout: 8000 });
      await setTheme(page, theme);
      await page.waitForTimeout(200);
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 800 });
        await page.waitForTimeout(80);
        if (await pageOverflows(page)) overflows.push(`${theme} ${width} ${route}`);
      }
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await page.waitForTimeout(80);
        await page.screenshot({
          path: path.join(shots, `layout-${theme}-${width}-${slug}.png`),
        });
      }
    }
  }
  expect(overflows, overflows.join('\n')).toEqual([]);
});
