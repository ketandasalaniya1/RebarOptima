import { Router } from 'express';
import { ObjectId } from 'mongodb';

export const PREDEFINED_CUTS_COLLECTION = 'predefined_cut_data';

// Helper to normalize queries for string / ObjectId
function idQuery(id: string | any): any {
  if (!id) return { _id: id };
  if (id instanceof ObjectId) return { _id: id };
  if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
    return { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
  }
  return { _id: String(id) };
}

function toObjectId(id: any): ObjectId | null {
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

export function parseCsvCutLines(rawText: string, defaultGroupName = 'Imported Cuts') {
  if (!rawText || !rawText.trim()) return { items: [], errors: [] };

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: any[] = [];
  const errors: string[] = [];

  // Helper to test if a line is likely a header
  const isHeader = (cells: string[]) => {
    // If the first cell is already a number (or number with mm), it's a data row
    if (cells.length > 0 && /^[0-9]+(\.[0-9]+)?\s*(mm)?$/i.test(cells[0].trim())) {
      return false;
    }
    const combined = cells.join(' ').toLowerCase();
    return (
      combined.includes('diameter') ||
      combined.includes('dia') ||
      combined.includes('length') ||
      combined.includes('qty') ||
      combined.includes('quantity') ||
      combined.includes('label') ||
      combined.includes('member')
    );
  };

  let startIdx = 0;
  if (lines.length > 0) {
    const firstCells = lines[0].split(/[,\t;]/).map((c) => c.replace(/["']/g, '').trim());
    if (isHeader(firstCells)) {
      startIdx = 1;
    }
  }

  for (let i = startIdx; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const cells = line.split(/[,\t;]/).map((c) => c.replace(/["']/g, '').trim());

    if (cells.length < 2) {
      errors.push(`Row ${lineNum}: Insufficient columns (expected at least Diameter, Length, Quantity)`);
      continue;
    }

    // Expected columns: Diameter, Length, Quantity, Label, Group
    const rawDia = cells[0].replace(/[^0-9.]/g, '');
    const rawLen = cells[1].replace(/[^0-9.]/g, '');
    const rawQty = (cells[2] || '1').replace(/[^0-9.]/g, '');
    const label = cells[3] || '';
    const group = cells[4] || defaultGroupName;

    const diameter = Number(rawDia);
    const length = Number(rawLen);
    const quantity = Math.max(1, Math.round(Number(rawQty) || 1));

    if (isNaN(diameter) || diameter <= 0) {
      errors.push(`Row ${lineNum}: Invalid diameter "${cells[0]}"`);
      continue;
    }
    if (isNaN(length) || length <= 0) {
      errors.push(`Row ${lineNum}: Invalid cut length "${cells[1]}"`);
      continue;
    }

    items.push({
      diameter,
      length,
      quantity,
      label: label.trim(),
      groupName: group.trim() || defaultGroupName,
    });
  }

  return { items, errors };
}

export function createPredefinedCutsRouter(
  getDb: () => any,
  authMiddleware: any,
  logAudit?: any,
): Router {
  const router = Router();

  const resolveCompanyId = async (req: any, db: any): Promise<string> => {
    if (req.user?.companyId) return String(req.user.companyId);

    const userId = req.user?.sub;
    if (userId) {
      try {
        const u = await db.collection('users').findOne(idQuery(userId));
        if (u && u.companyId) return String(u.companyId);
      } catch { }
    }

    // Only platform developers can override company context via header
    if (req.user?.accountType === 'developer') {
      const header = req.headers['x-company-id'];
      if (header) return String(header);
    }

    return 'default-company';
  };

  // ─── 1. Download CSV Template ───
  router.get('/template', authMiddleware, (_req: any, res: any) => {
    const csvContent =
      'Diameter,Length(mm),Quantity,Label,Group\n' +
      '12,3500,10,Beam-B1,Ground Floor Beams\n' +
      '16,4200,8,Column-C1,Main Columns\n' +
      '20,5800,15,Footing-F2,Foundation\n' +
      '25,6000,6,Plinth Beam,Ground Level\n' +
      '10,2100,24,Stirrup-S1,Shear Links\n';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="predefined_steel_cutting_template.csv"');
    res.send(csvContent);
  });

  // ─── 2. Get distinct groups / schedules with summary ───
  router.get('/groups', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.query;

      const filter: any = {
        companyId,
        isDeleted: { $ne: true },
      };
      if (projectId) {
        filter.$or = [{ projectId: String(projectId) }, { projectId: null }, { projectId: '' }];
      }

      const groupAgg = await db
        .collection(PREDEFINED_CUTS_COLLECTION)
        .aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$groupName',
              itemCount: { $sum: 1 },
              totalQuantity: { $sum: '$quantity' },
              lastUpdated: { $max: '$updatedAt' },
            },
          },
          { $sort: { lastUpdated: -1, _id: 1 } },
        ])
        .toArray();

      const groups = groupAgg
        .filter((g: any) => Boolean(g._id))
        .map((g: any) => ({
          name: g._id,
          itemCount: g.itemCount || 0,
          totalQuantity: g.totalQuantity || 0,
          lastUpdated: g.lastUpdated,
        }));

      res.json(groups);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching predefined groups' });
    }
  });

  // ─── Rename Schedule Group ───
  router.put('/groups/rename', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { oldGroupName, newGroupName, projectId } = req.body;

      if (!oldGroupName || !newGroupName || !String(newGroupName).trim()) {
        return res.status(400).json({ message: 'Both old and new schedule names are required' });
      }

      const trimmedNew = String(newGroupName).trim();
      const filter: any = {
        companyId,
        groupName: String(oldGroupName).trim(),
        isDeleted: { $ne: true },
      };
      if (projectId) {
        filter.$or = [{ projectId: String(projectId) }, { projectId: null }, { projectId: '' }];
      }

      const result = await db.collection(PREDEFINED_CUTS_COLLECTION).updateMany(
        filter,
        { $set: { groupName: trimmedNew, updatedAt: new Date() } },
      );

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user.sub,
          actorType: req.user.accountType || 'user',
          companyId,
          module: 'steel_optimizer',
          action: 'PREDEFINED_SCHEDULE_RENAMED',
          resource: PREDEFINED_CUTS_COLLECTION,
          description: `Renamed schedule "${oldGroupName}" to "${trimmedNew}" (${result.modifiedCount} cuts updated)`,
        });
      }

      res.json({
        success: true,
        modifiedCount: result.modifiedCount || 0,
        newGroupName: trimmedNew,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error renaming schedule group' });
    }
  });

  // ─── 3. List Predefined Cuts ───
  router.get('/', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, groupName, search, diameter } = req.query;

      const filter: any = {
        companyId,
        isDeleted: { $ne: true },
      };

      if (projectId) {
        filter.$or = [
          { projectId: String(projectId) },
          { projectId: null },
          { projectId: '' },
          { projectId: { $exists: false } },
        ];
      }

      if (groupName && groupName !== 'all') {
        filter.groupName = groupName;
      }

      if (diameter) {
        filter.diameter = Number(diameter);
      }

      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
          { label: regex },
          { groupName: regex },
        ];
      }

      const records = await db
        .collection(PREDEFINED_CUTS_COLLECTION)
        .find(filter)
        .sort({ groupName: 1, diameter: 1, length: -1 })
        .toArray();

      const normalized = records.map((r: any) => ({
        ...r,
        id: (r._id || r.id).toString(),
      }));

      res.json({
        success: true,
        count: normalized.length,
        data: normalized,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching predefined cut data' });
    }
  });

  // ─── 4. Add Single Predefined Cut ───
  router.post('/', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { diameter, length, quantity, label, groupName, projectId } = req.body;

      const diaNum = Number(diameter);
      const lenNum = Number(length);
      const qtyNum = Number(quantity);

      if (isNaN(diaNum) || diaNum <= 0) {
        return res.status(400).json({ message: 'Valid positive diameter (mm) is required' });
      }
      if (isNaN(lenNum) || lenNum <= 0) {
        return res.status(400).json({ message: 'Valid positive cut length (mm) is required' });
      }
      if (isNaN(qtyNum) || qtyNum <= 0) {
        return res.status(400).json({ message: 'Valid positive quantity is required' });
      }

      const now = new Date();
      const doc = {
        companyId,
        projectId: projectId ? String(projectId) : null,
        diameter: diaNum,
        length: lenNum,
        quantity: Math.round(qtyNum),
        label: (label || '').trim(),
        groupName: (groupName || 'Default Schedule').trim(),
        createdAt: now,
        updatedAt: now,
        createdBy: req.user?.email || req.user?.sub,
        isDeleted: false,
      };

      const result = await db.collection(PREDEFINED_CUTS_COLLECTION).insertOne(doc);
      const created = await db.collection(PREDEFINED_CUTS_COLLECTION).findOne({ _id: result.insertedId });

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user.sub,
          actorType: req.user.accountType || 'user',
          companyId,
          module: 'steel_optimizer',
          action: 'PREDEFINED_CUT_CREATED',
          resource: PREDEFINED_CUTS_COLLECTION,
          resourceId: result.insertedId.toString(),
          description: `Created predefined cut: ${diaNum}mm x ${lenNum}mm (${qtyNum} pcs)`,
        });
      }

      res.status(201).json({
        success: true,
        data: { ...created, id: created._id.toString() },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating predefined cut' });
    }
  });

  // ─── 5. Import CSV Data ───
  router.post('/import', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { csvText, rows, groupName, projectId } = req.body;

      let itemsToInsert: any[] = [];
      let parseErrors: string[] = [];

      const targetGroup = (groupName || `Import ${new Date().toLocaleDateString('en-GB')}`).trim();

      // Case A: raw CSV text provided
      if (typeof csvText === 'string' && csvText.trim()) {
        const parsed = parseCsvCutLines(csvText, targetGroup);
        itemsToInsert = parsed.items;
        parseErrors = parsed.errors;
      }
      // Case B: pre-parsed array of rows provided
      else if (Array.isArray(rows) && rows.length > 0) {
        rows.forEach((r: any, idx: number) => {
          const diaNum = Number(r.diameter);
          const lenNum = Number(r.length);
          const qtyNum = Number(r.quantity || 1);

          if (!diaNum || diaNum <= 0 || !lenNum || lenNum <= 0) {
            parseErrors.push(`Row ${idx + 1}: Invalid diameter or length`);
            return;
          }

          itemsToInsert.push({
            diameter: diaNum,
            length: lenNum,
            quantity: Math.max(1, Math.round(qtyNum)),
            label: String(r.label || '').trim(),
            groupName: String(r.groupName || targetGroup).trim(),
          });
        });
      } else {
        return res.status(400).json({ message: 'No CSV text or cut rows provided for import' });
      }

      if (itemsToInsert.length === 0) {
        return res.status(400).json({
          message: 'No valid cut rows could be parsed from the provided input.',
          errors: parseErrors,
        });
      }

      const now = new Date();
      const userIdent = req.user?.email || req.user?.sub;

      const docsToInsert = itemsToInsert.map((item) => {
        const _id = new ObjectId();
        return {
          _id,
          id: _id.toString(),
          companyId,
          projectId: projectId ? String(projectId) : null,
          diameter: item.diameter,
          length: item.length,
          quantity: item.quantity,
          label: item.label,
          groupName: item.groupName,
          createdAt: now,
          updatedAt: now,
          createdBy: userIdent,
          isDeleted: false,
        };
      });

      await db.collection(PREDEFINED_CUTS_COLLECTION).insertMany(docsToInsert);

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user.sub,
          actorType: req.user.accountType || 'user',
          companyId,
          module: 'steel_optimizer',
          action: 'PREDEFINED_CUTS_CSV_IMPORTED',
          resource: PREDEFINED_CUTS_COLLECTION,
          description: `Imported ${docsToInsert.length} predefined cut records under group '${targetGroup}'`,
        });
      }

      res.status(201).json({
        success: true,
        importedCount: docsToInsert.length,
        errors: parseErrors,
        data: docsToInsert.map((d) => ({ ...d, id: d._id.toString() })),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error importing predefined cut data' });
    }
  });

  // ─── 6. Update Single Predefined Cut ───
  router.put('/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;
      const { diameter, length, quantity, label, groupName } = req.body;

      const existing = await db.collection(PREDEFINED_CUTS_COLLECTION).findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true },
      });

      if (!existing) {
        return res.status(404).json({ message: 'Predefined cut record not found' });
      }

      const updateData: any = { updatedAt: new Date() };
      if (diameter !== undefined) {
        const d = Number(diameter);
        if (isNaN(d) || d <= 0) return res.status(400).json({ message: 'Invalid diameter' });
        updateData.diameter = d;
      }
      if (length !== undefined) {
        const l = Number(length);
        if (isNaN(l) || l <= 0) return res.status(400).json({ message: 'Invalid length' });
        updateData.length = l;
      }
      if (quantity !== undefined) {
        const q = Number(quantity);
        if (isNaN(q) || q <= 0) return res.status(400).json({ message: 'Invalid quantity' });
        updateData.quantity = Math.round(q);
      }
      if (label !== undefined) updateData.label = String(label).trim();
      if (groupName !== undefined) updateData.groupName = String(groupName).trim() || 'Default Schedule';

      await db.collection(PREDEFINED_CUTS_COLLECTION).updateOne(
        { _id: existing._id },
        { $set: updateData },
      );

      const updated = await db.collection(PREDEFINED_CUTS_COLLECTION).findOne({ _id: existing._id });

      res.json({
        success: true,
        data: { ...updated, id: updated._id.toString() },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating predefined cut' });
    }
  });

  // ─── 7. Delete Single Predefined Cut ───
  router.delete('/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;

      const existing = await db.collection(PREDEFINED_CUTS_COLLECTION).findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true },
      });

      if (!existing) {
        return res.status(404).json({ message: 'Predefined cut record not found' });
      }

      await db.collection(PREDEFINED_CUTS_COLLECTION).updateOne(
        { _id: existing._id },
        { $set: { isDeleted: true, deletedAt: new Date() } },
      );

      res.json({ success: true, message: 'Record deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error deleting predefined cut record' });
    }
  });

  // ─── 8. Bulk Delete Predefined Cuts ───
  router.post('/bulk-delete', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { ids, groupName } = req.body;

      const now = new Date();
      let filter: any = { companyId, isDeleted: { $ne: true } };

      if (Array.isArray(ids) && ids.length > 0) {
        const objIds = ids.map((id) => (ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : id));
        filter.$or = [{ _id: { $in: objIds } }, { id: { $in: ids } }];
      } else if (groupName) {
        filter.groupName = groupName;
      } else {
        return res.status(400).json({ message: 'Either an array of IDs or groupName must be provided' });
      }

      const result = await db.collection(PREDEFINED_CUTS_COLLECTION).updateMany(
        filter,
        { $set: { isDeleted: true, deletedAt: now } },
      );

      res.json({
        success: true,
        deletedCount: result.modifiedCount || 0,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error performing bulk delete' });
    }
  });

  return router;
}