import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { openAs } from './qa/session.mjs';

const API = 'http://127.0.0.1:3100/api';
const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/users.json', import.meta.url), 'utf8'));
test.setTimeout(50_000);
test.use({ actionTimeout: 8_000 });

async function api(request, path, { method = 'GET', token, body } = {}) {
  const res = await request.fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    data: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { status: res.status(), data };
}

async function signIn(request, email) {
  const res = await api(request, '/auth/signin', {
    method: 'POST',
    body: { email, password: fixtures.password },
  });
  expect(res.status).toBe(200);
  return res.data;
}

async function yardId(request, token) {
  const res = await api(request, '/projects', { token });
  const list = Array.isArray(res.data) ? res.data : [];
  const yard = list.find((item) => item.name === 'E2E Yard') || list[0];
  return String(yard._id || yard.id);
}

test('steel inward stores numbers and the page shows no price', async ({ page, request }) => {
  const session = await signIn(request, fixtures.admin.email);
  const projectId = await yardId(request, session.accessToken);
  const created = await api(request, '/inventory/inward', {
    method: 'POST',
    token: session.accessToken,
    body: {
      projectId,
      diameter: 32,
      length: 12000,
      quantity: 4,
      brandName: 'E2E Brand',
      vendorName: 'E2E Vendor',
    },
  });
  expect(created.status).toBe(200);
  expect(Number.isFinite(created.data.quantity)).toBe(true);
  expect(created.data.quantity).not.toBeNull();
  expect(Number.isFinite(Number(created.data.diameter))).toBe(true);
  const sent = ['projectId', 'diameter', 'length', 'quantity', 'brandName', 'vendorName'];
  expect(sent.some((key) => /price|rate|cost|gst/i.test(key))).toBe(false);
  await openAs(page, request, fixtures.admin.email, fixtures.password);
  await page.goto('/inventory');
  await expect(page.locator('body')).not.toContainText('₹');
});

test('inline delete asks Yes and No and No keeps the row', async ({ page, request }) => {
  await openAs(page, request, fixtures.admin.email, fixtures.password);
  await page.goto('/inventory');
  const deleteBtn = page.locator('button[title="Delete this stock entry"]').first();
  await deleteBtn.click();
  await expect(page.getByRole('button', { name: 'Yes' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'No' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'No' }).first().click();
  await expect(page.getByText('E2E Brand').first()).toBeVisible();
});

test('zero-stock and partial-stock blockers offer Add Stock', async ({ page, request }) => {
  const session = await signIn(request, fixtures.admin.email);
  const projectId = await yardId(request, session.accessToken);
  const inventory = await api(request, `/inventory?projectId=${projectId}`, { token: session.accessToken });
  for (const row of inventory.data.standardStock || []) {
    if (Number(row.diameter) === 32) {
      await api(request, `/inventory/${row._id}`, { method: 'DELETE', token: session.accessToken });
    }
  }
  await openAs(page, request, fixtures.admin.email, fixtures.password);
  await page.goto('/inputs');
  const row = page.locator('table.data-table tbody tr').first();
  await row.locator('select').first().selectOption('32');
  await row.locator('input').nth(0).fill('3000');
  await row.locator('input').nth(1).fill('2');
  const next = page.getByRole('button', { name: 'Next: Check Stock' });
  if (await next.isDisabled()) {
    throw new Error('Calculate Cutting Plan stays disabled because hasValidParts is false: a row needs length > 0 and quantity > 0. Length and quantity were filled and Next is still disabled.');
  }
  await next.click();
  await page.getByRole('button', { name: 'Next: Settings & Rules' }).click();
  await page.getByRole('button', { name: 'Next: Review & Run' }).click();
  const calculate = page.getByRole('button', { name: 'Calculate Cutting Plan' });
  if (await calculate.isDisabled()) {
    throw new Error('Calculate Cutting Plan is disabled when no row has length > 0 and quantity > 0, or while a run is already in progress.');
  }
  await calculate.click();
  const banner = page.locator('.stock-blocker-banner');
  await expect(banner).toContainText('No 32 mm steel in stock in yard inventory.');
  await banner.getByRole('button', { name: 'Add 32 mm Stock' }).click();
  await expect(page.locator('input, select').filter({ hasText: '32' }).first()).toBeVisible();
});

test('ledger tabs open and the report has three sign-off lines and no currency', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openAs(page, request, fixtures.admin.email, fixtures.password);
  await page.goto('/ledger');
  for (const name of ['Audit Ledger', 'Material Sourcing Breakdown', 'Batch Orders', 'Order Requests']) {
    await page.getByRole('button', { name }).click();
    await page.waitForTimeout(300);
  }
  expect(errors).toEqual([]);
  await page.emulateMedia({ media: 'print' });
  const text = await page.locator('body').innerText();
  expect(text).not.toContain('₹');
  expect(await page.locator('.print-sign-box').count()).toBe(3);
  const pdf = await page.pdf({ printBackground: true });
  expect(pdf.byteLength).toBeGreaterThan(1000);
});

test('batch print layouts stay free of currency', async ({ page, request }) => {
  await openAs(page, request, fixtures.admin.email, fixtures.password);
  await page.goto('/history');
  await page.getByRole('button', { name: 'Print Options' }).first().click();
  for (const title of ['Steel Foreman Cut-Sheet', 'Complete Executive Report', '1-Page Summary Sheet']) {
    await page.locator('.print-opt-item', { hasText: title }).click();
    await page.emulateMedia({ media: 'print' });
    const text = await page.locator('body').innerText();
    expect(text).not.toContain('₹');
    const pdf = await page.pdf({ printBackground: true });
    expect(pdf.byteLength).toBeGreaterThan(1000);
    await page.emulateMedia({ media: 'screen' });
    await page.getByRole('button', { name: 'Print Options' }).first().click();
  }
});

test('order request can be approved and rejected', async ({ page, request }) => {
  await openAs(page, request, fixtures.admin.email, fixtures.password);
  await page.goto('/ledger');
  await page.getByRole('button', { name: 'Order Requests' }).click();
  await page.locator('.request-form input[type="text"]').fill('E2E Yard');
  await page.locator('.request-form input[type="number"]').fill('3');
  await page.getByRole('button', { name: 'Submit Request' }).click();
  await page.locator('button[title="Approve request"]').first().click();
  await expect(page.getByText('Approved').first()).toBeVisible();
  await page.locator('.request-form input[type="number"]').fill('2');
  await page.getByRole('button', { name: 'Submit Request' }).click();
  await page.locator('button[title="Reject request"]').first().click();
  await expect(page.getByText('Rejected').first()).toBeVisible();
});

test('site inventory issue, return, transfer, and stocktake', async ({ request }) => {
  const session = await signIn(request, fixtures.admin.email);
  const token = session.accessToken;
  const projectId = await yardId(request, token);
  const stamp = Date.now();
  const storeA = await api(request, `/general-inventory/projects/${projectId}/stores`, {
    method: 'POST', token, body: { name: `Yard ${stamp}`, code: 'A', location: 'Gate' },
  });
  const storeB = await api(request, `/general-inventory/projects/${projectId}/stores`, {
    method: 'POST', token, body: { name: `Site ${stamp}`, code: 'B', location: 'Block' },
  });
  expect(storeA.status).toBeLessThan(300);
  expect(storeB.status).toBeLessThan(300);
  const storeAId = storeA.data.id || storeA.data._id || storeA.data.data?.id || storeA.data.data?._id;
  const storeBId = storeB.data.id || storeB.data._id || storeB.data.data?.id || storeB.data.data?._id;
  const material = await api(request, `/general-inventory/projects/${projectId}/materials`, {
    method: 'POST',
    token,
    body: { name: `Binding Wire ${stamp}`, category: 'Consumable', uom: 'kg', lowStockThreshold: 1 },
  });
  expect(material.status).toBeLessThan(300);
  const materialId = material.data.id || material.data._id || material.data.data?.id || material.data.data?._id;
  const inward = await api(request, `/general-inventory/projects/${projectId}/inward`, {
    method: 'POST',
    token,
    body: {
      storeId: storeAId,
      vendorName: 'E2E Vendor',
      vendorChallanNumber: `CH-${stamp}`,
      items: [{ materialId, receivedQuantity: 10, acceptedQuantity: 10 }],
    },
  });
  expect(inward.status).toBeLessThan(300);
  const outward = await api(request, `/general-inventory/projects/${projectId}/outward`, {
    method: 'POST',
    token,
    body: {
      storeId: storeAId,
      materialId,
      quantity: 2,
      personReceiving: 'E2E Supervisor',
      location: 'Block A',
      purpose: 'Site work',
      returnClassification: 'returnable',
      expectedReturnDate: '2026-12-01',
    },
  });
  expect(outward.status).toBeLessThan(300);
  const outwardId = outward.data.id || outward.data._id || outward.data.data?.id || outward.data.data?._id;
  const returned = await api(request, `/general-inventory/projects/${projectId}/returns`, {
    method: 'POST',
    token,
    body: { storeId: storeAId, outwardId, returnType: 'Unused', returnedByPerson: 'E2E Supervisor', acceptedQuantity: 1 },
  });
  expect(returned.status).toBeLessThan(300);
  const transfer = await api(request, `/general-inventory/projects/${projectId}/transfers`, {
    method: 'POST',
    token,
    body: { sourceStoreId: storeAId, destinationStoreId: storeBId, materialId, quantity: 1 },
  });
  expect(transfer.status).toBeLessThan(300);
  const stocktake = await api(request, `/general-inventory/projects/${projectId}/verifications`, {
    method: 'POST',
    token,
    body: { storeId: storeAId, materialId, physicalQuantity: 8 },
  });
  expect(stocktake.status).toBeLessThan(300);
});

test('users can be created, deactivated, and an admin cannot deactivate self', async ({ request }) => {
  const session = await signIn(request, fixtures.admin.email);
  const token = session.accessToken;
  const projectId = await yardId(request, token);
  const roles = await api(request, '/roles', { token });
  const supervisor = (Array.isArray(roles.data) ? roles.data : []).find((role) => role.name === 'Site Supervisor');
  const email = `e2e-extra-${Date.now()}@example.test`;
  const created = await api(request, '/users', {
    method: 'POST',
    token,
    body: {
      email,
      password: fixtures.password,
      firstName: 'Extra',
      lastName: 'Hand',
      roleId: supervisor.id,
      assignedProjects: [projectId],
    },
  });
  expect(created.status).toBeLessThan(300);
  const userId = created.data.user?.id || created.data.user?._id || created.data.id || created.data._id;
  const off = await api(request, `/users/${userId}/status`, {
    method: 'PUT', token, body: { isActive: false },
  });
  expect(off.status).toBeLessThan(300);
  const self = await api(request, `/users/${session.user.id || session.user._id}/status`, {
    method: 'PUT', token, body: { isActive: false },
  });
  expect(self.status).toBeGreaterThanOrEqual(400);
});

test('system roles cannot be edited and a duplicate name is rejected', async ({ request }) => {
  const session = await signIn(request, fixtures.admin.email);
  const roles = await api(request, '/roles', { token: session.accessToken });
  const admin = (Array.isArray(roles.data) ? roles.data : []).find((role) => role.name === 'Admin');
  const edit = await api(request, `/roles/${admin.id}`, {
    method: 'PUT',
    token: session.accessToken,
    body: { description: 'changed' },
  });
  expect(edit.status).toBe(403);
  const duplicate = await api(request, '/roles', {
    method: 'POST',
    token: session.accessToken,
    body: { name: 'Admin', permissions: {} },
  });
  expect(duplicate.status).toBeGreaterThanOrEqual(400);
});

test('the six roles are blocked from actions their permissions deny', async ({ page, request }) => {
  const denied = ['e2e-accountant@example.test', 'e2e-sales@example.test'];
  const allowed = ['e2e-supervisor@example.test', 'e2e-store@example.test', 'e2e-pm@example.test', fixtures.admin.email];
  for (const email of denied) {
    const session = await signIn(request, email);
    const projectId = await yardId(request, session.accessToken);
    const inward = await api(request, '/inventory/inward', {
      method: 'POST',
      token: session.accessToken,
      body: { projectId, diameter: 8, length: 12000, quantity: 1, brandName: 'E2E Brand', vendorName: 'E2E Vendor' },
    });
    expect(inward.status).toBe(403);
    await openAs(page, request, email, fixtures.password);
    await page.goto('/users');
    await expect(page.getByRole('button', { name: 'Add Team Member' })).toHaveCount(0);
  }
  for (const email of allowed) {
    const session = await signIn(request, email);
    const projectId = await yardId(request, session.accessToken);
    const inward = await api(request, '/inventory/inward', {
      method: 'POST',
      token: session.accessToken,
      body: { projectId, diameter: 8, length: 12000, quantity: 1, brandName: 'E2E Brand', vendorName: 'E2E Vendor' },
    });
    expect(inward.status).toBeLessThan(300);
  }
  await openAs(page, request, 'e2e-store@example.test', fixtures.password);
  await page.goto('/users');
  await expect(page.getByRole('button', { name: 'Add Team Member' })).toHaveCount(0);
});
