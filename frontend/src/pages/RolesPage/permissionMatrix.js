/** Module groups for collapsible permission sections */
export const MODULE_GROUPS = [
  {
    id: 'steel',
    label: 'Steel & Cutting',
    modules: ['inventory', 'optimizer', 'history', 'ledger', 'scrapSales'],
  },
  {
    id: 'site',
    label: 'Site Operations',
    modules: ['casting', 'generalInventory', 'pettyCash', 'contractors', 'manpower', 'attendance', 'projectManagement', 'projects', 'drawings', 'reports'],
  },
  {
    id: 'sales',
    label: 'Sales',
    modules: ['crm'],
  },
  {
    id: 'admin',
    label: 'Admin',
    modules: ['overview', 'users', 'roles', 'settings', 'activityLogs'],
  },
];

const CRUD_KEYS = ['view', 'create', 'edit', 'delete'];

/** Map non-standard feature keys onto CRUD columns when appropriate */
const CREATE_ALIASES = new Set(['inward', 'upload']);
const EDIT_ALIASES = new Set(['review']);

/**
 * Split a module's features into CRUD columns + "more".
 * @param {Record<string, string>} features - featureKey -> label from /api/modules
 */
export function splitModuleFeatures(features = {}) {
  const keys = Object.keys(features);
  const crud = { view: null, create: null, edit: null, delete: null };
  const more = [];

  for (const key of keys) {
    if (CRUD_KEYS.includes(key)) {
      crud[key] = key;
    } else if (CREATE_ALIASES.has(key) && !crud.create) {
      crud.create = key;
    } else if (EDIT_ALIASES.has(key) && !crud.edit) {
      crud.edit = key;
    } else {
      more.push(key);
    }
  }

  return { crud, more };
}

/** Pick a unique custom role name that does not collide with existing roles */
export function uniqueCustomRoleName(baseName, existingRoles = []) {
  const names = new Set((existingRoles || []).map((r) => String(r.name || '').toLowerCase()));
  const preferred = `${baseName} (Custom)`;
  if (!names.has(preferred.toLowerCase())) return preferred;
  let i = 2;
  while (names.has(`${baseName} (Custom ${i})`.toLowerCase())) i += 1;
  return `${baseName} (Custom ${i})`;
}

export function emptyPermissionsFromModules(modules = {}) {
  const perms = {};
  for (const mod of Object.keys(modules)) {
    perms[mod] = {};
    for (const feat of Object.keys(modules[mod]?.features || {})) {
      perms[mod][feat] = false;
    }
  }
  return perms;
}

export function permissionsFromRole(role, modules = {}) {
  const perms = emptyPermissionsFromModules(modules);
  const existing = role?.permissions || {};
  for (const mod of Object.keys(perms)) {
    for (const feat of Object.keys(perms[mod])) {
      perms[mod][feat] = existing[mod]?.[feat] === true;
    }
  }
  // Preserve unknown features from role (forward-compat)
  for (const mod of Object.keys(existing)) {
    if (!perms[mod]) perms[mod] = {};
    for (const [feat, allowed] of Object.entries(existing[mod] || {})) {
      if (perms[mod][feat] === undefined) perms[mod][feat] = allowed === true;
    }
  }
  return perms;
}

export function isModuleEnabled(modPerms = {}) {
  return Object.values(modPerms).some(Boolean);
}

export function toggleModule(modules, permissions, modKey, enabled) {
  const features = modules[modKey]?.features || {};
  const next = { ...permissions, [modKey]: { ...permissions[modKey] } };
  for (const feat of Object.keys(features)) {
    next[modKey][feat] = false;
  }
  if (enabled) {
    if (Object.prototype.hasOwnProperty.call(features, 'view')) {
      next[modKey].view = true;
    } else {
      // No view feature — leave enabled state as "any feature" via first feature if needed
      const first = Object.keys(features)[0];
      if (first) next[modKey][first] = true;
    }
  }
  return next;
}

/**
 * Toggle a single feature with View dependency:
 * - Checking any non-view feature ensures view is on (if view exists)
 * - Unchecking view while others are on keeps view on
 */
export function toggleFeature(modules, permissions, modKey, featKey) {
  const features = modules[modKey]?.features || {};
  const hasView = Object.prototype.hasOwnProperty.call(features, 'view');
  const next = {
    ...permissions,
    [modKey]: { ...permissions[modKey], [featKey]: !permissions[modKey]?.[featKey] },
  };

  const turningOn = next[modKey][featKey] === true;

  if (turningOn && featKey !== 'view' && hasView) {
    next[modKey].view = true;
  }

  if (!turningOn && featKey === 'view' && hasView) {
    const othersOn = Object.entries(next[modKey]).some(
      ([k, v]) => k !== 'view' && v === true && Object.prototype.hasOwnProperty.call(features, k)
    );
    if (othersOn) {
      next[modKey].view = true;
    }
  }

  return next;
}

export function groupModules(modules = {}) {
  const assigned = new Set();
  const groups = MODULE_GROUPS.map((g) => {
    const keys = g.modules.filter((m) => modules[m]);
    keys.forEach((k) => assigned.add(k));
    return { ...g, modules: keys };
  }).filter((g) => g.modules.length > 0);

  const leftover = Object.keys(modules).filter((m) => !assigned.has(m));
  if (leftover.length) {
    groups.push({ id: 'other', label: 'Other Modules', modules: leftover });
  }
  return groups;
}

export function formatRelativeTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.round(hr / 24);
  if (day < 60) return `${day} day${day === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}

export function scopeLabel(scope) {
  if (scope === 'project') return 'Assigned Projects Only';
  if (scope === 'own') return 'Own Data Only';
  return 'Entire Organization';
}

export function deepClonePermissions(perms) {
  return JSON.parse(JSON.stringify(perms || {}));
}

export function permissionsEqual(a, b) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

/** Ensure any enabled module keeps view:true when the module defines view */
export function ensureViewForEnabledModules(modules = {}, permissions = {}) {
  const next = deepClonePermissions(permissions);
  for (const mod of Object.keys(modules)) {
    const features = modules[mod]?.features || {};
    if (!Object.prototype.hasOwnProperty.call(features, 'view')) continue;
    if (isModuleEnabled(next[mod])) {
      next[mod] = { ...next[mod], view: true };
    }
  }
  return next;
}
