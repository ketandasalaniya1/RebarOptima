import { ObjectId } from 'mongodb';

export interface ContactPhoneNumber {
  number: string;
  normalizedNumber: string;
  label: string; // 'Mobile' | 'Work' | 'WhatsApp' | 'Site' | 'Office' | 'Home' | 'Other'
  isPrimary: boolean;
  hasWhatsApp: boolean;
}

export interface ContactAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

export interface ContactAttachment {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
  uploadedAt: Date;
}

export interface ContactDoc {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  name: string;
  nameLower: string;
  avatar?: string | null;
  designation?: string;
  categoryId?: ObjectId | string;
  categoryName?: string;
  companyName?: string;
  description?: string;
  email?: string;
  website?: string;
  phones: ContactPhoneNumber[];
  primaryPhone: string;
  normalizedPhones: string[];
  address?: ContactAddress;
  projectIds: (ObjectId | string)[];
  visibility: 'shared' | 'private';
  isFavourite: boolean;
  isArchived: boolean;
  archivedAt?: Date | null;
  archivedBy?: ObjectId | string | null;
  notes?: string;
  tags?: string[];
  attachments?: ContactAttachment[];
  createdBy: ObjectId | string | null;
  createdByName?: string;
  updatedBy?: ObjectId | string | null;
  updatedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactCategoryDoc {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  name: string;
  nameLower: string;
  isDefault?: boolean;
  color?: string;
  sortOrder?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactActivityLogDoc {
  _id?: ObjectId | string;
  contactId: ObjectId | string;
  companyId: ObjectId | string;
  action: 'created' | 'updated' | 'archived' | 'restored' | 'favourited' | 'unfavourited' | 'project_associated' | 'project_removed' | 'deleted';
  details?: Record<string, any>;
  performedBy: ObjectId | string | null;
  performedByName?: string;
  createdAt: Date;
}
