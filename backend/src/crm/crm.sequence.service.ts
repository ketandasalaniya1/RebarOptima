import { Db, ObjectId } from 'mongodb';

export type CrmSequenceType = 'customerCode' | 'bookingReference' | 'paymentReference' | 'receiptNumber';

/**
 * Atomically generates sequential, collision-resistant business references per tenant.
 */
export async function getNextSequence(
  db: Db,
  companyId: any,
  type: CrmSequenceType,
  year?: number
): Promise<string> {
  const currentYear = year || new Date().getFullYear();
  const cId = companyId && ObjectId.isValid(String(companyId)) ? new ObjectId(String(companyId)) : companyId;

  const filter = {
    companyId: cId,
    type,
    year: currentYear
  };

  const update = {
    $inc: { seq: 1 },
    $setOnInsert: { createdAt: new Date() },
    $set: { updatedAt: new Date() }
  };

  const result = await db.collection('crm_counters').findOneAndUpdate(
    filter,
    update,
    { upsert: true, returnDocument: 'after' }
  );

  const seq = result?.seq || 1;
  const padded = String(seq).padStart(4, '0');

  switch (type) {
    case 'customerCode':
      return `CUST-${padded}`;
    case 'bookingReference':
      return `BK-${currentYear}-${padded}`;
    case 'paymentReference':
      return `TXN-${currentYear}-${padded}`;
    case 'receiptNumber':
      return `REC-${currentYear}-${padded}`;
    default:
      return `${String(type).toUpperCase()}-${currentYear}-${padded}`;
  }
}

/**
 * Atomically reserves a block of sequential references for batch operations
 */
export async function getNextSequenceBlock(
  db: Db,
  companyId: any,
  type: CrmSequenceType,
  count: number,
  year?: number
): Promise<{ getNext: () => string }> {
  if (count <= 0) return { getNext: () => '' };
  const currentYear = year || new Date().getFullYear();
  const cId = companyId && ObjectId.isValid(String(companyId)) ? new ObjectId(String(companyId)) : companyId;

  const result = await db.collection('crm_counters').findOneAndUpdate(
    { companyId: cId, type, year: currentYear },
    { $inc: { seq: count }, $setOnInsert: { createdAt: new Date() }, $set: { updatedAt: new Date() } },
    { upsert: true, returnDocument: 'after' }
  );

  const endSeq = result?.seq || count;
  let current = endSeq - count + 1;

  return {
    getNext: () => {
      const seq = current++;
      const padded = String(seq).padStart(4, '0');
      switch (type) {
        case 'customerCode':
          return `CUST-${padded}`;
        case 'bookingReference':
          return `BK-${currentYear}-${padded}`;
        case 'paymentReference':
          return `TXN-${currentYear}-${padded}`;
        case 'receiptNumber':
          return `REC-${currentYear}-${padded}`;
        default:
          return `${String(type).toUpperCase()}-${currentYear}-${padded}`;
      }
    }
  };
}

/**
 * Idempotently creates required compound indexes across all CRM collections.
 */
export async function ensureCrmIndexes(db: Db): Promise<void> {
  try {
    // 1. crm_counters
    await db.collection('crm_counters').createIndex(
      { companyId: 1, type: 1, year: 1 },
      { unique: true, background: true }
    );

    // 2. crm_customers
    await db.collection('crm_customers').createIndex(
      { companyId: 1, customerCode: 1 },
      { unique: true, background: true }
    );
    await db.collection('crm_customers').createIndex(
      { companyId: 1, phoneNormalized: 1 },
      {
        unique: true,
        background: true,
        partialFilterExpression: { phoneNormalized: { $type: 'string', $gt: '' } }
      }
    );
    await db.collection('crm_customers').createIndex(
      { companyId: 1, email: 1 },
      { background: true }
    );

    // 3. crm_units
    await db.collection('crm_units').createIndex(
      { companyId: 1, projectId: 1, unitCode: 1 },
      { unique: true, background: true }
    );
    await db.collection('crm_units').createIndex(
      { companyId: 1, availabilityStatus: 1, heldUntil: 1 },
      { background: true }
    );

    // 4. crm_unit_interests
    await db.collection('crm_unit_interests').createIndex(
      { companyId: 1, customerId: 1 },
      { background: true }
    );
    await db.collection('crm_unit_interests').createIndex(
      { companyId: 1, stage: 1, assignedSalespersonId: 1 },
      { background: true }
    );

    // 5. crm_follow_ups
    await db.collection('crm_follow_ups').createIndex(
      { companyId: 1, assignedToId: 1, status: 1, dueDateTime: 1 },
      { background: true }
    );
    await db.collection('crm_follow_ups').createIndex(
      { companyId: 1, customerId: 1 },
      { background: true }
    );

    // 6. crm_bookings
    await db.collection('crm_bookings').createIndex(
      { companyId: 1, bookingReference: 1 },
      { unique: true, background: true }
    );
    await db.collection('crm_bookings').createIndex(
      { companyId: 1, unitId: 1 },
      { background: true }
    );

    // 7. crm_payment_transactions
    await db.collection('crm_payment_transactions').createIndex(
      { companyId: 1, paymentReference: 1 },
      { unique: true, background: true }
    );
    await db.collection('crm_payment_transactions').createIndex(
      { companyId: 1, receiptNumber: 1 },
      { unique: true, background: true }
    );
    await db.collection('crm_payment_transactions').createIndex(
      { companyId: 1, bookingId: 1, paymentDate: -1 },
      { background: true }
    );

    // 8. crm_payment_schedules
    await db.collection('crm_payment_schedules').createIndex(
      { companyId: 1, bookingId: 1, sortOrder: 1 },
      { background: true }
    );

    // 9. crm_activities
    await db.collection('crm_activities').createIndex(
      { companyId: 1, customerId: 1, createdAt: -1 },
      { background: true }
    );
  } catch (err) {
    console.warn('Notice: CRM index initialization:', (err as any)?.message || err);
  }
}

