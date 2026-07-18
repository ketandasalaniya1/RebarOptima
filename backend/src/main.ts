import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoClient, Db, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

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

// ── AUTH HELPERS ─────────────────────────────────────────────────────────────
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'fallback-access-secret';

function generateTokens(userId: string, email: string, role: string) {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
  const accessToken = jwt.sign({ sub: userId, email, role }, ACCESS_SECRET, { expiresIn: (process.env.ACCESS_TOKEN_EXPIRATION || '15m') as any });
  const refreshToken = jwt.sign({ sub: userId }, refreshSecret, { expiresIn: (process.env.REFRESH_TOKEN_EXPIRATION || '7d') as any });
  return { accessToken, refreshToken };
}

// JWT middleware — attaches decoded token to req.user
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

// ── INVENTORY HELPERS ────────────────────────────────────────────────────────
function getSingleBarWeight(diameter: number, lengthMm = 12000): number {
  return (lengthMm / 1000) * (diameter * diameter) / 162;
}

const STD_DIAMETERS = [8, 10, 12, 16, 20, 25, 32];

async function ensureScrapRules(db: Db, companyId: ObjectId) {
  const coll = db.collection('scraprules');
  const existing = await coll.find({ companyId }).toArray();
  const existingSet = new Set(existing.map((r: any) => r.diameter));
  const missing = STD_DIAMETERS.filter(d => !existingSet.has(d));
  if (missing.length) {
    await coll.insertMany(missing.map(d => ({ companyId, diameter: d, scrapLengthThreshold: 1000, createdAt: new Date() })));
  }
  return coll.find({ companyId }).sort({ diameter: 1 }).toArray();
}

// ── AUTH ROUTES ───────────────────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, companyName, projectName, location, mobileNumber, promoConsent, newsletterConsent } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const db = await connectDB();
    const usersColl = db.collection('users');
    const existing = await usersColl.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: 'Email already registered' });
    const companiesColl = db.collection('companies');
    const companyResult = await companiesColl.insertOne({ name: companyName, projectName, location, createdAt: new Date() });
    const companyId = companyResult.insertedId;
    const passwordHash = await bcrypt.hash(password, 10);
    const userDoc: any = { email: email.toLowerCase().trim(), passwordHash, firstName, lastName, role: role || 'OWNER', companyId, mobileNumber, promoConsent: !!promoConsent, newsletterConsent: !!newsletterConsent, createdAt: new Date() };
    const userResult = await usersColl.insertOne(userDoc);
    const tokens = generateTokens(userResult.insertedId.toString(), userDoc.email, userDoc.role);
    res.status(201).json({ ...tokens, user: { id: userResult.insertedId.toString(), email: userDoc.email, firstName, lastName, role: userDoc.role, companyId: companyId.toString(), companyName } });
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
    const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (!await bcrypt.compare(password, user.passwordHash)) return res.status(401).json({ message: 'Invalid credentials' });
    const company = await db.collection('companies').findOne({ _id: user.companyId });
    const tokens = generateTokens(user._id.toString(), user.email, user.role);
    res.json({ ...tokens, user: { id: user._id.toString(), email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, companyId: user.companyId.toString(), companyName: company?.name ?? 'Unknown' } });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ message: 'Internal server error', error: e.message });
  }
});

// ── INVENTORY ROUTES (protected) ─────────────────────────────────────────────
app.get('/api/inventory', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const companyId = new ObjectId(req.user.sub === req.user.sub ? (await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) }))?.companyId : null);
    const items = await db.collection('stockitems').find({ companyId, quantity: { $gt: 0 } }).sort({ createdAt: 1 }).toArray();
    res.json({ standardStock: items.filter((i: any) => !i.isRemnant), remnantsStock: items.filter((i: any) => i.isRemnant) });
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.post('/api/inventory/inward', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc?.companyId;
    const { diameter, length = 12000, quantity: rawQty = 0, weightInKgs: rawWeight = 0, costPerKg, typeOfBar = '', brandName = '', vendorName = '' } = req.body;
    let quantity = Number(rawQty), weightInKgs = Number(rawWeight);
    const singleWeight = getSingleBarWeight(Number(diameter), Number(length));
    if (weightInKgs > 0 && quantity === 0) quantity = Math.round(weightInKgs / singleWeight);
    else if (quantity > 0 && weightInKgs === 0) weightInKgs = quantity * singleWeight;
    const filter = { companyId, diameter: Number(diameter), length: Number(length), costPerKg: Number(costPerKg), typeOfBar, brandName, vendorName, isRemnant: false };
    const result = await db.collection('stockitems').findOneAndUpdate(filter, { $inc: { quantity, weightInKgs }, $setOnInsert: { createdAt: new Date() } }, { upsert: true, returnDocument: 'after' });
    await db.collection('inventorytransactions').insertOne({ companyId, type: 'INWARD', diameter: Number(diameter), length: Number(length), quantity, weightInKgs, brandName, vendorName, typeOfBar: typeOfBar || 'TMT500', referenceName: 'Manual Inward Entry', createdAt: new Date() });
    res.json(result);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.get('/api/inventory/scrap-rules', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const rules = await ensureScrapRules(db, userDoc?.companyId);
    res.json(rules);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.post('/api/inventory/scrap-rules', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc?.companyId;
    const { rules } = req.body;
    await Promise.all(rules.map((r: any) =>
      db.collection('scraprules').findOneAndUpdate({ companyId, diameter: r.diameter }, { $set: { scrapLengthThreshold: r.scrapLengthThreshold } }, { upsert: true })
    ));
    res.json(await db.collection('scraprules').find({ companyId }).sort({ diameter: 1 }).toArray());
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.get('/api/inventory/ledger', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const ledger = await db.collection('inventorytransactions').find({ companyId: userDoc?.companyId }).sort({ createdAt: -1 }).toArray();
    res.json(ledger);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.delete('/api/inventory/:id', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const result = await db.collection('stockitems').findOneAndDelete({ _id: new ObjectId(req.params.id), companyId: userDoc?.companyId, isRemnant: false });
    res.json({ deleted: !!result });
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

// ── BATCHES ROUTES (protected) ────────────────────────────────────────────────
app.post('/api/batches', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc?.companyId;
    const { batchName, inputStock, requiredParts, layouts, summary } = req.body;
    const scrapRules = await ensureScrapRules(db, companyId);
    const rulesMap = new Map(scrapRules.map((r: any) => [r.diameter, r.scrapLengthThreshold]));
    let totalScrapKg = 0, totalRemnantKg = 0;

    for (const layout of (layouts || [])) {
      const diameter = Number(layout.diameter);
      const stockLength = Number(layout.stockLength);
      const repetition = Number(layout.repetition);
      const singleWeight = getSingleBarWeight(diameter, stockLength);
      const layoutWeight = singleWeight * repetition;

      if (!layout.isVirtual && layout.dbId) {
        const original = await db.collection('stockitems').findOne({ _id: new ObjectId(layout.dbId) }) as any;
        if (original) {
          const newQty = Math.max(0, original.quantity - repetition);
          const newWeight = Math.max(0, original.weightInKgs - layoutWeight);
          if (newQty === 0) await db.collection('stockitems').deleteOne({ _id: original._id });
          else await db.collection('stockitems').updateOne({ _id: original._id }, { $set: { quantity: newQty, weightInKgs: newWeight } });
          await db.collection('inventorytransactions').insertOne({ companyId, type: 'OUTWARD', diameter, length: stockLength, quantity: repetition, weightInKgs: layoutWeight, brandName: original.brandName || '', vendorName: original.vendorName || '', typeOfBar: original.typeOfBar || '', referenceName: batchName || 'Cutting Batch', createdAt: new Date() });

          const waste = Number(layout.waste);
          if (waste > 0) {
            const threshold = rulesMap.get(diameter) ?? 1000;
            const wasteWeight = getSingleBarWeight(diameter, waste) * repetition;
            if (waste < threshold) { totalScrapKg += wasteWeight; }
            else {
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
      } else if (layout.isVirtual) {
        const waste = Number(layout.waste);
        if (waste > 0) totalScrapKg += getSingleBarWeight(diameter, waste) * repetition;
      }
    }

    const batch = await db.collection('batches').insertOne({ companyId, batchName, inputStock, requiredParts, layouts, summary: { ...summary, totalScrapKg, totalRemnantKg }, createdAt: new Date() });
    res.status(201).json({ _id: batch.insertedId, batchName, summary: { ...summary, totalScrapKg, totalRemnantKg } });
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.get('/api/batches', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const batches = await db.collection('batches').find({ companyId: userDoc?.companyId }).sort({ createdAt: -1 }).toArray();
    res.json(batches);
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.get('/api/batches/stats', authMiddleware, async (req: any, res) => {
  try {
    const db = await connectDB();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
    const companyId = userDoc?.companyId;

    const liveStock = await db.collection('stockitems').find({ companyId, quantity: { $gt: 0 } }).toArray();
    let liveStandardKg = 0, liveRemnantsKg = 0;
    const diameterWeights: { [key: number]: number } = { 8: 0, 10: 0, 12: 0, 16: 0, 20: 0, 25: 0, 32: 0 };

    liveStock.forEach((i: any) => {
      if (i.isRemnant) {
        liveRemnantsKg += i.weightInKgs;
      } else {
        liveStandardKg += i.weightInKgs;
      }
      const dia = Number(i.diameter);
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

    const dailyScrapGraph = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().split('T')[0];
      return { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), scrapKg: Math.round((dailyScrapMap.get(key) || 0) * 100) / 100 };
    });

    const wastagePercentage = totalStockUsedKg > 0 ? (totalScrapKg / totalStockUsedKg) * 100 : 0;
    res.json({
      liveStandardKg: Math.round(liveStandardKg * 100) / 100,
      liveRemnantsKg: Math.round(liveRemnantsKg * 100) / 100,
      totalLiveStockKg: Math.round((liveStandardKg + liveRemnantsKg) * 100) / 100,
      totalScrapKg: Math.round(totalScrapKg * 100) / 100,
      wastagePercentage: Math.round(wastagePercentage * 100) / 100,
      dailyScrapGraph,
      diameterWeights,
    });
  } catch (e: any) { console.error(e); res.status(500).json({ message: e.message }); }
});

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Express server listening on port ${PORT}`));
