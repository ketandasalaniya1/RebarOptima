/**
 * Phase 3c (APPROVAL-GATED): remap child projectId from module IDs → global IDs.
 *
 * Usage:
 *   node scripts/project-migration-remap-children.js --i-approve-remap
 * Without flag: dry-run only.
 */
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const approved = process.argv.includes('--i-approve-remap');

const CHILD_MAP = {
  bbs_projects: ['bbs_blocks', 'bbs_levels', 'bbs_members'],
  casting_projects: [
    'casting_blocks',
    'casting_levels',
    'casting_members',
    'casting_events',
    'casting_material_stock',
    'casting_stock_transactions',
    'casting_inward_receipts',
    'casting_posting_receipts',
    'casting_reversal_receipts',
    'casting_consumption_records',
  ],
  crm_projects: ['crm_units', 'crm_unit_interests', 'crm_site_visits', 'crm_bookings'],
  doc_projects: ['doc_drawings', 'doc_transmittals'],
  gi_projects: [
    'gi_stores',
    'gi_materials',
    'gi_stock_balances',
    'gi_transactions',
    'gi_inward_entries',
    'gi_outward_entries',
    'gi_returns',
    'gi_transfers',
    'gi_stock_verifications',
  ],
};

async function main() {
  const reportPath = path.join(__dirname, '..', '..', 'docs', 'migrations', 'project-mapping-report.json');
  if (!fs.existsSync(reportPath)) {
    console.error('Run inventory first');
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const rows = [...(report.mappings || [])].filter((m) => m.newGlobalId && m.matchType === 'exact');

  console.log(`${approved ? 'APPLY' : 'DRY-RUN'}: remap children for ${rows.length} mappings`);
  if (!approved) {
    console.log('Pass --i-approve-remap to execute after reviewing the mapping report.');
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const summary = [];
  for (const row of rows) {
    const children = CHILD_MAP[row.sourceCollection] || [];
    for (const coll of children) {
      const oldVariants = [String(row.oldId)];
      if (ObjectId.isValid(row.oldId) && row.oldId.length === 24) {
        oldVariants.push(new ObjectId(row.oldId));
      }
      const filter = { projectId: { $in: oldVariants } };
      const count = await db.collection(coll).countDocuments(filter).catch(() => 0);
      summary.push({ coll, oldId: row.oldId, newGlobalId: row.newGlobalId, count });
      if (!approved || count === 0) continue;

      await db.collection(coll).updateMany(filter, {
        $set: {
          projectId: String(row.newGlobalId),
          _migratedFromProjectId: String(row.oldId),
          _migratedAt: new Date(),
        },
      });
      await db.collection('project_id_migrations').updateOne(
        { sourceCollection: row.sourceCollection, oldId: String(row.oldId) },
        {
          $set: {
            phase: 'children_remapped',
            remappedAt: new Date(),
            childCollections: children,
          },
          $addToSet: { remappedChildren: coll },
        },
        { upsert: true },
      );
    }
  }

  console.table(summary.filter((s) => s.count > 0));
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
