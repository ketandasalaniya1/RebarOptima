import { Router } from 'express';
import { Db, MongoClient, ObjectId } from 'mongodb';
import {
  idQuery,
  checkMaterialDuplicate,
  getMaterialsWithStock,
  setOpeningBalance,
  processInwardReceipt,
  processOutwardIssue,
  processMaterialReturn,
  processStoreTransfer,
  recordStockVerification,
  processStockAdjustment,
  reportIncident,
  generateInventoryReport
} from './general-inventory.service';

export function createGeneralInventoryRouter(
  getDb: () => any,
  getClient: () => any,
  authMiddleware: any,
  logAudit?: any
): Router {
  const router = Router();

  // Helper to extract companyId from authenticated user
  const resolveCompanyId = async (req: any, db: Db): Promise<string> => {
    if (req.user?.companyId) return String(req.user.companyId);
    const header = req.headers['x-company-id'];
    if (header) return String(header);

    const userId = req.user?.sub;
    if (userId) {
      try {
        const u = await db.collection('users').findOne(idQuery(userId));
        if (u && u.companyId) return String(u.companyId);
      } catch {}
    }
    return req.user?.companyId || 'default-company';
  };

  // Helper to enforce Project Access Isolation
  const checkProjectAccess = async (req: any, db: Db, projectId: string) => {
    const userRole = (req.user?.role || '').toUpperCase();
    if (userRole === 'ADMIN' || userRole === 'OWNER' || req.user?.accountType === 'developer') {
      return true;
    }

    const userId = req.user?.sub;
    if (!userId) return true;

    try {
      const user = await db.collection('users').findOne(idQuery(userId));
      // Check if role restricts to assigned projects
      if (user && user.roleId) {
        const role = await db.collection('roles').findOne(idQuery(user.roleId));
        if (role && role.dataScope === 'project') {
          const assigned = (user.assignedProjects || []).map((p: any) => String(p));
          if (!assigned.includes(String(projectId))) {
            return false;
          }
        }
      }
    } catch {}
    return true;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 1. PROJECTS & STORES
  // ════════════════════════════════════════════════════════════════════════════

  // GET all projects for General Inventory
  router.get('/projects', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      let query: any = { companyId, status: { $ne: 'archived' } };

      // Filter by assigned projects if applicable
      const userRole = (req.user?.role || '').toUpperCase();
      if (userRole !== 'ADMIN' && userRole !== 'OWNER' && req.user?.accountType !== 'developer' && req.user?.sub) {
        const user = await db.collection('users').findOne(idQuery(req.user.sub));
        if (user && user.roleId) {
          const role = await db.collection('roles').findOne(idQuery(user.roleId));
          if (role && role.dataScope === 'project') {
            const assigned = (user.assignedProjects || []).map((p: any) => String(p));
            query = {
              companyId,
              status: { $ne: 'archived' },
              $or: [
                { _id: { $in: assigned.filter(a => ObjectId.isValid(a)).map(a => new ObjectId(a)) } },
                { code: { $in: assigned } },
                { name: { $in: assigned } }
              ]
            };
          }
        }
      }

      // Auto-discover company projects from BBS, Casting, and Core projects if not already registered in General Inventory
      try {
        const compFilter = ObjectId.isValid(companyId)
          ? { $or: [{ companyId: companyId }, { companyId: new ObjectId(companyId) }] }
          : { companyId };

        const [existingBbs, existingCasting, existingCore] = await Promise.all([
          db.collection('bbs_projects').find(compFilter).toArray().catch(() => []),
          db.collection('casting_projects').find({ ...compFilter, isDeleted: { $ne: true } }).toArray().catch(() => []),
          db.collection('projects').find(compFilter).toArray().catch(() => [])
        ]);

        const candidateProjects = [
          ...existingBbs.map((p: any) => ({ name: p.name, code: p.code, description: p.description, address: p.location })),
          ...existingCasting.map((p: any) => ({ name: p.name, code: p.code, description: p.description, address: p.location })),
          ...existingCore.map((p: any) => ({ name: p.name, code: p.code, description: p.description, address: p.location }))
        ];

        for (const cp of candidateProjects) {
          if (!cp.name || !cp.name.trim()) continue;
          const trimmedName = cp.name.trim();
          const existing = await db.collection('gi_projects').findOne({ companyId, name: trimmedName });
          if (!existing) {
            const insRes = await db.collection('gi_projects').insertOne({
              companyId,
              name: trimmedName,
              code: cp.code || undefined,
              description: cp.description || undefined,
              address: cp.address || undefined,
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date()
            });
            await db.collection('gi_stores').insertOne({
              companyId,
              projectId: insRes.insertedId.toString(),
              name: 'Main Store',
              code: 'STR-MAIN',
              location: 'Central Site Store',
              status: 'active',
              isDefault: true,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }
      } catch (discErr) {
        console.warn('Auto project discovery notice:', discErr);
      }

      const projects = await db.collection('gi_projects').find(query).sort({ name: 1 }).toArray();

      // Enrich projects with store count
      const enriched = await Promise.all(
        projects.map(async (p: any) => {
          const pId = p._id.toString();
          const storeCount = await db.collection('gi_stores').countDocuments({ companyId, projectId: pId, status: { $ne: 'inactive' } });
          const materialCount = await db.collection('gi_materials').countDocuments({ companyId, projectId: pId, isActive: true });
          return {
            ...p,
            id: pId,
            storeCount,
            materialCount
          };
        })
      );

      return res.json({ success: true, data: enriched });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST create project
  router.post('/projects', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { name, code, description, address } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Project name is required' });
      }

      const now = new Date();
      const newProj = {
        companyId,
        name: name.trim(),
        code: code ? code.trim() : undefined,
        description: description?.trim(),
        address: address?.trim(),
        status: 'active',
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('gi_projects').insertOne(newProj);
      const pId = result.insertedId.toString();

      // Automatically create a default "Main Store" for this new project
      const defaultStore = {
        companyId,
        projectId: pId,
        name: 'Main Store',
        code: 'MAIN',
        location: address ? address.trim() : 'Project Site',
        isDefault: true,
        status: 'active',
        createdAt: now,
        updatedAt: now
      };
      await db.collection('gi_stores').insertOne(defaultStore);

      return res.status(201).json({
        success: true,
        data: { ...newProj, _id: result.insertedId, id: pId }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET stores of a project
  router.get('/projects/:projectId/stores', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'You are not authorized to access this project.' });
      }

      let stores = await db.collection('gi_stores')
        .find({ companyId, projectId, status: { $ne: 'inactive' } })
        .sort({ isDefault: -1, name: 1 })
        .toArray();

      // If no store exists for project yet, create a default Main Store
      if (stores.length === 0) {
        const defaultStore = {
          companyId,
          projectId,
          name: 'Main Store',
          code: 'MAIN',
          location: 'Project Site',
          isDefault: true,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const ins = await db.collection('gi_stores').insertOne(defaultStore);
        stores = [{ ...defaultStore, _id: ins.insertedId }];
      }

      return res.json({
        success: true,
        data: stores.map((s: any) => ({ ...s, id: s._id.toString() }))
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST create store in project
  router.post('/projects/:projectId/stores', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { name, code, location } = req.body;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Unauthorized project store creation.' });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Store name is required' });
      }

      // Check duplicate store name in same project
      const existing = await db.collection('gi_stores').findOne({
        companyId,
        projectId,
        name: { $regex: `^${name.trim()}$`, $options: 'i' },
        status: { $ne: 'inactive' }
      });
      if (existing) {
        return res.status(400).json({ success: false, message: `A store named "${name.trim()}" already exists in this project.` });
      }

      const now = new Date();
      const newStore = {
        companyId,
        projectId,
        name: name.trim(),
        code: code ? code.trim() : undefined,
        location: location?.trim(),
        isDefault: false,
        status: 'active',
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('gi_stores').insertOne(newStore);
      return res.status(201).json({
        success: true,
        data: { ...newStore, _id: result.insertedId, id: result.insertedId.toString() }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. MATERIAL REGISTER
  // ════════════════════════════════════════════════════════════════════════════

  // GET materials for project (with stock balances)
  router.get('/projects/:projectId/materials', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId, includeInactive } = req.query;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Unauthorized project material access.' });
      }

      const materials = await getMaterialsWithStock(
        db,
        companyId,
        projectId,
        storeId ? String(storeId) : undefined,
        includeInactive === 'true'
      );

      return res.json({ success: true, data: materials });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST create material (with duplicate warning)
  router.post('/projects/:projectId/materials', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const {
        name,
        category,
        uom,
        lowStockThreshold,
        materialCode,
        subcategory,
        brandOrModel,
        sizeOrSpec,
        description,
        preferredVendor,
        remarks,
        forceDuplicateConfirmed
      } = req.body;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Unauthorized project access.' });
      }

      // Validations: Required fields per Section 5
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Material name is required.' });
      }
      if (!category || !category.trim()) {
        return res.status(400).json({ success: false, message: 'Category is required.' });
      }
      if (!uom || !uom.trim()) {
        return res.status(400).json({ success: false, message: 'Unit of measurement (UOM) is required.' });
      }
      if (lowStockThreshold === undefined || lowStockThreshold === null || isNaN(Number(lowStockThreshold)) || Number(lowStockThreshold) < 0) {
        return res.status(400).json({ success: false, message: 'Valid non-negative low-stock threshold is required.' });
      }

      // Check possible duplicate (Warn without blocking legitimate distinct items)
      const duplicateCheck = await checkMaterialDuplicate(db, companyId, projectId, name, sizeOrSpec);
      if (duplicateCheck.isDuplicate && !forceDuplicateConfirmed) {
        return res.status(200).json({
          success: false,
          isDuplicateWarning: true,
          existingMaterial: duplicateCheck.existing,
          message: `A similar material "${duplicateCheck.existing?.name}" (${duplicateCheck.existing?.category}, ${duplicateCheck.existing?.sizeOrSpec || 'Standard'}) already exists in this project.`
        });
      }

      const now = new Date();
      const newMaterial = {
        companyId,
        projectId,
        materialCode: materialCode ? materialCode.trim() : undefined,
        name: name.trim(),
        category: category.trim(),
        subcategory: subcategory?.trim(),
        uom: uom.trim(),
        lowStockThreshold: Number(lowStockThreshold),
        brandOrModel: brandOrModel?.trim(),
        sizeOrSpec: sizeOrSpec?.trim(),
        description: description?.trim(),
        preferredVendor: preferredVendor?.trim(),
        remarks: remarks?.trim(),
        isActive: true,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('gi_materials').insertOne(newMaterial);
      return res.status(201).json({
        success: true,
        data: { ...newMaterial, _id: result.insertedId, id: result.insertedId.toString() }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // PUT update material
  router.put('/projects/:projectId/materials/:materialId', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, materialId } = req.params;
      const updateData = req.body;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const material = await db.collection('gi_materials').findOne(idQuery(materialId));
      if (!material) return res.status(404).json({ success: false, message: 'Material not found.' });

      const fieldsToUpdate: any = { updatedAt: new Date() };
      if (updateData.name !== undefined) fieldsToUpdate.name = updateData.name.trim();
      if (updateData.category !== undefined) fieldsToUpdate.category = updateData.category.trim();
      if (updateData.subcategory !== undefined) fieldsToUpdate.subcategory = updateData.subcategory.trim();
      if (updateData.uom !== undefined) fieldsToUpdate.uom = updateData.uom.trim();
      if (updateData.lowStockThreshold !== undefined) fieldsToUpdate.lowStockThreshold = Number(updateData.lowStockThreshold);
      if (updateData.materialCode !== undefined) fieldsToUpdate.materialCode = updateData.materialCode.trim();
      if (updateData.brandOrModel !== undefined) fieldsToUpdate.brandOrModel = updateData.brandOrModel.trim();
      if (updateData.sizeOrSpec !== undefined) fieldsToUpdate.sizeOrSpec = updateData.sizeOrSpec.trim();
      if (updateData.description !== undefined) fieldsToUpdate.description = updateData.description.trim();
      if (updateData.preferredVendor !== undefined) fieldsToUpdate.preferredVendor = updateData.preferredVendor.trim();
      if (updateData.remarks !== undefined) fieldsToUpdate.remarks = updateData.remarks.trim();
      if (updateData.isActive !== undefined) fieldsToUpdate.isActive = Boolean(updateData.isActive);

      await db.collection('gi_materials').updateOne(idQuery(materialId), { $set: fieldsToUpdate });
      const updated = await db.collection('gi_materials').findOne(idQuery(materialId));
      if (!updated) return res.status(404).json({ success: false, message: 'Material not found after update.' });

      return res.json({ success: true, data: { ...updated, id: updated._id.toString() } });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // DELETE / Deactivate material (Preserves history per Section 5)
  router.delete('/projects/:projectId/materials/:materialId', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, materialId } = req.params;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const material = await db.collection('gi_materials').findOne(idQuery(materialId));
      if (!material) return res.status(404).json({ success: false, message: 'Material not found.' });

      const matId = material._id.toString();

      // Check if material has transaction history
      const txCount = await db.collection('gi_transactions').countDocuments({ companyId, projectId, materialId: matId });

      if (txCount > 0) {
        // Material has transaction history: Deactivate only, do not destroy history!
        await db.collection('gi_materials').updateOne(idQuery(materialId), { $set: { isActive: false, updatedAt: new Date() } });
        return res.json({
          success: true,
          deactivated: true,
          message: `Material "${material.name}" has ${txCount} historical transaction(s). It has been deactivated to preserve transaction audit history.`
        });
      } else {
        // Zero history: safe to remove
        await db.collection('gi_materials').deleteOne(idQuery(materialId));
        await db.collection('gi_stock_balances').deleteMany({ companyId, projectId, materialId: matId });
        return res.json({
          success: true,
          deleted: true,
          message: `Material "${material.name}" removed.`
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. STOCK BALANCES & OPENING STOCK
  // ════════════════════════════════════════════════════════════════════════════

  // GET stock balances
  router.get('/projects/:projectId/stock', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId } = req.query;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const materialsWithStock = await getMaterialsWithStock(db, companyId, projectId, storeId ? String(storeId) : undefined);
      return res.json({ success: true, data: materialsWithStock });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST set explicit opening balance
  router.post('/projects/:projectId/stock/opening-balance', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId, materialId, quantity, remarks } = req.body;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      if (!storeId || !materialId || quantity === undefined) {
        return res.status(400).json({ success: false, message: 'Store ID, material ID, and quantity are required.' });
      }

      const result = await setOpeningBalance(db, {
        companyId,
        projectId,
        storeId,
        materialId,
        quantity,
        user: req.user,
        remarks
      });

      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. INWARD RECEIPTS
  // ════════════════════════════════════════════════════════════════════════════

  // GET inward receipts
  router.get('/projects/:projectId/inward', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId, startDate, endDate, vendorName } = req.query;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const report = await generateInventoryReport(db, companyId, projectId, 'inward-register', {
        storeId,
        startDate,
        endDate,
        vendorName
      });

      return res.json({ success: true, data: report.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET inward receipt by ID
  router.get('/projects/:projectId/inward/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, id } = req.params;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const entry = await db.collection('gi_inward_entries').findOne(idQuery(id));
      if (!entry) return res.status(404).json({ success: false, message: 'Inward entry not found.' });

      const store = await db.collection('gi_stores').findOne(idQuery(entry.storeId));
      return res.json({ success: true, data: { ...entry, id: entry._id.toString(), storeName: store?.name || 'Main Store' } });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST record inward receipt
  router.post('/projects/:projectId/inward', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const {
        storeId,
        receiptDate,
        vendorName,
        vendorContact,
        vendorChallanNumber,
        invoiceNumber,
        items,
        remarks,
        attachments
      } = req.body;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      if (!storeId || !vendorName || !vendorChallanNumber || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Store, Vendor name, Vendor Challan number, and at least one line item are required.'
        });
      }

      const receipt = await processInwardReceipt(db, {
        companyId,
        projectId,
        storeId,
        receiptDate,
        vendorName,
        vendorContact,
        vendorChallanNumber,
        invoiceNumber,
        items,
        receivedBy: req.user,
        remarks,
        attachments
      });

      return res.status(201).json({ success: true, data: receipt });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. OUTWARD ISSUES
  // ════════════════════════════════════════════════════════════════════════════

  // GET outward issues
  router.get('/projects/:projectId/outward', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId, returnClassification, agency, startDate, endDate } = req.query;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const report = await generateInventoryReport(db, companyId, projectId, 'outward-register', {
        storeId,
        returnClassification,
        agency,
        startDate,
        endDate
      });

      return res.json({ success: true, data: report.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET outward issue by ID
  router.get('/projects/:projectId/outward/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, id } = req.params;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const entry = await db.collection('gi_outward_entries').findOne(idQuery(id));
      if (!entry) return res.status(404).json({ success: false, message: 'Outward entry not found.' });

      const store = await db.collection('gi_stores').findOne(idQuery(entry.storeId));
      return res.json({ success: true, data: { ...entry, id: entry._id.toString(), storeName: store?.name || 'Main Store' } });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET eligible outward issues for returns
  router.get('/projects/:projectId/outward/returnable/eligible', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId } = req.query;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const query: any = {
        companyId,
        projectId,
        outstandingQuantity: { $gt: 0 }
      };
      if (storeId) query.storeId = storeId;

      const eligible = await db.collection('gi_outward_entries').find(query).sort({ issueDateTime: -1 }).toArray();
      return res.json({ success: true, data: eligible.map((e: any) => ({ ...e, id: e._id.toString() })) });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST record outward issue (Backend validates sufficient stock)
  router.post('/projects/:projectId/outward', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const {
        storeId,
        issueDateTime,
        materialId,
        quantity,
        personReceiving,
        agency,
        location,
        purpose,
        returnClassification,
        expectedReturnDate,
        remarks,
        attachments
      } = req.body;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      if (!storeId || !materialId || !quantity || !personReceiving || !location || !purpose || !returnClassification) {
        return res.status(400).json({
          success: false,
          message: 'Store, Material, Quantity, Receiving Person, Work Location, Purpose, and Return Classification are required.'
        });
      }

      if (returnClassification === 'returnable' && !expectedReturnDate) {
        return res.status(400).json({
          success: false,
          message: 'Expected return date is required for returnable items.'
        });
      }

      const outward = await processOutwardIssue(db, {
        companyId,
        projectId,
        storeId,
        issueDateTime,
        materialId,
        quantity,
        personReceiving,
        issuedBy: req.user,
        agency,
        location,
        purpose,
        returnClassification,
        expectedReturnDate,
        remarks,
        attachments
      });

      return res.status(201).json({ success: true, data: outward });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 6. MATERIAL RETURNS
  // ════════════════════════════════════════════════════════════════════════════

  // GET returns register
  router.get('/projects/:projectId/returns', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId } = req.query;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const query: any = { companyId, projectId };
      if (storeId) query.storeId = storeId;

      const returns = await db.collection('gi_returns').find(query).sort({ returnDate: -1 }).toArray();
      return res.json({ success: true, data: returns.map((r: any) => ({ ...r, id: r._id.toString() })) });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST record material return (Unused or Borrowed)
  router.post('/projects/:projectId/returns', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const {
        storeId,
        outwardId,
        returnType,
        returnDate,
        returnedByPerson,
        acceptedQuantity,
        damagedQuantity,
        missingQuantity,
        remarks
      } = req.body;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      if (!storeId || !outwardId || !returnType || !returnedByPerson) {
        return res.status(400).json({
          success: false,
          message: 'Store, Outward reference, Return Type, and Person Returning are required.'
        });
      }

      const returnResult = await processMaterialReturn(db, {
        companyId,
        projectId,
        storeId,
        outwardId,
        returnType,
        returnDate,
        returnedByPerson,
        acceptedQuantity: Number(acceptedQuantity) || 0,
        damagedQuantity: Number(damagedQuantity) || 0,
        missingQuantity: Number(missingQuantity) || 0,
        receivedBy: req.user,
        remarks
      });

      return res.status(201).json({ success: true, data: returnResult });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 7. STORE TRANSFERS
  // ════════════════════════════════════════════════════════════════════════════

  // GET transfers
  router.get('/projects/:projectId/transfers', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const transfers = await db.collection('gi_transfers').find({ companyId, projectId }).sort({ transferDate: -1 }).toArray();
      return res.json({ success: true, data: transfers.map((t: any) => ({ ...t, id: t._id.toString() })) });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST process transfer between stores in same project
  router.post('/projects/:projectId/transfers', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const client = getClient();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const {
        sourceStoreId,
        destinationStoreId,
        materialId,
        quantity,
        transferDate,
        reference,
        remarks
      } = req.body;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      if (!sourceStoreId || !destinationStoreId || !materialId || !quantity) {
        return res.status(400).json({
          success: false,
          message: 'Source store, Destination store, Material, and Quantity are required.'
        });
      }

      const transfer = await processStoreTransfer(db, client, {
        companyId,
        projectId,
        sourceStoreId,
        destinationStoreId,
        materialId,
        quantity,
        transferDate,
        responsibleUser: req.user,
        reference,
        remarks
      });

      return res.status(201).json({ success: true, data: transfer });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 8. PHYSICAL STOCK VERIFICATION & ADJUSTMENTS
  // ════════════════════════════════════════════════════════════════════════════

  // GET verifications
  router.get('/projects/:projectId/verifications', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId } = req.query;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const query: any = { companyId, projectId };
      if (storeId) query.storeId = storeId;

      const list = await db.collection('gi_stock_verifications').find(query).sort({ verificationDate: -1 }).toArray();
      return res.json({ success: true, data: list.map((v: any) => ({ ...v, id: v._id.toString() })) });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST record physical verification (Audit check, does not overwrite stock)
  router.post('/projects/:projectId/verifications', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId, materialId, physicalQuantity, verificationDate, remarks } = req.body;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      if (!storeId || !materialId || physicalQuantity === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Store, Material, and Physical Quantity are required.'
        });
      }

      const record = await recordStockVerification(db, {
        companyId,
        projectId,
        storeId,
        materialId,
        physicalQuantity,
        verificationDate,
        responsibleUser: req.user,
        remarks
      });

      return res.status(201).json({ success: true, data: record });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  // GET adjustments
  router.get('/projects/:projectId/adjustments', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId } = req.query;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const query: any = { companyId, projectId };
      if (storeId) query.storeId = storeId;

      const adjustments = await db.collection('gi_adjustments').find(query).sort({ adjustmentDate: -1 }).toArray();
      return res.json({ success: true, data: adjustments.map((a: any) => ({ ...a, id: a._id.toString() })) });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST record authorized stock adjustment
  router.post('/projects/:projectId/adjustments', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId, materialId, adjustmentType, quantity, reason, verificationId } = req.body;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      if (!storeId || !materialId || !adjustmentType || !quantity || !reason) {
        return res.status(400).json({
          success: false,
          message: 'Store, Material, Adjustment type (ADD/DEDUCT), Quantity, and Reason are required.'
        });
      }

      const adjustment = await processStockAdjustment(db, {
        companyId,
        projectId,
        storeId,
        materialId,
        adjustmentType,
        quantity,
        reason,
        authorizedBy: req.user,
        verificationId
      });

      return res.status(201).json({ success: true, data: adjustment });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 9. INCIDENTS (Missing, Suspected Theft, Damaged, Other Loss)
  // ════════════════════════════════════════════════════════════════════════════

  // GET incidents
  router.get('/projects/:projectId/incidents', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId, incidentType } = req.query;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const query: any = { companyId, projectId };
      if (storeId) query.storeId = storeId;
      if (incidentType) query.incidentType = incidentType;

      const list = await db.collection('gi_incidents').find(query).sort({ date: -1 }).toArray();
      return res.json({ success: true, data: list.map((i: any) => ({ ...i, id: i._id.toString() })) });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST report incident (Does NOT deduct stock!)
  router.post('/projects/:projectId/incidents', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId, incidentType, materialId, quantity, date, description, reportedBy, attachments } = req.body;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      if (!storeId || !incidentType || !description || !reportedBy) {
        return res.status(400).json({
          success: false,
          message: 'Store, Incident Type, Description, and Reporter are required.'
        });
      }

      const incident = await reportIncident(db, {
        companyId,
        projectId,
        storeId,
        incidentType,
        materialId,
        quantity,
        date,
        description,
        reportedBy,
        attachments
      });

      return res.status(201).json({ success: true, data: incident });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 10. MATERIAL LEDGER & REPORTS
  // ════════════════════════════════════════════════════════════════════════════

  // GET transaction ledger
  router.get('/projects/:projectId/ledger', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { storeId, materialId, transactionType, startDate, endDate } = req.query;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const report = await generateInventoryReport(db, companyId, projectId, 'material-ledger', {
        storeId,
        materialId,
        transactionType,
        startDate,
        endDate
      });

      return res.json({ success: true, data: report.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET report by type
  router.get('/projects/:projectId/reports/:reportType', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, reportType } = req.params;
      const filters = req.query;

      const hasAccess = await checkProjectAccess(req, db, projectId);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Unauthorized.' });

      const report = await generateInventoryReport(db, companyId, projectId, reportType, filters);
      return res.json({ success: true, data: report });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  return router;
}
