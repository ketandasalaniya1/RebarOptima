import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { rupeesToPaise, paiseToRupees, calculateBookingFinancials } from '../crm.calculation.service';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const BATCH_SIZE = 100;

export async function runMoneyPaiseMigration(options: { apply?: boolean; mongoUri?: string } = {}) {
  const isApply = !!options.apply;
  const mongoUri = options.mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/rebaroptima';

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(` CRM MONEY PAISE MIGRATION & PARITY VERIFICATION (${isApply ? 'APPLY MODE' : 'DRY RUN'})`);
  console.log('═══════════════════════════════════════════════════════════════════════');

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db();

  const report = {
    bookingsExamined: 0,
    bookingsUpdated: 0,
    schedulesExamined: 0,
    schedulesUpdated: 0,
    paymentsExamined: 0,
    paymentsUpdated: 0,
    unitsExamined: 0,
    unitsUpdated: 0,
    customersExamined: 0,
    customersUpdated: 0,
    interestsExamined: 0,
    interestsUpdated: 0,
    parityMismatches: [] as any[]
  };

  try {
    // 1. Migrate crm_bookings
    const bookingCursor = db.collection('crm_bookings').find({});
    let bookingBatch: any[] = [];
    while (await bookingCursor.hasNext()) {
      const doc = await bookingCursor.next();
      if (!doc) continue;
      report.bookingsExamined++;

      const agreementPricePaise = rupeesToPaise(doc.agreementPrice);
      const discountAmountPaise = rupeesToPaise(doc.discountAmount || 0);
      const taxAmountPaise = rupeesToPaise(doc.taxAmount || 0);
      const netBookingValuePaise = rupeesToPaise(doc.netBookingValue || (doc.agreementPrice - (doc.discountAmount || 0) + (doc.taxAmount || 0)));
      const bookingDepositRequiredPaise = rupeesToPaise(doc.bookingDepositRequired || 0);

      // Parity check
      const expectedNetRupees = paiseToRupees(netBookingValuePaise);
      const existingNetRupees = doc.netBookingValue || doc.agreementPrice;
      if (Math.abs(expectedNetRupees - existingNetRupees) > 0.01) {
        report.parityMismatches.push({
          collection: 'crm_bookings',
          id: doc._id,
          reference: doc.bookingReference,
          existingRupees: existingNetRupees,
          calculatedRupees: expectedNetRupees,
          diff: expectedNetRupees - existingNetRupees
        });
      }

      bookingBatch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              agreementPricePaise,
              discountAmountPaise,
              taxAmountPaise,
              netBookingValuePaise,
              bookingDepositRequiredPaise
            }
          }
        }
      });

      if (bookingBatch.length >= BATCH_SIZE) {
        if (isApply) {
          await db.collection('crm_bookings').bulkWrite(bookingBatch);
        }
        report.bookingsUpdated += bookingBatch.length;
        bookingBatch = [];
      }
    }
    if (bookingBatch.length > 0) {
      if (isApply) {
        await db.collection('crm_bookings').bulkWrite(bookingBatch);
      }
      report.bookingsUpdated += bookingBatch.length;
    }

    // 2. Migrate crm_payment_schedules
    const schedCursor = db.collection('crm_payment_schedules').find({});
    let schedBatch: any[] = [];
    while (await schedCursor.hasNext()) {
      const doc = await schedCursor.next();
      if (!doc) continue;
      report.schedulesExamined++;

      const dueAmountPaise = rupeesToPaise(doc.dueAmount);
      const paidAmountPaise = rupeesToPaise(doc.paidAmount || 0);

      schedBatch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              dueAmountPaise,
              paidAmountPaise
            }
          }
        }
      });

      if (schedBatch.length >= BATCH_SIZE) {
        if (isApply) {
          await db.collection('crm_payment_schedules').bulkWrite(schedBatch);
        }
        report.schedulesUpdated += schedBatch.length;
        schedBatch = [];
      }
    }
    if (schedBatch.length > 0) {
      if (isApply) {
        await db.collection('crm_payment_schedules').bulkWrite(schedBatch);
      }
      report.schedulesUpdated += schedBatch.length;
    }

    // 3. Migrate crm_payment_transactions
    const payCursor = db.collection('crm_payment_transactions').find({});
    let payBatch: any[] = [];
    while (await payCursor.hasNext()) {
      const doc = await payCursor.next();
      if (!doc) continue;
      report.paymentsExamined++;

      const amountPaise = rupeesToPaise(doc.amount);

      payBatch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              amountPaise
            }
          }
        }
      });

      if (payBatch.length >= BATCH_SIZE) {
        if (isApply) {
          await db.collection('crm_payment_transactions').bulkWrite(payBatch);
        }
        report.paymentsUpdated += payBatch.length;
        payBatch = [];
      }
    }
    if (payBatch.length > 0) {
      if (isApply) {
        await db.collection('crm_payment_transactions').bulkWrite(payBatch);
      }
      report.paymentsUpdated += payBatch.length;
    }

    // 4. Migrate crm_units
    const unitCursor = db.collection('crm_units').find({});
    let unitBatch: any[] = [];
    while (await unitCursor.hasNext()) {
      const doc = await unitCursor.next();
      if (!doc) continue;
      report.unitsExamined++;

      const basePricePaise = rupeesToPaise(doc.basePrice);
      const askingPricePaise = rupeesToPaise(doc.askingPrice || doc.basePrice);

      unitBatch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              basePricePaise,
              askingPricePaise
            }
          }
        }
      });

      if (unitBatch.length >= BATCH_SIZE) {
        if (isApply) {
          await db.collection('crm_units').bulkWrite(unitBatch);
        }
        report.unitsUpdated += unitBatch.length;
        unitBatch = [];
      }
    }
    if (unitBatch.length > 0) {
      if (isApply) {
        await db.collection('crm_units').bulkWrite(unitBatch);
      }
      report.unitsUpdated += unitBatch.length;
    }

    // 5. Migrate crm_customers
    const custCursor = db.collection('crm_customers').find({});
    let custBatch: any[] = [];
    while (await custCursor.hasNext()) {
      const doc = await custCursor.next();
      if (!doc) continue;
      report.customersExamined++;

      const budgetMinPaise = rupeesToPaise(doc.budgetMin || 0);
      const budgetMaxPaise = rupeesToPaise(doc.budgetMax || 0);

      custBatch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              budgetMinPaise,
              budgetMaxPaise
            }
          }
        }
      });

      if (custBatch.length >= BATCH_SIZE) {
        if (isApply) {
          await db.collection('crm_customers').bulkWrite(custBatch);
        }
        report.customersUpdated += custBatch.length;
        custBatch = [];
      }
    }
    if (custBatch.length > 0) {
      if (isApply) {
        await db.collection('crm_customers').bulkWrite(custBatch);
      }
      report.customersUpdated += custBatch.length;
    }

    console.log(`\nMigration Summary:`);
    console.log(`- Bookings:     ${report.bookingsExamined} examined, ${report.bookingsUpdated} ${isApply ? 'updated' : 'eligible'}`);
    console.log(`- Schedules:    ${report.schedulesExamined} examined, ${report.schedulesUpdated} ${isApply ? 'updated' : 'eligible'}`);
    console.log(`- Payments:     ${report.paymentsExamined} examined, ${report.paymentsUpdated} ${isApply ? 'updated' : 'eligible'}`);
    console.log(`- Units:        ${report.unitsExamined} examined, ${report.unitsUpdated} ${isApply ? 'updated' : 'eligible'}`);
    console.log(`- Customers:    ${report.customersExamined} examined, ${report.customersUpdated} ${isApply ? 'updated' : 'eligible'}`);
    console.log(`- Parity Discrepancies: ${report.parityMismatches.length}`);

    if (report.parityMismatches.length > 0) {
      console.warn('⚠️ Parity discrepancies detected:', report.parityMismatches);
    } else {
      console.log('✅ ZERO parity discrepancies between float rupees and integer paise totals.');
    }

    return report;
  } finally {
    await client.close();
  }
}

// Allow direct CLI execution: ts-node migrate-crm-money-paise.ts [--apply]
if (require.main === module) {
  const isApply = process.argv.includes('--apply');
  runMoneyPaiseMigration({ apply: isApply })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
