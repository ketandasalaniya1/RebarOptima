/**
 * Phase 0 dry-run: map module project catalogs → global /api/projects IDs.
 * Does NOT mutate data. Writes docs/migrations/project-mapping-report.json
 *
 * Usage:
 *   node scripts/project-migration-inventory.js
 * Requires MONGODB_URI in env or backend/.env
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const MODULE_COLLECTIONS = [
  { collection: 'bbs_projects', nameField: 'name' },
  { collection: 'casting_projects', nameField: 'name', extraFilter: { isDeleted: { $ne: true } } },
  { collection: 'crm_projects', nameField: 'name' },
  { collection: 'doc_projects', nameField: 'projectName' },
  { collection: 'gi_projects', nameField: 'name' },
];

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function fuzzyScore(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.75;
  return 0;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const globalProjects = await db.collection('projects').find({}).toArray();
  const byCompany = new Map();
  for (const p of globalProjects) {
    const cid = String(p.companyId);
    if (!byCompany.has(cid)) byCompany.set(cid, []);
    byCompany.get(cid).push(p);
  }

  const mappings = [];
  const orphans = [];
  const globalsOnly = [];

  const seenGlobalMatched = new Set();

  for (const mod of MODULE_COLLECTIONS) {
    const filter = mod.extraFilter || {};
    let docs = [];
    try {
      docs = await db.collection(mod.collection).find(filter).toArray();
    } catch (e) {
      console.warn(`Skip ${mod.collection}:`, e.message);
      continue;
    }

    for (const doc of docs) {
      const companyId = String(doc.companyId || '');
      const rawName = doc[mod.nameField] || doc.name || '';
      const norm = normalizeName(rawName);
      const candidates = byCompany.get(companyId) || [];
      let best = null;
      let bestScore = 0;
      let matchType = 'unmatched';

      for (const g of candidates) {
        const gNorm = normalizeName(g.name);
        if (gNorm === norm && norm) {
          best = g;
          bestScore = 1;
          matchType = 'exact';
          break;
        }
        const score = fuzzyScore(gNorm, norm);
        if (score > bestScore) {
          bestScore = score;
          best = g;
          matchType = score >= 0.75 ? 'fuzzy' : 'unmatched';
        }
      }

      if (matchType === 'unmatched') best = null;

      const row = {
        companyId,
        sourceCollection: mod.collection,
        oldId: String(doc._id),
        sourceName: rawName,
        matchType,
        newGlobalId: best ? String(best._id) : null,
        globalName: best ? best.name : null,
        confidence: matchType === 'exact' ? 1 : matchType === 'fuzzy' ? bestScore : 0,
        verified: false,
        action: best
          ? 'remap_children_after_approval'
          : 'propose_create_global_after_approval',
      };

      if (best) {
        seenGlobalMatched.add(`${companyId}:${String(best._id)}`);
        mappings.push(row);
      } else {
        orphans.push(row);
      }
    }
  }

  for (const p of globalProjects) {
    const key = `${String(p.companyId)}:${String(p._id)}`;
    if (!seenGlobalMatched.has(key)) {
      globalsOnly.push({
        companyId: String(p.companyId),
        globalId: String(p._id),
        name: p.name,
        note: 'No module catalog row matched; modules will show empty state for this project',
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    summary: {
      globalCount: globalProjects.length,
      mappingCandidates: mappings.length,
      exact: mappings.filter((m) => m.matchType === 'exact').length,
      fuzzy: mappings.filter((m) => m.matchType === 'fuzzy').length,
      orphans: orphans.length,
      globalsOnly: globalsOnly.length,
    },
    mappings,
    orphans,
    globalsOnly,
  };

  const outDir = path.join(__dirname, '..', '..', 'docs', 'migrations');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'project-mapping-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('Wrote', outPath);
  console.log(JSON.stringify(report.summary, null, 2));

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
