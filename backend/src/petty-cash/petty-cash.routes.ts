import { Router } from 'express';
import { Db, ObjectId } from 'mongodb';

// Helper to normalize queries for string / ObjectId
export function idQuery(id: string | any): any {
  if (!id) return { _id: id };
  if (id instanceof ObjectId) return { _id: id };
  if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
    return { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
  }
  return { _id: String(id) };
}

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

// Build multi-tenant company filter
export function companyFilter(companyId: any): any {
  if (!companyId) return { companyId: null };
  const objId = toObjectId(companyId);
  if (objId) {
    return { $or: [{ companyId: objId }, { companyId: String(companyId) }] };
  }
  return { companyId: String(companyId) };
}

export function createPettyCashRouter(
  getDb: () => any,
  authMiddleware: any,
  logAudit?: any
): Router {
  const router = Router();

  // Helper to resolve companyId from token or database
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

  // ════════════════════════════════════════════════════════════════════════════
  // 1. SITES / PROJECTS LIST WITH LIVE BALANCES
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/sites', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const compFilter = companyFilter(companyId);

      // Auto-discover sites from existing collections (gi_projects, casting_projects, bbs_projects, projects, petty_cash_sites)
      const [giProj, castingProj, bbsProj, coreProj, customSites] = await Promise.all([
        db.collection('gi_projects').find(compFilter).toArray().catch(() => []),
        db.collection('casting_projects').find({ ...compFilter, isDeleted: { $ne: true } }).toArray().catch(() => []),
        db.collection('bbs_projects').find(compFilter).toArray().catch(() => []),
        db.collection('projects').find(compFilter).toArray().catch(() => []),
        db.collection('petty_cash_sites').find(compFilter).toArray().catch(() => [])
      ]);

      const siteMap = new Map<string, { id: string; name: string; code?: string; location?: string }>();

      const addSite = (id: any, name: any, code?: any, location?: any) => {
        if (!name || !String(name).trim()) return;
        const cleanName = String(name).trim();
        const siteKey = cleanName.toLowerCase();
        if (!siteMap.has(siteKey)) {
          siteMap.set(siteKey, {
            id: String(id || siteKey),
            name: cleanName,
            code: code ? String(code).trim() : undefined,
            location: location ? String(location).trim() : undefined
          });
        }
      };

      // Populate from custom sites first (so user-created Petty Cash sites take priority)
      customSites.forEach((s: any) => addSite(s._id || s.id, s.name, s.code, s.location));
      giProj.forEach((s: any) => addSite(s._id || s.id, s.name, s.code, s.address));
      castingProj.forEach((s: any) => addSite(s._id || s.id, s.name, s.code, s.location));
      bbsProj.forEach((s: any) => addSite(s._id || s.id, s.name, s.code, s.location));
      coreProj.forEach((s: any) => addSite(s._id || s.id, s.name, s.code, s.location));

      // If no sites exist at all, provide a default "Main Construction Site"
      if (siteMap.size === 0) {
        addSite('site-default', 'Main Site', 'SITE-01', 'Head Office / Main Site');
      }

      const sitesList = Array.from(siteMap.values());

      // Fetch all transactions to calculate live balance for each site
      const allTransactions = await db.collection('petty_cash_transactions').find(compFilter).toArray().catch(() => []);

      const siteBalances = new Map<string, { totalCredits: number; totalDebits: number; currentBalance: number; txCount: number }>();

      allTransactions.forEach((tx: any) => {
        const siteKey = (tx.siteName || '').trim().toLowerCase();
        const current = siteBalances.get(siteKey) || { totalCredits: 0, totalDebits: 0, currentBalance: 0, txCount: 0 };
        const amount = Number(tx.amount) || 0;
        if (tx.type === 'CREDIT') {
          current.totalCredits += amount;
          current.currentBalance += amount;
        } else if (tx.type === 'DEBIT') {
          current.totalDebits += amount;
          current.currentBalance -= amount;
        }
        current.txCount += 1;
        siteBalances.set(siteKey, current);
      });

      const enrichedSites = sitesList.map(s => {
        const stats = siteBalances.get(s.name.toLowerCase()) || { totalCredits: 0, totalDebits: 0, currentBalance: 0, txCount: 0 };
        return {
          ...s,
          totalCredits: Math.round(stats.totalCredits * 100) / 100,
          totalDebits: Math.round(stats.totalDebits * 100) / 100,
          currentBalance: Math.round(stats.currentBalance * 100) / 100,
          transactionCount: stats.txCount
        };
      });

      return res.json({ success: true, data: enrichedSites });
    } catch (err: any) {
      console.error('Error fetching petty cash sites:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST create new custom site
  router.post('/sites', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { name, code, location } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Site name is required' });
      }

      const trimmedName = name.trim();
      const compFilter = companyFilter(companyId);

      const existing = await db.collection('petty_cash_sites').findOne({
        ...compFilter,
        name: { $regex: `^${trimmedName}$`, $options: 'i' }
      });

      if (existing) {
        return res.status(400).json({ success: false, message: 'A site with this name already exists' });
      }

      const now = new Date();
      const newSite = {
        companyId,
        name: trimmedName,
        code: code ? code.trim() : undefined,
        location: location ? location.trim() : undefined,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('petty_cash_sites').insertOne(newSite);
      const siteId = result.insertedId.toString();

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user?.sub,
          actorType: req.user?.accountType || 'user',
          companyId,
          module: 'pettyCash',
          action: 'SITE_CREATED',
          resource: 'petty_cash_sites',
          resourceId: siteId,
          description: `Created new petty cash site "${trimmedName}"`
        }).catch(() => {});
      }

      return res.status(201).json({
        success: true,
        data: { ...newSite, id: siteId, currentBalance: 0, totalCredits: 0, totalDebits: 0, transactionCount: 0 }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. REUSABLE MONEY PROVIDERS (PERSONS)
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/persons', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const compFilter = companyFilter(companyId);

      const persons = await db.collection('petty_cash_persons')
        .find({ ...compFilter, isActive: { $ne: false } })
        .sort({ name: 1 })
        .toArray();

      return res.json({
        success: true,
        data: persons.map((p: any) => ({
          id: p._id.toString(),
          name: p.name,
          roleOrTitle: p.roleOrTitle || '',
          phone: p.phone || '',
          isActive: p.isActive !== false
        }))
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST create or update money provider
  router.post('/persons', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { name, roleOrTitle, phone } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Person name is required' });
      }

      const trimmedName = name.trim();
      const compFilter = companyFilter(companyId);

      const existing = await db.collection('petty_cash_persons').findOne({
        ...compFilter,
        name: { $regex: `^${trimmedName}$`, $options: 'i' }
      });

      if (existing) {
        // If inactive, re-activate
        await db.collection('petty_cash_persons').updateOne(
          { _id: existing._id },
          { $set: { isActive: true, roleOrTitle: roleOrTitle?.trim() || existing.roleOrTitle, phone: phone?.trim() || existing.phone, updatedAt: new Date() } }
        );
        return res.json({
          success: true,
          data: { id: existing._id.toString(), name: existing.name, roleOrTitle: roleOrTitle?.trim() || existing.roleOrTitle, phone: phone?.trim() || existing.phone }
        });
      }

      const now = new Date();
      const doc = {
        companyId,
        name: trimmedName,
        roleOrTitle: roleOrTitle ? roleOrTitle.trim() : '',
        phone: phone ? phone.trim() : '',
        isActive: true,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('petty_cash_persons').insertOne(doc);
      return res.status(201).json({
        success: true,
        data: { ...doc, id: result.insertedId.toString() }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // DELETE / deactivate money provider
  router.delete('/persons/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const targetQuery = idQuery(req.params.id);

      await db.collection('petty_cash_persons').updateOne(
        { ...targetQuery, ...companyFilter(companyId) },
        { $set: { isActive: false, updatedAt: new Date() } }
      );

      return res.json({ success: true, message: 'Person removed from active list' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. CATEGORIES & SUBCATEGORIES MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/categories', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const compFilter = companyFilter(companyId);

      let categories = await db.collection('petty_cash_categories').find(compFilter).sort({ name: 1 }).toArray();

      // If company has no categories yet, initialize with common construction defaults
      if (categories.length === 0) {
        const defaultCats = [
          { name: 'Opening Balance', subcategories: ['WhatsApp Carry-Forward', 'Bank Cash Withdrawal'] },
          { name: 'Site Materials & Supplies', subcategories: ['Hardware & Tools', 'Binding Wire & Nails', 'Safety & PPE', 'Cement & Sand'] },
          { name: 'Labor & Unloading', subcategories: ['Daily Wages', 'Material Unloading', 'Overtime Help'] },
          { name: 'Transport & Travel', subcategories: ['Auto / Tempo Fare', 'Fuel for Generator / Bike', 'Courier / Delivery'] },
          { name: 'Site Refreshments', subcategories: ['Tea & Snacks', 'Drinking Water (Jars/Cans)', 'Site Lunch'] },
          { name: 'Repairs & Maintenance', subcategories: ['Machine Servicing', 'Electrical Repairs', 'Welding / Fitting'] },
          { name: 'Office & Admin', subcategories: ['Stationery & Xerox', 'Mobile Recharge', 'Miscellaneous'] }
        ];

        const docsToInsert = defaultCats.map(c => ({
          companyId,
          name: c.name,
          subcategories: c.subcategories,
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        await db.collection('petty_cash_categories').insertMany(docsToInsert).catch(() => {});
        categories = await db.collection('petty_cash_categories').find(compFilter).sort({ name: 1 }).toArray();
      }

      return res.json({
        success: true,
        data: categories.map((c: any) => ({
          id: c._id.toString(),
          name: c.name,
          subcategories: Array.isArray(c.subcategories) ? c.subcategories : []
        }))
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST create or update category with subcategories
  router.post('/categories', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id, name, subcategories } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }

      const trimmedName = name.trim();
      const cleanSubcats = Array.isArray(subcategories)
        ? subcategories.map((s: any) => String(s).trim()).filter(Boolean)
        : [];

      const now = new Date();

      if (id) {
        // Update existing category
        const targetQuery = idQuery(id);
        await db.collection('petty_cash_categories').updateOne(
          { ...targetQuery, ...companyFilter(companyId) },
          { $set: { name: trimmedName, subcategories: cleanSubcats, updatedAt: now } }
        );
        return res.json({ success: true, data: { id, name: trimmedName, subcategories: cleanSubcats } });
      }

      // Check duplicate
      const compFilter = companyFilter(companyId);
      const existing = await db.collection('petty_cash_categories').findOne({
        ...compFilter,
        name: { $regex: `^${trimmedName}$`, $options: 'i' }
      });

      if (existing) {
        return res.status(400).json({ success: false, message: 'Category with this name already exists' });
      }

      const newDoc = {
        companyId,
        name: trimmedName,
        subcategories: cleanSubcats,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('petty_cash_categories').insertOne(newDoc);
      return res.status(201).json({
        success: true,
        data: { ...newDoc, id: result.insertedId.toString() }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // DELETE category
  router.delete('/categories/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const targetQuery = idQuery(req.params.id);

      await db.collection('petty_cash_categories').deleteOne({ ...targetQuery, ...companyFilter(companyId) });
      return res.json({ success: true, message: 'Category deleted' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. TRANSACTIONS & STATEMENT REPORTING WITH OPENING/CLOSING BALANCE
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/transactions', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const compFilter = companyFilter(companyId);

      const { siteId, siteName, startDate, endDate, type, personName, category } = req.query;

      // Base query for this company
      const query: any = { ...compFilter };

      // Filter by site
      if (siteName && String(siteName).trim()) {
        query.siteName = String(siteName).trim();
      } else if (siteId && String(siteId).trim()) {
        query.$or = [{ siteId: String(siteId) }, { siteName: String(siteId) }];
      }

      // Fetch all transactions for this site to compute opening balance accurately
      const allSiteTransactions = await db.collection('petty_cash_transactions')
        .find(query)
        .sort({ date: 1, createdAt: 1 })
        .toArray();

      let openingBalance = 0;
      let totalCredits = 0;
      let totalDebits = 0;

      const filteredTransactions: any[] = [];
      const personCreditTotalsMap = new Map<string, { totalAmount: number; count: number }>();

      // Populate overall person credits breakdown for this site
      allSiteTransactions.forEach((tx: any) => {
        if (tx.type === 'CREDIT' && tx.personName) {
          const pName = String(tx.personName).trim();
          const amt = Number(tx.amount) || 0;
          const prev = personCreditTotalsMap.get(pName) || { totalAmount: 0, count: 0 };
          prev.totalAmount += amt;
          prev.count += 1;
          personCreditTotalsMap.set(pName, prev);
        }
      });

      // Process each transaction to determine if it is before startDate (opening) or in current window
      for (const tx of allSiteTransactions) {
        const txDate = tx.date; // string 'YYYY-MM-DD'
        const amt = Number(tx.amount) || 0;

        // If a startDate is requested and this transaction is strictly prior to startDate:
        if (startDate && txDate < String(startDate)) {
          if (tx.type === 'CREDIT') {
            openingBalance += amt;
          } else if (tx.type === 'DEBIT') {
            openingBalance -= amt;
          }
          continue; // Prior to reporting window, included in opening balance only
        }

        // If an endDate is requested and transaction is after endDate:
        if (endDate && txDate > String(endDate)) {
          continue; // Past reporting window
        }

        // Filter by entry type (CREDIT or DEBIT)
        if (type && type !== 'ALL' && tx.type !== type) {
          continue;
        }

        // Filter by person
        if (personName && String(personName).trim()) {
          const targetPerson = String(personName).trim().toLowerCase();
          const curPerson = String(tx.personName || '').trim().toLowerCase();
          if (curPerson !== targetPerson) continue;
        }

        // Filter by category
        if (category && String(category).trim() && category !== 'ALL') {
          if (tx.category !== String(category).trim()) continue;
        }

        // In-window matching transaction
        if (tx.type === 'CREDIT') totalCredits += amt;
        if (tx.type === 'DEBIT') totalDebits += amt;

        filteredTransactions.push({
          ...tx,
          id: tx._id.toString()
        });
      }

      const closingBalance = openingBalance + totalCredits - totalDebits;

      const personCreditBreakdown = Array.from(personCreditTotalsMap.entries()).map(([person, stat]) => ({
        personName: person,
        totalAmount: Math.round(stat.totalAmount * 100) / 100,
        count: stat.count
      })).sort((a, b) => b.totalAmount - a.totalAmount);

      return res.json({
        success: true,
        data: {
          openingBalance: Math.round(openingBalance * 100) / 100,
          totalCredits: Math.round(totalCredits * 100) / 100,
          totalDebits: Math.round(totalDebits * 100) / 100,
          closingBalance: Math.round(closingBalance * 100) / 100,
          count: filteredTransactions.length,
          transactions: filteredTransactions,
          personCreditBreakdown
        }
      });
    } catch (err: any) {
      console.error('Error fetching petty cash transactions:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST create transaction (Credit or Debit)
  router.post('/transactions', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const {
        siteId,
        siteName,
        type,
        date,
        amount,
        category,
        subcategory,
        description,
        personName,
        photos
      } = req.body;

      if (!siteName || !String(siteName).trim()) {
        return res.status(400).json({ success: false, message: 'Site name is required' });
      }

      if (type !== 'CREDIT' && type !== 'DEBIT') {
        return res.status(400).json({ success: false, message: 'Type must be CREDIT or DEBIT' });
      }

      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
      }

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, message: 'Valid date (YYYY-MM-DD) is required' });
      }

      if (!category || !String(category).trim()) {
        return res.status(400).json({ success: false, message: 'Category is required' });
      }

      if (!description || !String(description).trim()) {
        return res.status(400).json({ success: false, message: 'Description is required' });
      }

      if (!personName || !String(personName).trim()) {
        const fieldLabel = type === 'CREDIT' ? 'Person who provided money' : 'Employee / Person name';
        return res.status(400).json({ success: false, message: `${fieldLabel} is required` });
      }

      // Process photos if any
      const sanitizedPhotos = Array.isArray(photos)
        ? photos.map((p: any) => ({
            dataUrl: p.dataUrl || p.url,
            name: p.name || 'receipt.jpg',
            size: p.size || undefined,
            uploadedAt: new Date()
          })).filter(p => !!p.dataUrl)
        : [];

      const now = new Date();
      const newTx = {
        companyId,
        siteId: siteId ? String(siteId).trim() : 'site-default',
        siteName: String(siteName).trim(),
        type,
        date,
        amount: Math.round(parsedAmount * 100) / 100,
        category: String(category).trim(),
        subcategory: subcategory ? String(subcategory).trim() : '',
        description: String(description).trim(),
        personName: String(personName).trim(),
        photos: sanitizedPhotos,
        createdBy: req.user?.sub || 'user',
        createdByName: req.user?.name || req.user?.email || 'User',
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('petty_cash_transactions').insertOne(newTx);
      const insertedId = result.insertedId.toString();

      // If this is a credit transaction, also make sure the person is registered in reusable persons list
      if (type === 'CREDIT') {
        const trimmedPerson = String(personName).trim();
        const compFilter = companyFilter(companyId);
        const exists = await db.collection('petty_cash_persons').findOne({
          ...compFilter,
          name: { $regex: `^${trimmedPerson}$`, $options: 'i' }
        });
        if (!exists) {
          await db.collection('petty_cash_persons').insertOne({
            companyId,
            name: trimmedPerson,
            roleOrTitle: '',
            phone: '',
            isActive: true,
            createdAt: now,
            updatedAt: now
          }).catch(() => {});
        }
      }

      // Audit log
      if (logAudit) {
        await logAudit(db, {
          actorId: req.user?.sub,
          actorType: req.user?.accountType || 'user',
          companyId,
          module: 'pettyCash',
          action: type === 'CREDIT' ? 'PETTY_CASH_CREDIT' : 'PETTY_CASH_DEBIT',
          resource: 'petty_cash_transactions',
          resourceId: insertedId,
          description: `Recorded ₹${newTx.amount} ${type} for ${newTx.siteName} (${newTx.category}: ${newTx.description})`,
          newValue: { type, amount: newTx.amount, siteName: newTx.siteName, personName: newTx.personName }
        }).catch(() => {});
      }

      return res.status(201).json({
        success: true,
        data: {
          ...newTx,
          id: insertedId
        }
      });
    } catch (err: any) {
      console.error('Error creating petty cash transaction:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // DELETE transaction (with audit log)
  router.delete('/transactions/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const targetQuery = idQuery(req.params.id);

      const existing = await db.collection('petty_cash_transactions').findOne({
        ...targetQuery,
        ...companyFilter(companyId)
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      await db.collection('petty_cash_transactions').deleteOne({ _id: existing._id });

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user?.sub,
          actorType: req.user?.accountType || 'user',
          companyId,
          module: 'pettyCash',
          action: 'PETTY_CASH_DELETED',
          resource: 'petty_cash_transactions',
          resourceId: existing._id.toString(),
          description: `Deleted ${existing.type} entry of ₹${existing.amount} (${existing.siteName}: ${existing.description})`,
          previousValue: existing
        }).catch(() => {});
      }

      return res.json({ success: true, message: 'Transaction deleted successfully' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
}
