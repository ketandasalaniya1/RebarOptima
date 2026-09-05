import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoClient, Db, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { solve1DCSP } from './batches/optimizer.engine';

dotenv.config();

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── DB ──────────────────────────────────────────────────────────────────────
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rebaroptima';
let client: MongoClient | null = null;
let db: Db | null = null;

async function connectDB(): Promise<Db> {
  if (!db) {
    try {
      client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
      await client.connect();
      db = client.db();
      console.log('✅ Connected to MongoDB');
    } catch (err: any) {
      client = null; db = null;
      if (err?.message?.includes('querySrv') || err?.message?.includes('ECONNREFUSED') || err?.message?.includes('ENOTFOUND')) {
        throw new Error('Cannot reach MongoDB Atlas. Check: (1) cluster not paused, (2) IP whitelisted.');
      }
      throw err;
    }
  }
  return db as Db;
}

function toObjectId(id: any): ObjectId | null {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (typeof id === 'object' && (id._bsontype === 'ObjectId' || id._bsontype === 'ObjectID')) return id;
  const str = String(id).trim();
  if (ObjectId.isValid(str) && str.length === 24) {
    try {
      return new ObjectId(str);
    } catch {
      return null;
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// MODULE & FEATURE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════
const PLATFORM_MODULES: Record<string, { displayName: string; features: Record<string, string> }> = {
  overview: {
    displayName: 'Overview / Dashboard',
    features: { view: 'View Dashboard', export: 'Export Reports' }
  },
  inventory: {
    displayName: 'Inventory',
    features: { view: 'View Stock', inward: 'Add Stock (Inward)', edit: 'Edit Stock', delete: 'Delete Stock', export: 'Export Inventory' }
  },
  optimizer: {
    displayName: 'Run Optimizer',
    features: { view: 'View Optimizer', create: 'Run Optimization' }
  },
  history: {
    displayName: 'Batch History',
    features: { view: 'View History', edit: 'Edit Batch', delete: 'Delete Batch', export: 'Export History' }
  },
  ledger: {
    displayName: 'Ledger & Orders',
    features: { view: 'View Ledger', export: 'Export Ledger' }
  },
  scrapSales: {
    displayName: 'Scrap Sales',
    features: { view: 'View Scrap Sales', create: 'Create Scrap Sale', edit: 'Edit Scrap Sale', delete: 'Delete Scrap Sale' }
  },
  activityLogs: {
    displayName: 'Activity Logs & Audit',
    features: { view: 'View Activity Logs', export: 'Export Logs' }
  },
  settings: {
    displayName: 'Settings',
    features: { view: 'View Settings', edit: 'Edit Settings' }
  },
  users: {
    displayName: 'User Management',
    features: { view: 'View Users', create: 'Create Users', edit: 'Edit Users', delete: 'Deactivate Users' }
  },
  roles: {
    displayName: 'Roles & Permissions',
    features: { view: 'View Roles', create: 'Create Roles', edit: 'Edit Roles', delete: 'Delete Roles' }
  }
};

// Default System Roles with permissions
function buildFullPermissions(): Record<string, Record<string, boolean>> {
  const perms: Record<string, Record<string, boolean>> = {};
  for (const [mod, def] of Object.entries(PLATFORM_MODULES)) {
    perms[mod] = {};
    for (const feat of Object.keys(def.features)) {
      perms[mod][feat] = true;
    }
  }
  return perms;
}

const DEFAULT_SYSTEM_ROLES = [
  {
    name: 'Admin',
    description: 'Full access to all modules and features within the organization',
    permissions: buildFullPermissions(),
    dataScope: 'organization'
  },
  {
    name: 'Project Manager',
    description: 'Manages projects, inventory, optimization, and team operations',
    permissions: {
      overview: { view: true, export: true },
      inventory: { view: true, inward: true, edit: true, delete: true, export: true },
      optimizer: { view: true, create: true },
      history: { view: true, edit: true, delete: true, export: true },
      ledger: { view: true, export: true },
      scrapSales: { view: true, create: true, edit: true, delete: true },
      activityLogs: { view: true, export: true },
      settings: { view: true, edit: true },
      users: { view: true },
      roles: { view: true }
    },
    dataScope: 'organization'
  },
  {
    name: 'Senior Site Engineer',
    description: 'Senior engineer with access to inventory, optimization, and batch history',
    permissions: {
      overview: { view: true, export: true },
      inventory: { view: true, inward: true, edit: true, delete: false, export: true },
      optimizer: { view: true, create: true },
      history: { view: true, edit: true, delete: false, export: true },
      ledger: { view: true, export: true },
      scrapSales: { view: true, create: true, edit: true, delete: false },
      activityLogs: { view: true, export: false },
      settings: { view: true, edit: false },
      users: { view: false },
      roles: { view: false }
    },
    dataScope: 'project'
  },
  {
    name: 'Junior Site Engineer',
    description: 'Junior engineer with basic access to view and run optimizer',
    permissions: {
      overview: { view: true, export: false },
      inventory: { view: true, inward: true, edit: false, delete: false, export: false },
      optimizer: { view: true, create: true },
      history: { view: true, edit: false, delete: false, export: false },
      ledger: { view: true, export: false },
      scrapSales: { view: true, create: false, edit: false, delete: false },
      activityLogs: { view: false, export: false },
      settings: { view: true, edit: false },
      users: { view: false },
      roles: { view: false }
    },
    dataScope: 'project'
  },
  {
    name: 'Site Supervisor',
    description: 'Supervisor with inventory and batch monitoring access',
    permissions: {
      overview: { view: true, export: false },
      inventory: { view: true, inward: true, edit: false, delete: false, export: false },
      optimizer: { view: true, create: false },
      history: { view: true, edit: false, delete: false, export: false },
      ledger: { view: true, export: false },
      scrapSales: { view: true, create: false, edit: false, delete: false },
      activityLogs: { view: false, export: false },
      settings: { view: false, edit: false },
      users: { view: false },
      roles: { view: false }
    },
    dataScope: 'project'
  },
  {
    name: 'Accountant',
    description: 'Financial operations including ledger and scrap sales management',
    permissions: {
      overview: { view: true, export: true },
      inventory: { view: true, inward: false, edit: false, delete: false, export: true },
      optimizer: { view: false, create: false },
      history: { view: true, edit: false, delete: false, export: true },
      ledger: { view: true, export: true },
      scrapSales: { view: true, create: true, edit: true, delete: true },
      activityLogs: { view: true, export: true },
      settings: { view: true, edit: false },
      users: { view: false },
      roles: { view: false }
    },
    dataScope: 'organization'
  },
  {
    name: 'Sales Executive',
    description: 'Sales operations with ledger and basic overview access',
    permissions: {
      overview: { view: true, export: false },
      inventory: { view: true, inward: false, edit: false, delete: false, export: false },
      optimizer: { view: false, create: false },
      history: { view: true, edit: false, delete: false, export: false },
      ledger: { view: true, export: true },
      scrapSales: { view: true, create: true, edit: true, delete: false },
      activityLogs: { view: false, export: false },
      settings: { view: false, edit: false },
      users: { view: false },
      roles: { view: false }
    },
    dataScope: 'organization'
  },
  {
    name: 'Purchase Manager',
    description: 'Procurement and inventory management operations',
    permissions: {
      overview: { view: true, export: true },
      inventory: { view: true, inward: true, edit: true, delete: true, export: true },
      optimizer: { view: true, create: false },
      history: { view: true, edit: false, delete: false, export: true },
      ledger: { view: true, export: true },
      scrapSales: { view: true, create: false, edit: false, delete: false },
      activityLogs: { view: true, export: false },
      settings: { view: true, edit: false },
      users: { view: false },
      roles: { view: false }
    },
    dataScope: 'organization'
  },
  {
    name: 'Store Keeper',
    description: 'Store operations with full inventory management access',
    permissions: {
      overview: { view: true, export: false },
      inventory: { view: true, inward: true, edit: true, delete: true, export: true },
      optimizer: { view: false, create: false },
      history: { view: true, edit: false, delete: false, export: false },
      ledger: { view: true, export: false },
      scrapSales: { view: true, create: false, edit: false, delete: false },
      activityLogs: { view: false, export: false },
      settings: { view: false, edit: false },
      users: { view: false },
      roles: { view: false }
    },
    dataScope: 'project'
  }
];

const DEFAULT_SUBSCRIPTION_PACKAGES = [
  {
    name: 'FREE',
    displayName: 'Free',
    description: 'Basic access for small teams getting started',
    modules: { overview: true, inventory: true, optimizer: true, history: true, ledger: true, scrapSales: true, activityLogs: true, settings: true, users: true, roles: false },
    features: {},
    limits: { maxUsers: 3, maxProjects: 1, maxStorageMB: 100 },
    isActive: true
  },
  {
    name: 'BASIC',
    displayName: 'Basic',
    description: 'Essential features for growing construction firms',
    modules: { overview: true, inventory: true, optimizer: true, history: true, ledger: true, scrapSales: true, activityLogs: true, settings: true, users: true, roles: false },
    features: {},
    limits: { maxUsers: 10, maxProjects: 5, maxStorageMB: 500 },
    isActive: true
  },
  {
    name: 'PRO',
    displayName: 'Professional',
    description: 'Full-featured plan for professional construction management',
    modules: { overview: true, inventory: true, optimizer: true, history: true, ledger: true, scrapSales: true, activityLogs: true, settings: true, users: true, roles: true },
    features: {},
    limits: { maxUsers: 50, maxProjects: 25, maxStorageMB: 5000 },
    isActive: true
  },
  {
    name: 'ENTERPRISE',
    displayName: 'Enterprise',
    description: 'Unlimited access with priority support for large organizations',
    modules: { overview: true, inventory: true, optimizer: true, history: true, ledger: true, scrapSales: true, activityLogs: true, settings: true, users: true, roles: true },
    features: {},
    limits: { maxUsers: null, maxProjects: null, maxStorageMB: null },
    isActive: true
  }
];

// ══════════════════════════════════════════════════════════════════════════════
// AUTH HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'fallback-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';

function generateTokens(userId: string, email: string, role: string, accountType: 'developer' | 'user' = 'user') {
  const accessToken = jwt.sign(
    { sub: userId, email, role, accountType },
    ACCESS_SECRET,
    { expiresIn: (process.env.ACCESS_TOKEN_EXPIRATION || '15m') as any }
  );
  const refreshToken = jwt.sign(
    { sub: userId, accountType },
    REFRESH_SECRET,
    { expiresIn: (process.env.REFRESH_TOKEN_EXPIRATION || '7d') as any }
  );
  return { accessToken, refreshToken };
}

// Standard user auth middleware
function authMiddleware(req: any, res: any, next: any) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, ACCESS_SECRET) as any;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Developer-only auth middleware
function developerAuthMiddleware(req: any, res: any, next: any) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as any;
    if (decoded.accountType !== 'developer') {
      return res.status(403).json({ message: 'Developer access required' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Admin-only middleware (must be Builder Firm Admin or Developer)
function adminMiddleware(req: any, res: any, next: any) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as any;
    req.user = decoded;
    // Developers always pass
    if (decoded.accountType === 'developer') return next();
    // For users, check if they have Admin role
    if (decoded.role === 'Admin' || decoded.role === 'OWNER' || decoded.role === 'ADMIN') return next();
    return res.status(403).json({ message: 'Admin access required' });
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PERMISSION ENGINE
// ══════════════════════════════════════════════════════════════════════════════
interface AccessResult {
  allowed: boolean;
  reason: string;
}

async function canAccess(
  db: Db,
  userId: string,
  moduleName: string,
  featureName?: string,
  _action?: string
): Promise<AccessResult> {
  try {
    // 1. Load user
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return { allowed: false, reason: 'User not found' };
    if (user.isActive === false) return { allowed: false, reason: 'Account is inactive' };

    // 2. Check company status
    const company = await db.collection('companies').findOne({ _id: user.companyId });
    if (!company) return { allowed: false, reason: 'Organization not found' };
    if (company.status === 'inactive') return { allowed: false, reason: 'Organization is inactive' };
    if (company.status === 'suspended') return { allowed: false, reason: 'Organization is suspended' };

    const isAdminUser = user.role === 'Admin' || user.role === 'OWNER' || user.role === 'ADMIN';

    // 3. Check subscription
    const subscription = await db.collection('subscriptions').findOne({ companyId: user.companyId, status: { $in: ['active', 'trial'] } });
    if (subscription) {
      const pkg = await db.collection('subscriptionpackages').findOne({ _id: subscription.packageId });
      if (pkg) {
        // Check module override first
        const moduleOverride = subscription.moduleOverrides?.[moduleName];
        const moduleEnabled = moduleOverride !== undefined ? moduleOverride : (pkg.modules?.[moduleName] !== false);
        if (!moduleEnabled && !isAdminUser) {
          return { allowed: false, reason: `Module "${moduleName}" is not available in your subscription (${pkg.displayName})` };
        }

        // Check feature override
        if (featureName && !isAdminUser) {
          const featureKey = `${moduleName}.${featureName}`;
          const featureOverride = subscription.featureOverrides?.[featureKey];
          const featureEnabled = featureOverride !== undefined ? featureOverride : (pkg.features?.[featureKey] !== false);
          if (!featureEnabled) {
            return { allowed: false, reason: `Feature "${featureName}" is not available in your subscription` };
          }
        }
      }
    }

    // Admins and owners have full access to management and activity log features
    if (isAdminUser) {
      return { allowed: true, reason: 'Access granted' };
    }

    // 4. Check role permissions
    if (user.roleId) {
      const role = await db.collection('roles').findOne({ _id: new ObjectId(user.roleId) });
      if (role && role.isActive !== false) {
        if (role.name === 'Admin') {
          return { allowed: true, reason: 'Access granted' };
        }
        const modulePerms = role.permissions?.[moduleName];
        if (!modulePerms) {
          // If module is activityLogs and role is management, grant access
          if (moduleName === 'activityLogs' && (role.name?.toLowerCase().includes('manager') || role.name?.toLowerCase().includes('admin'))) {
            return { allowed: true, reason: 'Access granted' };
          }
          return { allowed: false, reason: `You do not have access to the "${moduleName}" module` };
        }
        if (featureName && modulePerms[featureName] === false) {
          return { allowed: false, reason: `You do not have "${featureName}" permission in "${moduleName}"` };
        }
      }
    }
    // If no roleId, allow access (backward compatibility)

    return { allowed: true, reason: 'Access granted' };
  } catch (err: any) {
    console.error('Permission check error:', err);
    return { allowed: false, reason: 'Permission check failed' };
  }
}

async function getEffectivePermissions(db: Db, userId: string): Promise<any> {
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) return null;

  const company = await db.collection('companies').findOne({ _id: user.companyId });

  // Start with all modules/features enabled
  const modules: Record<string, boolean> = {};
  const features: Record<string, boolean> = {};
  for (const [mod, def] of Object.entries(PLATFORM_MODULES)) {
    modules[mod] = true;
    for (const feat of Object.keys(def.features)) {
      features[`${mod}.${feat}`] = true;
    }
  }

  // Apply subscription restrictions
  let subscriptionInfo: any = null;
  const subscription = await db.collection('subscriptions').findOne({ companyId: user.companyId, status: { $in: ['active', 'trial', 'expired'] } });
  if (subscription) {
    let isExpired = false;
    if (subscription.status === 'trial' && subscription.endDate) {
      const now = new Date();
      const expiresAt = new Date(subscription.endDate);
      if (now > expiresAt) {
        isExpired = true;
        if (subscription.status !== 'expired') {
          await db.collection('subscriptions').updateOne({ _id: subscription._id }, { $set: { status: 'expired', updatedAt: now } });
          subscription.status = 'expired';
        }
      }
    }

    const pkg = await db.collection('subscriptionpackages').findOne({ _id: subscription.packageId });
    if (pkg) {
      const trialDaysRemaining = (subscription.status === 'trial' && subscription.endDate)
        ? Math.max(0, Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

      subscriptionInfo = {
        name: pkg.name,
        displayName: subscription.status === 'trial' ? `${pkg.displayName} (7-Day Trial)` : pkg.displayName,
        status: subscription.status,
        limits: pkg.limits,
        trialDaysRemaining,
        trialExpiresAt: subscription.endDate,
        isExpired
      };

      for (const mod of Object.keys(modules)) {
        if (isExpired) {
          modules[mod] = false;
        } else {
          const override = subscription.moduleOverrides?.[mod];
          const pkgEnabled = pkg.modules?.[mod] !== false;
          modules[mod] = override !== undefined ? override : pkgEnabled;
        }
        if (!modules[mod]) {
          // Disable all features of disabled module
          for (const feat of Object.keys(PLATFORM_MODULES[mod]?.features || {})) {
            features[`${mod}.${feat}`] = false;
          }
        }
      }
    }
  }

  // Apply role restrictions
  let roleInfo: any = null;
  if (user.roleId) {
    const role = await db.collection('roles').findOne({ _id: new ObjectId(user.roleId) });
    if (role && role.isActive !== false) {
      roleInfo = { id: role._id.toString(), name: role.name, dataScope: role.dataScope || 'organization' };
      for (const [mod, modPerms] of Object.entries(role.permissions || {})) {
        if (!modules[mod]) continue; // Already disabled by subscription
        for (const [feat, allowed] of Object.entries(modPerms as Record<string, boolean>)) {
          if (!allowed) {
            features[`${mod}.${feat}`] = false;
          }
        }
        // If no features are enabled, disable the module
        const anyFeatureEnabled = Object.keys(PLATFORM_MODULES[mod]?.features || {}).some(f => features[`${mod}.${f}`]);
        if (!anyFeatureEnabled) modules[mod] = false;
      }
    }
  }

  // If user is Admin or Owner and subscription is not expired, ensure users, roles, and activityLogs modules are enabled
  const isAdminOrOwner = user.role === 'Admin' || user.role === 'OWNER' || user.role === 'ADMIN' || roleInfo?.name === 'Admin';
  if (isAdminOrOwner && !subscriptionInfo?.isExpired) {
    modules.users = true;
    modules.roles = true;
    modules.activityLogs = true;
    for (const feat of Object.keys(PLATFORM_MODULES.users?.features || {})) {
      features[`users.${feat}`] = true;
    }
    for (const feat of Object.keys(PLATFORM_MODULES.roles?.features || {})) {
      features[`roles.${feat}`] = true;
    }
    for (const feat of Object.keys(PLATFORM_MODULES.activityLogs?.features || {})) {
      features[`activityLogs.${feat}`] = true;
    }
  }

  return {
    modules,
    features,
    subscription: subscriptionInfo,
    role: roleInfo,
    companyStatus: company?.status || 'active',
    assignedProjects: user.assignedProjects || [],
    dataScope: roleInfo?.dataScope || 'organization'
  };
}

// Permission middleware factory
function requirePermission(moduleName: string, featureName?: string) {
  return async (req: any, res: any, next: any) => {
    // Developer bypass
    if (req.user?.accountType === 'developer') return next();

    try {
      const database = await connectDB();
      const result = await canAccess(database, req.user.sub, moduleName, featureName);
      if (!result.allowed) {
        return res.status(403).json({ message: result.reason, code: 'PERMISSION_DENIED' });
      }
      next();
    } catch (err: any) {
      console.error('Permission middleware error:', err);
      res.status(500).json({ message: 'Permission check failed' });
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG HELPER
// ══════════════════════════════════════════════════════════════════════════════
async function logAudit(db: Db, params: {
  actorId: string;
  actorType: 'developer' | 'user';
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  companyId?: string | ObjectId | null;
  module?: string;
  action: string;
  resource: string;
  resourceId?: string;
  description?: string;
  previousValue?: any;
  newValue?: any;
}) {
  try {
    let actorName = params.actorName;
    let actorEmail = params.actorEmail;
    let actorRole = params.actorRole;
    let companyId = toObjectId(params.companyId);

    if (params.actorType === 'developer') {
      if (!actorName || !actorEmail) {
        try {
          const devObjId = toObjectId(params.actorId);
          const dev = devObjId ? await db.collection('platformusers').findOne({ _id: devObjId }) : null;
          if (dev) {
            actorName = actorName || `${dev.firstName || ''} ${dev.lastName || ''}`.trim() || 'Platform Developer';
            actorEmail = actorEmail || dev.email;
            actorRole = actorRole || 'Platform Developer';
          }
        } catch {}
      }
    } else if (params.actorType === 'user') {
      if (!actorName || !actorEmail || !actorRole || !companyId) {
        try {
          const userObjId = toObjectId(params.actorId);
          const user = userObjId ? await db.collection('users').findOne({ _id: userObjId }) : null;
          if (user) {
            actorName = actorName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
            actorEmail = actorEmail || user.email;
            companyId = companyId || toObjectId(user.companyId);
            if (!actorRole) {
              if (user.roleId) {
                const roleObjId = toObjectId(user.roleId);
                const roleDoc = roleObjId ? await db.collection('roles').findOne({ _id: roleObjId }) : null;
                actorRole = roleDoc?.name || user.role || 'User';
              } else {
                actorRole = user.role || 'User';
              }
            }
          }
        } catch {}
      }
    }

    await db.collection('auditlogs').insertOne({
      actorId: params.actorId,
      actorType: params.actorType,
      actorName: actorName || 'System / User',
      actorEmail: actorEmail || '',
      actorRole: actorRole || 'User',
      companyId: companyId || null,
      module: params.module || 'general',
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId || null,
      description: params.description || `${params.action} on ${params.resource}`,
      previousValue: params.previousValue || null,
      newValue: params.newValue || null,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// ── INVENTORY HELPERS ────────────────────────────────────────────────────────
function getSingleBarWeight(diameter: number, lengthMm = 12000): number {
  return (lengthMm / 1000) * (diameter * diameter) / 162;
}

const STD_DIAMETERS = [8, 10, 12, 16, 20, 25, 32];

async function ensureScrapRules(db: Db, rawCompanyId: ObjectId | string) {
  if (!rawCompanyId) return [];
  const companyId = typeof rawCompanyId === 'string' ? new ObjectId(rawCompanyId) : rawCompanyId;
  const coll = db.collection('scraprules');

  const existing = await coll.find({
    $or: [{ companyId }, { companyId: companyId.toString() }]
  }).toArray();

  const existingSet = new Set(existing.map((r: any) => Number(r.diameter)));
  const missing = STD_DIAMETERS.filter(d => !existingSet.has(d));

  if (missing.length) {
    for (const d of missing) {
      try {
        await coll.updateOne(
          { companyId, diameter: Number(d) },
          { $setOnInsert: { companyId, diameter: Number(d), scrapLengthThreshold: 1000, createdAt: new Date() } },
          { upsert: true }
        );
      } catch (err: any) {
        if (!err.message?.includes('E11000')) throw err;
      }
    }
  }

  return coll.find({
    $or: [{ companyId }, { companyId: companyId.toString() }]
  }).sort({ diameter: 1 }).toArray();
}

// ══════════════════════════════════════════════════════════════════════════════
// SEED / INITIALIZATION HELPER
// ══════════════════════════════════════════════════════════════════════════════
async function seedDefaults(db: Db) {
  // 1. Seed subscription packages
  const pkgsColl = db.collection('subscriptionpackages');
  for (const pkg of DEFAULT_SUBSCRIPTION_PACKAGES) {
    const existing = await pkgsColl.findOne({ name: pkg.name });
    if (!existing) {
      await pkgsColl.insertOne({ ...pkg, createdAt: new Date(), updatedAt: new Date() });
      console.log(`  ✅ Created subscription package: ${pkg.name}`);
    } else {
      await pkgsColl.updateOne({ name: pkg.name }, { $set: { modules: pkg.modules, updatedAt: new Date() } });
    }
  }

  // 2. Seed system roles (companyId = null means system-level)
  const rolesColl = db.collection('roles');
  for (const roleDef of DEFAULT_SYSTEM_ROLES) {
    const existing = await rolesColl.findOne({ name: roleDef.name, isSystem: true, companyId: null });
    if (!existing) {
      await rolesColl.insertOne({
        companyId: null,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
        isActive: true,
        permissions: roleDef.permissions,
        dataScope: roleDef.dataScope,
        projectScope: 'all',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`  ✅ Created system role: ${roleDef.name}`);
    } else {
      await rolesColl.updateOne(
        { _id: existing._id },
        { $set: { permissions: roleDef.permissions, description: roleDef.description, updatedAt: new Date() } }
      );
    }
  }

  // 3. Seed developer account from env
  const devEmail = process.env.DEVELOPER_EMAIL || 'developer@rebaroptima.com';
  const devPassword = process.env.DEVELOPER_PASSWORD || 'DevSecure2026!@#';
  const devColl = db.collection('platformusers');
  const existingDev = await devColl.findOne({ email: devEmail.toLowerCase().trim() });
  if (!existingDev) {
    const hash = await bcrypt.hash(devPassword, 10);
    await devColl.insertOne({
      email: devEmail.toLowerCase().trim(),
      passwordHash: hash,
      firstName: 'Platform',
      lastName: 'Developer',
      role: 'DEVELOPER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`  ✅ Created developer account: ${devEmail}`);
  }

  // 4. Backfill existing companies with status and subscription
  const companiesColl = db.collection('companies');
  const companies = await companiesColl.find({ status: { $exists: false } }).toArray();
  if (companies.length > 0) {
    const freePkg = await pkgsColl.findOne({ name: 'FREE' });
    for (const company of companies) {
      await companiesColl.updateOne(
        { _id: company._id },
        { $set: { status: 'active' } }
      );
      // Create free subscription if none exists
      if (freePkg) {
        const existingSub = await db.collection('subscriptions').findOne({ companyId: company._id });
        if (!existingSub) {
          await db.collection('subscriptions').insertOne({
            companyId: company._id,
            packageId: freePkg._id,
            status: 'active',
            startDate: new Date(),
            endDate: null,
            moduleOverrides: {},
            featureOverrides: {},
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    }
    console.log(`  ✅ Backfilled ${companies.length} existing companies`);
  }

  // 5. Backfill existing users with isActive and Admin role
  const usersColl = db.collection('users');
  const usersToUpdate = await usersColl.find({ isActive: { $exists: false } }).toArray();
  if (usersToUpdate.length > 0) {
    const adminRole = await rolesColl.findOne({ name: 'Admin', isSystem: true, companyId: null });
    for (const user of usersToUpdate) {
      const updateFields: any = { isActive: true };
      // Map OWNER/ADMIN/SUPPORT to Admin role
      if (adminRole && (user.role === 'OWNER' || user.role === 'ADMIN' || user.role === 'SUPPORT')) {
        updateFields.roleId = adminRole._id;
      }
      await usersColl.updateOne({ _id: user._id }, { $set: updateFields });
    }
    console.log(`  ✅ Backfilled ${usersToUpdate.length} existing users`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DEVELOPER AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/auth/developer/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const db = await connectDB();
    const dev = await db.collection('platformusers').findOne({ email: email.toLowerCase().trim() });
    if (!dev) return res.status(401).json({ message: 'Invalid credentials' });
    if (dev.isActive === false) return res.status(403).json({ message: 'Account is inactive' });
    if (!await bcrypt.compare(password, dev.passwordHash)) return res.status(401).json({ message: 'Invalid credentials' });
    const tokens = generateTokens(dev._id.toString(), dev.email, 'DEVELOPER', 'developer');
    await logAudit(db, { actorId: dev._id.toString(), actorType: 'developer', action: 'DEVELOPER_LOGIN', resource: 'platformusers', resourceId: dev._id.toString() });
    res.json({
      ...tokens,
      user: { id: dev._id.toString(), email: dev.email, firstName: dev.firstName, lastName: dev.lastName, role: 'DEVELOPER', accountType: 'developer' }
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/developer/me', developerAuthMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const dev = await db.collection('platformusers').findOne({ _id: new ObjectId(req.user.sub) });
    if (!dev) return res.status(404).json({ message: 'Developer not found' });
    res.json({ id: dev._id.toString(), email: dev.email, firstName: dev.firstName, lastName: dev.lastName, role: 'DEVELOPER' });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// DEVELOPER MANAGEMENT ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// -- Platform Stats --
app.get('/api/developer/stats', developerAuthMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const totalCompanies = await db.collection('companies').countDocuments({ status: { $ne: 'deleted' } });
    const activeCompanies = await db.collection('companies').countDocuments({ status: 'active' });
    const totalUsers = await db.collection('users').countDocuments({ isActive: { $ne: false } });
    const totalBatches = await db.collection('batches').countDocuments();
    const totalSubscriptions = await db.collection('subscriptions').countDocuments({ status: { $in: ['active', 'trial'] } });
    res.json({ totalCompanies, activeCompanies, totalUsers, totalBatches, totalSubscriptions });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// -- Companies (Builder Firms) Management --
app.get('/api/developer/companies', developerAuthMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const companies = await db.collection('companies').find({ status: { $ne: 'deleted' } }).sort({ createdAt: -1 }).toArray();
    // Enrich with user count and subscription info
    const enriched = await Promise.all(companies.map(async (c: any) => {
      const userCount = await db.collection('users').countDocuments({ companyId: c._id, isActive: { $ne: false } });
      const subscription = await db.collection('subscriptions').findOne({ companyId: c._id, status: { $in: ['active', 'trial'] } });
      let pkgName = 'None';
      let maxStorageMB = 100;
      if (subscription) {
        const pkg = await db.collection('subscriptionpackages').findOne({ _id: subscription.packageId });
        pkgName = pkg?.displayName || pkg?.name || 'Unknown';
        if (pkg?.limits?.maxStorageMB) maxStorageMB = pkg.limits.maxStorageMB;
      }

      let totalBytes = 0;
      const collections = ['inventory', 'batches', 'ledger', 'scrapsales', 'scraprules', 'projects'];
      for (const collName of collections) {
        const docs = await db.collection(collName).find({ companyId: c._id }).toArray();
        if (docs.length > 0) totalBytes += Buffer.byteLength(JSON.stringify(docs), 'utf8');
      }
      const usersDocs = await db.collection('users').find({ companyId: c._id }).toArray();
      if (usersDocs.length > 0) totalBytes += Buffer.byteLength(JSON.stringify(usersDocs), 'utf8');
      
      const consumedStorageMB = totalBytes / (1024 * 1024);

      return {
        id: c._id.toString(),
        name: c.name,
        projectName: c.projectName || '',
        location: c.location || '',
        status: c.status || 'active',
        userCount,
        subscriptionPlan: pkgName,
        subscriptionStatus: subscription?.status || 'none',
        consumedStorageMB,
        maxStorageMB,
        createdAt: c.createdAt
      };
    }));
    res.json(enriched);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.get('/api/developer/companies/:id', developerAuthMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const company = await db.collection('companies').findOne({ _id: new ObjectId(req.params.id) });
    if (!company) return res.status(404).json({ message: 'Company not found' });
    const users = await db.collection('users').find({ companyId: company._id }).project({ passwordHash: 0 }).toArray();
    const subscription = await db.collection('subscriptions').findOne({ companyId: company._id });
    let pkg: any = null;
    if (subscription) {
      pkg = await db.collection('subscriptionpackages').findOne({ _id: subscription.packageId });
    }
    res.json({ company: { ...company, id: company._id.toString() }, users, subscription, package: pkg });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.put('/api/developer/companies/:id/status', developerAuthMiddleware, async (req: any, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be: active, inactive, suspended' });
    }
    const db = await connectDB();
    const company = await db.collection('companies').findOne({ _id: new ObjectId(req.params.id) });
    if (!company) return res.status(404).json({ message: 'Company not found' });
    const previousStatus = company.status || 'active';
    await db.collection('companies').updateOne({ _id: company._id }, { $set: { status } });
    await logAudit(db, { actorId: req.user.sub, actorType: 'developer', companyId: company._id, action: 'COMPANY_STATUS_CHANGED', resource: 'companies', resourceId: company._id.toString(), previousValue: { status: previousStatus }, newValue: { status } });
    res.json({ message: `Company status updated to ${status}`, status });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.delete('/api/developer/companies/:id', developerAuthMiddleware, async (req: any, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Developer password is required for this action' });
    
    const db = await connectDB();
    const dev = await db.collection('platformusers').findOne({ _id: new ObjectId(req.user.sub) });
    if (!dev || !await bcrypt.compare(password, dev.passwordHash)) {
      return res.status(403).json({ message: 'Invalid developer password' });
    }

    const companyId = new ObjectId(req.params.id);
    const company = await db.collection('companies').findOne({ _id: companyId });
    if (!company) return res.status(404).json({ message: 'Company not found' });

    await db.collection('users').deleteMany({ companyId });
    await db.collection('roles').deleteMany({ companyId });
    await db.collection('subscriptions').deleteMany({ companyId });
    await db.collection('inventory').deleteMany({ companyId });
    await db.collection('batches').deleteMany({ companyId });
    await db.collection('ledger').deleteMany({ companyId });
    await db.collection('scrapsales').deleteMany({ companyId });
    await db.collection('scraprules').deleteMany({ companyId });
    await db.collection('projects').deleteMany({ companyId });
    await db.collection('auditlogs').deleteMany({ companyId });
    await db.collection('companies').deleteOne({ _id: companyId });

    await logAudit(db, { 
      actorId: req.user.sub, 
      actorType: 'developer', 
      companyId: null, 
      action: 'FIRM_HARD_DELETED', 
      resource: 'companies', 
      resourceId: companyId.toString(), 
      previousValue: { name: company.name } 
    });

    res.json({ message: 'Company and all associated data permanently deleted' });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// -- Subscription Packages Management --
app.get('/api/developer/packages', developerAuthMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const packages = await db.collection('subscriptionpackages').find({}).sort({ createdAt: 1 }).toArray();
    res.json(packages.map((p: any) => ({ ...p, id: p._id.toString() })));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post('/api/developer/packages', developerAuthMiddleware, async (req: any, res) => {
  try {
    const { name, displayName, description, modules, features, limits } = req.body;
    if (!name || !displayName) return res.status(400).json({ message: 'Name and displayName required' });
    const db = await connectDB();
    const existing = await db.collection('subscriptionpackages').findOne({ name: name.toUpperCase() });
    if (existing) return res.status(409).json({ message: 'Package with this name already exists' });
    const result = await db.collection('subscriptionpackages').insertOne({
      name: name.toUpperCase(), displayName, description: description || '',
      modules: modules || {}, features: features || {}, limits: limits || {},
      isActive: true, createdAt: new Date(), updatedAt: new Date()
    });
    await logAudit(db, { actorId: req.user.sub, actorType: 'developer', action: 'PACKAGE_CREATED', resource: 'subscriptionpackages', resourceId: result.insertedId.toString(), newValue: { name } });
    res.status(201).json({ id: result.insertedId.toString(), name });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.put('/api/developer/packages/:id', developerAuthMiddleware, async (req: any, res) => {
  try {
    const { displayName, description, modules, features, limits, isActive } = req.body;
    const db = await connectDB();
    const pkg = await db.collection('subscriptionpackages').findOne({ _id: new ObjectId(req.params.id) });
    if (!pkg) return res.status(404).json({ message: 'Package not found' });
    const updateFields: any = { updatedAt: new Date() };
    if (displayName !== undefined) updateFields.displayName = displayName;
    if (description !== undefined) updateFields.description = description;
    if (modules !== undefined) updateFields.modules = modules;
    if (features !== undefined) updateFields.features = features;
    if (limits !== undefined) updateFields.limits = limits;
    if (isActive !== undefined) updateFields.isActive = isActive;
    await db.collection('subscriptionpackages').updateOne({ _id: pkg._id }, { $set: updateFields });
    await logAudit(db, { actorId: req.user.sub, actorType: 'developer', action: 'PACKAGE_UPDATED', resource: 'subscriptionpackages', resourceId: pkg._id.toString(), previousValue: { displayName: pkg.displayName, modules: pkg.modules }, newValue: updateFields });
    res.json({ message: 'Package updated', id: pkg._id.toString() });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// -- Subscription Management --
app.get('/api/developer/subscriptions', developerAuthMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const subs = await db.collection('subscriptions').find({}).sort({ createdAt: -1 }).toArray();
    const enriched = await Promise.all(subs.map(async (s: any) => {
      const company = await db.collection('companies').findOne({ _id: s.companyId });
      const pkg = await db.collection('subscriptionpackages').findOne({ _id: s.packageId });
      return { ...s, id: s._id.toString(), companyName: company?.name || 'Unknown', packageName: pkg?.displayName || pkg?.name || 'Unknown' };
    }));
    res.json(enriched);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post('/api/developer/subscriptions', developerAuthMiddleware, async (req: any, res) => {
  try {
    const { companyId, packageId, status, duration } = req.body;
    if (!companyId || !packageId) return res.status(400).json({ message: 'companyId and packageId required' });
    
    let endDate: Date | null = null;
    if (duration === '1_month') endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    else if (duration === '6_months') endDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    else if (duration === '1_year') endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    else if (duration === '2_years') endDate = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000);

    const db = await connectDB();
    // Deactivate existing active subscription
    await db.collection('subscriptions').updateMany({ companyId: new ObjectId(companyId), status: { $in: ['active', 'trial'] } }, { $set: { status: 'expired', updatedAt: new Date() } });
    const result = await db.collection('subscriptions').insertOne({
      companyId: new ObjectId(companyId), packageId: new ObjectId(packageId),
      status: status || 'active', startDate: new Date(), endDate,
      moduleOverrides: {}, featureOverrides: {},
      createdAt: new Date(), updatedAt: new Date()
    });
    await logAudit(db, { actorId: req.user.sub, actorType: 'developer', companyId, action: 'SUBSCRIPTION_ASSIGNED', resource: 'subscriptions', resourceId: result.insertedId.toString(), newValue: { packageId, status, duration } });
    res.status(201).json({ id: result.insertedId.toString(), message: 'Subscription assigned' });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.put('/api/developer/subscriptions/:id', developerAuthMiddleware, async (req: any, res) => {
  try {
    const { packageId, status, moduleOverrides, featureOverrides } = req.body;
    const db = await connectDB();
    const sub = await db.collection('subscriptions').findOne({ _id: new ObjectId(req.params.id) });
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });
    const updateFields: any = { updatedAt: new Date() };
    if (packageId) updateFields.packageId = new ObjectId(packageId);
    if (status) updateFields.status = status;
    if (moduleOverrides !== undefined) updateFields.moduleOverrides = moduleOverrides;
    if (featureOverrides !== undefined) updateFields.featureOverrides = featureOverrides;
    await db.collection('subscriptions').updateOne({ _id: sub._id }, { $set: updateFields });
    await logAudit(db, { actorId: req.user.sub, actorType: 'developer', companyId: sub.companyId, action: 'SUBSCRIPTION_UPDATED', resource: 'subscriptions', resourceId: sub._id.toString(), previousValue: { packageId: sub.packageId, status: sub.status }, newValue: updateFields });
    res.json({ message: 'Subscription updated' });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// -- Platform Users --
app.get('/api/developer/users', developerAuthMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const { companyId } = req.query as any;
    const filter: any = {};
    if (companyId) filter.companyId = new ObjectId(companyId);
    const users = await db.collection('users').find(filter).project({ passwordHash: 0 }).sort({ createdAt: -1 }).toArray();
    const enriched = await Promise.all(users.map(async (u: any) => {
      const company = await db.collection('companies').findOne({ _id: u.companyId });
      let roleName = u.role || 'Unknown';
      if (u.roleId) {
        const role = await db.collection('roles').findOne({ _id: new ObjectId(u.roleId) });
        if (role) roleName = role.name;
      }
      return { ...u, id: u._id.toString(), companyName: company?.name || 'Unknown', roleName };
    }));
    res.json(enriched);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// -- Audit Logs --
app.get('/api/developer/audit-logs', developerAuthMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const { limit = 100, companyId } = req.query as any;
    const filter: any = {};
    if (companyId) filter.companyId = new ObjectId(companyId);
    const logs = await db.collection('auditlogs').find(filter).sort({ timestamp: -1 }).limit(Number(limit)).toArray();
    res.json(logs);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// -- Module/Feature Definitions (for UI) --
app.get('/api/developer/modules', developerAuthMiddleware, async (req: any, res) => {
  res.json(PLATFORM_MODULES);
});

app.get('/api/modules', authMiddleware, async (req: any, res) => {
  res.json(PLATFORM_MODULES);
});

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOGS & AUDIT TRAIL (Company Scoped & Role Guarded)
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/activity-logs', authMiddleware, requirePermission('activityLogs', 'view'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    if (!companyId) return res.status(400).json({ message: 'Company not found' });

    const { module, userId, action, startDate, endDate, search, page = 1, limit = 50 } = req.query as any;

    const filter: any = { companyId };

    if (module && module !== 'all') {
      filter.module = module;
    }
    if (userId && userId !== 'all') {
      filter.actorId = userId;
    }
    if (action && action !== 'all') {
      filter.action = action;
    }
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { actorName: regex },
        { actorEmail: regex },
        { actorRole: regex },
        { description: regex },
        { action: regex },
        { resource: regex }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const totalLogs = await db.collection('auditlogs').countDocuments(filter);
    const logs = await db.collection('auditlogs')
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    // Compute metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await db.collection('auditlogs').countDocuments({
      companyId,
      timestamp: { $gte: today }
    });

    const activeUsersList = await db.collection('auditlogs').distinct('actorName', { companyId });
    const criticalCount = await db.collection('auditlogs').countDocuments({
      companyId,
      action: { $in: ['INVENTORY_DELETE', 'BATCH_DELETED', 'SCRAP_SALE_DELETED', 'USER_STATUS_CHANGED', 'ROLE_DELETED'] }
    });

    res.json({
      logs: logs.map((l: any) => ({ ...l, id: l._id.toString() })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalLogs,
        totalPages: Math.ceil(totalLogs / limitNum) || 1
      },
      stats: {
        totalLogs,
        todayCount,
        activeUsersCount: activeUsersList.length,
        criticalCount
      }
    });
  } catch (e: any) {
    console.error('Activity logs query error:', e);
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/activity-logs/export', authMiddleware, requirePermission('activityLogs', 'export'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    if (!companyId) return res.status(400).json({ message: 'Company not found' });

    const { module, userId, action, startDate, endDate, search } = req.query as any;
    const filter: any = { companyId };
    if (module && module !== 'all') filter.module = module;
    if (userId && userId !== 'all') filter.actorId = userId;
    if (action && action !== 'all') filter.action = action;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { actorName: regex },
        { actorEmail: regex },
        { actorRole: regex },
        { description: regex }
      ];
    }

    const logs = await db.collection('auditlogs').find(filter).sort({ timestamp: -1 }).limit(2000).toArray();

    const headers = ['Timestamp', 'User Name', 'Email', 'Role', 'Module', 'Action', 'Description', 'Resource ID'];
    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = logs.map((l: any) => [
      escapeCsv(l.timestamp ? new Date(l.timestamp).toISOString() : ''),
      escapeCsv(l.actorName || 'Unknown'),
      escapeCsv(l.actorEmail || ''),
      escapeCsv(l.actorRole || 'User'),
      escapeCsv(l.module || ''),
      escapeCsv(l.action || ''),
      escapeCsv(l.description || ''),
      escapeCsv(l.resourceId || '')
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="company_activity_logs_${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (e: any) {
    console.error('Export error:', e);
    res.status(500).json({ message: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// BUILDER FIRM AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName, companyName, projectName, location, mobileNumber, promoConsent, newsletterConsent } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    if (!companyName) return res.status(400).json({ message: 'Firm name is required' });
    if (!firstName || !lastName) return res.status(400).json({ message: 'First name and last name are required' });

    // Password validation
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    if (!/[A-Z]/.test(password)) return res.status(400).json({ message: 'Password must contain at least one uppercase letter' });
    if (!/[0-9]/.test(password)) return res.status(400).json({ message: 'Password must contain at least one number' });
    if (!/[^A-Za-z0-9]/.test(password)) return res.status(400).json({ message: 'Password must contain at least one special character' });

    const db = await connectDB();
    const usersColl = db.collection('users');
    const existing = await usersColl.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    // Create company
    const companiesColl = db.collection('companies');
    const companyResult = await companiesColl.insertOne({ name: companyName, projectName, location, status: 'active', createdAt: new Date() });
    const companyId = companyResult.insertedId;

    // Assign default subscription (FREE) with 7 Days Full Access Trial Validity
    const freePkg = await db.collection('subscriptionpackages').findOne({ name: 'FREE' });
    if (freePkg) {
      const startDate = new Date();
      const trialEndDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 Days Validity
      await db.collection('subscriptions').insertOne({
        companyId,
        packageId: freePkg._id,
        status: 'trial',
        startDate,
        endDate: trialEndDate,
        trialExpiresAt: trialEndDate,
        moduleOverrides: {},
        featureOverrides: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Find Admin system role
    const adminRole = await db.collection('roles').findOne({ name: 'Admin', isSystem: true, companyId: null });

    // Create user as Admin
    const passwordHash = await bcrypt.hash(password, 10);
    const userDoc: any = {
      email: email.toLowerCase().trim(), passwordHash, firstName, lastName,
      role: 'Admin', companyId,
      roleId: adminRole?._id || null,
      mobileNumber, promoConsent: !!promoConsent, newsletterConsent: !!newsletterConsent,
      isActive: true, assignedProjects: [],
      createdAt: new Date()
    };
    const userResult = await usersColl.insertOne(userDoc);
    const userId = userResult.insertedId.toString();

    // Generate tokens
    const tokens = generateTokens(userId, userDoc.email, 'Admin', 'user');

    // Get effective permissions
    const permissions = await getEffectivePermissions(db, userId);

    await logAudit(db, { actorId: userId, actorType: 'user', companyId, action: 'SIGNUP', resource: 'users', resourceId: userId, newValue: { email: userDoc.email, companyName } });

    res.status(201).json({
      ...tokens,
      user: {
        id: userId, email: userDoc.email, firstName, lastName,
        role: 'Admin', companyId: companyId.toString(), companyName,
        projectName: projectName || '', accountType: 'user'
      },
      permissions
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ message: 'Internal server error', error: e.message });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const db = await connectDB();

    // Check if user is a regular user
    const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });
    if (user.isActive === false) return res.status(403).json({ message: 'Account is inactive. Contact your administrator.' });
    if (!await bcrypt.compare(password, user.passwordHash)) return res.status(401).json({ message: 'Invalid email or password' });

    // Check company status (if companyId exists)
    let company: any = null;
    if (user.companyId) {
      company = await db.collection('companies').findOne({ _id: user.companyId });
      if (!company) return res.status(403).json({ message: 'Organization not found' });
      if (company.status === 'inactive') return res.status(403).json({ message: 'Your organization is inactive. Contact platform support.' });
      if (company.status === 'suspended') return res.status(403).json({ message: 'Your organization is suspended. Contact platform support.' });
    }

    // Get role name
    let roleName = user.role || 'Admin';
    if (user.roleId) {
      const role = await db.collection('roles').findOne({ _id: new ObjectId(user.roleId) });
      if (role) roleName = role.name;
    }

    const tokens = generateTokens(user._id.toString(), user.email, roleName, 'user');

    // Get effective permissions
    const permissions = await getEffectivePermissions(db, user._id.toString());

    await logAudit(db, {
      actorId: user._id.toString(),
      actorType: 'user',
      actorName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      actorEmail: user.email,
      actorRole: roleName,
      companyId: user.companyId || null,
      module: 'auth',
      action: 'USER_SIGNIN',
      resource: 'users',
      resourceId: user._id.toString(),
      description: `${user.firstName || ''} ${user.lastName || ''} (${roleName}) logged in to RebarOptima`
    });

    res.json({
      ...tokens,
      user: {
        id: user._id.toString(), email: user.email, firstName: user.firstName, lastName: user.lastName,
        role: roleName, companyId: user.companyId ? user.companyId.toString() : null,
        companyName: company?.name ?? 'System', projectName: company?.projectName ?? '',
        accountType: 'user'
      },
      permissions
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ message: 'Internal server error', error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// EFFECTIVE PERMISSIONS ROUTE
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/permissions/effective', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const permissions = await getEffectivePermissions(db, req.user.sub);
    if (!permissions) return res.status(404).json({ message: 'User not found' });
    res.json(permissions);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// TENANT STORAGE
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/companies/storage', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    if (!userDoc || !userDoc.companyId) return res.status(400).json({ message: 'Company not found' });
    const companyId = new ObjectId(userDoc.companyId);
    
    let totalBytes = 0;
    const collections = ['inventory', 'batches', 'ledger', 'scrapsales', 'scraprules', 'projects'];
    for (const collName of collections) {
      const docs = await db.collection(collName).find({ companyId: new ObjectId(companyId) }).toArray();
      if (docs.length > 0) {
        totalBytes += Buffer.byteLength(JSON.stringify(docs), 'utf8');
      }
    }
    const users = await db.collection('users').find({ companyId: new ObjectId(companyId) }).toArray();
    totalBytes += Buffer.byteLength(JSON.stringify(users), 'utf8');

    const consumedMB = totalBytes / (1024 * 1024);
    
    const subscription = await db.collection('subscriptions').findOne({ companyId: new ObjectId(companyId), status: { $in: ['active', 'trial'] } });
    let maxMB = 100;
    if (subscription) {
      const pkg = await db.collection('subscriptionpackages').findOne({ _id: subscription.packageId });
      if (pkg?.limits?.maxStorageMB) maxMB = pkg.limits.maxStorageMB;
    }

    res.json({ consumedMB, maxMB, totalBytes });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// BUILDER FIRM ADMIN — ROLE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/roles', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Get system roles + company-specific roles
    let roles = await db.collection('roles').find({
      $or: [
        { companyId: null, isSystem: true },
        { companyId: user.companyId }
      ],
      isActive: { $ne: false }
    }).toArray();

    const ROLE_POWER_ORDER = [
      'Admin',
      'Project Manager',
      'Senior Site Engineer',
      'Site Supervisor',
      'Junior Site Engineer',
      'Purchase Manager',
      'Accountant',
      'Sales Executive',
      'Store Keeper'
    ];

    roles.sort((a, b) => {
      if (a.isSystem && b.isSystem) {
        const idxA = ROLE_POWER_ORDER.indexOf(a.name);
        const idxB = ROLE_POWER_ORDER.indexOf(b.name);
        return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
      }
      if (a.isSystem) return -1;
      if (b.isSystem) return 1;
      return a.name.localeCompare(b.name);
    });

    // Add user count per role
    const enriched = await Promise.all(roles.map(async (r: any) => {
      const userCount = await db.collection('users').countDocuments({
        companyId: user.companyId,
        roleId: r._id,
        isActive: { $ne: false }
      });
      return { ...r, id: r._id.toString(), userCount };
    }));

    res.json(enriched);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post('/api/roles', adminMiddleware, async (req: any, res) => {
  try {
    const { name, description, permissions, dataScope, projectScope } = req.body;
    if (!name) return res.status(400).json({ message: 'Role name is required' });
    const db = await connectDB();

    // Get company from user (unless developer)
    let companyId: ObjectId | null = null;
    if (req.user.accountType !== 'developer') {
      const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
      if (!user) return res.status(404).json({ message: 'User not found' });
      companyId = user.companyId;
    }

    // Check for duplicate role name within company
    const existing = await db.collection('roles').findOne({
      $or: [
        { companyId, name, isActive: { $ne: false } },
        { companyId: null, isSystem: true, name }
      ]
    });
    if (existing) return res.status(409).json({ message: 'A role with this name already exists' });

    // Validate permissions against subscription
    if (companyId) {
      const subscription = await db.collection('subscriptions').findOne({ companyId, status: { $in: ['active', 'trial'] } });
      if (subscription) {
        const pkg = await db.collection('subscriptionpackages').findOne({ _id: subscription.packageId });
        if (pkg && permissions) {
          for (const mod of Object.keys(permissions)) {
            const moduleEnabled = subscription.moduleOverrides?.[mod] !== undefined ? subscription.moduleOverrides[mod] : (pkg.modules?.[mod] !== false);
            if (!moduleEnabled) {
              return res.status(400).json({ message: `Cannot grant permissions for module "${mod}" — not available in your subscription` });
            }
          }
        }
      }
    }

    const result = await db.collection('roles').insertOne({
      companyId, name, description: description || '',
      isSystem: false, isActive: true,
      permissions: permissions || {},
      dataScope: dataScope || 'organization',
      projectScope: projectScope || 'all',
      createdAt: new Date(), updatedAt: new Date()
    });

    await logAudit(db, { actorId: req.user.sub, actorType: req.user.accountType, companyId, action: 'ROLE_CREATED', resource: 'roles', resourceId: result.insertedId.toString(), newValue: { name, permissions } });

    res.status(201).json({ id: result.insertedId.toString(), name, message: 'Role created successfully' });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.put('/api/roles/:id', adminMiddleware, async (req: any, res) => {
  try {
    const { name, description, permissions, dataScope, projectScope, isActive } = req.body;
    const db = await connectDB();
    const role = await db.collection('roles').findOne({ _id: new ObjectId(req.params.id) });
    if (!role) return res.status(404).json({ message: 'Role not found' });
    if (role.isSystem && role.companyId === null) return res.status(403).json({ message: 'Cannot modify system roles' });

    const updateFields: any = { updatedAt: new Date() };
    if (name !== undefined) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (permissions !== undefined) updateFields.permissions = permissions;
    if (dataScope !== undefined) updateFields.dataScope = dataScope;
    if (projectScope !== undefined) updateFields.projectScope = projectScope;
    if (isActive !== undefined) updateFields.isActive = isActive;

    await db.collection('roles').updateOne({ _id: role._id }, { $set: updateFields });
    await logAudit(db, { actorId: req.user.sub, actorType: req.user.accountType, companyId: role.companyId, action: 'ROLE_UPDATED', resource: 'roles', resourceId: role._id.toString(), previousValue: { name: role.name, permissions: role.permissions }, newValue: updateFields });

    res.json({ message: 'Role updated successfully' });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.delete('/api/roles/:id', adminMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const role = await db.collection('roles').findOne({ _id: new ObjectId(req.params.id) });
    if (!role) return res.status(404).json({ message: 'Role not found' });
    if (role.isSystem && role.companyId === null) return res.status(403).json({ message: 'Cannot delete system roles' });

    // Check if users are assigned
    const assignedCount = await db.collection('users').countDocuments({ roleId: role._id, isActive: { $ne: false } });
    if (assignedCount > 0) {
      return res.status(400).json({ message: `Cannot delete: ${assignedCount} user(s) are assigned to this role. Reassign them first.` });
    }

    // Soft delete
    await db.collection('roles').updateOne({ _id: role._id }, { $set: { isActive: false, deletedAt: new Date() } });
    await logAudit(db, { actorId: req.user.sub, actorType: req.user.accountType, companyId: role.companyId, action: 'ROLE_DELETED', resource: 'roles', resourceId: role._id.toString(), previousValue: { name: role.name } });

    res.json({ message: 'Role deactivated successfully' });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// CURRENT LOGGED-IN USER PROFILE & SETTINGS (Must be before /api/users/:id)
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/users/me', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    if (req.user.accountType === 'developer') {
      const devObjId = toObjectId(req.user.sub);
      const dev = devObjId ? await db.collection('developers').findOne({ _id: devObjId }) : await db.collection('developers').findOne({ email: req.user.email?.toLowerCase().trim() });
      if (!dev) return res.status(404).json({ message: 'Developer not found' });
      return res.json({
        id: dev._id.toString(),
        email: dev.email,
        firstName: dev.name || 'Developer',
        lastName: 'Admin',
        role: 'Superadmin',
        roleName: 'Developer Superadmin',
        companyName: 'Platform Core',
        projectName: 'Global',
        location: 'HQ',
        mobileNumber: dev.mobileNumber || '',
        avatar: dev.avatar || null,
        preferences: dev.preferences || { defaultKerf: 3, defaultTrimMargin: 25, defaultBarLength: 12000, defaultAlgorithm: 'genetic' },
        accountType: 'developer',
        createdAt: dev.createdAt || new Date()
      });
    }

    const userObjId = toObjectId(req.user.sub);
    const user = userObjId ? await db.collection('users').findOne({ _id: userObjId }) : await db.collection('users').findOne({ email: req.user.email?.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'User not found' });

    let company: any = null;
    const companyObjId = toObjectId(user.companyId);
    if (companyObjId) {
      company = await db.collection('companies').findOne({ _id: companyObjId });
    }

    let roleName = user.role || 'User';
    let permissions = null;
    const roleObjId = toObjectId(user.roleId);
    if (roleObjId) {
      const role = await db.collection('roles').findOne({ _id: roleObjId });
      if (role) {
        roleName = role.name;
        permissions = role.permissions;
      }
    }

    const effectivePerms = await getEffectivePermissions(db, user._id.toString());

    res.json({
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      mobileNumber: user.mobileNumber || '',
      avatar: user.avatar || null,
      role: roleName,
      roleName: roleName,
      roleId: user.roleId ? user.roleId.toString() : null,
      companyId: user.companyId ? user.companyId.toString() : null,
      companyName: company?.name || 'Standard Firm',
      projectName: company?.projectName || '',
      location: company?.location || '',
      assignedProjects: user.assignedProjects || [],
      preferences: user.preferences || { defaultKerf: 3, defaultTrimMargin: 25, defaultBarLength: 12000, defaultAlgorithm: 'genetic' },
      accountType: 'user',
      createdAt: user.createdAt || new Date(),
      effectivePermissions: effectivePerms
    });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.put('/api/users/me', authMiddleware, async (req: any, res) => {
  try {
    const { firstName, lastName, mobileNumber, avatar, preferences } = req.body;
    const db = await connectDB();

    if (req.user.accountType === 'developer') {
      const devObjId = toObjectId(req.user.sub);
      const updateDoc: any = {};
      if (firstName !== undefined) updateDoc.name = `${firstName} ${lastName || ''}`.trim();
      if (mobileNumber !== undefined) updateDoc.mobileNumber = mobileNumber;
      if (avatar !== undefined) updateDoc.avatar = avatar;
      if (preferences !== undefined) updateDoc.preferences = preferences;
      updateDoc.updatedAt = new Date();

      if (devObjId) {
        await db.collection('developers').updateOne({ _id: devObjId }, { $set: updateDoc });
      }
      return res.json({ message: 'Developer profile updated successfully' });
    }

    const userObjId = toObjectId(req.user.sub);
    const user = userObjId ? await db.collection('users').findOne({ _id: userObjId }) : await db.collection('users').findOne({ email: req.user.email?.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const updateDoc: any = {};
    if (firstName !== undefined && firstName.trim()) updateDoc.firstName = firstName.trim();
    if (lastName !== undefined && lastName.trim()) updateDoc.lastName = lastName.trim();
    if (mobileNumber !== undefined) updateDoc.mobileNumber = mobileNumber.trim();
    if (avatar !== undefined) updateDoc.avatar = avatar;
    if (preferences !== undefined) updateDoc.preferences = preferences;
    updateDoc.updatedAt = new Date();

    await db.collection('users').updateOne({ _id: user._id }, { $set: updateDoc });

    await logAudit(db, {
      actorId: user._id.toString(),
      actorType: 'user',
      actorName: `${updateDoc.firstName || user.firstName} ${updateDoc.lastName || user.lastName}`,
      actorEmail: user.email,
      actorRole: user.role,
      companyId: user.companyId,
      module: 'users',
      action: 'PROFILE_UPDATED',
      resource: 'users',
      resourceId: user._id.toString(),
      description: `User profile updated for ${updateDoc.firstName || user.firstName} ${updateDoc.lastName || user.lastName}`
    });

    const updated = await db.collection('users').findOne({ _id: user._id });
    const companyObjId = toObjectId(user.companyId);
    const company = companyObjId ? await db.collection('companies').findOne({ _id: companyObjId }) : null;

    res.json({
      id: updated!._id.toString(),
      email: updated!.email,
      firstName: updated!.firstName,
      lastName: updated!.lastName,
      mobileNumber: updated!.mobileNumber || '',
      avatar: updated!.avatar || null,
      role: updated!.role,
      companyId: updated!.companyId ? updated!.companyId.toString() : null,
      companyName: company?.name || 'Standard Firm',
      projectName: company?.projectName || '',
      location: company?.location || '',
      preferences: updated!.preferences || { defaultKerf: 3, defaultTrimMargin: 25, defaultBarLength: 12000, defaultAlgorithm: 'genetic' },
      message: 'Profile updated successfully'
    });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.put('/api/users/me/password', authMiddleware, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({ message: 'New password must contain at least one uppercase letter' });
    }
    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({ message: 'New password must contain at least one number' });
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      return res.status(400).json({ message: 'New password must contain at least one special character' });
    }

    const db = await connectDB();

    if (req.user.accountType === 'developer') {
      const devObjId = toObjectId(req.user.sub);
      const dev = devObjId ? await db.collection('developers').findOne({ _id: devObjId }) : null;
      if (!dev) return res.status(404).json({ message: 'Developer not found' });
      const matches = await bcrypt.compare(currentPassword, dev.passwordHash);
      if (!matches) return res.status(400).json({ message: 'Current password is incorrect' });

      const newHash = await bcrypt.hash(newPassword, 10);
      await db.collection('developers').updateOne({ _id: dev._id }, { $set: { passwordHash: newHash, updatedAt: new Date() } });
      return res.json({ message: 'Password changed successfully' });
    }

    const userObjId = toObjectId(req.user.sub);
    const user = userObjId ? await db.collection('users').findOne({ _id: userObjId }) : await db.collection('users').findOne({ email: req.user.email?.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) return res.status(400).json({ message: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.collection('users').updateOne({ _id: user._id }, { $set: { passwordHash: newHash, updatedAt: new Date() } });

    await logAudit(db, {
      actorId: user._id.toString(),
      actorType: 'user',
      actorName: `${user.firstName} ${user.lastName}`,
      actorEmail: user.email,
      actorRole: user.role,
      companyId: user.companyId,
      module: 'auth',
      action: 'PASSWORD_CHANGED',
      resource: 'users',
      resourceId: user._id.toString(),
      description: `Password changed successfully for ${user.firstName} ${user.lastName}`
    });

    res.json({ message: 'Password changed successfully' });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.get('/api/users/me/stats', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const userObjId = toObjectId(req.user.sub);
    const userDoc = userObjId ? await db.collection('users').findOne({ _id: userObjId }) : null;
    const companyId = toObjectId(userDoc?.companyId);

    // Batches count and stats
    const batches = await db.collection('batches').find({
      $or: [
        { companyId },
        { createdBy: userObjId },
        { createdBy: req.user.sub }
      ]
    }).toArray();

    let totalBatches = batches.length;
    let totalScrapKg = 0;
    let totalRemnantKg = 0;
    let totalSteelWeightKg = 0;
    let yieldSum = 0;
    let batchCountWithEfficiency = 0;

    for (const b of batches) {
      if (b.summary) {
        if (b.summary.totalScrapKg) totalScrapKg += Number(b.summary.totalScrapKg) || 0;
        if (b.summary.totalRemnantKg) totalRemnantKg += Number(b.summary.totalRemnantKg) || 0;
        if (b.summary.totalWeight || b.summary.inputWeight || b.summary.totalWeightKg) {
          totalSteelWeightKg += Number(b.summary.totalWeight || b.summary.inputWeight || b.summary.totalWeightKg) || 0;
        }
        if (b.summary.efficiency || b.summary.yieldPercentage) {
          yieldSum += Number(b.summary.efficiency || b.summary.yieldPercentage) || 0;
          batchCountWithEfficiency++;
        }
      }
    }

    const avgYield = batchCountWithEfficiency > 0 ? (yieldSum / batchCountWithEfficiency) : 96.5;

    // Recent activity audit logs for this specific user
    const recentLogs = await db.collection('auditlogs')
      .find({ actorId: req.user.sub })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    res.json({
      totalBatches,
      totalSteelWeightKg: Math.round(totalSteelWeightKg),
      totalSteelWeightMT: Number((totalSteelWeightKg / 1000).toFixed(3)),
      totalScrapKg: Math.round(totalScrapKg),
      totalRemnantKg: Math.round(totalRemnantKg),
      avgYield: Number(avgYield.toFixed(1)),
      recentLogs: recentLogs.map((l: any) => ({
        id: l._id.toString(),
        timestamp: l.timestamp,
        module: l.module,
        action: l.action,
        description: l.description || `${l.action} on ${l.resource || 'item'}`
      }))
    });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// BUILDER FIRM ADMIN — USER MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/users', adminMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();

    if (req.user.accountType === 'developer') {
      const users = await db.collection('users').find({}).project({ passwordHash: 0 }).sort({ createdAt: -1 }).toArray();
      return res.json(users.map((u: any) => ({ ...u, id: u._id.toString() })));
    }

    const userObjId = toObjectId(req.user.sub);
    const user = userObjId ? await db.collection('users').findOne({ _id: userObjId }) : null;
    if (!user) return res.status(404).json({ message: 'User not found' });

    const users = await db.collection('users').find({ companyId: user.companyId, isActive: { $ne: false } }).project({ passwordHash: 0 }).sort({ createdAt: -1 }).toArray();

    const enriched = await Promise.all(users.map(async (u: any) => {
      let roleName = u.role || 'Unknown';
      const roleObjId = toObjectId(u.roleId);
      if (roleObjId) {
        const role = await db.collection('roles').findOne({ _id: roleObjId });
        if (role) roleName = role.name;
      }
      return { ...u, id: u._id.toString(), roleName };
    }));

    res.json(enriched);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post('/api/users', adminMiddleware, async (req: any, res) => {
  try {
    const { email, password, firstName, lastName, roleId, mobileNumber } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: 'Email, password, first name, and last name are required' });
    }
    const db = await connectDB();

    // Get admin's company
    const adminObjId = toObjectId(req.user.sub);
    const admin = adminObjId ? await db.collection('users').findOne({ _id: adminObjId }) : null;
    if (!admin && req.user.accountType !== 'developer') return res.status(404).json({ message: 'Admin user not found' });
    const companyId = admin?.companyId;

    // Check subscription user limits
    if (companyId) {
      const subscription = await db.collection('subscriptions').findOne({ companyId, status: { $in: ['active', 'trial'] } });
      if (subscription) {
        const pkg = await db.collection('subscriptionpackages').findOne({ _id: subscription.packageId });
        if (pkg?.limits?.maxUsers) {
          const currentCount = await db.collection('users').countDocuments({ companyId, isActive: { $ne: false } });
          if (currentCount >= pkg.limits.maxUsers) {
            return res.status(400).json({ message: `User limit reached (${pkg.limits.maxUsers}). Upgrade your subscription to add more users.` });
          }
        }
      }
    }

    // Check duplicate email
    const existing = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    // Validate roleId
    let roleName = 'Admin';
    const roleObjId = toObjectId(roleId);
    if (roleObjId) {
      const role = await db.collection('roles').findOne({ _id: roleObjId });
      if (!role) return res.status(400).json({ message: 'Invalid role ID' });
      roleName = role.name;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userDoc: any = {
      email: email.toLowerCase().trim(), passwordHash, firstName, lastName,
      role: roleName, companyId,
      roleId: roleObjId || null,
      mobileNumber: mobileNumber || '', isActive: true, assignedProjects: [],
      createdAt: new Date()
    };
    const result = await db.collection('users').insertOne(userDoc);

    await logAudit(db, { actorId: req.user.sub, actorType: req.user.accountType, companyId, action: 'USER_CREATED', resource: 'users', resourceId: result.insertedId.toString(), newValue: { email: userDoc.email, role: roleName } });

    res.status(201).json({ id: result.insertedId.toString(), email: userDoc.email, firstName, lastName, role: roleName, message: 'User created successfully' });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.put('/api/users/:id', adminMiddleware, async (req: any, res) => {
  try {
    const { firstName, lastName, roleId, mobileNumber, assignedProjects } = req.body;
    const db = await connectDB();
    const targetObjId = toObjectId(req.params.id);
    if (!targetObjId) return res.status(400).json({ message: 'Invalid user ID' });
    const targetUser = await db.collection('users').findOne({ _id: targetObjId });
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // Ensure same company (unless developer)
    if (req.user.accountType !== 'developer') {
      const adminObjId = toObjectId(req.user.sub);
      const admin = adminObjId ? await db.collection('users').findOne({ _id: adminObjId }) : null;
      if (!admin || admin.companyId.toString() !== targetUser.companyId.toString()) {
        return res.status(403).json({ message: 'Cannot modify users from another organization' });
      }
    }

    const updateFields: any = {};
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (mobileNumber !== undefined) updateFields.mobileNumber = mobileNumber;
    if (assignedProjects !== undefined) updateFields.assignedProjects = assignedProjects;
    const roleObjId = toObjectId(roleId);
    if (roleObjId) {
      const role = await db.collection('roles').findOne({ _id: roleObjId });
      if (!role) return res.status(400).json({ message: 'Invalid role ID' });
      updateFields.roleId = roleObjId;
      updateFields.role = role.name;
    }

    await db.collection('users').updateOne({ _id: targetUser._id }, { $set: updateFields });
    await logAudit(db, { actorId: req.user.sub, actorType: req.user.accountType, companyId: targetUser.companyId, action: 'USER_UPDATED', resource: 'users', resourceId: targetUser._id.toString(), previousValue: { role: targetUser.role, roleId: targetUser.roleId }, newValue: updateFields });

    res.json({ message: 'User updated successfully' });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.put('/api/users/:id/status', adminMiddleware, async (req: any, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') return res.status(400).json({ message: 'isActive must be a boolean' });
    const db = await connectDB();
    const targetObjId = toObjectId(req.params.id);
    if (!targetObjId) return res.status(400).json({ message: 'Invalid user ID' });
    const targetUser = await db.collection('users').findOne({ _id: targetObjId });
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // Cannot deactivate yourself
    if (req.user.sub === req.params.id) return res.status(400).json({ message: 'Cannot deactivate your own account' });

    await db.collection('users').updateOne({ _id: targetUser._id }, { $set: { isActive } });
    await logAudit(db, { actorId: req.user.sub, actorType: req.user.accountType, companyId: targetUser.companyId, action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', resource: 'users', resourceId: targetUser._id.toString() });

    res.json({ message: `User ${isActive ? 'activated' : 'deactivated'} successfully` });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// SYSTEM ROLES ENDPOINT (public list of default system roles for reference)
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/system-roles', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const roles = await db.collection('roles').find({ isSystem: true, companyId: null, isActive: true }).sort({ name: 1 }).toArray();
    res.json(roles.map((r: any) => ({ ...r, id: r._id.toString() })));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// INVENTORY ROUTES (protected with permissions)
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/inventory', authMiddleware, requirePermission('inventory', 'view'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    const items = await db.collection('stockitems').find({ companyId, quantity: { $gt: 0 } }).sort({ createdAt: 1 }).toArray();
    res.json({ standardStock: items.filter((i: any) => !i.isRemnant), remnantsStock: items.filter((i: any) => i.isRemnant).sort((a: any, b: any) => Number(a.length) - Number(b.length)) });
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.post('/api/inventory/inward', authMiddleware, requirePermission('inventory', 'inward'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    const { diameter, length = 12000, quantity: rawQty = 0, weightInKgs: rawWeight = 0, costPerKg, typeOfBar = '', brandName = '', vendorName = '' } = req.body;
    let quantity = Number(rawQty), weightInKgs = Number(rawWeight);
    const singleWeight = getSingleBarWeight(Number(diameter), Number(length));
    if (weightInKgs > 0 && quantity === 0) quantity = Math.round(weightInKgs / singleWeight);
    else if (quantity > 0 && weightInKgs === 0) weightInKgs = quantity * singleWeight;
    const filter = { companyId, diameter: Number(diameter), length: Number(length), costPerKg: Number(costPerKg), typeOfBar, brandName, vendorName, isRemnant: false };
    const result = await db.collection('stockitems').findOneAndUpdate(filter, { $inc: { quantity, weightInKgs }, $setOnInsert: { createdAt: new Date() } }, { upsert: true, returnDocument: 'after' });
    await db.collection('inventorytransactions').insertOne({ companyId, type: 'INWARD', diameter: Number(diameter), length: Number(length), quantity, weightInKgs, costPerKg: Number(costPerKg) || 0, brandName, vendorName, typeOfBar: typeOfBar || 'TMT500', referenceName: 'Manual Inward Entry', createdAt: new Date() });

    await logAudit(db, {
      actorId: req.user.sub,
      actorType: 'user',
      companyId,
      module: 'inventory',
      action: 'INVENTORY_INWARD',
      resource: 'stockitems',
      resourceId: result?._id?.toString() || '',
      description: `Added inward stock of ${diameter}mm rebar (${quantity} pcs, ${weightInKgs.toFixed(1)} kg) - ${brandName || 'Standard'}${typeOfBar ? ` (${typeOfBar})` : ''}`,
      newValue: { diameter: Number(diameter), length: Number(length), quantity, weightInKgs, costPerKg: Number(costPerKg) || 0, brandName, vendorName, typeOfBar }
    });

    res.json(result);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.get('/api/inventory/scrap-rules', authMiddleware, requirePermission('settings', 'view'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    const rules = await ensureScrapRules(db, companyId as any);
    res.json(rules);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.post('/api/inventory/scrap-rules', authMiddleware, requirePermission('settings', 'edit'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    if (!companyId) return res.status(400).json({ message: 'Company not found' });
    const { rules } = req.body;
    if (Array.isArray(rules)) {
      await Promise.all(rules.map((r: any) =>
        db.collection('scraprules').findOneAndUpdate(
          { companyId, diameter: Number(r.diameter) },
          { $set: { scrapLengthThreshold: Number(r.scrapLengthThreshold) }, $setOnInsert: { companyId, diameter: Number(r.diameter), createdAt: new Date() } },
          { upsert: true }
        )
      ));
    }
    const updatedRules = await db.collection('scraprules').find({
      $or: [{ companyId }, { companyId: companyId.toString() }]
    }).sort({ diameter: 1 }).toArray();

    await logAudit(db, {
      actorId: req.user.sub,
      actorType: 'user',
      companyId,
      module: 'settings',
      action: 'SCRAP_RULES_UPDATED',
      resource: 'scraprules',
      description: `Updated scrap length threshold configurations`,
      newValue: { rules }
    });

    res.json(updatedRules);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.get('/api/inventory/ledger', authMiddleware, requirePermission('ledger', 'view'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    const ledger = await db.collection('inventorytransactions').find({ companyId }).sort({ createdAt: -1 }).toArray();
    res.json(ledger);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.delete('/api/inventory/:id', authMiddleware, requirePermission('inventory', 'delete'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    const result = await db.collection('stockitems').findOneAndDelete({ _id: new ObjectId(req.params.id), companyId });

    if (result) {
      await logAudit(db, {
        actorId: req.user.sub,
        actorType: 'user',
        companyId,
        module: 'inventory',
        action: 'INVENTORY_DELETE',
        resource: 'stockitems',
        resourceId: req.params.id,
        description: `Deleted ${result.isRemnant ? 'remnant' : 'standard'} stock item of ${result.diameter}mm (${result.quantity} pcs, ${(result.weightInKgs || 0).toFixed(1)} kg)`,
        previousValue: { diameter: result.diameter, length: result.length, quantity: result.quantity, weightInKgs: result.weightInKgs, isRemnant: result.isRemnant }
      });
    }

    res.json({ deleted: !!result });
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.put('/api/inventory/:id', authMiddleware, requirePermission('inventory', 'edit'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    const { quantity } = req.body;

    if (quantity === undefined || Number(quantity) < 0) {
      return res.status(400).json({ message: 'Quantity must be a non-negative number' });
    }

    const item = await db.collection('stockitems').findOne({ _id: new ObjectId(req.params.id), companyId });
    if (!item) return res.status(404).json({ message: 'Stock item not found' });

    const newQty = Number(quantity);
    if (newQty === 0) {
      await db.collection('stockitems').deleteOne({ _id: item._id });
      await logAudit(db, {
        actorId: req.user.sub,
        actorType: 'user',
        companyId,
        module: 'inventory',
        action: 'INVENTORY_DELETE',
        resource: 'stockitems',
        resourceId: item._id.toString(),
        description: `Removed stock item ${item.diameter}mm (Quantity reduced to 0)`,
        previousValue: { quantity: item.quantity, weightInKgs: item.weightInKgs }
      });
      return res.json({ deleted: true });
    }

    const singleWeight = getSingleBarWeight(Number(item.diameter), Number(item.length));
    const newWeight = newQty * singleWeight;

    const result = await db.collection('stockitems').findOneAndUpdate(
      { _id: item._id },
      { $set: { quantity: newQty, weightInKgs: newWeight } },
      { returnDocument: 'after' }
    );

    await logAudit(db, {
      actorId: req.user.sub,
      actorType: 'user',
      companyId,
      module: 'inventory',
      action: 'INVENTORY_UPDATE',
      resource: 'stockitems',
      resourceId: item._id.toString(),
      description: `Updated stock of ${item.diameter}mm rebar from ${item.quantity} pcs (${(item.weightInKgs || 0).toFixed(1)} kg) to ${newQty} pcs (${newWeight.toFixed(1)} kg)`,
      previousValue: { quantity: item.quantity, weightInKgs: item.weightInKgs },
      newValue: { quantity: newQty, weightInKgs: newWeight }
    });

    res.json(result);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.get('/api/inventory/scrapsales', authMiddleware, requirePermission('scrapSales', 'view'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    if (!companyId) return res.json([]);

    const sales = await db.collection('scrapsales').find({ companyId }).sort({ date: -1 }).toArray();
    res.json(sales);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.post('/api/inventory/scrapsales', authMiddleware, requirePermission('scrapSales', 'create'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    const company = companyId ? await db.collection('companies').findOne({ _id: companyId }) : null;
    const { date, buyer, weight, pricePerKg } = req.body;
    if (!date || !buyer || !weight || !pricePerKg) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const newSale = {
      companyId,
      projectName: company?.projectName || '',
      date,
      buyer,
      weight: Number(weight),
      pricePerKg: Number(pricePerKg),
      revenue: Number(weight) * Number(pricePerKg),
      createdAt: new Date()
    };
    const result = await db.collection('scrapsales').insertOne(newSale);

    await logAudit(db, {
      actorId: req.user.sub,
      actorType: 'user',
      companyId,
      module: 'scrapSales',
      action: 'SCRAP_SALE_CREATED',
      resource: 'scrapsales',
      resourceId: result.insertedId.toString(),
      description: `Recorded scrap sale of ${weight} kg at ₹${pricePerKg}/kg to buyer "${buyer}" (Total: ₹${(Number(weight) * Number(pricePerKg)).toLocaleString()})`,
      newValue: newSale
    });

    res.status(201).json({ _id: result.insertedId, ...newSale });
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.put('/api/inventory/scrapsales/:id', authMiddleware, requirePermission('scrapSales', 'edit'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    const { date, buyer, weight, pricePerKg } = req.body;
    const updateDoc: any = {};
    if (date) updateDoc.date = date;
    if (buyer) updateDoc.buyer = buyer;
    if (weight !== undefined) updateDoc.weight = Number(weight);
    if (pricePerKg !== undefined) updateDoc.pricePerKg = Number(pricePerKg);
    if (weight !== undefined && pricePerKg !== undefined) {
      updateDoc.revenue = Number(weight) * Number(pricePerKg);
    } else if (weight !== undefined || pricePerKg !== undefined) {
      const existing = await db.collection('scrapsales').findOne({ _id: new ObjectId(req.params.id), companyId });
      if (existing) {
        const w = weight !== undefined ? Number(weight) : existing.weight;
        const p = pricePerKg !== undefined ? Number(pricePerKg) : existing.pricePerKg;
        updateDoc.revenue = w * p;
      }
    }
    const result = await db.collection('scrapsales').findOneAndUpdate(
      { _id: new ObjectId(req.params.id), companyId },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );

    await logAudit(db, {
      actorId: req.user.sub,
      actorType: 'user',
      companyId,
      module: 'scrapSales',
      action: 'SCRAP_SALE_UPDATED',
      resource: 'scrapsales',
      resourceId: req.params.id,
      description: `Updated scrap sale record (Buyer: ${buyer || 'Unchanged'}, Weight: ${weight !== undefined ? weight + ' kg' : 'Unchanged'})`,
      newValue: updateDoc
    });

    res.json(result);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.delete('/api/inventory/scrapsales/:id', authMiddleware, requirePermission('scrapSales', 'delete'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    const result = await db.collection('scrapsales').findOneAndDelete({ _id: new ObjectId(req.params.id), companyId });

    if (result) {
      await logAudit(db, {
        actorId: req.user.sub,
        actorType: 'user',
        companyId,
        module: 'scrapSales',
        action: 'SCRAP_SALE_DELETED',
        resource: 'scrapsales',
        resourceId: req.params.id,
        description: `Deleted scrap sale to buyer "${result.buyer}" (${result.weight} kg, ₹${result.revenue})`,
        previousValue: result
      });
    }

    res.json({ deleted: !!result });
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

// ── BATCHES ROUTES (protected) ────────────────────────────────────────────────
app.post('/api/batches/optimize', authMiddleware, requirePermission('optimizer', 'create'), async (req: any, res) => {
  try {
    const { stockRows, partsRows, options } = req.body;
    const result = solve1DCSP(stockRows || [], partsRows || [], options || {});
    res.json(result);
  } catch (e: any) {
    console.error('Optimization calculation error:', e);
    res.status(400).json({ message: e.message || 'Failed to solve cutting stock problem' });
  }
});

app.post('/api/batches', authMiddleware, requirePermission('optimizer', 'create'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    const { batchName, inputStock, requiredParts, layouts, summary } = req.body;
    const scrapRules = await ensureScrapRules(db, companyId as any);
    const rulesMap = new Map(scrapRules.map((r: any) => [r.diameter, r.scrapLengthThreshold]));
    let totalScrapKg = 0, totalRemnantKg = 0;

    for (const layout of (layouts || [])) {
      const diameter = Number(layout.diameter);
      const stockLength = Number(layout.stockLength);
      const repetition = Number(layout.repetition);
      const singleWeight = getSingleBarWeight(diameter, stockLength);
      const layoutWeight = singleWeight * repetition;
      const waste = Number(layout.waste);

      if (!layout.isVirtual && layout.dbId) {
        const original = await db.collection('stockitems').findOne({ _id: new ObjectId(layout.dbId) }) as any;
        if (original) {
          const newQty = Math.max(0, original.quantity - repetition);
          const newWeight = Math.max(0, original.weightInKgs - layoutWeight);
          if (newQty === 0) await db.collection('stockitems').deleteOne({ _id: original._id });
          else await db.collection('stockitems').updateOne({ _id: original._id }, { $set: { quantity: newQty, weightInKgs: newWeight } });
          await db.collection('inventorytransactions').insertOne({ companyId, type: 'OUTWARD', diameter, length: stockLength, quantity: repetition, weightInKgs: layoutWeight, brandName: original.brandName || '', vendorName: original.vendorName || '', typeOfBar: original.typeOfBar || '', referenceName: batchName || 'Cutting Batch', createdAt: new Date() });

          if (waste > 0) {
            const threshold = rulesMap.get(diameter) ?? 1000;
            const wasteWeight = getSingleBarWeight(diameter, waste) * repetition;
            if (waste < threshold) {
              totalScrapKg += wasteWeight;
              await db.collection('inventorytransactions').insertOne({ companyId, type: 'SCRAP', diameter, length: waste, quantity: repetition, weightInKgs: wasteWeight, brandName: original.brandName || '', vendorName: original.vendorName || '', typeOfBar: original.typeOfBar || '', referenceName: batchName || 'Cutting Batch', createdAt: new Date() });
            } else {
              totalRemnantKg += wasteWeight;
              await db.collection('stockitems').findOneAndUpdate(
                { companyId, diameter, length: waste, isRemnant: true, costPerKg: original.costPerKg, typeOfBar: original.typeOfBar || '', brandName: original.brandName || '', vendorName: original.vendorName || '' },
                { $inc: { quantity: repetition, weightInKgs: wasteWeight }, $setOnInsert: { createdAt: new Date() } },
                { upsert: true }
              );
              await db.collection('inventorytransactions').insertOne({ companyId, type: 'REMNANT', diameter, length: waste, quantity: repetition, weightInKgs: wasteWeight, brandName: original.brandName || '', vendorName: original.vendorName || '', typeOfBar: original.typeOfBar || '', referenceName: batchName || 'Cutting Batch', createdAt: new Date() });
            }
          }
        }
      } else {
        if (waste > 0) {
          const threshold = rulesMap.get(diameter) ?? 1000;
          const wasteWeight = getSingleBarWeight(diameter, waste) * repetition;
          if (waste < threshold) {
            totalScrapKg += wasteWeight;
            await db.collection('inventorytransactions').insertOne({ companyId, type: 'SCRAP', diameter, length: waste, quantity: repetition, weightInKgs: wasteWeight, referenceName: batchName || 'Cutting Batch', createdAt: new Date() });
          } else {
            totalRemnantKg += wasteWeight;
          }
        }
      }
    }

    const batch = await db.collection('batches').insertOne({ companyId, batchName, inputStock, requiredParts, layouts, summary: { ...summary, totalScrapKg, totalRemnantKg }, createdAt: new Date() });

    await logAudit(db, {
      actorId: req.user.sub,
      actorType: 'user',
      companyId,
      module: 'optimizer',
      action: 'BATCH_CREATED',
      resource: 'batches',
      resourceId: batch.insertedId.toString(),
      description: `Executed and saved cutting batch "${batchName || 'Cutting Batch'}" (${(layouts || []).length} cutting layouts, Scrap: ${totalScrapKg.toFixed(1)} kg, Remnants: ${totalRemnantKg.toFixed(1)} kg)`,
      newValue: { batchName, summary: { ...summary, totalScrapKg, totalRemnantKg } }
    });

    res.status(201).json({ _id: batch.insertedId, batchName, summary: { ...summary, totalScrapKg, totalRemnantKg } });
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.get('/api/batches', authMiddleware, requirePermission('history', 'view'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    const batches = await db.collection('batches').find({ companyId }).sort({ createdAt: -1 }).toArray();
    res.json(batches);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.put('/api/batches/:id', authMiddleware, requirePermission('history', 'edit'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    const { batchName } = req.body;
    if (!batchName || !batchName.trim()) {
      return res.status(400).json({ message: 'Batch name is required' });
    }
    const result = await db.collection('batches').findOneAndUpdate(
      { _id: new ObjectId(req.params.id), companyId },
      { $set: { batchName: batchName.trim() } },
      { returnDocument: 'after' }
    );

    await logAudit(db, {
      actorId: req.user.sub,
      actorType: 'user',
      companyId,
      module: 'history',
      action: 'BATCH_UPDATED',
      resource: 'batches',
      resourceId: req.params.id,
      description: `Renamed cutting batch to "${batchName.trim()}"`,
      newValue: { batchName: batchName.trim() }
    });

    res.json(result);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.delete('/api/batches/:id', authMiddleware, requirePermission('history', 'delete'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    const result = await db.collection('batches').findOneAndDelete({ _id: new ObjectId(req.params.id), companyId });

    if (result) {
      await logAudit(db, {
        actorId: req.user.sub,
        actorType: 'user',
        companyId,
        module: 'history',
        action: 'BATCH_DELETED',
        resource: 'batches',
        resourceId: req.params.id,
        description: `Deleted cutting batch "${result.batchName || 'Cutting Batch'}"`,
        previousValue: { batchName: result.batchName, summary: result.summary }
      });
    }

    res.json({ deleted: !!result });
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.get('/api/batches/scrap-records', authMiddleware, requirePermission('history', 'view'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;
    if (!companyId) return res.json([]);

    const batches = await db.collection('batches').find({ companyId }).sort({ createdAt: -1 }).toArray();
    const scrapRules = await ensureScrapRules(db, companyId);
    const rulesMap = new Map(scrapRules.map((r: any) => [r.diameter, r.scrapLengthThreshold]));

    const records = batches.map((b: any) => {
      const batchId = b._id.toString();
      const batchName = b.batchName || 'Cutting Batch';
      const createdAt = b.createdAt;

      const diameterBreakdownMap = new Map<number, { count: number; scrapKg: number; totalWasteMm: number }>();
      let computedScrapKg = 0;
      let computedRemnantKg = 0;

      if (b.layouts) {
        b.layouts.forEach((layout: any) => {
          const dia = Number(layout.diameter);
          const waste = Number(layout.waste);
          const rep = Number(layout.repetition);
          const threshold = rulesMap.get(dia) ?? 1000;

          if (waste > 0) {
            const wasteWeight = getSingleBarWeight(dia, waste) * rep;
            if (waste < threshold) {
              computedScrapKg += wasteWeight;
              const current = diameterBreakdownMap.get(dia) || { count: 0, scrapKg: 0, totalWasteMm: 0 };
              current.count += rep;
              current.scrapKg += wasteWeight;
              current.totalWasteMm += waste * rep;
              diameterBreakdownMap.set(dia, current);
            } else {
              computedRemnantKg += wasteWeight;
            }
          }
        });
      }

      const totalScrapKg = Math.round((b.summary?.totalScrapKg !== undefined && b.summary?.totalScrapKg !== null ? b.summary.totalScrapKg : computedScrapKg) * 100) / 100;
      const totalRemnantKg = Math.round((b.summary?.totalRemnantKg !== undefined && b.summary?.totalRemnantKg !== null ? b.summary.totalRemnantKg : computedRemnantKg) * 100) / 100;

      const diameterBreakdown = Array.from(diameterBreakdownMap.entries()).map(([diameter, data]) => ({
        diameter,
        pieces: data.count,
        scrapKg: Math.round(data.scrapKg * 100) / 100,
        totalWasteMm: data.totalWasteMm,
      })).sort((a, b) => a.diameter - b.diameter);

      return {
        batchId,
        batchName,
        createdAt,
        totalScrapKg,
        totalRemnantKg,
        avgUtilization: b.summary?.avgUtilization || 0,
        diameterBreakdown,
      };
    });

    res.json(records);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.get('/api/batches/stats', authMiddleware, requirePermission('overview', 'view'), async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc ? new ObjectId(userDoc.companyId) : null;

    const liveStock = await db.collection('stockitems').find({ companyId, quantity: { $gt: 0 } }).toArray();
    let liveStandardKg = 0, liveRemnantsKg = 0;
    const diameterWeights: { [key: number]: number } = { 8: 0, 10: 0, 12: 0, 16: 0, 20: 0, 25: 0, 32: 0 };
    const remnantDiameterWeights: { [key: number]: number } = { 8: 0, 10: 0, 12: 0, 16: 0, 20: 0, 25: 0, 32: 0 };

    liveStock.forEach((i: any) => {
      const dia = Number(i.diameter);
      if (i.isRemnant) {
        liveRemnantsKg += i.weightInKgs || 0;
        if (remnantDiameterWeights[dia] !== undefined) {
          remnantDiameterWeights[dia] += i.weightInKgs || 0;
        }
      } else {
        liveStandardKg += i.weightInKgs || 0;
      }
      if (diameterWeights[dia] !== undefined) {
        diameterWeights[dia] += i.weightInKgs || 0;
      }
    });

    const batches = await db.collection('batches').find({ companyId }).sort({ createdAt: 1 }).toArray();
    let totalScrapKg = 0, totalStockUsedKg = 0;
    const dailyScrapMap = new Map<string, number>();

    batches.forEach((b: any) => {
      totalScrapKg += b.summary?.totalScrapKg || 0;
      (b.layouts || []).forEach((l: any) => {
        if (!l.isVirtual) totalStockUsedKg += getSingleBarWeight(Number(l.diameter), Number(l.stockLength)) * Number(l.repetition);
      });
      if (b.createdAt) {
        const key = new Date(b.createdAt).toISOString().split('T')[0];
        dailyScrapMap.set(key, (dailyScrapMap.get(key) || 0) + (b.summary?.totalScrapKg || 0));
      }
    });

    const dailyScrapGraph = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().split('T')[0];
      return { 
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
        fullDate: key,
        scrapKg: Math.round((dailyScrapMap.get(key) || 0) * 100) / 100 
      };
    });

    const wastagePercentage = totalStockUsedKg > 0 ? (totalScrapKg / totalStockUsedKg) * 100 : 0;

    const scrapSales = await db.collection('scrapsales').find({ companyId }).toArray();
    let totalScrapSoldWeight = 0;
    let totalScrapRevenue = 0;
    let totalScrapLossDifferential = 0;
    const estPurchasePriceWithGst = 60;

    scrapSales.forEach((s: any) => {
      totalScrapSoldWeight += s.weight || 0;
      totalScrapRevenue += s.revenue || 0;
      totalScrapLossDifferential += ((estPurchasePriceWithGst - (s.pricePerKg || 0)) * (s.weight || 0));
    });

    // Compute Inward Steel Purchased Value and Weight Till Date
    const inwardTransactions = await db.collection('inventorytransactions').find({ companyId, type: 'INWARD' }).toArray();
    let totalSteelPurchasedCost = 0;
    let totalSteelPurchasedKg = 0;
    inwardTransactions.forEach((t: any) => {
      const wt = Number(t.weightInKgs) || 0;
      const cost = Number(t.costPerKg) || 60;
      totalSteelPurchasedKg += wt;
      totalSteelPurchasedCost += wt * cost;
    });

    if (totalSteelPurchasedCost === 0 && liveStock.length > 0) {
      liveStock.forEach((i: any) => {
        const wt = Number(i.weightInKgs) || 0;
        const cost = Number(i.costPerKg) || 60;
        totalSteelPurchasedKg += wt;
        totalSteelPurchasedCost += wt * cost;
      });
    }

    const liveScrapKg = Math.max(0, totalScrapKg - totalScrapSoldWeight);
    const lostMaterialValue = Math.max(0, totalScrapLossDifferential);

    // Format remnant weights rounded to 2 decimals
    const formattedRemnantWeights: { [key: number]: number } = {};
    Object.keys(remnantDiameterWeights).forEach(dia => {
      const key = Number(dia);
      formattedRemnantWeights[key] = Math.round(remnantDiameterWeights[key] * 100) / 100;
    });

    res.json({
      liveStandardKg: Math.round(liveStandardKg * 100) / 100,
      liveRemnantsKg: Math.round(liveRemnantsKg * 100) / 100,
      totalLiveStockKg: Math.round((liveStandardKg + liveRemnantsKg) * 100) / 100,
      liveScrapKg: Math.round(liveScrapKg * 100) / 100,
      totalScrapKg: Math.round(totalScrapKg * 100) / 100,
      wastagePercentage: Math.round(wastagePercentage * 100) / 100,
      dailyScrapGraph,
      diameterWeights,
      remnantDiameterWeights: formattedRemnantWeights,
      totalSteelPurchasedCost: Math.round(totalSteelPurchasedCost),
      totalSteelPurchasedKg: Math.round(totalSteelPurchasedKg * 100) / 100,
      totalScrapSoldWeight: Math.round(totalScrapSoldWeight * 100) / 100,
      totalScrapRevenue: Math.round(totalScrapRevenue * 100) / 100,
      totalScrapLossDifferential: Math.round(totalScrapLossDifferential * 100) / 100,
      lostMaterialValue: Math.round(lostMaterialValue * 100) / 100,
    });
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// START — with seed initialization
// ══════════════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    const database = await connectDB();
    console.log('🌱 Seeding defaults...');
    await seedDefaults(database);
    console.log('🌱 Seeding complete.');
  } catch (err) {
    console.error('⚠️  Seed failed (non-fatal):', err);
  }
  app.listen(PORT, () => console.log(`🚀 Express server listening on port ${PORT}`));
}

startServer();
