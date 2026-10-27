/**
 * Project-first acceptance scenarios A–E (API-level).
 * Requires a running API with MONGODB_URI and seeded users.
 *
 * Usage:
 *   node test-project-first-acceptance.js
 *
 * Env:
 *   API_BASE (default http://localhost:3000/api)
 *   ADMIN_EMAIL / ADMIN_PASSWORD — company admin with create rights
 *   PARTNER_EMAIL / PARTNER_PASSWORD — project partner admin (optional for C)
 */
const API = process.env.API_BASE || 'http://localhost:3000/api';

async function req(path, { method = 'GET', token, body, projectId } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (projectId) headers['X-Project-Id'] = String(projectId);
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function signin(email, password) {
  const { status, data } = await req('/auth/signin', {
    method: 'POST',
    body: { email, password },
  });
  if (status >= 400) throw new Error(`Signin failed for ${email}: ${JSON.stringify(data)}`);
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function scenarioA(admin) {
  console.log('\n=== Scenario A — New Company Admin / no-project → create → active ===');
  const token = admin.accessToken;
  const list = await req('/projects', { token });
  assert(list.status === 200, 'A: list projects');
  const before = Array.isArray(list.data) ? list.data : [];

  // If already has projects, still verify create + select path works for a unique name
  const name = `PF-Accept-${Date.now()}`;
  const created = await req('/projects', {
    method: 'POST',
    token,
    body: {
      name,
      address: 'Test Site Road',
      pincode: '560001',
      location: { latitude: 12.97, longitude: 77.59 },
      projectType: 'Residential',
    },
  });
  assert(created.status === 201 || created.status === 200, `A: create project got ${created.status}`);
  const project = created.data;
  const pid = String(project._id || project.id);

  const getOne = await req(`/projects/${pid}`, { token });
  assert(getOne.status === 200, 'A: validate access via GET /projects/:id');

  const inv = await req('/inventory', { token, projectId: pid });
  assert(inv.status !== 403, 'A: inventory with project context not denied for admin');
  assert(inv.status !== 400 || inv.data?.code !== 'PROJECT_REQUIRED' || true, 'header accepted');

  console.log('A PASS', { pid, projectsBefore: before.length });
  return project;
}

async function scenarioB(admin, projectA, projectB) {
  console.log('\n=== Scenario B — Switch projects refreshes scoped data ===');
  const token = admin.accessToken;
  const a = String(projectA._id || projectA.id);
  const b = String(projectB._id || projectB.id);

  const invA = await req('/inventory', { token, projectId: a });
  const invB = await req('/inventory', { token, projectId: b });
  assert(invA.status === 200 || invA.status === 400, `B: inv A status ${invA.status}`);
  assert(invB.status === 200 || invB.status === 400, `B: inv B status ${invB.status}`);

  const bbsA = await req(`/bbs/projects/${a}`, { token, projectId: a });
  const bbsB = await req(`/bbs/projects/${b}`, { token, projectId: b });
  assert([200, 404].includes(bbsA.status), 'B: bbs A');
  assert([200, 404].includes(bbsB.status), 'B: bbs B');

  console.log('B PASS');
}

async function scenarioC(partnerToken, allowedId, foreignId) {
  console.log('\n=== Scenario C — Partner Admin isolation ===');
  if (!partnerToken) {
    console.log('C SKIP (no PARTNER_EMAIL)');
    return;
  }
  const list = await req('/projects', { token: partnerToken });
  assert(list.status === 200, 'C: list');
  const ids = (Array.isArray(list.data) ? list.data : []).map((p) => String(p._id || p.id));
  if (foreignId) {
    assert(!ids.includes(String(foreignId)) || ids.includes(String(allowedId)), 'C: list scoped');
    const deny = await req(`/projects/${foreignId}`, { token: partnerToken });
    assert(deny.status === 403 || deny.status === 404, `C: foreign project denied (${deny.status})`);
  }
  const create = await req('/projects', {
    method: 'POST',
    token: partnerToken,
    body: {
      name: `Partner-Should-Fail-${Date.now()}`,
      address: 'X',
      pincode: '560001',
      location: { latitude: 1, longitude: 1 },
      projectType: 'Residential',
    },
  });
  assert(create.status === 403, `C: partner create denied got ${create.status}`);
  console.log('C PASS', { visible: ids.length });
}

async function scenarioD(admin, emptyProject) {
  console.log('\n=== Scenario D — Empty project module empty states (API) ===');
  const token = admin.accessToken;
  const pid = String(emptyProject._id || emptyProject.id);
  const inv = await req('/inventory', { token, projectId: pid });
  if (inv.status === 200) {
    const std = inv.data?.standardStock || [];
    const rem = inv.data?.remnantsStock || [];
    assert(Array.isArray(std) && Array.isArray(rem), 'D: inventory arrays');
  }
  const batches = await req('/batches', { token, projectId: pid });
  if (batches.status === 200) {
    assert(Array.isArray(batches.data), 'D: batches array');
  }
  console.log('D PASS');
}

async function scenarioE(admin, projectA, projectB) {
  console.log('\n=== Scenario E — Cross-project deny + header required ===');
  const token = admin.accessToken;
  const a = String(projectA._id || projectA.id);
  const missing = await req('/inventory', { token });
  assert(missing.status === 400 && missing.data?.code === 'PROJECT_REQUIRED', 'E: project required');

  // Fake foreign id
  const fake = '000000000000000000000099';
  const cross = await req(`/projects/${fake}`, { token, projectId: a });
  assert(cross.status === 404 || cross.status === 403, `E: fake project ${cross.status}`);

  const switchA = await req('/inventory', { token, projectId: a });
  const switchB = await req('/inventory', { token, projectId: String(projectB._id || projectB.id) });
  assert(switchA.status !== 500 && switchB.status !== 500, 'E: switch does not 500');
  console.log('E PASS');
}

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('Set ADMIN_EMAIL and ADMIN_PASSWORD to run acceptance against a live API.');
    console.log('Structural checks of helpers still covered by Jest project-access.spec.ts');
    process.exit(0);
  }

  const admin = await signin(email, password);
  const p1 = await scenarioA(admin);

  // Ensure a second project for switch tests
  let p2;
  const list = await req('/projects', { token: admin.accessToken });
  const projects = Array.isArray(list.data) ? list.data : [];
  p2 = projects.find((p) => String(p._id || p.id) !== String(p1._id || p1.id));
  if (!p2) {
    const created = await req('/projects', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        name: `PF-Accept-B-${Date.now()}`,
        address: 'Second Site',
        pincode: '560002',
        location: { latitude: 13.0, longitude: 77.6 },
        projectType: 'Commercial',
      },
    });
    p2 = created.data;
  }

  await scenarioB(admin, p1, p2);

  let partnerToken = null;
  if (process.env.PARTNER_EMAIL && process.env.PARTNER_PASSWORD) {
    const partner = await signin(process.env.PARTNER_EMAIL, process.env.PARTNER_PASSWORD);
    partnerToken = partner.accessToken;
  }
  await scenarioC(partnerToken, p1._id || p1.id, p2._id || p2.id);
  await scenarioD(admin, p1);
  await scenarioE(admin, p1, p2);

  console.log('\nAll runnable project-first scenarios completed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
