/**
 * Phase 3a (additive): set orgProjectId on module project docs from verified mappings.
 * Does NOT remap child projectId values.
 *
 * Usage:
 *   node scripts/project-migration-apply-bridge.js [--apply]
 * Without --apply: dry-run only.
 * Reads docs/migrations/project-mapping-report.json (or --report=path)
 */
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const apply = process.argv.includes('--apply');
const reportArg = process.argv.find((a) => a.startsWith('--report='));
const reportPath =
  (reportArg && reportArg.split('=')[1]) ||
  path.join(__dirname, '..', '..', 'docs', 'migrations', 'project-mapping-report.json');

async function main() {
  if (!fs.existsSync(reportPath)) {
    console.error('Mapping report not found. Run project-migration-inventory.js first.');
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const rows = [...(report.mappings || [])].filter((m) => m.newGlobalId && m.matchType === 'exact');

  console.log(`${apply ? 'APPLY' : 'DRY-RUN'}: bridge ${rows.length} exact mappings`);

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  let updated = 0;
  for (const row of rows) {
    const filter = ObjectId.isValid(row.oldId) && row.oldId.length === 24
      ? { _id: new ObjectId(row.oldId) }
      : { _id: row.oldId };
    if (!apply) {
      console.log(`Would set ${row.sourceCollection}.${row.oldId} orgProjectId=${row.newGlobalId}`);
      continue;
    }
    const res = await db.collection(row.sourceCollection).updateOne(filter, {
      $set: { orgProjectId: String(row.newGlobalId), orgProjectLinkedAt: new Date() },
    });
    if (res.modifiedCount || res.matchedCount) {
      updated++;
      await db.collection('project_id_migrations').updateOne(
        { sourceCollection: row.sourceCollection, oldId: String(row.oldId) },
        {
          $set: {
            companyId: row.companyId,
            sourceCollection: row.sourceCollection,
            oldId: String(row.oldId),
            newGlobalId: String(row.newGlobalId),
            matchType: row.matchType,
            phase: 'bridge',
            verifiedAt: new Date(),
            verifiedBy: 'bridge-script',
          },
        },
        { upsert: true },
      );
    }
  }

  console.log(apply ? `Bridged ${updated} docs` : 'Dry-run complete');
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
