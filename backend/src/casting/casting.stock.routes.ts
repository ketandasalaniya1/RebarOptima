import { Router } from 'express';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { processStockInward } from './casting.inventory.service';

function idQuery(id: string): any {
  if (ObjectId.isValid(id) && id.length === 24) {
    return { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
  }
  return { _id: id };
}

async function resolveCompanyId(req: any, db: Db): Promise<string> {
  if (req.user?.companyId) return String(req.user.companyId);
  const header = req.headers['x-company-id'];
  if (header) return String(header);

  if (req.user?.sub) {
    const userQuery = ObjectId.isValid(req.user.sub) && req.user.sub.length === 24
      ? { _id: new ObjectId(req.user.sub) }
      : { _id: req.user.sub };
    const u = await db.collection('users').findOne(userQuery);
    if (u?.companyId) return String(u.companyId);
  }
  return 'default-company';
}

export function createCastingStockRouter(
  getDb: () => Db,
  getClient: () => MongoClient,
  authMiddleware: any,
  logAudit?: any
): Router {
  const router = Router();

  // 1. GET /projects/:projectId/stock — List project store stock balances
  router.get('/projects/:projectId/stock', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;

      const stocks = await db.collection('casting_material_stock')
        .find({ companyId, projectId })
        .sort({ category: 1, name: 1 })
        .toArray();

      return res.json({
        success: true,
        data: stocks.map((s: any) => ({ ...s, id: s._id.toString() }))
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 2. POST /projects/:projectId/stock/inward — Inward material delivery (GRN)
  router.post('/projects/:projectId/stock/inward', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const client = getClient();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const challanNumber = req.body.challanNumber || req.body.deliveryChallanNumber;
      const vendorName = req.body.vendorName || req.body.supplierName;
      const vendorGstin = req.body.vendorGstin;
      const vehicleNumber = req.body.vehicleNumber || req.body.truckNumber;
      const deliveryDate = req.body.deliveryDate || req.body.receivedDate;
      const remarks = req.body.remarks;

      const rawItems = req.body.items || [];
      const items = rawItems.map((it: any) => ({
        ...it,
        enteredQuantity: it.enteredQuantity !== undefined ? it.enteredQuantity : it.receivedQuantity,
        enteredUnit: it.enteredUnit || it.receivedUnit,
        targetCanonicalUnit: it.targetCanonicalUnit || it.canonicalTargetUnit
      }));

      const receivedBy = {
        userId: req.user.sub,
        name: req.user.name || req.user.email || 'Store Keeper',
        email: req.user.email || '',
        role: req.user.role || 'Store Keeper'
      };

      const receipt = await processStockInward(db, client, {
        companyId,
        projectId,
        challanNumber,
        vendorName,
        vendorGstin,
        vehicleNumber,
        deliveryDate,
        items,
        receivedBy,
        remarks
      });

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user.sub,
          actorType: req.user.accountType || 'user',
          companyId,
          module: 'casting',
          action: 'CASTING_STOCK_INWARD_RECORDED',
          resource: 'casting_inward_receipts',
          resourceId: receipt._id ? receipt._id.toString() : receipt.inwardKey,
          description: `Recorded inward delivery challan ${challanNumber} from vendor ${vendorName}`
        });
      }

      return res.status(receipt.isDuplicateReplay ? 200 : 201).json({
        success: true,
        message: receipt.isDuplicateReplay ? 'Inward delivery already recorded (Duplicate Replay).' : 'Material stock inward processed successfully.',
        data: receipt
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  // 3. GET /projects/:projectId/stock/ledger — Project stock movement ledger
  router.get('/projects/:projectId/stock/ledger', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;
      const { materialIdentifier, transactionType } = req.query;

      const filter: any = { companyId, projectId };
      if (materialIdentifier) filter.materialIdentifier = String(materialIdentifier);
      if (transactionType) filter.transactionType = String(transactionType);

      const transactions = await db.collection('casting_stock_transactions')
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();

      return res.json({
        success: true,
        data: transactions.map((t: any) => ({ ...t, id: t._id.toString() }))
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 4. GET /projects/:projectId/stock/receipts/inward — Inward delivery receipts
  router.get('/projects/:projectId/stock/receipts/inward', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.params;

      const receipts = await db.collection('casting_inward_receipts')
        .find({ companyId, projectId })
        .sort({ receivedAt: -1 })
        .toArray();

      return res.json({
        success: true,
        data: receipts.map((r: any) => ({ ...r, id: r._id.toString() }))
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
}
