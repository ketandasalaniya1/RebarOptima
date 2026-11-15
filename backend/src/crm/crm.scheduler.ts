import { Db, ObjectId } from 'mongodb';

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Checks and persists expired holds back to 'Available' status.
 */
export async function checkAndExpireHolds(db: Db): Promise<number> {
  if (!db) return 0;
  try {
    const now = new Date();
    // Find units currently held whose heldUntil timestamp has passed
    const expiredUnits = await db.collection('crm_units').find({
      availabilityStatus: 'Held',
      heldUntil: { $lt: now }
    }).toArray();

    if (expiredUnits.length === 0) return 0;

    let releasedCount = 0;
    for (const unit of expiredUnits) {
      const updateResult = await db.collection('crm_units').findOneAndUpdate(
        {
          _id: unit._id,
          availabilityStatus: 'Held',
          heldUntil: { $lt: now }
        },
        {
          $set: {
            availabilityStatus: 'Available',
            heldUntil: null,
            heldByCustomerId: null,
            updatedAt: now
          }
        },
        { returnDocument: 'after' }
      );

      if (updateResult) {
        releasedCount++;
        // Write activity log
        if (unit.heldByCustomerId) {
          const custId = ObjectId.isValid(String(unit.heldByCustomerId))
            ? new ObjectId(String(unit.heldByCustomerId))
            : unit.heldByCustomerId;

          await db.collection('crm_activities').insertOne({
            companyId: unit.companyId,
            customerId: custId,
            unitCode: unit.unitCode,
            activityType: 'Booking Action',
            title: `Hold Expired: Unit ${unit.unitCode}`,
            description: `Temporary reservation hold on Unit ${unit.unitCode} expired and was automatically released back to Available inventory.`,
            performedBy: 'system',
            performedByName: 'Auto-Hold Expiration Service',
            createdAt: now
          });
        }
      }
    }

    if (releasedCount > 0) {
      console.log(`[CRM Scheduler] Auto-released ${releasedCount} expired unit reservation holds.`);
    }

    return releasedCount;
  } catch (err) {
    console.error('[CRM Scheduler] Error checking expired unit holds:', (err as any)?.message || err);
    return 0;
  }
}

/**
 * Starts the recurring 5-minute background worker for unit hold expiration.
 */
export function startCrmScheduler(getDb: () => any, intervalMs: number = 5 * 60 * 1000): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  // Initial check shortly after startup
  setTimeout(() => {
    try {
      const db = getDb();
      if (db) checkAndExpireHolds(db);
    } catch {}
  }, 5000);

  // Set 5-minute interval
  schedulerInterval = setInterval(() => {
    try {
      const db = getDb();
      if (db) checkAndExpireHolds(db);
    } catch (err) {
      console.error('[CRM Scheduler] Failed to execute cycle:', (err as any)?.message);
    }
  }, intervalMs);

  console.log(`[CRM Scheduler] Background hold-expiry worker started (interval: ${intervalMs / 1000}s).`);
}

/**
 * Stops the background scheduler (used in tests or server shutdown).
 */
export function stopCrmScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

