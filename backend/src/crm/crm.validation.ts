import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ── 1. Query Pagination Helper ──────────────────────────────────────────────
export interface IPaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(query: any): IPaginationOptions {
  const page = Math.max(1, parseInt(String(query?.page || '1'), 10) || 1);
  const rawLimit = parseInt(String(query?.limit || '25'), 10) || 25;
  const limit = Math.min(100, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

// ── 2. Zod Validation Middleware ────────────────────────────────────────────
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      return res.status(400).json({
        message: `Validation failed: ${issues}`,
        errors: result.error.format()
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      return res.status(400).json({
        message: `Invalid query parameters: ${issues}`,
        errors: result.error.format()
      });
    }
    req.query = result.data;
    next();
  };
}

// ── 3. Zod Schemas ──────────────────────────────────────────────────────────

export const createCustomerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().min(7, 'Primary phone must have at least 7 digits'),
  altPhone: z.string().optional().default(''),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  preferredContactMethod: z.enum(['Phone', 'WhatsApp', 'Email', 'In Person']).optional().default('Phone'),
  leadSource: z.string().optional().default('Direct Walk-in'),
  campaign: z.string().optional().default(''),
  budgetMin: z.coerce.number().min(0).optional().default(0),
  budgetMax: z.coerce.number().min(0).optional().default(0),
  preferredLocation: z.string().optional().default(''),
  preferredPropertyType: z.string().optional().default('2BHK'),
  assignedSalespersonId: z.string().optional(),
  assignedSalespersonName: z.string().optional(),
  notes: z.string().optional().default(''),
  communicationConsent: z.boolean().optional().default(true),
  panNumber: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  forceCreate: z.boolean().optional().default(false),
  initialInterest: z.object({
    projectId: z.string().optional(),
    unitId: z.string().optional(),
    unitCode: z.string().optional(),
    budget: z.coerce.number().optional()
  }).optional()
});

export const updateCustomerSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().min(7).optional(),
  altPhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  preferredContactMethod: z.enum(['Phone', 'WhatsApp', 'Email', 'In Person']).optional(),
  leadSource: z.string().optional(),
  budgetMin: z.coerce.number().optional(),
  budgetMax: z.coerce.number().optional(),
  preferredLocation: z.string().optional(),
  preferredPropertyType: z.string().optional(),
  assignedSalespersonId: z.string().optional(),
  assignedSalespersonName: z.string().optional(),
  notes: z.string().optional(),
  panNumber: z.string().optional(),
  aadhaarNumber: z.string().optional()
});

export const createBookingSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  unitId: z.string().min(1, 'Unit ID is required'),
  unitInterestId: z.string().optional(),
  agreementPrice: z.coerce.number().positive('Agreement price must be positive'),
  discountAmount: z.coerce.number().min(0).optional().default(0),
  taxAmount: z.coerce.number().min(0).optional().default(0),
  bookingDepositRequired: z.coerce.number().min(0).optional().default(0),
  bookingDate: z.string().optional(),
  salespersonId: z.string().optional(),
  salespersonName: z.string().optional(),
  notes: z.string().optional(),
  customSchedule: z.array(z.object({
    milestoneName: z.string().min(1),
    milestonePercentage: z.coerce.number().min(0).max(100),
    dueAmount: z.coerce.number().min(0),
    dueDate: z.string().optional()
  })).optional()
});

export const recordPaymentSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  milestoneScheduleId: z.string().optional().nullable(),
  amount: z.coerce.number().positive('Payment amount must be positive'),
  currency: z.string().optional().default('INR'),
  paymentMethod: z.enum([
    'Bank Transfer (NEFT/RTGS)',
    'Cheque',
    'UPI',
    'Demand Draft',
    'Credit/Debit Card',
    'Cash'
  ]).optional().default('Bank Transfer (NEFT/RTGS)'),
  transactionReference: z.string().min(1, 'Transaction reference/UTR/Cheque number is required'),
  paymentDate: z.string().optional(),
  receiptNotes: z.string().optional()
});

export const reversePaymentSchema = z.object({
  reversalReason: z.string().min(3, 'A clear reversal reason is mandatory'),
  reversalType: z.enum(['Reversed', 'Refunded']).optional().default('Reversed')
});

export const reserveUnitSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  holdDurationHours: z.coerce.number().min(1).max(168).optional().default(48)
});

export const blockUnitSchema = z.object({
  blockReason: z.string().min(3, 'Management block reason is required')
});

export const updateLeadStageSchema = z.object({
  stage: z.enum(['New', 'Contacted', 'Qualified', 'Visit Scheduled', 'Visited', 'Negotiation', 'Booked', 'Lost', 'On Hold']),
  notes: z.string().optional(),
  lostReason: z.string().optional()
});

// ── 4. Lightweight In-Memory Write Rate Limiter ─────────────────────────────
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitBucket>();

export function crmRateLimiter(options: { windowMs?: number; max?: number } = {}) {
  const windowMs = options.windowMs || 60000; // 1 minute
  const max = options.max || 100;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `crm:${ip}:${req.path}`;
    const now = Date.now();

    const record = rateLimitMap.get(key);
    if (!record || now > record.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      return res.status(429).json({
        message: 'Too many requests. Please slow down and try again shortly.'
      });
    }

    record.count++;
    next();
  };
}

