import { test, expect } from '@playwright/test';

const API = 'http://127.0.0.1:3100/api';
const PASSWORD = 'E2e-Restore-1!';

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
  const data = text ? JSON.parse(text) : null;
  if (!res.ok()) throw new Error(`${method} ${path} ${res.status()} ${data?.message || text}`);
  return data;
}

function stockOf(inventory, diameter, remnant) {
  const rows = remnant ? inventory.remnantsStock : inventory.standardStock;
  return rows.filter((row) => Number(row.diameter) === diameter);
}

test('delete report-only leaves stock, restore puts it back', async ({ request }) => {
  const stamp = Date.now();
  const signup = await api(request, '/auth/signup', {
    method: 'POST',
    body: {
      email: `e2e-restore-${stamp}@example.test`,
      password: PASSWORD,
      firstName: 'Restore',
      lastName: 'Admin',
      companyName: 'E2E Restore Co',
      projectName: 'E2E Restore Yard',
    },
  });
  const token = signup.accessToken;
  const project = await api(request, '/projects', {
    method: 'POST',
    token,
    body: {
      name: 'E2E Restore Yard',
      address: 'E2E Restore Plot',
      pincode: '380001',
      location: { latitude: 23.03, longitude: 72.58 },
      projectType: 'Residential',
    },
  });
  const projectId = String(project._id);
  const inward = await api(request, '/inventory/inward', {
    method: 'POST',
    token,
    body: {
      projectId,
      diameter: 12,
      length: 12000,
      quantity: 10,
      brandName: 'E2E Brand',
      vendorName: 'E2E Vendor',
    },
  });

  const scrap = await api(request, '/batches', {
    method: 'POST',
    token,
    body: {
      batchName: `E2E scrap ${stamp}`,
      projectId,
      inputStock: [],
      requiredParts: [],
      summary: {},
      layouts: [{ dbId: inward._id, diameter: 12, stockLength: 12000, repetition: 1, waste: 200, isVirtual: false }],
    },
  });
  const remnant = await api(request, '/batches', {
    method: 'POST',
    token,
    body: {
      batchName: `E2E remnant ${stamp}`,
      projectId,
      inputStock: [],
      requiredParts: [],
      summary: {},
      layouts: [{ dbId: inward._id, diameter: 12, stockLength: 12000, repetition: 1, waste: 2000, isVirtual: false }],
    },
  });

  const before = await api(request, `/inventory?projectId=${projectId}`, { token });
  const beforeLedger = await api(request, `/inventory/ledger?projectId=${projectId}`, { token });
  expect(stockOf(before, 12, false).reduce((sum, row) => sum + row.quantity, 0)).toBe(8);
  expect(stockOf(before, 12, true).reduce((sum, row) => sum + row.quantity, 0)).toBe(1);
  expect(beforeLedger.filter((row) => row.referenceName === scrap.batchName).length).toBeGreaterThan(0);
  expect(beforeLedger.filter((row) => row.referenceName === remnant.batchName).length).toBeGreaterThan(0);

  const reportOnly = await api(request, `/batches/${scrap._id}?restoreStock=false`, { method: 'DELETE', token });
  expect(reportOnly).toEqual({ deleted: true, restored: false });
  const afterReport = await api(request, `/inventory?projectId=${projectId}`, { token });
  const afterReportLedger = await api(request, `/inventory/ledger?projectId=${projectId}`, { token });
  expect(stockOf(afterReport, 12, false).reduce((sum, row) => sum + row.quantity, 0)).toBe(8);
  expect(stockOf(afterReport, 12, true).reduce((sum, row) => sum + row.quantity, 0)).toBe(1);
  expect(afterReportLedger.filter((row) => row.referenceName === scrap.batchName).length).toBeGreaterThan(0);

  const restored = await api(request, `/batches/${remnant._id}?restoreStock=true`, { method: 'DELETE', token });
  expect(restored.deleted).toBe(true);
  expect(restored.restored).toBe(true);
  expect(restored.remnantShortfalls).toEqual([]);
  const afterRestore = await api(request, `/inventory?projectId=${projectId}`, { token });
  const afterRestoreLedger = await api(request, `/inventory/ledger?projectId=${projectId}`, { token });
  expect(stockOf(afterRestore, 12, false).reduce((sum, row) => sum + row.quantity, 0)).toBe(9);
  expect(stockOf(afterRestore, 12, true)).toEqual([]);
  expect(afterRestoreLedger.filter((row) => row.referenceName === remnant.batchName)).toEqual([]);
  expect(afterRestoreLedger.filter((row) => row.referenceName === scrap.batchName).length).toBeGreaterThan(0);

  const inward16 = await api(request, '/inventory/inward', {
    method: 'POST',
    token,
    body: { projectId, diameter: 16, length: 12000, quantity: 4, brandName: 'E2E Brand', vendorName: 'E2E Vendor' },
  });
  const first = await api(request, '/batches', {
    method: 'POST',
    token,
    body: {
      batchName: `E2E first remnant ${stamp}`,
      projectId,
      inputStock: [],
      requiredParts: [],
      summary: {},
      layouts: [{ dbId: inward16._id, diameter: 16, stockLength: 12000, repetition: 1, waste: 2000, isVirtual: false }],
    },
  });
  const made = await api(request, `/inventory?projectId=${projectId}`, { token });
  const remnantRow = stockOf(made, 16, true)[0];
  await api(request, '/batches', {
    method: 'POST',
    token,
    body: {
      batchName: `E2E later cut ${stamp}`,
      projectId,
      inputStock: [],
      requiredParts: [],
      summary: {},
      layouts: [{ dbId: remnantRow._id, diameter: 16, stockLength: 2000, repetition: 1, waste: 100, isVirtual: false }],
    },
  });
  const consumed = await api(request, `/batches/${first._id}?restoreStock=true`, { method: 'DELETE', token });
  expect(consumed.restored).toBe(true);
  expect(consumed.remnantShortfalls).toEqual([
    { diameter: 16, length: 2000, requested: 1, restored: 0, alreadyUsed: 1 },
  ]);
  const finalStock = await api(request, `/inventory?projectId=${projectId}`, { token });
  expect(stockOf(finalStock, 16, true)).toEqual([]);
  expect(stockOf(finalStock, 16, false).reduce((sum, row) => sum + row.quantity, 0)).toBe(4);
});
