import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { normalizePhone } from '../crm.reservation.service';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const BATCH_SIZE = 100;

export async function runPhoneNormalizationBackfill(options: { apply?: boolean; mongoUri?: string } = {}) {
  const isApply = !!options.apply;
  const mongoUri = options.mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/rebaroptima';

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(` CRM PHONE NORMALIZATION BACKFILL (${isApply ? 'APPLY MODE' : 'DRY RUN'})`);
  console.log('═══════════════════════════════════════════════════════════════════════');

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db();

  const report = {
    totalExamined: 0,
    totalUpdated: 0,
    alreadyNormalized: 0,
    conflictsDetected: [] as any[]
  };

  try {
    const cursor = db.collection('crm_customers').find({});
    const phoneMap = new Map<string, any[]>();
    let batch: any[] = [];

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) continue;
      report.totalExamined++;

      const phoneNormalized = normalizePhone(doc.phone);
      const altPhoneNormalized = doc.altPhone ? normalizePhone(doc.altPhone) : '';

      // Collision check within company
      if (phoneNormalized) {
        const key = `${String(doc.companyId)}:${phoneNormalized}`;
        if (!phoneMap.has(key)) {
          phoneMap.set(key, []);
        }
        phoneMap.get(key)!.push({
          _id: doc._id,
          customerCode: doc.customerCode,
          fullName: doc.fullName,
          phone: doc.phone
        });
      }

      if (doc.phoneNormalized === phoneNormalized && doc.altPhoneNormalized === altPhoneNormalized) {
        report.alreadyNormalized++;
        continue;
      }

      batch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              phoneNormalized,
              altPhoneNormalized,
              updatedAt: new Date()
            }
          }
        }
      });

      if (batch.length >= BATCH_SIZE) {
        if (isApply) {
          await db.collection('crm_customers').bulkWrite(batch);
        }
        report.totalUpdated += batch.length;
        batch = [];
      }
    }

    if (batch.length > 0) {
      if (isApply) {
        await db.collection('crm_customers').bulkWrite(batch);
      }
      report.totalUpdated += batch.length;
    }

    // Inspect collisions
    for (const [key, customers] of phoneMap.entries()) {
      if (customers.length > 1) {
        report.conflictsDetected.push({
          companyAndPhone: key,
          duplicateCount: customers.length,
          customers
        });
      }
    }

    console.log(`\nPhone Backfill Summary:`);
    console.log(`- Customers Examined: ${report.totalExamined}`);
    console.log(`- Already Normalized: ${report.alreadyNormalized}`);
    console.log(`- Updated / Eligible: ${report.totalUpdated}`);
    console.log(`- Conflicts Detected: ${report.conflictsDetected.length}`);

    if (report.conflictsDetected.length > 0) {
      console.warn('⚠️ Duplicate phone conflicts detected across customers:');
      console.warn(JSON.stringify(report.conflictsDetected, null, 2));
    } else {
      console.log('✅ ZERO phone number conflicts detected.');
    }

    return report;
  } finally {
    await client.close();
  }
}

// Allow direct CLI execution: ts-node backfill-crm-phone-normalization.ts [--apply]
if (require.main === module) {
  const isApply = process.argv.includes('--apply');
  runPhoneNormalizationBackfill({ apply: isApply })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Phone backfill failed:', err);
      process.exit(1);
    });
}
