import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import { CrmRole } from './crm.types';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Derives a 32-byte key from environment or fallback secret.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.CRM_ENCRYPTION_KEY || process.env.JWT_SECRET || 'rebaroptima-crm-secure-key-default-32bytes!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts sensitive plaintext (e.g. PAN or Aadhaar) at rest using AES-256-GCM.
 */
export function encryptSensitiveField(plaintext: string | undefined | null): string | null {
  if (!plaintext || typeof plaintext !== 'string') return null;
  const trimmed = plaintext.trim();
  if (!trimmed) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  let encrypted = cipher.update(trimmed, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Format: iv:authTag:encryptedHex
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts sensitive ciphertext back to plaintext.
 */
export function decryptSensitiveField(ciphertext: string | undefined | null): string | null {
  if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.includes(':')) return null;

  try {
    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) return null;

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.warn('Decryption failed for sensitive field:', (err as any)?.message);
    return null;
  }
}

/**
 * Masks PAN numbers (e.g. ABCDE1234F -> AB•••••34F)
 */
export function maskPan(pan?: string | null): string {
  if (!pan) return '';
  const clean = String(pan).trim().toUpperCase();
  if (clean.length !== 10) return clean ? `${clean.substring(0, 2)}••••${clean.slice(-2)}` : '';
  return `${clean.substring(0, 2)}•••••${clean.substring(7)}`;
}

/**
 * Masks Aadhaar numbers and extracts last 4 digits (e.g. 123456789821 -> •••• •••• 9821)
 */
export function maskAadhaar(aadhaar?: string | null): { masked: string; last4: string } {
  if (!aadhaar) return { masked: '', last4: '' };
  const digits = String(aadhaar).replace(/[^\d]/g, '');
  const last4 = digits.slice(-4);
  return {
    masked: last4 ? `•••• •••• ${last4}` : '',
    last4
  };
}

/**
 * Role-Based Access Control Middleware for CRM.
 * Roles: admin, sales_manager, accountant, sales_rep
 */
export function requireCrmRole(...allowedRoles: CrmRole[]) {
  return (req: any, res: Response, next: NextFunction) => {
    // Determine user role from token or request
    const userRole = (req.user?.role || req.user?.crmRole || 'sales_rep').toLowerCase() as CrmRole;
    
    // Superadmin or admin bypasses all CRM checks
    if (userRole === 'admin' || req.user?.isAdmin || req.user?.role === 'superadmin') {
      req.crmRole = 'admin';
      return next();
    }

    if (allowedRoles.includes(userRole)) {
      req.crmRole = userRole;
      return next();
    }

    return res.status(403).json({
      message: `Access denied. Role '${userRole}' is not authorized for this operation. Required: ${allowedRoles.join(' or ')}.`
    });
  };
}

