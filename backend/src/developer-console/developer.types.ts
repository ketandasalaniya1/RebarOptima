export interface IWebPushConfig {
  enabled: boolean;
  publicKey: string;
  privateKey: string;
  subject: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface IFirebaseFcmConfig {
  enabled: boolean;
  projectId: string;
  clientEmail: string;
  privateKey: string;
  serviceAccountJson?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface IUserFcmToken {
  _id?: any;
  userId: string;
  companyId?: string;
  token: string;
  platform?: 'android' | 'ios' | 'web';
  deviceInfo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean; // true for 465, false for 587/STARTTLS
  username: string;
  password?: string; // encrypted or masked
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  connectionTimeoutMs?: number;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface INotificationTemplate {
  _id?: string;
  key: string; // e.g. 'USER_INVITATION', 'CHAT_MENTION', 'PROGRESS_REPORT'
  name: string;
  subject: string;
  htmlContent: string;
  plainTextContent: string;
  variables: string[];
  enabled: boolean;
  updatedAt?: Date;
}

export interface IEmailDeliveryLog {
  _id?: any;
  recipientEmail: string;
  subject: string;
  templateKey?: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  sentAt: Date;
  metadata?: Record<string, any>;
}

export interface IPushDeliveryLog {
  _id?: any;
  recipientUserId: string;
  title: string;
  body: string;
  endpoint: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  sentAt: Date;
}

export interface IUserPushSubscription {
  _id?: any;
  userId: string;
  companyId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}
