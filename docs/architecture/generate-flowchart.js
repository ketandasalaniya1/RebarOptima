/**
 * Generates REBAR_OPTIMA_FLOWCHART.excalidraw — detailed system flowchart.
 * Run: node docs/architecture/generate-flowchart.js
 */
const fs = require('fs');
const path = require('path');

let idCounter = 0;
const nid = (prefix = 'el') => `${prefix}_${++idCounter}_${Math.random().toString(36).slice(2, 8)}`;

function rect(x, y, w, h, opts = {}) {
  const id = opts.id || nid('r');
  return {
    id,
    type: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: opts.stroke || '#1e1e1e',
    backgroundColor: opts.fill || '#ffffff',
    fillStyle: 'solid',
    strokeWidth: opts.strokeWidth || 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: opts.groupIds || [],
    frameId: null,
    roundness: { type: 3 },
    seed: Math.floor(Math.random() * 1e9),
    versionNonce: Math.floor(Math.random() * 1e9),
    isDeleted: false,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

function diamond(x, y, w, h, opts = {}) {
  const id = opts.id || nid('d');
  return {
    id,
    type: 'diamond',
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: opts.stroke || '#1e1e1e',
    backgroundColor: opts.fill || '#ffe8cc',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 2 },
    seed: Math.floor(Math.random() * 1e9),
    versionNonce: Math.floor(Math.random() * 1e9),
    isDeleted: false,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

function ellipse(x, y, w, h, opts = {}) {
  const id = opts.id || nid('e');
  return {
    id,
    type: 'ellipse',
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: opts.stroke || '#1e1e1e',
    backgroundColor: opts.fill || '#e3f2fd',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: Math.floor(Math.random() * 1e9),
    versionNonce: Math.floor(Math.random() * 1e9),
    isDeleted: false,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

function textEl(x, y, text, opts = {}) {
  const id = opts.id || nid('t');
  const fontSize = opts.fontSize || 16;
  const lines = String(text).split('\n');
  const width = opts.width || Math.max(...lines.map((l) => l.length)) * fontSize * 0.55 + 8;
  const height = opts.height || lines.length * fontSize * 1.25 + 4;
  return {
    id,
    type: 'text',
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: opts.stroke || '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: Math.floor(Math.random() * 1e9),
    versionNonce: Math.floor(Math.random() * 1e9),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    text,
    fontSize,
    fontFamily: 1,
    textAlign: opts.align || 'center',
    verticalAlign: opts.verticalAlign || 'middle',
    containerId: opts.containerId || null,
    originalText: text,
    autoResize: true,
    lineHeight: 1.25,
  };
}

function labeledBox(x, y, w, h, label, opts = {}) {
  const box = rect(x, y, w, h, opts);
  const t = textEl(x + 8, y + h / 2 - 10, label, {
    fontSize: opts.fontSize || 14,
    containerId: box.id,
    width: w - 16,
    height: h - 16,
    stroke: opts.textColor || '#1e1e1e',
  });
  box.boundElements = [{ id: t.id, type: 'text' }];
  t.x = x;
  t.y = y;
  t.width = w;
  t.height = h;
  return { box, text: t, id: box.id, cx: x + w / 2, cy: y + h / 2, x, y, w, h };
}

function labeledEllipse(x, y, w, h, label, opts = {}) {
  const box = ellipse(x, y, w, h, opts);
  const t = textEl(x, y, label, {
    fontSize: opts.fontSize || 14,
    containerId: box.id,
    width: w,
    height: h,
  });
  box.boundElements = [{ id: t.id, type: 'text' }];
  return { box, text: t, id: box.id, cx: x + w / 2, cy: y + h / 2, x, y, w, h };
}

function labeledDiamond(x, y, w, h, label, opts = {}) {
  const box = diamond(x, y, w, h, opts);
  const t = textEl(x, y, label, {
    fontSize: opts.fontSize || 13,
    containerId: box.id,
    width: w,
    height: h,
  });
  box.boundElements = [{ id: t.id, type: 'text' }];
  return { box, text: t, id: box.id, cx: x + w / 2, cy: y + h / 2, x, y, w, h };
}

function arrow(from, to, opts = {}) {
  const id = nid('a');
  const start = {
    x: from.cx + (opts.fromOffsetX || 0),
    y: from.cy + (opts.fromOffsetY || 0),
  };
  const end = {
    x: to.cx + (opts.toOffsetX || 0),
    y: to.cy + (opts.toOffsetY || 0),
  };

  // Prefer vertical/horizontal routing
  const points = opts.points || [
    [0, 0],
    [end.x - start.x, end.y - start.y],
  ];

  const el = {
    id,
    type: 'arrow',
    x: start.x,
    y: start.y,
    width: Math.abs(points[points.length - 1][0]),
    height: Math.abs(points[points.length - 1][1]),
    angle: 0,
    strokeColor: opts.stroke || '#495057',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: opts.strokeWidth || 2,
    strokeStyle: opts.dashed ? 'dashed' : 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 2 },
    seed: Math.floor(Math.random() * 1e9),
    versionNonce: Math.floor(Math.random() * 1e9),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    startBinding: {
      elementId: from.id,
      focus: 0,
      gap: 4,
    },
    endBinding: {
      elementId: to.id,
      focus: 0,
      gap: 4,
    },
    lastCommittedPoint: null,
    startArrowhead: null,
    endArrowhead: 'arrow',
    points,
  };

  if (!from.box.boundElements) from.box.boundElements = [];
  if (!to.box.boundElements) to.box.boundElements = [];
  from.box.boundElements.push({ id, type: 'arrow' });
  to.box.boundElements.push({ id, type: 'arrow' });

  return el;
}

function sectionFrame(x, y, w, h, title, fill) {
  const frame = rect(x, y, w, h, {
    fill: fill || '#f8f9fa',
    stroke: '#868e8e',
    strokeWidth: 1,
  });
  frame.roundness = { type: 3 };
  const titleEl = textEl(x + 16, y + 12, title, {
    fontSize: 22,
    align: 'left',
    stroke: '#212529',
  });
  return { frame, title: titleEl, elements: [frame, titleEl] };
}

const elements = [];
const push = (...els) => {
  for (const e of els) {
    if (e.box && e.text) {
      elements.push(e.box, e.text);
    } else if (e.elements) {
      elements.push(...e.elements);
    } else {
      elements.push(e);
    }
  }
};

// ========== TITLE ==========
push(
  textEl(40, 20, 'Rebar-Optima — Detailed System Flowchart', {
    fontSize: 36,
    align: 'left',
    stroke: '#087f5b',
  }),
);
push(
  textEl(40, 70, 'Frontend (React) → api.js → Express (main.ts) → MongoDB  |  Open in https://excalidraw.com', {
    fontSize: 16,
    align: 'left',
    stroke: '#495057',
  }),
);

// ========== LEGEND ==========
const legendY = 110;
push(labeledBox(40, legendY, 140, 36, 'Page / UI', { fill: '#a5d8ff' }));
push(labeledBox(200, legendY, 140, 36, 'API client', { fill: '#b2f2bb' }));
push(labeledBox(360, legendY, 140, 36, 'Express route', { fill: '#ffec99' }));
push(labeledBox(520, legendY, 140, 36, 'Service / logic', { fill: '#ffc9c9' }));
push(labeledEllipse(680, legendY - 4, 160, 44, 'MongoDB collection', { fill: '#eebefa' }));
push(labeledBox(860, legendY, 160, 36, 'Docs / migration', { fill: '#ffd8a8' }));
push(labeledDiamond(1040, legendY - 10, 160, 56, 'Decision', { fill: '#ffe8cc' }));

// ========== SECTION 1: AUTH & BOOTSTRAP ==========
const s1 = sectionFrame(40, 180, 2100, 280, '1. Auth & App Bootstrap', '#e7f5ff');
push(s1);

const signIn = labeledBox(80, 240, 160, 50, 'SignInPage', { fill: '#a5d8ff' });
const signUp = labeledBox(80, 310, 160, 50, 'SignUpPage', { fill: '#a5d8ff' });
const saLogin = labeledBox(80, 380, 160, 50, 'SuperadminLogin', { fill: '#a5d8ff' });
push(signIn, signUp, saLogin);

const authApi = labeledBox(320, 270, 160, 50, 'authApi\n/signin /signup', { fill: '#b2f2bb', fontSize: 13 });
const devApi = labeledBox(320, 380, 160, 50, 'developerApi\n/developer/signin', { fill: '#b2f2bb', fontSize: 13 });
push(authApi, devApi);

const authRoutes = labeledBox(560, 250, 200, 70, 'POST /api/auth/signin\nPOST /api/auth/signup\nPOST /api/auth/refresh', {
  fill: '#ffec99',
  fontSize: 12,
});
const devAuth = labeledBox(560, 370, 200, 50, 'POST /api/auth/developer/signin', { fill: '#ffec99', fontSize: 12 });
push(authRoutes, devAuth);

const jwt = labeledBox(840, 270, 160, 50, 'JWT + sessionStorage\naccessToken / refresh', { fill: '#ffc9c9', fontSize: 12 });
push(jwt);

const appBoot = labeledBox(1080, 240, 220, 90, 'App.jsx bootstrap\n1. permissionsApi.getEffective\n2. projectsApi.getAll\n3. validate active project\n4. set X-Project-Id', {
  fill: '#a5d8ff',
  fontSize: 12,
});
push(appBoot);

const hasProject = labeledDiamond(1380, 250, 180, 80, 'Has active\nproject?', { fill: '#ffe8cc' });
push(hasProject);

const overviewGate = labeledBox(1640, 230, 160, 50, '→ Overview / nav', { fill: '#a5d8ff' });
const noProject = labeledBox(1640, 320, 160, 50, '→ NoProjectPage', { fill: '#a5d8ff' });
const subscribe = labeledBox(1640, 390, 160, 50, '→ SubscribePage\n(suspended/expired)', { fill: '#a5d8ff', fontSize: 12 });
push(overviewGate, noProject, subscribe);

push(arrow(signIn, authApi));
push(arrow(signUp, authApi));
push(arrow(saLogin, devApi));
push(arrow(authApi, authRoutes));
push(arrow(devApi, devAuth));
push(arrow(authRoutes, jwt));
push(arrow(jwt, appBoot));
push(arrow(appBoot, hasProject));
push(arrow(hasProject, overviewGate, { fromOffsetY: -10, toOffsetY: 0 }));
push(arrow(hasProject, noProject, { fromOffsetY: 20, toOffsetY: 0 }));

// ========== SECTION 2: FRONTEND SHELL ==========
const s2 = sectionFrame(40, 500, 2100, 420, '2. Frontend Shell — App.jsx · SideNavbar · Redux · Modals', '#fff9db');
push(s2);

const appNode = labeledBox(80, 560, 180, 60, 'App.jsx\nview router (Redux)', { fill: '#a5d8ff' });
const nav = labeledBox(320, 560, 180, 60, 'SideNavbar\nnav items → setView', { fill: '#a5d8ff' });
const crumbs = labeledBox(560, 560, 160, 60, 'Breadcrumbs\nScrollToTop', { fill: '#a5d8ff', fontSize: 13 });
push(appNode, nav, crumbs);

const redux = labeledBox(800, 540, 280, 100, 'Redux store/slices\n• authSlice\n• routingSlice\n• projectSlice\n• permissionsSlice\n• settingsSlice · bbsSlice', {
  fill: '#ffc9c9',
  fontSize: 12,
});
push(redux);

const formModal = labeledBox(1160, 540, 200, 70, 'ProjectFormModal\ncreate/edit + blocks[]', { fill: '#a5d8ff', fontSize: 13 });
const geoModal = labeledBox(1400, 540, 200, 70, 'GeofenceConfigModal\ncircle / polygon', { fill: '#a5d8ff', fontSize: 13 });
const partnerModal = labeledBox(1640, 540, 200, 70, 'AssignPartnerModal\npartner admins', { fill: '#a5d8ff', fontSize: 13 });
push(formModal, geoModal, partnerModal);

push(arrow(appNode, nav));
push(arrow(nav, crumbs));
push(arrow(appNode, redux));
push(arrow(redux, formModal));
push(arrow(formModal, geoModal));
push(arrow(geoModal, partnerModal));

// Pages grid
const pages = [
  ['OverviewPage', 'overview'],
  ['ProjectsPage', 'projects'],
  ['InventoryPage', 'inventory'],
  ['NewBatchPage', 'inputs'],
  ['ResultsPage', 'results'],
  ['BatchHistoryPage', 'history'],
  ['BBSPage (+wizard)', 'bbs'],
  ['CastingPage', 'casting'],
  ['GeneralInventory', 'general-inventory'],
  ['CrmPage', 'crm'],
  ['ProjectMgmtPage', 'project-management'],
  ['DrawingsPage', 'drawings'],
  ['PettyCashPage', 'petty-cash'],
  ['LedgerPage', 'ledger'],
  ['SettingsPage', 'settings'],
  ['UsersPage', 'users'],
  ['RolesPage', 'roles'],
  ['ActivityLogsPage', 'activity-logs'],
  ['ProfilePage', 'profile'],
  ['SuperadminDash', 'superadmin'],
];

const pageNodes = {};
pages.forEach((p, i) => {
  const col = i % 10;
  const row = Math.floor(i / 10);
  const n = labeledBox(80 + col * 200, 680 + row * 80, 180, 55, `${p[0]}\nview: ${p[1]}`, {
    fill: '#a5d8ff',
    fontSize: 12,
  });
  pageNodes[p[1]] = n;
  push(n);
});

push(arrow(nav, pageNodes.overview, { fromOffsetY: 20, toOffsetY: -20 }));
push(arrow(nav, pageNodes.projects, { fromOffsetY: 20, toOffsetY: -20 }));

// ========== SECTION 3: PROJECTS + BLOCKS DETAIL ==========
const s3 = sectionFrame(40, 960, 2100, 520, '3. Projects & Blocks Detail (canonical project_blocks)', '#ebfbee');
push(s3);

const projectsPage = labeledBox(80, 1040, 180, 60, 'ProjectsPage\nlist / select / status', { fill: '#a5d8ff' });
const blocksPanel = labeledBox(320, 1040, 200, 70, 'ProjectBlocksPanel\nCRUD blocks UI\nmax 200 / project', { fill: '#a5d8ff', fontSize: 12 });
const pForm = labeledBox(80, 1160, 180, 60, 'ProjectFormModal\noptional blocks[]', { fill: '#a5d8ff', fontSize: 12 });
push(projectsPage, blocksPanel, pForm);

const projectsApiN = labeledBox(580, 1020, 240, 140, 'projectsApi (api.js)\nGET  /projects\nGET  /projects/:id\nPOST /projects (+blocks)\nPUT  /projects/:id\nPUT  /:id/status\nPUT  /:id/geofences\nPOST /:id/assign-partner\nGET|POST /:id/blocks\nPUT|DEL /:id/blocks/:bid', {
  fill: '#b2f2bb',
  fontSize: 11,
});
push(projectsApiN);

const projectsRoutes = labeledBox(900, 1020, 260, 160, 'projects.routes.ts\ncreateProjectsRouter\nmounted /api/projects\n\n• validateBlocksPayload\n• insertProjectWithBlocks\n• list/create/update/archive\n• assertBlockInProject\n• project-access gates', {
  fill: '#ffec99',
  fontSize: 12,
});
push(projectsRoutes);

const blocksSvc = labeledBox(1240, 1020, 260, 160, 'project-blocks.service.ts\nPROJECT_BLOCKS_COLLECTION\nMAX_BLOCKS=200\nnormalizeBlockName\nensureIndexes\nlist/create/update/archive\nassertBlockInProject\ninsertProjectWithBlocks\n(+ Mongo transaction)', {
  fill: '#ffc9c9',
  fontSize: 12,
});
push(blocksSvc);

const adapter = labeledBox(1240, 1220, 260, 80, 'module-project-adapter.ts\nresolveCanonicalProjectId\nlegacy → orgProjectId bridge\nbbs/casting/crm/gi/doc', {
  fill: '#ffc9c9',
  fontSize: 12,
});
push(adapter);

const access = labeledBox(900, 1220, 260, 80, 'project-access.ts\nresolveUserAndCompany\nassertProjectAccess\nfilterProjectsForUser', {
  fill: '#ffc9c9',
  fontSize: 12,
});
push(access);

const schema = labeledBox(1560, 1020, 200, 70, 'project.schema.ts\nNest schema + blockCount', { fill: '#ffc9c9', fontSize: 12 });
const projectsColl = labeledEllipse(1560, 1120, 200, 60, 'projects', { fill: '#eebefa' });
const blocksColl = labeledEllipse(1800, 1120, 220, 60, 'project_blocks', { fill: '#eebefa' });
const spec = labeledBox(1560, 1220, 200, 70, 'project-blocks.service.spec\nnpm test', { fill: '#ffc9c9', fontSize: 12 });
push(schema, projectsColl, blocksColl, spec);

push(arrow(projectsPage, blocksPanel));
push(arrow(projectsPage, projectsApiN));
push(arrow(blocksPanel, projectsApiN));
push(arrow(pForm, projectsApiN));
push(arrow(projectsApiN, projectsRoutes));
push(arrow(projectsRoutes, blocksSvc));
push(arrow(projectsRoutes, access));
push(arrow(blocksSvc, projectsColl));
push(arrow(blocksSvc, blocksColl));
push(arrow(adapter, projectsColl));
push(arrow(blocksSvc, spec, { dashed: true }));

// ========== SECTION 4: API CLIENT MAP ==========
const s4 = sectionFrame(40, 1520, 2100, 280, '4. Frontend API Clients (utils/api.js) → Backend mounts', '#f3f0ff');
push(s4);

const apiClients = [
  ['authApi', '/api/auth/*'],
  ['permissionsApi', '/api/permissions'],
  ['projectsApi', '/api/projects'],
  ['inventoryApi', '/api/inventory'],
  ['batchesApi', '/api/batches'],
  ['bbsApi', '/api/bbs'],
  ['generalInventoryApi', '/api/general-inventory'],
  ['pettyCashApi', '/api/petty-cash'],
  ['rolesApi', '/api/roles'],
  ['usersApi', '/api/users'],
  ['profileApi', '/api/users/me'],
  ['activityLogsApi', '/api/activity-logs'],
  ['developerApi', '/api/developer'],
  ['companyApi', '/api/companies'],
  ['publicApi', '/api/public'],
];

const apiNodes = {};
apiClients.forEach((c, i) => {
  const col = i % 8;
  const row = Math.floor(i / 8);
  const n = labeledBox(80 + col * 250, 1600 + row * 80, 230, 55, `${c[0]}\n→ ${c[1]}`, {
    fill: '#b2f2bb',
    fontSize: 12,
  });
  apiNodes[c[0]] = n;
  push(n);
});

push(
  textEl(80, 1760, 'apiRequest: Bearer JWT + X-Project-Id (skip for /projects, /auth) · auto refresh on 401', {
    fontSize: 14,
    align: 'left',
    stroke: '#5f3dc4',
  }),
);

// ========== SECTION 5: BACKEND EXPRESS ==========
const s5 = sectionFrame(40, 1840, 2100, 420, '5. Backend Express Entry — main.ts routers & inline routes', '#fff4e6');
push(s5);

const mainTs = labeledBox(80, 1920, 220, 80, 'main.ts\nExpress + Nest hybrid\nJSON 50mb · CORS\n/api/health', { fill: '#ffec99', fontSize: 13 });
push(mainTs);

const routers = [
  ['/api/projects', 'createProjectsRouter'],
  ['/api/bbs', 'createBBSRouter'],
  ['/api/casting', 'createCastingRouter'],
  ['/api/general-inventory', 'GI router'],
  ['/api/crm', 'CRM master router'],
  ['/api/drawings', 'Drawings router'],
  ['/api/petty-cash', 'PettyCash router'],
  ['/api/pm', 'PM master router'],
];

const routerNodes = {};
routers.forEach((r, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const n = labeledBox(360 + col * 420, 1920 + row * 90, 380, 70, `${r[0]}\n${r[1]}`, {
    fill: '#ffec99',
    fontSize: 13,
  });
  routerNodes[r[0]] = n;
  push(n);
  push(arrow(mainTs, n));
});

const inline = labeledBox(80, 2140, 1980, 90, 'Inline in main.ts: /api/auth/* · /api/permissions/effective · /api/roles · /api/users · /api/inventory/* · /api/batches/* · /api/activity-logs · /api/developer/* · /api/modules · /api/companies/storage\nMiddleware: authMiddleware · adminMiddleware · developerAuthMiddleware · requirePermission(module, action) · X-Project-Id validation', {
  fill: '#ffec99',
  fontSize: 13,
});
push(inline);
push(arrow(mainTs, inline));

// ========== SECTION 6: MODULE DATA + MONGODB ==========
const s6 = sectionFrame(40, 2300, 2100, 380, '6. MongoDB Collections & Project Scope (PROJECT_DATA_SCOPE_MATRIX)', '#f8f0fc');
push(s6);

const colls = [
  ['projects', 'canonical'],
  ['project_blocks', 'canonical blocks'],
  ['stockitems', 'steel inventory'],
  ['batches', 'optimizer'],
  ['bbs_projects', 'legacy→orgProjectId'],
  ['bbs_blocks', 'bridge orgBlockId'],
  ['casting_projects', 'legacy'],
  ['casting_blocks', 'legacy'],
  ['crm_projects', 'legacy'],
  ['crm_units', 'tower→blockId'],
  ['gi_projects', 'legacy'],
  ['doc_projects', 'legacy'],
  ['doc_drawings', 'drawings'],
  ['users', 'company + ACL'],
  ['roles', 'permissions'],
  ['companies', 'tenants'],
  ['activity_logs', 'audit'],
  ['scrap_rules', 'company'],
];

colls.forEach((c, i) => {
  const col = i % 6;
  const row = Math.floor(i / 6);
  const n = labeledEllipse(80 + col * 340, 2380 + row * 90, 300, 60, `${c[0]}\n${c[1]}`, {
    fill: '#eebefa',
    fontSize: 12,
  });
  push(n);
});

// ========== SECTION 7: MODULE FLOWS ==========
const s7 = sectionFrame(40, 2720, 2100, 360, '7. Module Feature Flows (high-level)', '#e6fcf5');
push(s7);

const steel = labeledBox(80, 2800, 320, 100, 'Steel Optimizer\nInventoryPage → inventoryApi\nNewBatchPage → batchesApi.optimize\nResultsPage → commitBatch\nBatchHistory → history/delete', {
  fill: '#a5d8ff',
  fontSize: 12,
});
const bbs = labeledBox(440, 2800, 320, 100, 'BBS\nBbsProjects/Dashboard/Wizard\nShapes · Reports · CAD\nbbsApi → /api/bbs\nuses global projectId', {
  fill: '#a5d8ff',
  fontSize: 12,
});
const casting = labeledBox(800, 2800, 320, 100, 'Casting\nHierarchy · Events · Recipes\nStock · Consumption · Quality\n/api/casting\nadapter resolves project', {
  fill: '#a5d8ff',
  fontSize: 12,
});
const crm = labeledBox(1160, 2800, 320, 100, 'CRM\nLeads · Units · Bookings\nCustomers · Visits · Payments\n/api/crm\ntowers → future blockId', {
  fill: '#a5d8ff',
  fontSize: 12,
});
const other = labeledBox(1520, 2800, 500, 100, 'Also: General Inventory (/api/general-inventory)\nDrawings (/api/drawings) · PM (/api/pm)\nPetty Cash · Users/Roles · Activity Logs · Settings', {
  fill: '#a5d8ff',
  fontSize: 12,
});
push(steel, bbs, casting, crm, other);

const steelApi = labeledBox(80, 2950, 320, 60, '→ /api/inventory + /api/batches', { fill: '#ffec99', fontSize: 13 });
const bbsApiR = labeledBox(440, 2950, 320, 60, '→ /api/bbs', { fill: '#ffec99', fontSize: 13 });
const castApi = labeledBox(800, 2950, 320, 60, '→ /api/casting', { fill: '#ffec99', fontSize: 13 });
const crmApi = labeledBox(1160, 2950, 320, 60, '→ /api/crm', { fill: '#ffec99', fontSize: 13 });
push(steelApi, bbsApiR, castApi, crmApi);
push(arrow(steel, steelApi));
push(arrow(bbs, bbsApiR));
push(arrow(casting, castApi));
push(arrow(crm, crmApi));

// ========== SECTION 8: MIGRATION ==========
const s8 = sectionFrame(40, 3120, 2100, 380, '8. Block Unification Migration (docs/migrations)', '#fff0f6');
push(s8);

const runbook = labeledBox(80, 3200, 280, 80, 'BLOCK_UNIFICATION\n_RUNBOOK.md\nphases + safety gates', { fill: '#ffd8a8', fontSize: 13 });
const invScript = labeledBox(420, 3200, 280, 80, 'block-migration-\ninventory.js\nread-only inventory', { fill: '#ffd8a8', fontSize: 13 });
const blockReport = labeledBox(760, 3200, 280, 80, 'block-mapping-\nreport.json', { fill: '#ffd8a8', fontSize: 13 });
const projReport = labeledBox(1100, 3200, 280, 80, 'project-mapping-\nreport.json', { fill: '#ffd8a8', fontSize: 13 });
const matrix = labeledBox(1440, 3200, 280, 80, 'PROJECT_DATA_\nSCOPE_MATRIX.md', { fill: '#ffd8a8', fontSize: 13 });
const ux = labeledBox(1780, 3200, 240, 80, 'UX_AUDIT_\nREBAROPTIMA.md', { fill: '#ffd8a8', fontSize: 12 });
push(runbook, invScript, blockReport, projReport, matrix, ux);

const phase0 = labeledBox(80, 3340, 300, 70, '0. Verify Express live API\n(not Nest for runtime)', { fill: '#ffc9c9', fontSize: 12 });
const phase1 = labeledBox(420, 3340, 300, 70, '1. Inventory dry-run\norphan / dup / CRM towers', { fill: '#ffc9c9', fontSize: 12 });
const phase2 = labeledBox(760, 3340, 300, 70, '2. Create project_blocks\nvia API / approved seed', { fill: '#ffc9c9', fontSize: 12 });
const phase3 = labeledBox(1100, 3340, 300, 70, '3. Bridge orgBlockId\n(approval-gated)', { fill: '#ffc9c9', fontSize: 12 });
const phase4 = labeledBox(1440, 3340, 300, 70, '4. Remap children FKs\n(destructive, gated)', { fill: '#ffc9c9', fontSize: 12 });
const phase5 = labeledBox(1780, 3340, 240, 70, '5. Rollback paths\n/ Atlas restore', { fill: '#ffc9c9', fontSize: 12 });
push(phase0, phase1, phase2, phase3, phase4, phase5);

push(arrow(runbook, invScript));
push(arrow(invScript, blockReport));
push(arrow(runbook, phase0));
push(arrow(phase0, phase1));
push(arrow(phase1, phase2));
push(arrow(phase2, phase3));
push(arrow(phase3, phase4));
push(arrow(phase4, phase5));
push(arrow(phase2, blocksColl, { dashed: true, fromOffsetY: -200, toOffsetY: 200 }));

// ========== SECTION 9: END-TO-END SEQUENCE ==========
const s9 = sectionFrame(40, 3540, 2100, 280, '9. End-to-End: Create Project with Blocks', '#edf2ff');
push(s9);

const seq = [
  ['User opens\nProjectsPage', '#a5d8ff'],
  ['Open\nProjectFormModal', '#a5d8ff'],
  ['Submit name+\naddress+blocks[]', '#a5d8ff'],
  ['projectsApi\n.create()', '#b2f2bb'],
  ['POST\n/api/projects', '#ffec99'],
  ['validate +\ninsertProjectWithBlocks', '#ffc9c9'],
  ['Mongo txn:\nprojects +\nproject_blocks', '#eebefa'],
  ['UI refresh +\nProjectBlocksPanel', '#a5d8ff'],
];

const seqNodes = seq.map((s, i) => {
  const n = labeledBox(80 + i * 255, 3640, 230, 80, s[0], { fill: s[1], fontSize: 12 });
  push(n);
  return n;
});
for (let i = 0; i < seqNodes.length - 1; i++) {
  push(arrow(seqNodes[i], seqNodes[i + 1]));
}

push(
  textEl(40, 3860, 'Generated from repo structure · Open this file in Excalidraw (File → Open) or drag onto https://excalidraw.com', {
    fontSize: 14,
    align: 'left',
    stroke: '#868e8e',
  }),
);

const doc = {
  type: 'excalidraw',
  version: 2,
  source: 'https://excalidraw.com',
  elements,
  appState: {
    gridSize: null,
    viewBackgroundColor: '#ffffff',
    currentItemFontFamily: 1,
  },
  files: {},
};

const out = path.join(__dirname, 'REBAR_OPTIMA_FLOWCHART.excalidraw');
fs.writeFileSync(out, JSON.stringify(doc, null, 2));
console.log(`Wrote ${out}`);
console.log(`Elements: ${elements.length}`);
