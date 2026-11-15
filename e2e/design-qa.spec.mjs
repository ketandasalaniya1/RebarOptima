import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { KEY_ROUTES, ROUTES, openAs, readSurface } from './qa/session.mjs';

const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/users.json', import.meta.url), 'utf8'));
const WIDTHS = [360, 390, 768, 1024];
const shots = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../design-qa/screenshots');

test('design-qa routes against the local app', async ({ page, request }) => {
  test.setTimeout(1_800_000);
  fs.mkdirSync(shots, { recursive: true });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await openAs(page, request, fixtures.admin.email, fixtures.password, 'light');
  const rows = [];
  const axeRules = new Map();
  const samples = [];

  for (const theme of ['light', 'dark']) {
    await page.evaluate((next) => {
      localStorage.setItem('themeMode', next);
      document.documentElement.setAttribute('data-theme', next);
      document.documentElement.style.colorScheme = next;
    }, theme);
    for (const route of ROUTES) {
      const before = pageErrors.length;
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700);
      await page.setViewportSize({ width: 1280, height: 800 });
      const surface = await readSurface(page);
      let axeSerious = 0;
      let axeCritical = 0;
      try {
        const axe = await new AxeBuilder({ page }).analyze();
        for (const violation of axe.violations) {
          if (violation.impact !== 'serious' && violation.impact !== 'critical') continue;
          if (violation.impact === 'serious') axeSerious += 1;
          if (violation.impact === 'critical') axeCritical += 1;
          const key = `${violation.impact}:${violation.id}`;
          axeRules.set(key, (axeRules.get(key) || 0) + 1);
        }
      } catch (err) {
        axeRules.set(`error:${err.message}`, 1);
      }
      const scroll = {};
      const targets = {};
      if (surface.wrongTheme) samples.push(`${route} ${theme} theme ${surface.wrongSample.join(' | ')}`);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        await page.waitForTimeout(80);
        const sized = await readSurface(page);
        scroll[width] = sized.pageScroll ? 1 : 0;
        targets[width] = sized.smallTargets;
        if (sized.pageScroll) samples.push(`${route} ${theme} ${width} overflow ${sized.overflowers.join(' | ')}`);
        if (sized.smallTargets) samples.push(`${route} ${theme} ${width} target ${sized.smallSample.join(' | ')}`);
      }
      if (KEY_ROUTES.includes(route)) {
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
          const slug = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '');
          await page.screenshot({
            path: path.join(shots, `${theme}-${width}-${slug}.png`),
            fullPage: true,
          });
        }
      }
      const errors = pageErrors.slice(before);
      rows.push({
        route,
        theme,
        pageerrors: errors.length ? errors.join(' | ') : '0',
        blank: surface.blank ? 1 : 0,
        axeSerious,
        axeCritical,
        wrongTheme: surface.wrongTheme,
        scroll: WIDTHS.reduce((sum, width) => sum + scroll[width], 0),
        smallTargets: WIDTHS.reduce((sum, width) => sum + targets[width], 0),
      });
    }
  }

  const totals = rows.reduce((sum, row) => {
    sum.pageerrors += row.pageerrors === '0' ? 0 : 1;
    sum.blank += row.blank;
    sum.axeSerious += row.axeSerious;
    sum.axeCritical += row.axeCritical;
    sum.wrongTheme += row.wrongTheme;
    sum.scroll += row.scroll;
    sum.smallTargets += row.smallTargets;
    return sum;
  }, { pageerrors: 0, blank: 0, axeSerious: 0, axeCritical: 0, wrongTheme: 0, scroll: 0, smallTargets: 0 });
  console.log('ROUTE\tTHEME\tPAGEERRORS\tBLANK\tAXE_SERIOUS\tAXE_CRITICAL\tWRONG_THEME\tSCROLL\tSMALL_TARGETS');
  for (const row of rows) {
    console.log([row.route, row.theme, row.pageerrors, row.blank, row.axeSerious, row.axeCritical, row.wrongTheme, row.scroll, row.smallTargets].join('\t'));
  }
  console.log(`AXE_RULES\t${[...axeRules.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => `${id}=${count}`).join(' ')}`);
  console.log(`TOTALS\tpageerror_routes=${totals.pageerrors}\tblank=${totals.blank}\taxe_serious=${totals.axeSerious}\taxe_critical=${totals.axeCritical}\twrong_theme=${totals.wrongTheme}\tscroll_hits=${totals.scroll}\tsmall_targets=${totals.smallTargets}`);
  const failed = [
    ['pageerrors', totals.pageerrors],
    ['axe serious', totals.axeSerious],
    ['axe critical', totals.axeCritical],
    ['wrong-theme', totals.wrongTheme],
    ['horizontal scroll', totals.scroll],
    ['small touch targets', totals.smallTargets],
  ].filter(([, count]) => count > 0);
  if (samples.length) console.log(`SAMPLES\t${samples.slice(0, 25).join('\n')}`);
  if (failed.length) {
    throw new Error(failed.map(([name, count]) => `${name}=${count}`).join(', '));
  }
});
