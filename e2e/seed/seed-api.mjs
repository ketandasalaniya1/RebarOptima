/**
 * Fixture seed through the local API only. Reads the guarded URI for counts.
 * Test passwords live in e2e/fixtures/users.json and are not printed.
 */
import fs from 'node:fs';
import { MongoClient } from 'mongodb';
import { assertSafeMongoUri } from './guard.mjs';

const API = 'http://127.0.0.1:3100/api';
const fixtures = JSON.parse(fs.readFileSync(new URL('../fixtures/users.json', import.meta.url), 'utf8'));
const password = fixtures.password;

async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`${method} ${pathname} -> ${res.status} ${data?.message || text}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const signup = await api('/auth/signup', {
  method: 'POST',
  body: {
    email: fixtures.admin.email,
    password,
    firstName: fixtures.admin.firstName,
    lastName: fixtures.admin.lastName,
    companyName: 'E2E Yard Co',
    projectName: 'E2E Yard',
  },
});
const token = signup.accessToken;

const project = await api('/projects', {
  method: 'POST',
  token,
  body: {
    name: 'E2E Yard',
    address: 'E2E Test Plot',
    pincode: '380001',
    location: { latitude: 23.0225, longitude: 72.5714 },
    projectType: 'Residential',
  },
});
const projectId = String(project._id);

const roles = await api('/roles', { token });
const roleId = new Map(roles.map((role) => [role.name, role.id]));

const createdUsers = [{ role: 'Admin', email: fixtures.admin.email }];
const userErrors = [];
for (const user of fixtures.users) {
  try {
    await api('/users', {
      method: 'POST',
      token,
      body: {
        email: user.email,
        password,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: roleId.get(user.role),
        assignedProjects: [projectId],
      },
    });
    createdUsers.push({ role: user.role, email: user.email });
  } catch (err) {
    userErrors.push(`${user.role}: ${err.message}`);
  }
}

const stocked = [];
for (const diameter of [8, 10, 12, 16, 20, 25]) {
  const row = await api('/inventory/inward', {
    method: 'POST',
    token,
    body: {
      projectId,
      diameter,
      length: 12000,
      quantity: 10,
      brandName: 'E2E Brand',
      vendorName: 'E2E Vendor',
    },
  });
  stocked.push(row);
}

const bar12 = stocked.find((row) => Number(row.diameter) === 12);
for (const batch of [
  { batchName: 'E2E remnant cut', waste: 2000 },
  { batchName: 'E2E scrap cut', waste: 200 },
]) {
  await api('/batches', {
    method: 'POST',
    token,
    body: {
      batchName: batch.batchName,
      projectId,
      inputStock: [],
      requiredParts: [],
      summary: {},
      layouts: [{
        dbId: bar12._id,
        diameter: 12,
        stockLength: 12000,
        repetition: 1,
        waste: batch.waste,
        isVirtual: false,
      }],
    },
  });
}

const inventory = await api(`/inventory?projectId=${projectId}`, { token });
console.log('SEEDED_USERS');
for (const user of createdUsers) console.log(`${user.role}\t${user.email}`);
if (userErrors.length) {
  console.log('USER_API_ERRORS');
  for (const line of userErrors) console.log(line);
}
console.log('STOCK_TABLE');
console.log('kind\tdiameter\tlength\tquantity\tbrand\tvendor');
for (const row of [...inventory.standardStock, ...inventory.remnantsStock]) {
  console.log([
    row.isRemnant ? 'remnant' : 'standard',
    row.diameter,
    row.length,
    row.quantity,
    row.brandName || '',
    row.vendorName || '',
  ].join('\t'));
}
console.log('DIAMETER_32_ROWS=' + [...inventory.standardStock, ...inventory.remnantsStock].filter((row) => Number(row.diameter) === 32).length);

const uri = assertSafeMongoUri(fs.readFileSync(new URL('../.run-uri', import.meta.url), 'utf8').trim()).uri;
const client = new MongoClient(uri);
await client.connect();
const db = client.db('rebaroptima_e2e');
const names = (await db.listCollections().toArray()).map((item) => item.name).sort();
console.log('COLLECTION_COUNTS');
for (const name of names) {
  const count = await db.collection(name).countDocuments();
  console.log(`${name}\t${count}`);
}
await client.close();
