import fs from 'node:fs';
import { test } from '@playwright/test';
import { ROUTES, openAs } from './qa/session.mjs';

const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/users.json', import.meta.url), 'utf8'));
const accounts = [
  { role: 'Admin', email: fixtures.admin.email },
  ...fixtures.users.map((user) => ({ role: user.role, email: user.email })),
];
const TAB_SELECTOR = '.tab-btn, .casting-tab-btn, .gi-hub-tab-btn, .gi-tab-btn, [role="tab"]';

test('pageerrors per role, route, and tab', async ({ page, request }) => {
  test.setTimeout(1_500_000);
  const lines = ['ROLE\tROUTE\tTAB\tPAGEERRORS'];
  for (const account of accounts) {
    const pageErrors = [];
    const onError = (error) => pageErrors.push(error.message);
    page.on('pageerror', onError);
    await openAs(page, request, account.email, fixtures.password, 'light');
    for (const route of ROUTES) {
      const before = pageErrors.length;
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700);
      const loadErrors = pageErrors.slice(before);
      lines.push(`${account.role}\t${route}\tload\t${loadErrors.length ? loadErrors.join(' | ') : '0'}`);
      const tabs = page.locator(TAB_SELECTOR);
      const count = Math.min(await tabs.count(), 16);
      for (let index = 0; index < count; index += 1) {
        const tab = tabs.nth(index);
        const label = ((await tab.innerText().catch(() => '')) || `tab-${index}`).replace(/\s+/g, ' ').trim();
        const tabBefore = pageErrors.length;
        await tab.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
        const tabErrors = pageErrors.slice(tabBefore);
        lines.push(`${account.role}\t${route}\t${label || `tab-${index}`}\t${tabErrors.length ? tabErrors.join(' | ') : '0'}`);
      }
    }
    page.off('pageerror', onError);
  }
  console.log(lines.join('\n'));
  const hits = lines.filter((line) => !line.endsWith('\t0') && !line.startsWith('ROLE'));
  console.log(`PAGEERROR_ROWS=${hits.length}`);
});
