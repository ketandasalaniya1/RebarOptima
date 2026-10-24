import { ObjectId, Db } from 'mongodb';
import { ICrmUnit, UnitAvailabilityStatus } from './crm.types';

/**
 * Normalizes phone numbers for collision detection (removes spaces, hyphens, parentheses, country code +91)
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
 * Generates collision-resistant business references
 */
export async function generateBusinessReference(
  db: Db,
  companyId: any,
  collectionName: string,
  prefix: string,
  field: string = 'bookingReference'
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const count = await db.collection(collectionName).countDocuments({ companyId });
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const sequence = String(count + 1).padStart(4, '0');
  const candidate = `${prefix}-${currentYear}-${sequence}`;

  // Collision check
  const exists = await db.collection(collectionName).findOne({ [field]: candidate, companyId });
  if (exists) {
    return `${prefix}-${currentYear}-${sequence}-${randomSuffix}`;
  }
  return candidate;
}

/**
 * Checks for existing customer by phone or email
 */
export async function checkDuplicateCustomer(
  db: Db,
  companyId: any,
  phone: string,
  email?: string,
  excludeCustomerId?: any
): Promise<{ isDuplicate: boolean; matches: any[]; reason?: string }> {
  const normPhone = normalizePhone(phone);
  const normEmail = email ? normalizeEmail(email) : '';

  const query: any = { companyId };
  if (excludeCustomerId) {
    query._id = { $ne: excludeCustomerId instanceof ObjectId ? excludeCustomerId : new ObjectId(excludeCustomerId) };
  }

  const allCustomers = await db.collection('crm_customers').find(query).toArray();
  const matches = allCustomers.filter((c: any) => {
    const p = normalizePhone(c.phone);
    const altP = normalizePhone(c.altPhone || '');
    const e = normalizeEmail(c.email || '');

    const phoneMatches = normPhone && (p === normPhone || altP === normPhone);
    const emailMatches = normEmail && e && e === normEmail;
    return phoneMatches || emailMatches;
  });

  if (matches.length > 0) {
    const reasons: string[] = [];
    if (matches.some((m: any) => normalizePhone(m.phone) === normPhone)) reasons.push('primary phone number');
    if (matches.some((m: any) => normalizeEmail(m.email) === normEmail)) reasons.push('email address');
    return {
      isDuplicate: true,
      matches,
      reason: `Customer with identical ${reasons.join(' and ')} already exists.`
    };
  }

  return { isDuplicate: false, matches: [] };
}

/**
 * Safely evaluates unit availability, accounting for expired temporary holds
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

/**
 * Atomic reservation validation and transition
 */
export async function reserveUnitSafely(
  db: Db,
  companyId: any,
  unitId: any,
  customerId: any,
  holdDurationHours: number = 48
): Promise<{ success: boolean; message: string; unit?: any }> {
  const uId = unitId instanceof ObjectId ? unitId : new ObjectId(unitId);
  const unit = await db.collection('crm_units').findOne({ _id: uId, companyId });

  if (!unit) {
    return { success: false, message: 'Target property unit not found.' };
  }

  const { isAvailable, isHoldExpired } = evaluateUnitAvailability(unit);

  // If already held by the same customer, refresh hold
  const isSameCustomerHold = unit.availabilityStatus === 'Held' && String(unit.heldByCustomerId) === String(customerId);

  if (!isAvailable && !isSameCustomerHold) {
    return {
      success: false,
      message: `Unit ${unit.unitCode} is currently in '${unit.availabilityStatus}' status and cannot be reserved.`
    };
  }

  const heldUntil = new Date();
  heldUntil.setHours(heldUntil.getHours() + holdDurationHours);

  const updateResult = await db.collection('crm_units').updateOne(
    { _id: uId, companyId },
    {
      $set: {
        availabilityStatus: 'Reserved',
        heldUntil,
        heldByCustomerId: String(customerId),
        updatedAt: new Date()
      }
    }
  );

  if (updateResult.modifiedCount === 0 && !isSameCustomerHold) {
    return { success: false, message: 'Concurrent reservation conflict detected. Please refresh inventory.' };
  }

  const updatedUnit = await db.collection('crm_units').findOne({ _id: uId });
  return {
    success: true,
    message: `Unit ${unit.unitCode} successfully reserved until ${heldUntil.toLocaleString()}.`,
    unit: updatedUnit
  };
}

/**
 * Confirms booking on a unit, changing its status to 'Booked'
 */
export async function commitUnitBooking(
  db: Db,
  companyId: any,
  unitId: any,
  bookingId: any,
  customerId: any
): Promise<{ success: boolean; message: string; unit?: any }> {
  const uId = unitId instanceof ObjectId ? unitId : new ObjectId(unitId);
  const unit = await db.collection('crm_units').findOne({ _id: uId, companyId });

  if (!unit) {
    return { success: false, message: 'Target property unit not found.' };
  }

  // Unit must be Available, Held by this customer, or Reserved
  if (['Booked', 'Sold', 'Blocked'].includes(unit.availabilityStatus)) {
    return {
      success: false,
      message: `Unit ${unit.unitCode} is already ${unit.availabilityStatus}. Duplicate booking prevented.`
    };
  }

  await db.collection('crm_units').updateOne(
    { _id: uId, companyId },
    {
      $set: {
        availabilityStatus: 'Booked',
        activeBookingId: String(bookingId),
        heldByCustomerId: String(customerId),
        heldUntil: null,
        updatedAt: new Date()
      }
    }
  );

  const updatedUnit = await db.collection('crm_units').findOne({ _id: uId });
  return { success: true, message: `Unit ${unit.unitCode} committed to booking successfully.`, unit: updatedUnit };
}

/**
 * Releases unit when a booking or hold is cancelled
 */
export async function releaseUnitSafely(
  db: Db,
  companyId: any,
  unitId: any
): Promise<{ success: boolean; message: string }> {
  const uId = unitId instanceof ObjectId ? unitId : new ObjectId(unitId);
  const unit = await db.collection('crm_units').findOne({ _id: uId, companyId });

  if (!unit) return { success: false, message: 'Unit not found.' };

  await db.collection('crm_units').updateOne(
    { _id: uId, companyId },
    {
      $set: {
        availabilityStatus: 'Available',
        activeBookingId: null,
        heldByCustomerId: null,
        heldUntil: null,
        updatedAt: new Date()
      }
    }
  );

  return { success: true, message: `Unit ${unit.unitCode} released back to Available status.` };
}
