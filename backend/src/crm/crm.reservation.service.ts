import { ObjectId, Db } from 'mongodb';
import { UnitAvailabilityStatus } from './crm.types';

/**
 * Normalizes phone numbers for collision detection (removes spaces, hyphens, parentheses, country code +91, leading 0)
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^\d]/g, '');
  // If 12 digits starting with 91, strip country code for standard 10 digit comparison
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.substring(2);
  }
  // If 11 digits starting with 0, strip leading 0
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Normalizes email strings
 */
export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Legacy business reference fallback generator (prefer getNextSequence from crm.sequence.service.ts)
 */
export async function generateBusinessReference(
  db: Db,
  companyId: any,
  collectionName: string,
  prefix: string,
  field: string = 'bookingReference'
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const cId = companyId && ObjectId.isValid(String(companyId)) ? new ObjectId(String(companyId)) : companyId;
  const count = await db.collection(collectionName).countDocuments({ companyId: cId });
  const sequence = String(count + 1).padStart(4, '0');
  const candidate = `${prefix}-${currentYear}-${sequence}`;

  // Collision check
  const exists = await db.collection(collectionName).findOne({ [field]: candidate, companyId: cId });
  if (exists) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${currentYear}-${sequence}-${randomSuffix}`;
  }
  return candidate;
}

/**
 * Checks for existing customer by phone, normalized phone, or email
 */
export async function checkDuplicateCustomer(
  db: Db,
  companyId: any,
  phone: string,
  email?: string,
  excludeCustomerId?: any
): Promise<{ isDuplicate: boolean; matches: any[]; existingCustomerSummary?: any; reason?: string }> {
  const normPhone = normalizePhone(phone);
  const normEmail = email ? normalizeEmail(email) : '';

  const cMatcher = toCompanyMatch(companyId);
  const query: any = { companyId: cMatcher };
  if (excludeCustomerId) {
    query._id = { $ne: excludeCustomerId instanceof ObjectId ? excludeCustomerId : new ObjectId(excludeCustomerId) };
  }

  // Fast direct query on normalized phone or email if indexed
  const orConditions: any[] = [];
  if (normPhone) {
    orConditions.push({ phoneNormalized: normPhone });
    orConditions.push({ phone: phone });
    orConditions.push({ altPhoneNormalized: normPhone });
  }
  if (normEmail) {
    orConditions.push({ email: normEmail });
  }

  if (orConditions.length > 0) {
    query.$or = orConditions;
  }

  const matches = await db.collection('crm_customers').find(query).toArray();

  // In-memory verification for edge cases
  const verifiedMatches = matches.filter((c: any) => {
    const p = normalizePhone(c.phoneNormalized || c.phone);
    const altP = normalizePhone(c.altPhoneNormalized || c.altPhone || '');
    const e = normalizeEmail(c.email || '');

    const phoneMatches = normPhone && (p === normPhone || altP === normPhone);
    const emailMatches = normEmail && e && e === normEmail;
    return phoneMatches || emailMatches;
  });

  if (verifiedMatches.length > 0) {
    const primary = verifiedMatches[0];
    const reasons: string[] = [];
    if (normalizePhone(primary.phoneNormalized || primary.phone) === normPhone) reasons.push('primary phone number');
    if (primary.email && normalizeEmail(primary.email) === normEmail) reasons.push('email address');

    return {
      isDuplicate: true,
      matches: verifiedMatches,
      existingCustomerSummary: {
        customerId: primary._id,
        customerCode: primary.customerCode,
        fullName: primary.fullName,
        phone: primary.phone,
        email: primary.email,
        assignedSalespersonName: primary.assignedSalespersonName,
        createdAt: primary.createdAt
      },
      reason: `Customer with identical ${reasons.join(' and ') || 'contact details'} already exists (${primary.customerCode}: ${primary.fullName}).`
    };
  }

  return { isDuplicate: false, matches: [] };
}

/**
 * Safely evaluates unit availability, accounting for expired temporary holds at read-time
 */
export function evaluateUnitAvailability(unit: any): {
  isAvailable: boolean;
  status: UnitAvailabilityStatus;
  isHoldExpired: boolean;
} {
  const now = new Date();
  let isHoldExpired = false;

  if (unit.availabilityStatus === 'Held' && unit.heldUntil) {
    const holdDate = new Date(unit.heldUntil);
    if (holdDate < now) {
      isHoldExpired = true;
      return { isAvailable: true, status: 'Available', isHoldExpired: true };
    }
  }

  const isAvailable = unit.availabilityStatus === 'Available' || isHoldExpired;
  return { isAvailable, status: isHoldExpired ? 'Available' : unit.availabilityStatus, isHoldExpired };
}

function toIdMatch(id: any) {
  if (!id) return id;
  const str = String(id);
  return ObjectId.isValid(str) && str.length === 24
    ? { $in: [new ObjectId(str), str] }
    : id;
}

function toCompanyMatch(companyId: any) {
  if (!companyId) return companyId;
  const str = String(companyId);
  return ObjectId.isValid(str) && str.length === 24
    ? { $in: [str, new ObjectId(str)] }
    : companyId;
}

/**
 * Atomic reservation validation and transition using conditional findOneAndUpdate.
 * Returns 409 conflict if another user held or booked the unit concurrently.
 */
export async function reserveUnitSafely(
  db: Db,
  companyId: any,
  unitId: any,
  customerId: any,
  holdDurationHours: number = 48
): Promise<{ success: boolean; message: string; unit?: any; conflict?: boolean }> {
  const now = new Date();
  const heldUntil = new Date(now.getTime() + holdDurationHours * 60 * 60 * 1000);
  const uId = ObjectId.isValid(String(unitId)) ? new ObjectId(String(unitId)) : unitId;
  const cMatcher = toCompanyMatch(companyId);
  const custIdStr = String(customerId);

  // Atomic condition: Unit must be Available, OR Held by the same customer, OR Held but expired
  const filter = {
    _id: uId,
    companyId: cMatcher,
    $or: [
      { availabilityStatus: 'Available' },
      { availabilityStatus: 'Held', heldByCustomerId: custIdStr },
      { availabilityStatus: 'Held', heldUntil: { $lt: now } }
    ]
  };

  const update = {
    $set: {
      availabilityStatus: 'Held' as UnitAvailabilityStatus,
      heldUntil,
      heldByCustomerId: custIdStr,
      updatedAt: now
    }
  };

  const updatedUnit = await db.collection('crm_units').findOneAndUpdate(
    filter,
    update,
    { returnDocument: 'after' }
  );

  if (!updatedUnit) {
    // Determine the current state to return an accurate 409 conflict message
    const currentUnit = await db.collection('crm_units').findOne({ _id: uId });
    if (!currentUnit) {
      return { success: false, message: 'Target property unit not found.', conflict: false };
    }

    return {
      success: false,
      conflict: true,
      message: `Conflict: Unit ${currentUnit.unitCode} is currently in '${currentUnit.availabilityStatus}' status and cannot be reserved.`
    };
  }

  return {
    success: true,
    message: `Unit ${updatedUnit.unitCode} successfully reserved on hold until ${heldUntil.toLocaleString()}.`,
    unit: updatedUnit
  };
}

/**
 * Atomically commits booking on a unit, changing its status to 'Booked'.
 * Returns 409 conflict if unit was booked/sold or locked by someone else.
 */
export async function commitUnitBooking(
  db: Db,
  companyId: any,
  unitId: any,
  bookingId: any,
  customerId: any
): Promise<{ success: boolean; message: string; unit?: any; conflict?: boolean }> {
  const now = new Date();
  const uId = ObjectId.isValid(String(unitId)) ? new ObjectId(String(unitId)) : unitId;
  const cMatcher = toCompanyMatch(companyId);
  const custIdStr = String(customerId);

  // Unit can be booked if: Available, OR Held by this customer, OR Held but expired, OR Reserved by this customer
  const filter = {
    _id: uId,
    companyId: cMatcher,
    $or: [
      { availabilityStatus: 'Available' },
      { availabilityStatus: 'Held', heldByCustomerId: custIdStr },
      { availabilityStatus: 'Held', heldUntil: { $lt: now } },
      { availabilityStatus: 'Reserved', heldByCustomerId: custIdStr }
    ]
  };

  const update = {
    $set: {
      availabilityStatus: 'Booked' as UnitAvailabilityStatus,
      activeBookingId: bookingId ? (ObjectId.isValid(String(bookingId)) ? new ObjectId(String(bookingId)) : String(bookingId)) : null,
      heldByCustomerId: custIdStr,
      heldUntil: null,
      updatedAt: now
    }
  };

  const updatedUnit = await db.collection('crm_units').findOneAndUpdate(
    filter,
    update,
    { returnDocument: 'after' }
  );

  if (!updatedUnit) {
    const currentUnit = await db.collection('crm_units').findOne({ _id: uId });
    if (!currentUnit) {
      return { success: false, message: 'Target property unit not found.', conflict: false };
    }
    return {
      success: false,
      conflict: true,
      message: `Conflict: Unit ${currentUnit.unitCode} is currently '${currentUnit.availabilityStatus}' and cannot be booked.`
    };
  }

  return {
    success: true,
    message: `Unit ${updatedUnit.unitCode} committed to booking successfully.`,
    unit: updatedUnit
  };
}

/**
 * Releases unit when a booking or hold is cancelled back to 'Available'
 */
export async function releaseUnitSafely(
  db: Db,
  companyId: any,
  unitId: any
): Promise<{ success: boolean; message: string; unit?: any; conflict?: boolean }> {
  const now = new Date();
  const uId = ObjectId.isValid(String(unitId)) ? new ObjectId(String(unitId)) : unitId;
  const cMatcher = toCompanyMatch(companyId);

  const filter = {
    _id: uId,
    companyId: cMatcher,
    availabilityStatus: { $in: ['Held', 'Reserved', 'Booked'] }
  };

  const update = {
    $set: {
      availabilityStatus: 'Available' as UnitAvailabilityStatus,
      activeBookingId: null,
      heldByCustomerId: null,
      heldUntil: null,
      updatedAt: now
    }
  };

  const updatedUnit = await db.collection('crm_units').findOneAndUpdate(
    filter,
    update,
    { returnDocument: 'after' }
  );

  if (!updatedUnit) {
    return { success: false, message: 'Unit is not currently in a releasable state or not found.', conflict: true };
  }

  return { success: true, message: `Unit ${updatedUnit.unitCode} released back to Available status.`, unit: updatedUnit };
}

/**
 * Blocks unit for management hold
 */
export async function blockUnitSafely(
  db: Db,
  companyId: any,
  unitId: any,
  blockReason: string
): Promise<{ success: boolean; message: string; unit?: any; conflict?: boolean }> {
  const now = new Date();
  const uId = ObjectId.isValid(String(unitId)) ? new ObjectId(String(unitId)) : unitId;
  const cMatcher = toCompanyMatch(companyId);

  // Can only block Available or Held units (cannot block if already Booked or Sold)
  const filter = {
    _id: uId,
    companyId: cMatcher,
    availabilityStatus: { $in: ['Available', 'Held', 'Reserved'] }
  };

  const update = {
    $set: {
      availabilityStatus: 'Blocked' as UnitAvailabilityStatus,
      notes: blockReason ? `[Blocked]: ${blockReason}` : '[Blocked by Management]',
      heldUntil: null,
      heldByCustomerId: null,
      updatedAt: now
    }
  };

  const updatedUnit = await db.collection('crm_units').findOneAndUpdate(
    filter,
    update,
    { returnDocument: 'after' }
  );

  if (!updatedUnit) {
    return {
      success: false,
      conflict: true,
      message: 'Conflict: Unit cannot be blocked because it is already booked or sold.'
    };
  }

  return { success: true, message: `Unit ${updatedUnit.unitCode} blocked successfully.`, unit: updatedUnit };
}

/**
 * Unblocks a previously blocked unit
 */
export async function unblockUnitSafely(
  db: Db,
  companyId: any,
  unitId: any
): Promise<{ success: boolean; message: string; unit?: any; conflict?: boolean }> {
  const now = new Date();
  const uId = ObjectId.isValid(String(unitId)) ? new ObjectId(String(unitId)) : unitId;
  const cMatcher = toCompanyMatch(companyId);

  const filter = {
    _id: uId,
    companyId: cMatcher,
    availabilityStatus: 'Blocked'
  };

  const update = {
    $set: {
      availabilityStatus: 'Available' as UnitAvailabilityStatus,
      updatedAt: now
    }
  };

  const updatedUnit = await db.collection('crm_units').findOneAndUpdate(
    filter,
    update,
    { returnDocument: 'after' }
  );

  if (!updatedUnit) {
    return { success: false, conflict: true, message: 'Unit is not currently blocked or not found.' };
  }

  return { success: true, message: `Unit ${updatedUnit.unitCode} unblocked and returned to Available.`, unit: updatedUnit };
}
