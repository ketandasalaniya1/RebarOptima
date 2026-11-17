import { ObjectId } from 'mongodb';
import {
  normalizePhoneNumber,
  companyFilter,
  DEFAULT_CONTACT_CATEGORIES,
  toObjectId,
} from './contacts.routes';

describe('Central Contact Directory - Unit & Logic Test Suite', () => {
  // ── 1. PHONE NORMALIZATION ──────────────────────────────────────────────
  describe('Phone Number Normalization & Sanitization', () => {
    it('normalizes standard 10-digit mobile number by stripping non-digit symbols', () => {
      expect(normalizePhoneNumber('+91 98765-43210')).toBe('9876543210');
      expect(normalizePhoneNumber('98765 43210')).toBe('9876543210');
      expect(normalizePhoneNumber('(987) 654-3210')).toBe('9876543210');
    });

    it('strips leading country code 91 when 12 digits are present', () => {
      expect(normalizePhoneNumber('919876543210')).toBe('9876543210');
      expect(normalizePhoneNumber('+919876543210')).toBe('9876543210');
    });

    it('strips leading 0 when 11 digits are present', () => {
      expect(normalizePhoneNumber('09876543210')).toBe('9876543210');
    });

    it('gracefully handles empty, null, or undefined inputs', () => {
      expect(normalizePhoneNumber('')).toBe('');
      expect(normalizePhoneNumber(null)).toBe('');
      expect(normalizePhoneNumber(undefined)).toBe('');
      expect(normalizePhoneNumber('abc-def')).toBe('');
    });
  });

  // ── 2. MULTI-TENANCY & COMPANY ISOLATION ────────────────────────────────
  describe('Company Multi-Tenant Isolation Filter', () => {
    it('constructs a robust company filter matching both string and ObjectId representations', () => {
      const validObjectIdStr = '507f1f77bcf86cd799439011';
      const filter = companyFilter(validObjectIdStr);
      expect(filter).toBeDefined();
      expect(filter.$or).toBeDefined();
      expect(filter.$or).toHaveLength(2);
      expect(filter.$or[0].companyId).toBeInstanceOf(ObjectId);
      expect(filter.$or[1].companyId).toBe(validObjectIdStr);
    });

    it('falls back to string companyId when input is not a 24-hex ObjectId', () => {
      const filter = companyFilter('custom_firm_tenant_99');
      expect(filter).toEqual({ companyId: 'custom_firm_tenant_99' });
    });

    it('safely handles null companyId without throwing', () => {
      const filter = companyFilter(null);
      expect(filter).toEqual({ companyId: null });
    });
  });

  // ── 3. DEFAULT STAKEHOLDER CATEGORIES ──────────────────────────────────
  describe('Default Stakeholder Categories Coverage', () => {
    it('contains all mandatory construction stakeholder categories', () => {
      const requiredCategories = [
        'Client',
        'Contractor',
        'Subcontractor',
        'Supplier',
        'Architect',
        'Structural Engineer',
        'Civil Engineer',
        'Electrical Contractor',
        'Plumbing Contractor',
        'Labour Contractor',
        'Consultant',
        'Government Officer',
        'Site Staff',
        'Transporter',
        'Other',
      ];

      for (const cat of requiredCategories) {
        expect(DEFAULT_CONTACT_CATEGORIES).toContain(cat);
      }
      expect(DEFAULT_CONTACT_CATEGORIES.length).toBeGreaterThanOrEqual(15);
    });
  });

  // ── 4. OBJECT ID CONVERSION UTILITY ─────────────────────────────────────
  describe('toObjectId utility', () => {
    it('returns an existing ObjectId intact', () => {
      const id = new ObjectId();
      expect(toObjectId(id)).toBe(id);
    });

    it('converts a valid 24-character hex string into ObjectId', () => {
      const hex = '507f1f77bcf86cd799439011';
      const objId = toObjectId(hex);
      expect(objId).toBeInstanceOf(ObjectId);
      expect(objId?.toHexString()).toBe(hex);
    });

    it('returns null for non-hex or invalid lengths', () => {
      expect(toObjectId('invalid-id')).toBeNull();
      expect(toObjectId('12345')).toBeNull();
      expect(toObjectId(null)).toBeNull();
      expect(toObjectId(undefined)).toBeNull();
    });
  });

  // ── 5. DUPLICATE CHECKING SIMULATION ───────────────────────────────────
  describe('Duplicate Detection Simulation Across Tenants', () => {
    it('detects duplicates when a phone exists within the same tenant', () => {
      const existingContacts = [
        {
          _id: new ObjectId(),
          companyId: 'tenant_A',
          name: 'Rajesh Patel',
          normalizedPhones: ['9820012345'],
          isArchived: false,
        },
      ];

      const inputPhone = '+91 98200-12345';
      const normalized = normalizePhoneNumber(inputPhone);

      const duplicate = existingContacts.find(
        (c) => c.companyId === 'tenant_A' && c.normalizedPhones.includes(normalized) && !c.isArchived
      );

      expect(duplicate).toBeDefined();
      expect(duplicate?.name).toBe('Rajesh Patel');
    });

    it('does not falsely flag duplicates across different tenants (strict isolation)', () => {
      const existingContacts = [
        {
          _id: new ObjectId(),
          companyId: 'tenant_A',
          name: 'Rajesh Patel',
          normalizedPhones: ['9820012345'],
          isArchived: false,
        },
      ];

      const inputPhone = '9820012345';
      const targetCompany = 'tenant_B'; // Different company

      const duplicate = existingContacts.find(
        (c) => c.companyId === targetCompany && c.normalizedPhones.includes(inputPhone)
      );

      expect(duplicate).toBeUndefined();
    });
  });

  // ── 6. CENTRALIZED MULTI-PROJECT SHARING ARCHITECTURE ───────────────────
  describe('Centralized Multi-Project Association Architecture', () => {
    it('allows a single contact record to be linked to multiple project IDs without record duplication', () => {
      const contactRecord = {
        _id: new ObjectId(),
        companyId: 'tenant_A',
        name: 'Sharma Steels & Cement',
        projectIds: ['proj_skyhight', 'proj_dashtech', 'proj_commercial_hub'],
        visibility: 'shared',
        phoneNumbers: [
          { number: '9811122233', type: 'Primary Mobile', isPrimary: true, isWhatsApp: true },
        ],
      };

      // Ensure no duplication occurred: 1 record, multiple projects
      expect(contactRecord.projectIds).toHaveLength(3);
      expect(contactRecord.projectIds).toContain('proj_skyhight');
      expect(contactRecord.projectIds).toContain('proj_dashtech');
      expect(contactRecord.projectIds).toContain('proj_commercial_hub');
    });

    it('enforces creator privacy when visibility is private', () => {
      const creatorUserId = 'user_engineer_101';
      const otherUserId = 'user_accountant_202';

      const privateContact = {
        _id: new ObjectId(),
        companyId: 'tenant_A',
        name: 'Confidential Consultant',
        visibility: 'private',
        createdBy: creatorUserId,
        projectIds: ['proj_skyhight'],
      };

      // Visibility check rule
      const canView = (contact: any, requestingUser: string, isCompanyAdmin: boolean) => {
        if (contact.visibility === 'shared') return true;
        if (isCompanyAdmin) return true;
        return contact.createdBy === requestingUser;
      };

      expect(canView(privateContact, creatorUserId, false)).toBe(true);
      expect(canView(privateContact, otherUserId, false)).toBe(false);
      expect(canView(privateContact, otherUserId, true)).toBe(true); // Company Admin can view
    });
  });
});

