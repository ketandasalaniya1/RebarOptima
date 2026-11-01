/**
 * Phase 1 dry-run: inventory BBS/Casting blocks + CRM tower strings vs global projects.
 * Does NOT mutate data. Writes docs/migrations/block-mapping-report.json
 *
 * Usage:
 *   node scripts/block-migration-inventory.js
 * Requires MONGODB_URI in env or backend/.env
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

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

function loadProjectReport() {
  const reportPath = path.join(__dirname, '..', '..', 'docs', 'migrations', 'project-mapping-report.json');
  if (!fs.existsSync(reportPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (_) {
    return null;
  }
}

/** Map legacy module projectId → canonical global projectId when exact bridge exists. */
function buildLegacyToGlobalMap(projectReport) {
  const map = new Map();
  if (!projectReport) return map;
  for (const row of [...(projectReport.mappings || []), ...(projectReport.orphans || [])]) {
    if (row.matchType === 'exact' && row.newGlobalId) {
      map.set(String(row.oldId), String(row.newGlobalId));
    }
  }
  return map;
}

/**
 * Resolve module projectId → global via live catalogs (orgProjectId) and exact name match.
 * Does not invent fuzzy merges.
 */
async function buildLiveLegacyProjectMap(db, globalProjects) {
  const map = new Map();
  const byCompanyName = new Map();
  for (const p of globalProjects) {
    const key = `${String(p.companyId)}::${normalizeName(p.name)}`;
    if (!byCompanyName.has(key)) byCompanyName.set(key, []);
    byCompanyName.get(key).push(p);
  }

  const catalogs = [
    { collection: 'bbs_projects', nameField: 'name' },
    { collection: 'casting_projects', nameField: 'name', extraFilter: { isDeleted: { $ne: true } } },
    { collection: 'crm_projects', nameField: 'name' },
    { collection: 'doc_projects', nameField: 'projectName' },
    { collection: 'gi_projects', nameField: 'name' },
  ];

  for (const cat of catalogs) {
    let docs = [];
    try {
      docs = await db.collection(cat.collection).find(cat.extraFilter || {}).toArray();
    } catch (_) {
      continue;
    }
    for (const doc of docs) {
      const oldId = String(doc._id);
      if (doc.orgProjectId && map.has(oldId) === false) {
        map.set(oldId, {
          globalId: String(doc.orgProjectId),
          via: 'orgProjectId',
          sourceCollection: cat.collection,
        });
        continue;
      }
      const rawName = doc[cat.nameField] || doc.name || '';
      const key = `${String(doc.companyId)}::${normalizeName(rawName)}`;
      const candidates = byCompanyName.get(key) || [];
      if (candidates.length === 1 && !map.has(oldId)) {
        map.set(oldId, {
          globalId: String(candidates[0]._id),
          via: 'exact_name',
          sourceCollection: cat.collection,
        });
      } else if (candidates.length > 1 && !map.has(oldId)) {
        map.set(oldId, {
          globalId: null,
          via: 'ambiguous_name',
          sourceCollection: cat.collection,
          candidateIds: candidates.map((c) => String(c._id)),
        });
      }
    }
  }
  return map;
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

  const projectReport = loadProjectReport();
  const reportLegacyToGlobal = buildLegacyToGlobalMap(projectReport);

  const globalProjects = await db.collection('projects').find({}).toArray();
  const globalById = new Map(globalProjects.map((p) => [String(p._id), p]));
  const liveLegacyMap = await buildLiveLegacyProjectMap(db, globalProjects);

  function resolveGlobalProjectId(rawProjectId) {
    const raw = String(rawProjectId || '');
    if (globalById.has(raw)) return { id: raw, via: 'already_global' };
    if (reportLegacyToGlobal.has(raw)) {
      return { id: reportLegacyToGlobal.get(raw), via: 'project_mapping_report' };
    }
    const live = liveLegacyMap.get(raw);
    if (live?.globalId) return { id: live.globalId, via: live.via };
    return { id: null, via: live?.via || 'unresolved' };
  }

  const existingCanonical = await db
    .collection('project_blocks')
    .find({})
    .toArray()
    .catch(() => []);

  const canonicalByProjectName = new Map();
  for (const b of existingCanonical) {
    const key = `${String(b.projectId)}::${normalizeName(b.name)}`;
    if (!canonicalByProjectName.has(key)) canonicalByProjectName.set(key, []);
    canonicalByProjectName.get(key).push(b);
  }

  const sources = [
    {
      collection: 'bbs_blocks',
      nameField: 'name',
      extraFilter: {},
      childCollections: [
        { name: 'bbs_levels', blockField: 'blockId' },
        { name: 'bbs_members', blockField: 'blockId' },
      ],
    },
    {
      collection: 'casting_blocks',
      nameField: 'name',
      extraFilter: { isDeleted: { $ne: true } },
      childCollections: [
        { name: 'casting_levels', blockField: 'blockId' },
        { name: 'casting_members', blockField: 'blockId' },
      ],
    },
  ];

  const blockRows = [];
  const orphans = [];
  const duplicatesWithinSource = [];
  const ambiguousCrossModule = [];
  const alreadyBridged = [];

  // Track names per canonical project for cross-module ambiguity
  const namesByCanonical = new Map(); // key: projectId::nameLower -> [{source, blockId, name}]

  for (const src of sources) {
    let docs = [];
    try {
      docs = await db.collection(src.collection).find(src.extraFilter || {}).toArray();
    } catch (e) {
      console.warn(`Skip ${src.collection}:`, e.message);
      continue;
    }

    // Duplicate names within same projectId in source collection
    const byProjectName = new Map();
    for (const doc of docs) {
      const pId = String(doc.projectId || '');
      const n = normalizeName(doc[src.nameField] || doc.name);
      const k = `${pId}::${n}`;
      if (!byProjectName.has(k)) byProjectName.set(k, []);
      byProjectName.get(k).push(doc);
    }
    for (const [k, group] of byProjectName) {
      if (group.length > 1 && k.split('::')[1]) {
        duplicatesWithinSource.push({
          sourceCollection: src.collection,
          key: k,
          count: group.length,
          blockIds: group.map((d) => String(d._id)),
          names: group.map((d) => d.name),
          action: 'manual_reconcile_do_not_auto_merge',
        });
      }
    }

    for (const doc of docs) {
      const rawProjectId = String(doc.projectId || '');
      const resolved = resolveGlobalProjectId(rawProjectId);
      let resolvedProjectId = resolved.id;
      let projectResolveVia = resolved.via;
      if (!resolvedProjectId && doc.orgProjectId && globalById.has(String(doc.orgProjectId))) {
        resolvedProjectId = String(doc.orgProjectId);
        projectResolveVia = 'block.orgProjectId';
      }

      const rawName = doc[src.nameField] || doc.name || '';
      const nameLower = normalizeName(rawName);
      const childCounts = {};
      for (const child of src.childCollections) {
        try {
          childCounts[child.name] = await db.collection(child.name).countDocuments({
            [child.blockField]: { $in: [String(doc._id), doc._id] },
          });
        } catch (_) {
          childCounts[child.name] = null;
        }
      }

      const orgBlockId = doc.orgBlockId ? String(doc.orgBlockId) : null;
      if (orgBlockId) {
        alreadyBridged.push({
          sourceCollection: src.collection,
          blockId: String(doc._id),
          orgBlockId,
          projectId: rawProjectId,
        });
      }

      let matchType = 'unmapped';
      let canonicalBlockId = null;
      if (resolvedProjectId && nameLower) {
        const canonKey = `${resolvedProjectId}::${nameLower}`;
        const existing = canonicalByProjectName.get(canonKey) || [];
        if (existing.length === 1) {
          matchType = 'exact_canonical';
          canonicalBlockId = String(existing[0]._id);
        } else if (existing.length > 1) {
          matchType = 'ambiguous_canonical';
        } else if (orgBlockId && existingCanonical.some((b) => String(b._id) === orgBlockId)) {
          matchType = 'bridged';
          canonicalBlockId = orgBlockId;
        } else {
          matchType = 'propose_create_canonical';
        }

        if (!namesByCanonical.has(canonKey)) namesByCanonical.set(canonKey, []);
        namesByCanonical.get(canonKey).push({
          sourceCollection: src.collection,
          blockId: String(doc._id),
          name: rawName,
          projectId: rawProjectId,
          resolvedProjectId,
        });
      }

      const row = {
        companyId: String(doc.companyId || ''),
        sourceCollection: src.collection,
        sourceBlockId: String(doc._id),
        sourceName: rawName,
        nameLower,
        sourceProjectId: rawProjectId,
        resolvedCanonicalProjectId: resolvedProjectId,
        projectResolveVia,
        globalProjectName: resolvedProjectId ? globalById.get(resolvedProjectId)?.name || null : null,
        orgBlockId,
        matchType,
        canonicalBlockId,
        childCounts,
        verified: false,
        action:
          matchType === 'propose_create_canonical'
            ? 'create_project_block_after_approval'
            : matchType === 'exact_canonical' || matchType === 'bridged'
              ? 'set_orgBlockId_bridge_after_approval'
              : 'manual_review',
      };

      if (!resolvedProjectId) {
        orphans.push(row);
      } else {
        blockRows.push(row);
      }
    }
  }

  for (const [key, group] of namesByCanonical) {
    const sourcesPresent = new Set(group.map((g) => g.sourceCollection));
    if (sourcesPresent.size > 1) {
      // Same normalized name appears in both BBS and Casting for same project — candidate unify, still not auto-merge
      ambiguousCrossModule.push({
        key,
        sources: [...sourcesPresent],
        entries: group,
        note: 'Same normalized name across modules; map to one project_blocks row only after human approval',
      });
    }
  }

  // CRM tower strings (not block entities)
  const crmTowers = [];
  let crmUnits = [];
  try {
    crmUnits = await db
      .collection('crm_units')
      .find({ buildingTower: { $exists: true, $ne: '' } })
      .project({ projectId: 1, companyId: 1, buildingTower: 1, blockId: 1 })
      .toArray();
  } catch (e) {
    console.warn('Skip crm_units:', e.message);
  }

  const towerAgg = new Map();
  for (const u of crmUnits) {
    const pId = String(u.projectId || '');
    const resolved = resolveGlobalProjectId(pId).id;
    const tower = String(u.buildingTower || '').trim();
    const k = `${resolved || pId}::${normalizeName(tower)}`;
    if (!towerAgg.has(k)) {
      towerAgg.set(k, {
        companyId: String(u.companyId || ''),
        sourceProjectId: pId,
        resolvedCanonicalProjectId: resolved,
        buildingTower: tower,
        nameLower: normalizeName(tower),
        unitCount: 0,
        unitsWithBlockId: 0,
        matchType: 'crm_tower_string',
      });
    }
    const agg = towerAgg.get(k);
    agg.unitCount += 1;
    if (u.blockId) agg.unitsWithBlockId += 1;
  }

  for (const agg of towerAgg.values()) {
    if (agg.resolvedCanonicalProjectId && agg.nameLower) {
      const canonKey = `${agg.resolvedCanonicalProjectId}::${agg.nameLower}`;
      const existing = canonicalByProjectName.get(canonKey) || [];
      if (existing.length === 1) {
        agg.proposedCanonicalBlockId = String(existing[0]._id);
        agg.matchType = 'crm_exact_canonical_name';
      } else {
        const bbsCast = namesByCanonical.get(canonKey) || [];
        if (bbsCast.length === 1) {
          agg.matchType = 'crm_fuzzy_via_module_block';
          agg.proposedFromModule = bbsCast[0];
        } else if (bbsCast.length > 1) {
          agg.matchType = 'crm_ambiguous';
        } else {
          agg.matchType = 'crm_unmapped';
        }
      }
    } else {
      agg.matchType = 'crm_orphan_project';
    }
    crmTowers.push(agg);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    mutatesData: false,
    notes: [
      'Read-only inventory. Do not auto-merge ambiguous or fuzzy rows.',
      'Destructive remaps require separate approved scripts (not this file).',
      'Prefer exact (canonicalProjectId, nameLower) maps only when creating project_blocks.',
    ],
    projectReportPresent: Boolean(projectReport),
    projectReportIsPlaceholder: Boolean(projectReport?.note && /placeholder/i.test(projectReport.note)),
    liveLegacyProjectMapSize: [...liveLegacyMap.values()].filter((v) => v.globalId).length,
    summary: {
      globalProjectCount: globalProjects.length,
      existingProjectBlocks: existingCanonical.length,
      bbsCastingBlockRows: blockRows.length,
      orphanBlocks: orphans.length,
      duplicatesWithinSource: duplicatesWithinSource.length,
      crossModuleSameName: ambiguousCrossModule.length,
      alreadyBridged: alreadyBridged.length,
      crmDistinctTowers: crmTowers.length,
      crmUnmapped: crmTowers.filter((t) => t.matchType === 'crm_unmapped' || t.matchType === 'crm_orphan_project')
        .length,
      crmAmbiguous: crmTowers.filter((t) => t.matchType === 'crm_ambiguous').length,
      proposeCreateCanonical: blockRows.filter((r) => r.matchType === 'propose_create_canonical').length,
    },
    blockRows,
    orphans,
    duplicatesWithinSource,
    ambiguousCrossModule,
    alreadyBridged,
    crmTowers,
  };

  const outDir = path.join(__dirname, '..', '..', 'docs', 'migrations');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'block-mapping-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('Wrote', outPath);
  console.log(JSON.stringify(report.summary, null, 2));

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
