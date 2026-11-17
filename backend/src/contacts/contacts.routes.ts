import { Router } from 'express';
import { ObjectId, Db } from 'mongodb';
import ExcelJS from 'exceljs';
import {
  resolveUserAndCompany,
  assertProjectAccess,
  idQuery,
} from '../projects/project-access';
import {
  ContactPhoneNumber,
  ContactDoc,
  ContactCategoryDoc,
} from './contacts.types';

export const DEFAULT_CONTACT_CATEGORIES = [
  'Client',
  'Contractor',
  'Subcontractor',
  'Supplier',
  'Architect',
  'Structural Engineer',
  'Civil Engineer',
  'Electrical Contractor',
  'Plumbing Contractor',
  'Labour Contractor',
  'Consultant',
  'Government Officer',
  'Site Staff',
  'Transporter',
  'Other',
];

export function toObjectId(id: any): ObjectId | null {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
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

export function companyFilter(companyId: any): any {
  if (!companyId) return { companyId: null };
  const objId = toObjectId(companyId);
  if (objId) {
    return { $or: [{ companyId: objId }, { companyId: String(companyId) }] };
  }
  return { companyId: String(companyId) };
}

/**
 * Normalizes any phone string down to clean digits.
 * If 12 digits starting with '91' (India country code), strips the leading '91'.
 * If 11 digits starting with '0', strips the leading '0'.
 */
export function normalizePhoneNumber(raw: any): string {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Ensures indexes exist on the contacts collections for lightning-fast queries and duplicate lookups.
 */
let indexesCreated = false;
async function ensureContactIndexes(db: Db) {
  if (indexesCreated) return;
  try {
    const contactsColl = db.collection('contacts');
    await contactsColl.createIndex({ companyId: 1, isArchived: 1, createdAt: -1 });
    await contactsColl.createIndex({ companyId: 1, normalizedPhones: 1 });
    await contactsColl.createIndex({ companyId: 1, nameLower: 1 });
    await contactsColl.createIndex({ companyId: 1, categoryId: 1 });
    await contactsColl.createIndex({ companyId: 1, projectIds: 1 });
    await contactsColl.createIndex({ companyId: 1, isFavourite: 1 });
    await contactsColl.createIndex({ companyId: 1, visibility: 1, createdBy: 1 });

    const catColl = db.collection('contact_categories');
    await catColl.createIndex({ companyId: 1, nameLower: 1 });

    const logsColl = db.collection('contact_activity_logs');
    await logsColl.createIndex({ contactId: 1, createdAt: -1 });
    await logsColl.createIndex({ companyId: 1, createdAt: -1 });

    indexesCreated = true;
  } catch (err) {
    console.warn('⚠️ Warning: failed to create contact indexes:', err);
  }
}

/**
 * Ensures default categories are seeded for the company
 */
async function ensureDefaultCategories(db: Db, companyId: string) {
  const coll = db.collection('contact_categories');
  const count = await coll.countDocuments(companyFilter(companyId));
  if (count === 0) {
    const now = new Date();
    const docs = DEFAULT_CONTACT_CATEGORIES.map((name, idx) => ({
      companyId: toObjectId(companyId) || companyId,
      name,
      nameLower: name.toLowerCase().trim(),
      isDefault: true,
      sortOrder: idx,
      createdAt: now,
      updatedAt: now,
    }));
    try {
      await coll.insertMany(docs);
    } catch (_) { }
  }
}

/**
 * Helper to check permissions on user request
 */
function hasPermission(ctx: any, feature: string): boolean {
  if (ctx.isCompanyAdmin || ctx.isDeveloper) return true;
  const userDoc = ctx.userDoc;
  if (!userDoc) return false;
  // If no granular features are loaded, fallback to active role check
  return true;
}

export function createContactsRouter(getDb: () => any, authMiddleware: any, logAudit?: any): Router {
  const router = Router();
  router.use(authMiddleware);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. SUMMARY COUNTERS
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/summary', async (req: any, res) => {
    try {
      const db = getDb();
      await ensureContactIndexes(db);
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      await ensureDefaultCategories(db, companyId);

      const baseQuery: any = {
        ...companyFilter(companyId),
      };

      // Visibility scoping
      if (!ctx.isCompanyAdmin && !ctx.isDeveloper) {
        baseQuery.$or = [
          { visibility: 'shared' },
          { visibility: { $exists: false } },
          { createdBy: toObjectId(ctx.userId) || ctx.userId },
        ];
      }

      const activeQuery = { ...baseQuery, isArchived: { $ne: true } };
      const archivedQuery = { ...baseQuery, isArchived: true };
      const favQuery = { ...activeQuery, isFavourite: true };

      // Recently added (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentQuery = { ...activeQuery, createdAt: { $gte: sevenDaysAgo } };

      const [totalActive, totalArchived, totalFavourites, totalRecent, categories] = await Promise.all([
        db.collection('contacts').countDocuments(activeQuery),
        db.collection('contacts').countDocuments(archivedQuery),
        db.collection('contacts').countDocuments(favQuery),
        db.collection('contacts').countDocuments(recentQuery),
        db.collection('contact_categories').find(companyFilter(companyId)).sort({ sortOrder: 1, name: 1 }).toArray(),
      ]);

      // Count contacts per category
      const categoryCounts = await db.collection('contacts').aggregate([
        { $match: activeQuery },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      ]).toArray();

      const catCountMap = new Map();
      categoryCounts.forEach((c: any) => {
        if (c._id) catCountMap.set(String(c._id), c.count);
      });

      const categoriesWithCount = categories.map((cat: any) => ({
        id: String(cat._id),
        _id: String(cat._id),
        name: cat.name,
        isDefault: cat.isDefault || false,
        count: catCountMap.get(String(cat._id)) || 0,
      }));

      res.json({
        totalActive,
        totalArchived,
        totalFavourites,
        totalRecent,
        categories: categoriesWithCount,
      });
    } catch (err: any) {
      console.error('Contacts summary error:', err);
      res.status(500).json({ message: err.message || 'Failed to fetch summary' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. CHECK DUPLICATE PHONE NUMBER
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/check-duplicate', async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const phone = req.query.phone;
      const excludeId = req.query.excludeId;

      if (!phone) {
        return res.json({ exists: false, contact: null });
      }

      const normalized = normalizePhoneNumber(phone);
      if (!normalized || normalized.length < 6) {
        return res.json({ exists: false, contact: null });
      }

      const query: any = {
        ...companyFilter(companyId),
        normalizedPhones: normalized,
      };

      const excludeObjId = toObjectId(excludeId);
      if (excludeObjId) {
        query._id = { $ne: excludeObjId };
      } else if (excludeId) {
        query._id = { $ne: excludeId };
      }

      const existing = await db.collection('contacts').findOne(query);

      if (existing) {
        return res.json({
          exists: true,
          contact: {
            id: String(existing._id),
            _id: String(existing._id),
            name: existing.name,
            companyName: existing.companyName,
            designation: existing.designation,
            categoryName: existing.categoryName,
            primaryPhone: existing.primaryPhone,
            isArchived: existing.isArchived || false,
            projectIds: (existing.projectIds || []).map((p: any) => String(p)),
            createdByName: existing.createdByName,
          },
        });
      }

      return res.json({ exists: false, contact: null });
    } catch (err: any) {
      console.error('Check duplicate phone error:', err);
      res.status(500).json({ message: 'Error checking duplicate phone' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. CATEGORIES MANAGEMENT
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/categories', async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      await ensureDefaultCategories(db, companyId);

      const categories = await db
        .collection('contact_categories')
        .find(companyFilter(companyId))
        .sort({ sortOrder: 1, name: 1 })
        .toArray();

      res.json(
        categories.map((c: any) => ({
          id: String(c._id),
          _id: String(c._id),
          name: c.name,
          isDefault: c.isDefault || false,
        }))
      );
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fetch categories' });
    }
  });

  router.post('/categories', async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const name = (req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ message: 'Category name is required' });
      }

      const nameLower = name.toLowerCase();
      const existing = await db.collection('contact_categories').findOne({
        ...companyFilter(companyId),
        nameLower,
      });

      if (existing) {
        return res.status(409).json({ message: 'Category with this name already exists' });
      }

      const now = new Date();
      const insertResult = await db.collection('contact_categories').insertOne({
        companyId: toObjectId(companyId) || companyId,
        name,
        nameLower,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      res.status(201).json({
        id: String(insertResult.insertedId),
        _id: String(insertResult.insertedId),
        name,
        isDefault: false,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to create category' });
    }
  });

  router.put('/categories/:id', async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const catId = req.params.id;
      const name = (req.body.name || '').trim();
      if (!name) return res.status(400).json({ message: 'Category name is required' });

      const catObjId = toObjectId(catId);
      const catQuery = catObjId
        ? { ...companyFilter(companyId), $or: [{ _id: catObjId }, { _id: catId }] }
        : { ...companyFilter(companyId), _id: catId };

      const existing = await db.collection('contact_categories').findOne(catQuery as any);
      if (!existing) return res.status(404).json({ message: 'Category not found' });

      const nameLower = name.toLowerCase();
      await db.collection('contact_categories').updateOne(catQuery as any, {
        $set: { name, nameLower, updatedAt: new Date() },
      });

      // Also update denormalized categoryName on contacts
      await db.collection('contacts').updateMany(
        {
          ...companyFilter(companyId),
          categoryId: { $in: [catId, catObjId].filter(Boolean) },
        },
        { $set: { categoryName: name } }
      );

      res.json({ message: 'Category updated successfully', id: catId, name });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update category' });
    }
  });

  router.delete('/categories/:id', async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const catId = req.params.id;
      const catObjId = toObjectId(catId);
      const catQuery = catObjId
        ? { ...companyFilter(companyId), $or: [{ _id: catObjId }, { _id: catId }] }
        : { ...companyFilter(companyId), _id: catId };

      const existing = await db.collection('contact_categories').findOne(catQuery as any);
      if (!existing) return res.status(404).json({ message: 'Category not found' });

      // Check if contacts are currently assigned to this category
      const contactsUsing = await db.collection('contacts').countDocuments({
        ...companyFilter(companyId),
        categoryId: { $in: [catId, catObjId].filter(Boolean) },
      } as any);

      if (contactsUsing > 0) {
        return res.status(400).json({
          message: `Cannot delete category: ${contactsUsing} contact(s) are currently categorized under it. Reassign them first.`,
        });
      }

      await db.collection('contact_categories').deleteOne(catQuery as any);
      res.json({ message: 'Category deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to delete category' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. GET CONTACTS LIST (Search, Filter, Paginate, Scoped Visibility)
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/', async (req: any, res) => {
    try {
      const db = getDb();
      await ensureContactIndexes(db);
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const search = (req.query.search || '').trim();
      const categoryId = req.query.categoryId;
      const projectId = req.query.projectId;
      const visibility = req.query.visibility; // 'all' | 'shared' | 'private'
      const isFavourite = req.query.isFavourite;
      const isArchived = req.query.isArchived === 'true';
      const page = Math.max(1, parseInt(req.query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
      const skip = (page - 1) * limit;

      const query: any = {
        ...companyFilter(companyId),
        isArchived: isArchived ? true : { $ne: true },
      };

      // 1. Private / Shared Visibility Enforcing
      if (!ctx.isCompanyAdmin && !ctx.isDeveloper) {
        if (visibility === 'private') {
          query.visibility = 'private';
          query.createdBy = toObjectId(ctx.userId) || ctx.userId;
        } else if (visibility === 'shared') {
          query.visibility = { $in: ['shared', null] };
        } else {
          query.$or = [
            { visibility: 'shared' },
            { visibility: { $exists: false } },
            { createdBy: toObjectId(ctx.userId) || ctx.userId },
          ];
        }
      } else {
        if (visibility && visibility !== 'all') {
          query.visibility = visibility;
        }
      }

      // 2. Category Filter
      if (categoryId && categoryId !== 'all') {
        const catObjId = toObjectId(categoryId);
        query.categoryId = catObjId ? { $in: [categoryId, catObjId] } : categoryId;
      }

      // 3. Project Filter
      if (projectId && projectId !== 'all') {
        const pObjId = toObjectId(projectId);
        query.projectIds = pObjId ? { $in: [projectId, pObjId] } : projectId;
      }

      // 4. Favourite Filter
      if (isFavourite === 'true') {
        query.isFavourite = true;
      }

      // 5. Search Text (Name, Company, Designation, or Phone)
      if (search) {
        const normalizedSearch = normalizePhoneNumber(search);
        const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        const searchConditions: any[] = [
          { name: searchRegex },
          { companyName: searchRegex },
          { designation: searchRegex },
          { email: searchRegex },
        ];

        if (normalizedSearch && normalizedSearch.length >= 3) {
          searchConditions.push({ normalizedPhones: { $regex: normalizedSearch } });
        }

        if (query.$or) {
          query.$and = [{ $or: query.$or }, { $or: searchConditions }];
          delete query.$or;
        } else {
          query.$or = searchConditions;
        }
      }

      // Sort: Favourites first, then newest
      const sortConfig: any = { isFavourite: -1, createdAt: -1 };

      const [total, rawContacts, projects] = await Promise.all([
        db.collection('contacts').countDocuments(query),
        db.collection('contacts').find(query).sort(sortConfig).skip(skip).limit(limit).toArray(),
        db.collection('projects').find(companyFilter(companyId)).project({ name: 1, projectName: 1, _id: 1 }).toArray(),
      ]);

      const projectMap = new Map<string, string>();
      projects.forEach((p: any) => {
        projectMap.set(String(p._id), p.name || p.projectName || 'Project');
      });

      const contacts = rawContacts.map((c: any) => {
        const id = String(c._id);
        const pIds = (c.projectIds || []).map((p: any) => String(p));
        const resolvedProjects = pIds.map((pid: string) => ({
          id: pid,
          name: projectMap.get(pid) || 'Project',
        }));

        return {
          id,
          _id: id,
          companyId: String(c.companyId),
          name: c.name || '',
          avatar: c.avatar || null,
          designation: c.designation || '',
          categoryId: c.categoryId ? String(c.categoryId) : null,
          categoryName: c.categoryName || 'Other',
          companyName: c.companyName || '',
          description: c.description || '',
          email: c.email || '',
          website: c.website || '',
          phones: c.phones || [],
          primaryPhone: c.primaryPhone || '',
          address: c.address || {},
          projectIds: pIds,
          projects: resolvedProjects,
          visibility: c.visibility || 'shared',
          isFavourite: Boolean(c.isFavourite),
          isArchived: Boolean(c.isArchived),
          notes: c.notes || '',
          tags: c.tags || [],
          createdBy: c.createdBy ? String(c.createdBy) : null,
          createdByName: c.createdByName || 'Team Member',
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      });

      res.json({
        contacts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      });
    } catch (err: any) {
      console.error('Get contacts list error:', err);
      res.status(500).json({ message: err.message || 'Failed to fetch contacts' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. GET SINGLE CONTACT BY ID (Detailed Profile & Activity Log)
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/:id', async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const contactId = req.params.id;
      const contactObjId = toObjectId(contactId);

      const contactQuery = contactObjId
        ? { ...companyFilter(companyId), $or: [{ _id: contactObjId }, { _id: contactId }] }
        : { ...companyFilter(companyId), _id: contactId };

      const contact = await db.collection('contacts').findOne(contactQuery);
      if (!contact) {
        return res.status(404).json({ message: 'Contact not found' });
      }

      // Check private visibility
      const isOwner = String(contact.createdBy) === String(ctx.userId);
      if (contact.visibility === 'private' && !isOwner && !ctx.isCompanyAdmin && !ctx.isDeveloper) {
        return res.status(403).json({ message: 'This contact is private to its creator' });
      }

      // Resolve projects
      const pIds = (contact.projectIds || []).map((p: any) => toObjectId(p) || String(p));
      const projectDocs = await db
        .collection('projects')
        .find({ ...companyFilter(companyId), _id: { $in: pIds } })
        .toArray();

      const projects = projectDocs.map((p: any) => ({
        id: String(p._id),
        name: p.name || p.projectName || 'Project',
        status: p.status || 'Active',
      }));

      // Resolve category
      let categoryName = contact.categoryName || '';
      if (contact.categoryId) {
        const catDoc = await db.collection('contact_categories').findOne(idQuery(String(contact.categoryId)) as any);
        if (catDoc) categoryName = catDoc.name;
      }

      // Fetch audit activity logs
      const activityLogs = await db
        .collection('contact_activity_logs')
        .find({ contactId: String(contact._id) })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();

      res.json({
        id: String(contact._id),
        _id: String(contact._id),
        companyId: String(contact.companyId),
        name: contact.name,
        avatar: contact.avatar || null,
        designation: contact.designation || '',
        categoryId: contact.categoryId ? String(contact.categoryId) : null,
        categoryName,
        companyName: contact.companyName || '',
        description: contact.description || '',
        email: contact.email || '',
        website: contact.website || '',
        phones: contact.phones || [],
        primaryPhone: contact.primaryPhone || '',
        address: contact.address || {},
        projectIds: (contact.projectIds || []).map((p: any) => String(p)),
        projects,
        visibility: contact.visibility || 'shared',
        isFavourite: Boolean(contact.isFavourite),
        isArchived: Boolean(contact.isArchived),
        notes: contact.notes || '',
        tags: contact.tags || [],
        attachments: contact.attachments || [],
        createdBy: contact.createdBy ? String(contact.createdBy) : null,
        createdByName: contact.createdByName || '',
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
        activityLogs: activityLogs.map((log: any) => ({
          id: String(log._id),
          action: log.action,
          details: log.details,
          performedByName: log.performedByName || 'User',
          createdAt: log.createdAt,
        })),
      });
    } catch (err: any) {
      console.error('Get contact by id error:', err);
      res.status(500).json({ message: err.message || 'Failed to fetch contact details' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. CREATE CONTACT (Duplicate Protection & Project Association)
  // ──────────────────────────────────────────────────────────────────────────
  router.post('/', async (req: any, res) => {
    try {
      const db = getDb();
      await ensureContactIndexes(db);
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const {
        name,
        avatar,
        designation,
        categoryId,
        categoryName: rawCatName,
        companyName,
        description,
        email,
        website,
        phones: rawPhones = [],
        address = {},
        projectIds: rawProjectIds = [],
        visibility = 'shared',
        isFavourite = false,
        notes = '',
        tags = [],
        attachments = [],
        forceDuplicate = false,
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Contact name is required' });
      }

      // 1. Process & Normalize Phone Numbers
      const phones: ContactPhoneNumber[] = [];
      const normalizedPhones: string[] = [];

      (Array.isArray(rawPhones) ? rawPhones : []).forEach((p: any, idx: number) => {
        if (!p || !p.number) return;
        const norm = normalizePhoneNumber(p.number);
        if (norm) {
          phones.push({
            number: String(p.number).trim(),
            normalizedNumber: norm,
            label: p.label || (idx === 0 ? 'Mobile' : 'Other'),
            isPrimary: p.isPrimary !== undefined ? Boolean(p.isPrimary) : idx === 0,
            hasWhatsApp: Boolean(p.hasWhatsApp),
          });
          if (!normalizedPhones.includes(norm)) {
            normalizedPhones.push(norm);
          }
        }
      });

      // Ensure at least one phone has isPrimary = true if any phones exist
      if (phones.length > 0 && !phones.some((p) => p.isPrimary)) {
        phones[0].isPrimary = true;
      }

      const primaryPhone = phones.find((p) => p.isPrimary)?.number || phones[0]?.number || '';

      // 2. Duplicate Detection: Check if any phone already exists in this tenant
      if (normalizedPhones.length > 0 && !forceDuplicate) {
        const existingDuplicate = await db.collection('contacts').findOne({
          ...companyFilter(companyId),
          normalizedPhones: { $in: normalizedPhones },
          isArchived: { $ne: true },
        });

        if (existingDuplicate) {
          return res.status(409).json({
            code: 'DUPLICATE_PHONE_DETECTED',
            message: `Phone number is already associated with existing contact: ${existingDuplicate.name}`,
            duplicateContact: {
              id: String(existingDuplicate._id),
              name: existingDuplicate.name,
              companyName: existingDuplicate.companyName || '',
              designation: existingDuplicate.designation || '',
              categoryName: existingDuplicate.categoryName || '',
              primaryPhone: existingDuplicate.primaryPhone || '',
            },
          });
        }
      }

      // 3. Resolve Category
      let resolvedCategoryName = (rawCatName || '').trim();
      let resolvedCategoryId: any = toObjectId(categoryId) || categoryId || null;

      if (resolvedCategoryId) {
        const cat = await db.collection('contact_categories').findOne(idQuery(String(resolvedCategoryId)) as any);
        if (cat) {
          resolvedCategoryName = cat.name;
        }
      } else if (resolvedCategoryName) {
        const cat = await db.collection('contact_categories').findOne({
          ...companyFilter(companyId),
          nameLower: resolvedCategoryName.toLowerCase(),
        });
        if (cat) {
          resolvedCategoryId = cat._id;
          resolvedCategoryName = cat.name;
        }
      }

      // 4. Validate & Associate Projects (Ensure projects belong to this tenant)
      const sanitizedProjectIds: any[] = [];
      if (Array.isArray(rawProjectIds) && rawProjectIds.length > 0) {
        const validProjects = await db
          .collection('projects')
          .find({
            ...companyFilter(companyId),
            _id: { $in: rawProjectIds.map((pid: string) => toObjectId(pid) || pid) },
          })
          .project({ _id: 1 })
          .toArray();

        validProjects.forEach((p: any) => sanitizedProjectIds.push(String(p._id)));
      }

      const now = new Date();
      const creatorName = ctx.userDoc
        ? `${ctx.userDoc.firstName || ''} ${ctx.userDoc.lastName || ''}`.trim() || ctx.userDoc.email
        : 'Team Member';

      const newContactDoc: ContactDoc = {
        companyId: toObjectId(companyId) || companyId,
        name: name.trim(),
        nameLower: name.trim().toLowerCase(),
        avatar: avatar || null,
        designation: (designation || '').trim(),
        categoryId: resolvedCategoryId,
        categoryName: resolvedCategoryName || 'Other',
        companyName: (companyName || '').trim(),
        description: (description || '').trim(),
        email: (email || '').trim().toLowerCase(),
        website: (website || '').trim(),
        phones,
        primaryPhone,
        normalizedPhones,
        address: {
          street: (address.street || '').trim(),
          city: (address.city || '').trim(),
          state: (address.state || '').trim(),
          country: (address.country || '').trim(),
          pincode: (address.pincode || '').trim(),
        },
        projectIds: sanitizedProjectIds,
        visibility: visibility === 'private' ? 'private' : 'shared',
        isFavourite: Boolean(isFavourite),
        isArchived: false,
        notes: (notes || '').trim(),
        tags: Array.isArray(tags) ? tags.map((t: string) => String(t).trim()).filter(Boolean) : [],
        attachments: Array.isArray(attachments) ? attachments : [],
        createdBy: (toObjectId(ctx.userId) || ctx.userId || 'system') as any,
        createdByName: creatorName,
        updatedBy: (toObjectId(ctx.userId) || ctx.userId || 'system') as any,
        updatedByName: creatorName,
        createdAt: now,
        updatedAt: now,
      };

      const result = await db.collection('contacts').insertOne(newContactDoc as any);
      const contactId = String(result.insertedId);

      // Record Activity Log
      await db.collection('contact_activity_logs').insertOne({
        contactId,
        companyId: toObjectId(companyId) || companyId,
        action: 'created',
        details: {
          name: newContactDoc.name,
          category: newContactDoc.categoryName,
          projectCount: sanitizedProjectIds.length,
          visibility: newContactDoc.visibility,
        },
        performedBy: toObjectId(ctx.userId) || ctx.userId,
        performedByName: creatorName,
        createdAt: now,
      });

      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          actorType: 'user',
          actorName: creatorName,
          companyId,
          action: 'CONTACT_CREATED',
          resource: 'contacts',
          resourceId: contactId,
          details: { name: newContactDoc.name, primaryPhone },
        });
      }

      res.status(201).json({
        id: contactId,
        _id: contactId,
        message: 'Contact created successfully',
        contact: { ...newContactDoc, id: contactId, _id: contactId },
      });
    } catch (err: any) {
      console.error('Create contact error:', err);
      res.status(500).json({ message: err.message || 'Failed to create contact' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. UPDATE CONTACT
  // ──────────────────────────────────────────────────────────────────────────
  router.put('/:id', async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const contactId = req.params.id;
      const contactObjId = toObjectId(contactId);

      const contactQuery = contactObjId
        ? { ...companyFilter(companyId), $or: [{ _id: contactObjId }, { _id: contactId }] }
        : { ...companyFilter(companyId), _id: contactId };

      const existing = await db.collection('contacts').findOne(contactQuery as any);
      if (!existing) {
        return res.status(404).json({ message: 'Contact not found' });
      }

      // Check edit permission: creator, admin, or developer
      const isOwner = String(existing.createdBy) === String(ctx.userId);
      if (!isOwner && !ctx.isCompanyAdmin && !ctx.isDeveloper) {
        return res.status(403).json({ message: 'You do not have permission to edit this contact' });
      }

      const {
        name,
        avatar,
        designation,
        categoryId,
        categoryName: rawCatName,
        companyName,
        description,
        email,
        website,
        phones: rawPhones,
        address,
        projectIds: rawProjectIds,
        visibility,
        notes,
        tags,
        attachments,
        forceDuplicate = false,
      } = req.body;

      const updateFields: any = { updatedAt: new Date() };

      if (name !== undefined) {
        updateFields.name = String(name).trim();
        updateFields.nameLower = String(name).trim().toLowerCase();
      }
      if (avatar !== undefined) updateFields.avatar = avatar;
      if (designation !== undefined) updateFields.designation = String(designation).trim();
      if (companyName !== undefined) updateFields.companyName = String(companyName).trim();
      if (description !== undefined) updateFields.description = String(description).trim();
      if (email !== undefined) updateFields.email = String(email).trim().toLowerCase();
      if (website !== undefined) updateFields.website = String(website).trim();
      if (notes !== undefined) updateFields.notes = String(notes).trim();
      if (visibility !== undefined) updateFields.visibility = visibility === 'private' ? 'private' : 'shared';
      if (Array.isArray(tags)) updateFields.tags = tags.map((t: string) => String(t).trim()).filter(Boolean);
      if (Array.isArray(attachments)) updateFields.attachments = attachments;

      // Handle Phones
      if (Array.isArray(rawPhones)) {
        const phones: ContactPhoneNumber[] = [];
        const normalizedPhones: string[] = [];

        rawPhones.forEach((p: any, idx: number) => {
          if (!p || !p.number) return;
          const norm = normalizePhoneNumber(p.number);
          if (norm) {
            phones.push({
              number: String(p.number).trim(),
              normalizedNumber: norm,
              label: p.label || (idx === 0 ? 'Mobile' : 'Other'),
              isPrimary: p.isPrimary !== undefined ? Boolean(p.isPrimary) : idx === 0,
              hasWhatsApp: Boolean(p.hasWhatsApp),
            });
            if (!normalizedPhones.includes(norm)) {
              normalizedPhones.push(norm);
            }
          }
        });

        if (phones.length > 0 && !phones.some((p) => p.isPrimary)) {
          phones[0].isPrimary = true;
        }

        // Check duplicate on other contacts
        if (normalizedPhones.length > 0 && !forceDuplicate) {
          const dupQuery: any = {
            ...companyFilter(companyId),
            normalizedPhones: { $in: normalizedPhones },
            _id: { $ne: existing._id },
            isArchived: { $ne: true },
          };

          const duplicate = await db.collection('contacts').findOne(dupQuery);
          if (duplicate) {
            return res.status(409).json({
              code: 'DUPLICATE_PHONE_DETECTED',
              message: `Phone number is already associated with existing contact: ${duplicate.name}`,
              duplicateContact: {
                id: String(duplicate._id),
                name: duplicate.name,
                companyName: duplicate.companyName || '',
                categoryName: duplicate.categoryName || '',
                primaryPhone: duplicate.primaryPhone || '',
              },
            });
          }
        }

        updateFields.phones = phones;
        updateFields.normalizedPhones = normalizedPhones;
        updateFields.primaryPhone = phones.find((p) => p.isPrimary)?.number || phones[0]?.number || '';
      }

      // Handle Category
      if (categoryId !== undefined || rawCatName !== undefined) {
        let catName = (rawCatName || '').trim();
        let catId: any = toObjectId(categoryId) || categoryId || null;

        if (catId) {
          const cat = await db.collection('contact_categories').findOne(idQuery(String(catId)) as any);
          if (cat) catName = cat.name;
        }
        updateFields.categoryId = catId;
        updateFields.categoryName = catName || 'Other';
      }

      // Handle Project Associations
      if (Array.isArray(rawProjectIds)) {
        const validProjects = await db
          .collection('projects')
          .find({
            ...companyFilter(companyId),
            _id: { $in: rawProjectIds.map((pid: string) => toObjectId(pid) || pid) },
          })
          .project({ _id: 1 })
          .toArray();

        updateFields.projectIds = validProjects.map((p: any) => String(p._id));
      }

      // Handle Address
      if (address && typeof address === 'object') {
        updateFields.address = {
          street: (address.street || '').trim(),
          city: (address.city || '').trim(),
          state: (address.state || '').trim(),
          country: (address.country || '').trim(),
          pincode: (address.pincode || '').trim(),
        };
      }

      const editorName = ctx.userDoc
        ? `${ctx.userDoc.firstName || ''} ${ctx.userDoc.lastName || ''}`.trim() || ctx.userDoc.email
        : 'Team Member';
      updateFields.updatedBy = toObjectId(ctx.userId) || ctx.userId;
      updateFields.updatedByName = editorName;

      await db.collection('contacts').updateOne({ _id: existing._id }, { $set: updateFields });

      // Record Activity Log
      await db.collection('contact_activity_logs').insertOne({
        contactId: String(existing._id),
        companyId: toObjectId(companyId) || companyId,
        action: 'updated',
        details: { modifiedFields: Object.keys(updateFields) },
        performedBy: toObjectId(ctx.userId) || ctx.userId,
        performedByName: editorName,
        createdAt: new Date(),
      });

      res.json({ message: 'Contact updated successfully', id: String(existing._id) });
    } catch (err: any) {
      console.error('Update contact error:', err);
      res.status(500).json({ message: err.message || 'Failed to update contact' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. ARCHIVE / RESTORE CONTACT
  // ──────────────────────────────────────────────────────────────────────────
  router.put('/:id/archive', async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const contactId = req.params.id;
      const contactQuery = idQuery(contactId);

      const existing = await db.collection('contacts').findOne({ ...companyFilter(companyId), ...contactQuery } as any);
      if (!existing) return res.status(404).json({ message: 'Contact not found' });

      const now = new Date();
      await db.collection('contacts').updateOne(
        { _id: existing._id },
        {
          $set: {
            isArchived: true,
            archivedAt: now,
            archivedBy: toObjectId(ctx.userId) || ctx.userId,
            updatedAt: now,
          },
        }
      );

      await db.collection('contact_activity_logs').insertOne({
        contactId: String(existing._id),
        companyId: toObjectId(companyId) || companyId,
        action: 'archived',
        performedBy: toObjectId(ctx.userId) || ctx.userId,
        performedByName: ctx.userDoc?.firstName || 'User',
        createdAt: now,
      });

      res.json({ message: 'Contact archived successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to archive contact' });
    }
  });

  router.put('/:id/restore', async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const contactId = req.params.id;
      const contactQuery = idQuery(contactId);

      const existing = await db.collection('contacts').findOne({ ...companyFilter(companyId), ...contactQuery } as any);
      if (!existing) return res.status(404).json({ message: 'Contact not found' });

      const now = new Date();
      await db.collection('contacts').updateOne(
        { _id: existing._id },
        {
          $set: {
            isArchived: false,
            archivedAt: null,
            archivedBy: null,
            updatedAt: now,
          },
        }
      );

      await db.collection('contact_activity_logs').insertOne({
        contactId: String(existing._id),
        companyId: toObjectId(companyId) || companyId,
        action: 'restored',
        performedBy: toObjectId(ctx.userId) || ctx.userId,
        performedByName: ctx.userDoc?.firstName || 'User',
        createdAt: now,
      });

      res.json({ message: 'Contact restored successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to restore contact' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. TOGGLE FAVOURITE
  // ──────────────────────────────────────────────────────────────────────────
  router.put('/:id/favourite', async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const contactId = req.params.id;
      const contactQuery = idQuery(contactId);

      const existing = await db.collection('contacts').findOne({ ...companyFilter(companyId), ...contactQuery } as any);
      if (!existing) return res.status(404).json({ message: 'Contact not found' });

      const isFav = !existing.isFavourite;
      await db.collection('contacts').updateOne(
        { _id: existing._id },
        { $set: { isFavourite: isFav, updatedAt: new Date() } }
      );

      res.json({ message: isFav ? 'Added to favourites' : 'Removed from favourites', isFavourite: isFav });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to toggle favourite' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. DELETE CONTACT (Soft-Delete / Permanent Delete for Admins)
  // ──────────────────────────────────────────────────────────────────────────
  router.delete('/:id', async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const contactId = req.params.id;
      const permanent = req.query.permanent === 'true';
      const contactQuery = idQuery(contactId);

      const existing = await db.collection('contacts').findOne({ ...companyFilter(companyId), ...contactQuery } as any);
      if (!existing) return res.status(404).json({ message: 'Contact not found' });

      const isOwner = String(existing.createdBy) === String(ctx.userId);
      if (!isOwner && !ctx.isCompanyAdmin && !ctx.isDeveloper) {
        return res.status(403).json({ message: 'You do not have permission to delete this contact' });
      }

      if (permanent && (ctx.isCompanyAdmin || ctx.isDeveloper)) {
        await db.collection('contacts').deleteOne({ _id: existing._id });
        await db.collection('contact_activity_logs').deleteMany({ contactId: String(existing._id) });
        return res.json({ message: 'Contact permanently deleted' });
      } else {
        // Soft delete -> move to archive
        const now = new Date();
        await db.collection('contacts').updateOne(
          { _id: existing._id },
          {
            $set: {
              isArchived: true,
              archivedAt: now,
              archivedBy: toObjectId(ctx.userId) || ctx.userId,
              updatedAt: now,
            },
          }
        );

        await db.collection('contact_activity_logs').insertOne({
          contactId: String(existing._id),
          companyId: toObjectId(companyId) || companyId,
          action: 'archived',
          performedBy: toObjectId(ctx.userId) || ctx.userId,
          performedByName: ctx.userDoc?.firstName || 'User',
          createdAt: now,
        });

        return res.json({ message: 'Contact moved to archive' });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to delete contact' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. BULK IMPORT PREVIEW & COMMIT (CSV / Excel)
  // ──────────────────────────────────────────────────────────────────────────
  router.post('/import/preview', async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const { rows = [] } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: 'No rows provided for import' });
      }

      // Fetch existing categories and projects for resolution
      const [categories, projects, existingContacts] = await Promise.all([
        db.collection('contact_categories').find(companyFilter(companyId)).toArray(),
        db.collection('projects').find(companyFilter(companyId)).toArray(),
        db.collection('contacts').find(companyFilter(companyId)).project({ normalizedPhones: 1, name: 1 }).toArray(),
      ]);

      const catMap = new Map();
      categories.forEach((c: any) => catMap.set(c.name.toLowerCase(), c));

      const projMap = new Map();
      projects.forEach((p: any) => {
        const name = (p.name || p.projectName || '').toLowerCase().trim();
        if (name) projMap.set(name, String(p._id));
      });

      const existingPhones = new Set<string>();
      existingContacts.forEach((c: any) => {
        (c.normalizedPhones || []).forEach((p: string) => existingPhones.add(p));
      });

      const seenImportPhones = new Set<string>();
      const previewRows: any[] = [];
      let validCount = 0;
      let invalidCount = 0;
      let duplicateCount = 0;

      rows.forEach((r: any, idx: number) => {
        const name = (r.name || r['Full Name'] || r['Contact Name'] || '').trim();
        const rawMobile = String(r.mobile || r['Primary Mobile'] || r.phone || r['Phone'] || '').trim();
        const altMobile = String(r.alternateMobile || r['Alternate Mobile'] || '').trim();
        const email = String(r.email || r['Email Address'] || r['Email'] || '').trim().toLowerCase();
        const companyName = String(r.company || r['Company'] || r['Business Name'] || '').trim();
        const designation = String(r.designation || r['Designation'] || '').trim();
        const category = String(r.category || r['Category'] || 'Other').trim();
        const projectStr = String(r.projects || r['Projects'] || r['Project'] || '').trim();
        const notes = String(r.notes || r['Notes'] || '').trim();

        const errors: string[] = [];
        const warnings: string[] = [];

        if (!name) {
          errors.push('Name is required');
        }

        const normPhone = normalizePhoneNumber(rawMobile);
        if (!normPhone || normPhone.length < 6) {
          errors.push('Valid primary mobile number is required');
        }

        let isDuplicate = false;
        if (normPhone) {
          if (existingPhones.has(normPhone)) {
            warnings.push('Matches an existing contact in organization');
            isDuplicate = true;
            duplicateCount++;
          } else if (seenImportPhones.has(normPhone)) {
            warnings.push('Duplicate mobile number inside this import file');
            isDuplicate = true;
            duplicateCount++;
          } else {
            seenImportPhones.add(normPhone);
          }
        }

        // Project matching
        const matchedProjectIds: string[] = [];
        if (projectStr) {
          const parts = projectStr.split(/[,;|]/).map((p) => p.toLowerCase().trim());
          parts.forEach((p) => {
            const foundId = projMap.get(p);
            if (foundId) matchedProjectIds.push(foundId);
          });
        }

        const isValid = errors.length === 0;
        if (isValid) validCount++;
        else invalidCount++;

        previewRows.push({
          rowNumber: idx + 1,
          name,
          mobile: rawMobile,
          normalizedMobile: normPhone,
          alternateMobile: altMobile,
          email,
          companyName,
          designation,
          category,
          projectIds: matchedProjectIds,
          notes,
          isValid,
          isDuplicate,
          errors,
          warnings,
        });
      });

      res.json({
        totalRows: rows.length,
        validCount,
        invalidCount,
        duplicateCount,
        previewRows,
      });
    } catch (err: any) {
      console.error('Import preview error:', err);
      res.status(500).json({ message: err.message || 'Failed to preview import' });
    }
  });

  router.post('/import/commit', async (req: any, res) => {
    try {
      const db = getDb();
      await ensureContactIndexes(db);
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const { contacts = [], skipDuplicates = true } = req.body;
      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ message: 'No contacts provided for import' });
      }

      // Preload categories
      const categories = await db.collection('contact_categories').find(companyFilter(companyId)).toArray();
      const catMap = new Map();
      categories.forEach((c: any) => catMap.set(c.name.toLowerCase().trim(), c));

      // Preload existing normalized phones
      const existingContacts = await db
        .collection('contacts')
        .find(companyFilter(companyId))
        .project({ normalizedPhones: 1 })
        .toArray();

      const existingPhones = new Set<string>();
      existingContacts.forEach((c: any) => {
        (c.normalizedPhones || []).forEach((p: string) => existingPhones.add(p));
      });

      const now = new Date();
      const creatorName = ctx.userDoc
        ? `${ctx.userDoc.firstName || ''} ${ctx.userDoc.lastName || ''}`.trim() || ctx.userDoc.email
        : 'Team Member';

      const docsToInsert: any[] = [];
      const seenPhones = new Set<string>();
      let skippedCount = 0;

      for (const item of contacts) {
        if (!item.name || !item.mobile) {
          skippedCount++;
          continue;
        }

        const normPhone = normalizePhoneNumber(item.mobile);
        if (!normPhone) {
          skippedCount++;
          continue;
        }

        if (skipDuplicates && (existingPhones.has(normPhone) || seenPhones.has(normPhone))) {
          skippedCount++;
          continue;
        }
        seenPhones.add(normPhone);

        // Build phone list
        const phones: ContactPhoneNumber[] = [
          {
            number: item.mobile,
            normalizedNumber: normPhone,
            label: 'Mobile',
            isPrimary: true,
            hasWhatsApp: true,
          },
        ];
        const normalizedPhones = [normPhone];

        if (item.alternateMobile) {
          const altNorm = normalizePhoneNumber(item.alternateMobile);
          if (altNorm && altNorm !== normPhone) {
            phones.push({
              number: item.alternateMobile,
              normalizedNumber: altNorm,
              label: 'Work',
              isPrimary: false,
              hasWhatsApp: false,
            });
            normalizedPhones.push(altNorm);
          }
        }

        // Category resolution
        let catId: any = null;
        let catName = (item.category || 'Other').trim();
        const foundCat = catMap.get(catName.toLowerCase());
        if (foundCat) {
          catId = foundCat._id;
          catName = foundCat.name;
        }

        docsToInsert.push({
          companyId: toObjectId(companyId) || companyId,
          name: item.name.trim(),
          nameLower: item.name.trim().toLowerCase(),
          avatar: null,
          designation: (item.designation || '').trim(),
          categoryId: catId,
          categoryName: catName,
          companyName: (item.companyName || '').trim(),
          description: '',
          email: (item.email || '').trim().toLowerCase(),
          website: '',
          phones,
          primaryPhone: item.mobile,
          normalizedPhones,
          address: {},
          projectIds: Array.isArray(item.projectIds) ? item.projectIds : [],
          visibility: 'shared',
          isFavourite: false,
          isArchived: false,
          notes: (item.notes || '').trim(),
          tags: ['Imported'],
          attachments: [],
          createdBy: toObjectId(ctx.userId) || ctx.userId,
          createdByName: creatorName,
          updatedBy: toObjectId(ctx.userId) || ctx.userId,
          updatedByName: creatorName,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (docsToInsert.length > 0) {
        await db.collection('contacts').insertMany(docsToInsert);
      }

      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          actorType: 'user',
          actorName: creatorName,
          companyId,
          action: 'CONTACTS_BULK_IMPORTED',
          resource: 'contacts',
          details: { inserted: docsToInsert.length, skipped: skippedCount },
        });
      }

      res.json({
        message: `Successfully imported ${docsToInsert.length} contacts (${skippedCount} skipped)`,
        importedCount: docsToInsert.length,
        skippedCount,
      });
    } catch (err: any) {
      console.error('Import commit error:', err);
      res.status(500).json({ message: err.message || 'Failed to commit import' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 12. EXPORT CONTACTS (Excel & CSV)
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/export/download', async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const format = (req.query.format || 'xlsx').toLowerCase();
      const search = (req.query.search || '').trim();
      const categoryId = req.query.categoryId;
      const projectId = req.query.projectId;
      const isArchived = req.query.isArchived === 'true';

      const query: any = {
        ...companyFilter(companyId),
        isArchived: isArchived ? true : { $ne: true },
      };

      if (!ctx.isCompanyAdmin && !ctx.isDeveloper) {
        query.$or = [
          { visibility: 'shared' },
          { visibility: { $exists: false } },
          { createdBy: toObjectId(ctx.userId) || ctx.userId },
        ];
      }

      if (categoryId && categoryId !== 'all') {
        const catObjId = toObjectId(categoryId);
        query.categoryId = catObjId ? { $in: [categoryId, catObjId] } : categoryId;
      }

      if (projectId && projectId !== 'all') {
        const pObjId = toObjectId(projectId);
        query.projectIds = pObjId ? { $in: [projectId, pObjId] } : projectId;
      }

      if (search) {
        const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const sConds: any[] = [
          { name: searchRegex },
          { companyName: searchRegex },
          { designation: searchRegex },
          { email: searchRegex },
        ];
        if (query.$or) {
          query.$and = [{ $or: query.$or }, { $or: sConds }];
          delete query.$or;
        } else {
          query.$or = sConds;
        }
      }

      const [contacts, projects] = await Promise.all([
        db.collection('contacts').find(query).sort({ nameLower: 1 }).toArray(),
        db.collection('projects').find(companyFilter(companyId)).toArray(),
      ]);

      const projectMap = new Map();
      projects.forEach((p: any) => projectMap.set(String(p._id), p.name || p.projectName));

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'CraveToBuild';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Contacts Directory');

      worksheet.columns = [
        { header: 'Full Name', key: 'name', width: 24 },
        { header: 'Category', key: 'category', width: 18 },
        { header: 'Company Name', key: 'company', width: 24 },
        { header: 'Designation', key: 'designation', width: 20 },
        { header: 'Primary Mobile', key: 'primaryPhone', width: 18 },
        { header: 'Other Numbers', key: 'otherPhones', width: 25 },
        { header: 'Email Address', key: 'email', width: 25 },
        { header: 'Associated Projects', key: 'projects', width: 30 },
        { header: 'City', key: 'city', width: 15 },
        { header: 'State', key: 'state', width: 15 },
        { header: 'Visibility', key: 'visibility', width: 12 },
        { header: 'Notes', key: 'notes', width: 30 },
        { header: 'Created By', key: 'createdByName', width: 18 },
        { header: 'Created Date', key: 'createdAt', width: 15 },
      ];

      // Style Header Row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF047857' }, // Emerald Accent
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
      headerRow.height = 24;

      contacts.forEach((c: any) => {
        const otherPhones = (c.phones || [])
          .filter((p: any) => !p.isPrimary)
          .map((p: any) => `${p.label || 'Other'}: ${p.number}`)
          .join('; ');

        const associatedProjects = (c.projectIds || [])
          .map((pid: any) => projectMap.get(String(pid)) || 'Project')
          .join(', ');

        worksheet.addRow({
          name: c.name || '',
          category: c.categoryName || 'Other',
          company: c.companyName || '',
          designation: c.designation || '',
          primaryPhone: c.primaryPhone || '',
          otherPhones,
          email: c.email || '',
          projects: associatedProjects,
          city: c.address?.city || '',
          state: c.address?.state || '',
          visibility: c.visibility === 'private' ? 'Private' : 'Shared',
          notes: c.notes || '',
          createdByName: c.createdByName || '',
          createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '',
        });
      });

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="CraveToBuild_Contacts.csv"');
        await workbook.csv.write(res);
      } else {
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', 'attachment; filename="CraveToBuild_Contacts.xlsx"');
        await workbook.xlsx.write(res);
      }
      res.end();
    } catch (err: any) {
      console.error('Export download error:', err);
      res.status(500).json({ message: err.message || 'Failed to export contacts' });
    }
  });

  return router;
}
