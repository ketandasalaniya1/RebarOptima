/**
 * Raise the e2e company's user limit, then create the three roles the FREE cap blocked.
 * The subscription write stays on the guarded rebaroptima_e2e URI. Users go through the API.
 */
import fs from 'node:fs';
import { MongoClient } from 'mongodb';
import { assertSafeMongoUri } from './guard.mjs';

const API = 'http://127.0.0.1:3100/api';
const fixtures = JSON.parse(fs.readFileSync(new URL('../fixtures/users.json', import.meta.url), 'utf8'));
const wanted = ['Store Keeper', 'Accountant', 'Sales Executive'];

const uri = assertSafeMongoUri(fs.readFileSync(new URL('../.run-uri', import.meta.url), 'utf8').trim()).uri;
const client = new MongoClient(uri);
await client.connect();
const db = client.db('rebaroptima_e2e');
const company = await db.collection('companies').findOne({ name: 'E2E Yard Co' });
const basic = await db.collection('subscriptionpackages').findOne({ name: 'BASIC' });
if (!company || !basic) throw new Error('E2E company or BASIC package is missing');
const companyIds = [company._id, String(company._id)];
const updated = await db.collection('subscriptions').updateMany(
  { companyId: { $in: companyIds }, status: { $in: ['active', 'trial'] } },
  { $set: { packageId: basic._id, updatedAt: new Date() } },
);
console.log(`SUBSCRIPTION_UPDATES=${updated.modifiedCount} PACKAGE=BASIC MAX_USERS=${basic.limits.maxUsers}`);

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
  if (!res.ok) throw new Error(`${method} ${pathname} -> ${res.status} ${data?.message || text}`);
  return data;
}

const session = await api('/auth/signin', {
  method: 'POST',
  body: { email: fixtures.admin.email, password: fixtures.password },
});
const token = session.accessToken;
const roles = await api('/roles', { token });
const roleId = new Map(roles.map((role) => [role.name, role.id]));
const project = await db.collection('projects').findOne({ name: 'E2E Yard', companyId: { $in: companyIds } });
const projectId = String(project._id);

for (const roleName of wanted) {
  const user = fixtures.users.find((item) => item.role === roleName);
  await api('/users', {
    method: 'POST',
    token,
    body: {
      email: user.email,
      password: fixtures.password,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: roleId.get(roleName),
      assignedProjects: [projectId],
    },
  });
  console.log(`CREATED\t${roleName}\t${user.email}`);
}

const names = (await db.listCollections().toArray()).map((item) => item.name).sort();
console.log('COLLECTION_COUNTS');
for (const name of names) {
  console.log(`${name}\t${await db.collection(name).countDocuments()}`);
}
const stock = await db.collection('stockitems').find({}).sort({ diameter: 1, length: 1 }).toArray();
console.log('STOCK_TABLE');
console.log('kind\tdiameter\tlength\tquantity');
for (const row of stock) {
  console.log([row.isRemnant ? 'remnant' : 'standard', row.diameter, row.length, row.quantity].join('\t'));
}
console.log('DIAMETER_32_ROWS=' + stock.filter((row) => Number(row.diameter) === 32).length);
console.log('USERS=' + await db.collection('users').countDocuments());
await client.close();
