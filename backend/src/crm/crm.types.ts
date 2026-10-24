import { ObjectId } from 'mongodb';

export type LeadStage = 
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Visit Scheduled'
  | 'Visited'
  | 'Negotiation'
  | 'Booked'
  | 'Lost'
  | 'On Hold';

export type UnitAvailabilityStatus = 
  | 'Available'
  | 'Held'
  | 'Reserved'
  | 'Booked'
  | 'Blocked'
  | 'Sold';

export type BookingStatus = 
  | 'Draft'
  | 'Pending Approval'
  | 'Reserved'
  | 'Confirmed'
  | 'Cancelled'
  | 'Refund Pending'
  | 'Refunded';

export type PaymentStatus = 
  | 'Scheduled'
  | 'Due'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue'
  | 'Failed'
  | 'Refunded';

export type SiteVisitStatus = 
  | 'Scheduled'
  | 'Confirmed'
  | 'Completed'
  | 'Rescheduled'
  | 'Cancelled'
  | 'No Show';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Deferred' | 'Cancelled';

export interface ICrmCustomer {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  customerCode: string; // e.g. CUST-1001
  fullName: string;
  phone: string;
  altPhone?: string;
  email?: string;
  address?: string;
  city?: string;
  preferredContactMethod?: 'Phone' | 'WhatsApp' | 'Email' | 'In Person';
  leadSource?: string; // 'Website', 'Referral', 'Walk-in', 'Channel Partner', 'Social Media', etc.
  campaign?: string;
  budgetMin?: number;
  budgetMax?: number;
  preferredLocation?: string;
  preferredPropertyType?: string; // '1BHK', '2BHK', '3BHK', 'Villa', 'Commercial'
  assignedSalespersonId?: string;
  assignedSalespersonName?: string;
  notes?: string;
  communicationConsent?: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ICrmProject {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  projectCode: string; // e.g. PRJ-01
  name: string;
  developerName?: string;
  address?: string;
  location?: string;
  city?: string;
  description?: string;
  propertyCategory?: 'Residential' | 'Commercial' | 'Mixed Use' | 'Plotted';
  configurations?: string[]; // ['1BHK', '2BHK', '3BHK']
  salesStartDate?: string;
  projectStatus: 'Planning' | 'Under Construction' | 'Ready to Move' | 'Sold Out';
  totalUnitsCount?: number;
  assignedTeam?: string[];
  bannerUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICrmUnit {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  projectId: ObjectId | string;
  projectName: string;
  unitCode: string; // e.g. A-1203
  buildingTower: string; // Tower A
  floorNumber: number; // 12
  unitNumber: string; // 1203
  configuration: string; // 2BHK, 3BHK, Penthouse
  propertyType: string;
  carpetAreaSqFt: number;
  saleableAreaSqFt: number;
  basePrice: number;
  askingPrice: number;
  availabilityStatus: UnitAvailabilityStatus;
  heldUntil?: Date | string | null;
  heldByCustomerId?: string | null;
  activeBookingId?: string | null;
  facing?: string; // North, East, Garden, Pool
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICrmUnitInterest {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  customerId: ObjectId | string;
  customerName: string;
  customerPhone: string;
  projectId: ObjectId | string;
  projectName: string;
  unitId?: ObjectId | string | null; // Optional: lead can be general project enquiry or specific unit
  unitCode?: string;
  stage: LeadStage;
  assignedSalespersonId?: string;
  assignedSalespersonName?: string;
  leadSource?: string;
  budget?: number;
  expectedDecisionDate?: string;
  priority: TaskPriority;
  lastContactDate?: string | Date;
  nextFollowUpDate?: string | Date;
  lostReason?: string;
  notes?: string;
  bookingId?: ObjectId | string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICrmActivity {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  customerId: ObjectId | string;
  unitInterestId?: ObjectId | string | null;
  unitCode?: string;
  activityType: 'Call' | 'Meeting' | 'Site Visit' | 'WhatsApp' | 'Email' | 'Note' | 'Stage Change' | 'Booking Action';
  title: string;
  description: string;
  performedBy: string;
  performedByName: string;
  metadata?: any;
  createdAt: Date;
}

export interface ICrmSiteVisit {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  customerId: ObjectId | string;
  customerName: string;
  unitInterestId?: ObjectId | string | null;
  projectId: ObjectId | string;
  projectName: string;
  unitId?: ObjectId | string | null;
  unitCode?: string;
  visitDateTime: string | Date;
  assignedSalespersonId: string;
  assignedSalespersonName: string;
  status: SiteVisitStatus;
  notes?: string;
  outcome?: string;
  nextAction?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICrmFollowUpTask {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  customerId: ObjectId | string;
  customerName: string;
  unitInterestId?: ObjectId | string | null;
  title: string;
  dueDateTime: string | Date;
  priority: TaskPriority;
  taskType: 'Phone Call' | 'WhatsApp' | 'Email' | 'Document Collection' | 'Site Visit Prep' | 'Contract Review' | 'Payment Follow-up';
  status: TaskStatus;
  assignedTo: string;
  assignedToName: string;
  notes?: string;
  completedAt?: Date | null;
  completedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICrmBooking {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  bookingReference: string; // e.g. BK-2026-0001
  customerId: ObjectId | string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  projectId: ObjectId | string;
  projectName: string;
  unitId: ObjectId | string;
  unitCode: string;
  unitInterestId?: ObjectId | string | null;
  agreementPrice: number;
  discountAmount: number;
  taxAmount: number;
  netBookingValue: number;
  bookingDepositRequired: number;
  bookingDate: string | Date;
  status: BookingStatus;
  cancellationReason?: string;
  cancelledAt?: Date | null;
  cancelledBy?: string | null;
  approvalStatus?: 'Not Required' | 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string | null;
  approvedAt?: Date | null;
  notes?: string;
  salespersonId?: string;
  salespersonName?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ICrmPaymentSchedule {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  bookingId: ObjectId | string;
  bookingReference: string;
  milestoneName: string; // 'Token Amount', 'Agreement Signing', 'Foundation Level', 'Slab 1', 'Finishing', 'Possession'
  milestonePercentage: number; // e.g. 10%, 20%
  dueAmount: number;
  dueDate: string | Date;
  paidAmount: number;
  status: PaymentStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICrmPaymentTransaction {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  paymentReference: string; // e.g. TXN-2026-0001
  receiptNumber: string; // e.g. REC-2026-0001
  bookingId: ObjectId | string;
  bookingReference: string;
  customerId: ObjectId | string;
  customerName: string;
  milestoneScheduleId?: ObjectId | string | null;
  amount: number;
  currency: string;
  paymentMethod: 'Bank Transfer (NEFT/RTGS)' | 'Cheque' | 'UPI' | 'Demand Draft' | 'Credit/Debit Card' | 'Cash';
  transactionReference: string; // UTR or Cheque No
  paymentDate: string | Date;
  receivedBy: string;
  receivedByName: string;
  paymentStatus: 'Paid' | 'Reversed' | 'Refunded';
  reversalReason?: string;
  reversalDate?: Date | null;
  receiptNotes?: string;
  createdAt: Date;
  createdBy: string;
}

export interface ICrmSettings {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  leadSources: string[];
  pipelineStages: { key: LeadStage; label: string; order: number; isClosedWon?: boolean; isClosedLost?: boolean }[];
  lostReasons: string[];
  followUpTypes: string[];
  propertyTypes: string[];
  defaultReservationHours: number; // e.g. 48 hours
  milestoneTemplates: { name: string; percentage: number }[];
  updatedAt: Date;
}
