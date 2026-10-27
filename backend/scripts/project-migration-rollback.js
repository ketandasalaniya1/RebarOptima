/**
 * Rollback child projectId remaps using _migratedFromProjectId.
 * Usage: node scripts/project-migration-rollback.js --i-approve-rollback
 */
const { MongoClient } = require('mongodb');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const approved = process.argv.includes('--i-approve-rollback');

const CHILD_COLLECTIONS = [
  'bbs_blocks', 'bbs_levels', 'bbs_members',
  'casting_blocks', 'casting_levels', 'casting_members', 'casting_events',
  'casting_material_stock', 'casting_stock_transactions', 'casting_inward_receipts',
  'casting_posting_receipts', 'casting_reversal_receipts', 'casting_consumption_records',
  'crm_units', 'crm_unit_interests', 'crm_site_visits', 'crm_bookings',
  'doc_drawings', 'doc_transmittals',
  'gi_stores', 'gi_materials', 'gi_stock_balances', 'gi_transactions',
  'gi_inward_entries', 'gi_outward_entries', 'gi_returns', 'gi_transfers', 'gi_stock_verifications',
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  console.log(approved ? 'APPLY rollback' : 'DRY-RUN rollback');

  for (const coll of CHILD_COLLECTIONS) {
    const filter = { _migratedFromProjectId: { $exists: true } };
    const docs = await db.collection(coll).find(filter).project({ _id: 1, projectId: 1, _migratedFromProjectId: 1 }).toArray().catch(() => []);
    console.log(`${coll}: ${docs.length} docs to restore`);
    if (!approved) continue;
    for (const doc of docs) {
      await db.collection(coll).updateOne(
        { _id: doc._id },
        {
          $set: { projectId: doc._migratedFromProjectId },
          $unset: { _migratedFromProjectId: '', _migratedAt: '' },
        },
      );
    }
  }

  if (approved) {
    await db.collection('project_id_migrations').updateMany(
      { phase: 'children_remapped' },
      { $set: { phase: 'rolled_back', rolledBackAt: new Date() } },
    );
    // Clear bridge orgProjectId? Keep bridge; only children rolled back.
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
