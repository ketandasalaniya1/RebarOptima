/**
 * Recreate the six local roles and yard stock. Safe to run again:
 * existing accounts, the project, and stock are left in place.
 * Talks to 127.0.0.1:3100 and the guarded URI only.
 */
import fs from 'node:fs';
import { MongoClient } from 'mongodb';
import { assertSafeMongoUri } from './guard.mjs';

const API = 'http://127.0.0.1:3100/api';
const fixtures = JSON.parse(fs.readFileSync(new URL('../fixtures/users.json', import.meta.url), 'utf8'));

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

let token;
try {
  token = (await api('/auth/signin', {
    method: 'POST',
    body: { email: fixtures.admin.email, password: fixtures.password },
  })).accessToken;
  console.log('ADMIN\texisting');
} catch {
  token = (await api('/auth/signup', {
    method: 'POST',
    body: {
      email: fixtures.admin.email,
      password: fixtures.password,
      firstName: fixtures.admin.firstName,
      lastName: fixtures.admin.lastName,
      companyName: 'E2E Yard Co',
      projectName: 'E2E Yard',
    },
  })).accessToken;
  console.log('ADMIN\tcreated');
}

const projects = await api('/projects', { token });
let project = (Array.isArray(projects) ? projects : []).find((item) => item.name === 'E2E Yard');
if (!project) {
  project = await api('/projects', {
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
  console.log('PROJECT\tcreated');
} else {
  console.log('PROJECT\texisting');
}
const projectId = String(project._id || project.id);

const uri = assertSafeMongoUri(fs.readFileSync(new URL('../.run-uri', import.meta.url), 'utf8').trim()).uri;
const client = new MongoClient(uri);
await client.connect();
const db = client.db('rebaroptima_e2e');
const company = await db.collection('companies').findOne({ name: 'E2E Yard Co' });
const basic = await db.collection('subscriptionpackages').findOne({ name: 'BASIC' });
if (!company || !basic) throw new Error('E2E company or BASIC package is missing');
const companyIds = [company._id, String(company._id)];
const updated = await db.collection('subscriptions').updateMany(
  { companyId: { $in: companyIds } },
  { $set: { packageId: basic._id, updatedAt: new Date() } },
);
console.log(`SUBSCRIPTION_UPDATES=${updated.modifiedCount}`);

const roles = await api('/roles', { token });
const roleId = new Map(roles.map((role) => [role.name, role.id]));
for (const user of fixtures.users) {
  try {
    await api('/users', {
      method: 'POST',
      token,
      body: {
        email: user.email,
        password: fixtures.password,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: roleId.get(user.role),
        assignedProjects: [projectId],
      },
    });
    console.log(`USER\tcreated\t${user.role}`);
  } catch (err) {
    if (err.status === 409 || /exist/i.test(err.message)) console.log(`USER\texisting\t${user.role}`);
    else throw err;
  }
}

const inventory = await api(`/inventory?projectId=${projectId}`, { token });
const standard = inventory.standardStock || [];
if (standard.length === 0) {
  const stocked = [];
  for (const diameter of [8, 10, 12, 16, 20, 25]) {
    stocked.push(await api('/inventory/inward', {
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
    }));
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
        layouts: [{ dbId: bar12._id, diameter: 12, stockLength: 12000, repetition: 1, waste: batch.waste, isVirtual: false }],
      },
    });
  }
  console.log('STOCK\tcreated');
} else {
  console.log('STOCK\texisting');
}

const users = await db.collection('users').countDocuments({ companyId: { $in: companyIds } });
const stock = await db.collection('stockitems').countDocuments({ companyId: { $in: companyIds } });
console.log(`USERS=${users}`);
console.log(`STOCK_ROWS=${stock}`);
console.log('DIAMETER_32_ROWS=' + await db.collection('stockitems').countDocuments({ companyId: { $in: companyIds }, diameter: 32 }));
await client.close();
