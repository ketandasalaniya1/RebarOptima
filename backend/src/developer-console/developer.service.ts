import { Db, ObjectId } from 'mongodb';
import webpush from 'web-push';
import nodemailer from 'nodemailer';
import {
  IWebPushConfig,
  IFirebaseFcmConfig,
  ISmtpConfig,
  INotificationTemplate,
  IEmailDeliveryLog,
  IPushDeliveryLog,
  IUserPushSubscription,
} from './developer.types';
import { getFirebaseAdminApp, getFirebaseMessaging, resetFirebaseAdminApp } from '../notifications/firebase-admin.helper';

const SETTINGS_COLLECTION = 'system_settings';
const EMAIL_LOGS_COLLECTION = 'email_delivery_logs';
const PUSH_LOGS_COLLECTION = 'push_delivery_logs';
const PUSH_SUBS_COLLECTION = 'user_push_subscriptions';
const FCM_TOKENS_COLLECTION = 'user_fcm_tokens';
const TEMPLATES_COLLECTION = 'notification_templates';

export class DeveloperService {
  constructor(private db: Db) {}

  // ══════════════════════════════════════════════════════════════════════════════
  // WEB PUSH CONFIG & VAPID KEYS
  // ══════════════════════════════════════════════════════════════════════════════

  async getWebPushConfig(includeSecret = false): Promise<IWebPushConfig | null> {
    const doc = await this.db.collection(SETTINGS_COLLECTION).findOne({ key: 'web_push' });
    if (!doc || !doc.value) {
      return {
        enabled: false,
        publicKey: '',
        privateKey: '',
        subject: 'mailto:support@rebaroptima.com',
      };
    }
    const cfg = { ...doc.value } as IWebPushConfig;
    if (!includeSecret && cfg.privateKey) {
      cfg.privateKey = cfg.privateKey.substring(0, 4) + '****************' + cfg.privateKey.slice(-4);
    }
    return cfg;
  }

  async saveWebPushConfig(data: Partial<IWebPushConfig>, updatedBy: string): Promise<IWebPushConfig> {
    const existing = await this.db.collection(SETTINGS_COLLECTION).findOne({ key: 'web_push' });
    let privateKey = data.privateKey;
    if (existing?.value?.privateKey && (data.privateKey?.includes('****') || !data.privateKey)) {
      privateKey = existing.value.privateKey;
    }

    const value: IWebPushConfig = {
      enabled: Boolean(data.enabled),
      publicKey: data.publicKey?.trim() || '',
      privateKey: privateKey?.trim() || '',
      subject: data.subject?.trim() || 'mailto:support@rebaroptima.com',
      updatedAt: new Date(),
      updatedBy,
    };

    await this.db.collection(SETTINGS_COLLECTION).updateOne(
      { key: 'web_push' },
      { $set: { key: 'web_push', value, updatedAt: new Date() } },
      { upsert: true }
    );

    return value;
  }

  generateVapidKeys() {
    const keys = webpush.generateVAPIDKeys();
    return {
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // FIREBASE CLOUD MESSAGING (FCM) CONFIGURATION
  // ══════════════════════════════════════════════════════════════════════════════

  async getFcmConfig(includeSecret = false): Promise<IFirebaseFcmConfig | null> {
    const doc = await this.db.collection(SETTINGS_COLLECTION).findOne({ key: 'fcm' });
    if (!doc || !doc.value) {
      return {
        enabled: false,
        projectId: '',
        clientEmail: '',
        privateKey: '',
      };
    }
    const cfg = { ...doc.value } as IFirebaseFcmConfig;
    if (!includeSecret && cfg.privateKey) {
      cfg.privateKey = cfg.privateKey.substring(0, 30) + '****************' + cfg.privateKey.slice(-15);
    }
    return cfg;
  }

  async saveFcmConfig(data: Partial<IFirebaseFcmConfig>, updatedBy: string): Promise<IFirebaseFcmConfig> {
    const existing = await this.db.collection(SETTINGS_COLLECTION).findOne({ key: 'fcm' });

    let projectId = data.projectId?.trim() || '';
    let clientEmail = data.clientEmail?.trim() || '';
    let privateKey = data.privateKey?.trim() || '';

    // If user pasted a Service Account JSON string, parse it automatically
    if (data.serviceAccountJson && typeof data.serviceAccountJson === 'string') {
      try {
        const parsed = JSON.parse(data.serviceAccountJson.trim());
        if (parsed.project_id) projectId = parsed.project_id;
        if (parsed.client_email) clientEmail = parsed.client_email;
        if (parsed.private_key) privateKey = parsed.private_key;
      } catch (err: any) {
        // Not valid JSON, continue with normal fields
      }
    }

    if (existing?.value?.privateKey && (privateKey.includes('****') || !privateKey)) {
      privateKey = existing.value.privateKey;
    }
    if (!projectId && existing?.value?.projectId) {
      projectId = existing.value.projectId;
    }
    if (!clientEmail && existing?.value?.clientEmail) {
      clientEmail = existing.value.clientEmail;
    }

    const value: IFirebaseFcmConfig = {
      enabled: Boolean(data.enabled),
      projectId,
      clientEmail,
      privateKey,
      updatedAt: new Date(),
      updatedBy,
    };

    await this.db.collection(SETTINGS_COLLECTION).updateOne(
      { key: 'fcm' },
      { $set: { key: 'fcm', value, updatedAt: new Date() } },
      { upsert: true }
    );

    // Reset Firebase Admin App so new credentials take effect immediately
    resetFirebaseAdminApp();

    return value;
  }

  async testFcmNotification(
    targetDeviceToken?: string,
    testPayload?: { title: string; body: string }
  ): Promise<{ success: boolean; message: string; messageId?: string }> {
    const cfg = await this.getFcmConfig(true);
    if (!cfg || !cfg.enabled || !cfg.projectId || !cfg.clientEmail || !cfg.privateKey) {
      return {
        success: false,
        message: 'FCM is not enabled or credentials (Project ID, Client Email, Private Key) are incomplete.',
      };
    }

    const messaging = getFirebaseMessaging(cfg);
    if (!messaging) {
      return {
        success: false,
        message: 'Failed to initialize Firebase Admin SDK. Please check your service account credentials.',
      };
    }

    const title = testPayload?.title || '🔔 Rebar Optima FCM Test';
    const body = testPayload?.body || 'Firebase Cloud Messaging test dispatched from Developer Console.';

    if (targetDeviceToken && targetDeviceToken.trim()) {
      try {
        const messageId = await messaging.send({
          token: targetDeviceToken.trim(),
          notification: {
            title,
            body,
          },
          data: {
            url: '/chat',
            source: 'developer_console_test',
            timestamp: String(Date.now()),
          },
        });

        await this.db.collection(PUSH_LOGS_COLLECTION).insertOne({
          recipientUserId: 'test-device',
          title,
          body,
          endpoint: `fcm:${targetDeviceToken.slice(-10)}`,
          status: 'SUCCESS',
          sentAt: new Date(),
        });

        return {
          success: true,
          message: `FCM push sent successfully! Message ID: ${messageId}`,
          messageId,
        };
      } catch (err: any) {
        await this.db.collection(PUSH_LOGS_COLLECTION).insertOne({
          recipientUserId: 'test-device',
          title,
          body,
          endpoint: `fcm:${targetDeviceToken.slice(-10)}`,
          status: 'FAILED',
          errorMessage: err.message,
          sentAt: new Date(),
        });

        return {
          success: false,
          message: `FCM push failed: ${err.message}`,
        };
      }
    }

    // If no target device token was provided, verify credentials with Google OAuth
    try {
      const app = getFirebaseAdminApp(cfg);
      const token = await (app?.options?.credential as any)?.getAccessToken();
      if (token && token.access_token) {
        return {
          success: true,
          message: `Firebase Admin SDK initialized and authenticated successfully with Google FCM (Project: ${cfg.projectId})! To send a test push notification to a real device, enter an FCM device token below.`,
        };
      }
      return {
        success: true,
        message: `Firebase Admin SDK initialized successfully with project "${cfg.projectId}".`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Firebase authentication check failed: ${err.message}`,
      };
    }
  }

  async getRegisteredFcmTokens() {
    const tokens = await this.db.collection(FCM_TOKENS_COLLECTION).find().sort({ updatedAt: -1 }).limit(50).toArray();
    const userIds = tokens.map((t) => t.userId).filter(Boolean);
    const objectIds = userIds.map((id) => {
      try {
        return ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : null;
      } catch {
        return null;
      }
    }).filter(Boolean);

    const userQuery: any = {
      $or: [
        { _id: { $in: userIds.map(String) } },
        { _id: { $in: objectIds } },
      ],
    };
    const users = await this.db.collection('users').find(userQuery).project({ email: 1, name: 1, firstName: 1, lastName: 1 }).toArray();

    const userMap = new Map();
    users.forEach((u) => {
      userMap.set(u._id.toString(), u);
    });

    return tokens.map((t) => {
      const u = userMap.get(String(t.userId));
      return {
        _id: t._id.toString(),
        userId: t.userId,
        userName: u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || u.email : 'User',
        userEmail: u?.email || '',
        platform: t.platform || 'web',
        deviceInfo: t.deviceInfo || '',
        token: t.token,
        tokenSnippet: t.token ? `${t.token.slice(0, 16)}...${t.token.slice(-8)}` : '',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });
  }

  async registerFcmTokenForUser(userId: string, token: string, platform = 'web', deviceInfo = '') {
    if (!token || !userId) throw new Error('userId and token are required');
    await this.db.collection(FCM_TOKENS_COLLECTION).updateOne(
      { token: token.trim() },
      {
        $set: {
          userId: String(userId).trim(),
          token: token.trim(),
          platform,
          deviceInfo: deviceInfo || 'Manual Console Registration',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    return { success: true };
  }

  async deleteFcmToken(tokenId: string) {
    let query: any = { _id: tokenId };
    try {
      if (ObjectId.isValid(tokenId) && tokenId.length === 24) {
        query = { $or: [{ _id: new ObjectId(tokenId) }, { _id: tokenId }] };
      }
    } catch {}
    await this.db.collection(FCM_TOKENS_COLLECTION).deleteOne(query);
    return { success: true };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SMTP CONFIGURATION
  // ══════════════════════════════════════════════════════════════════════════════

  async getSmtpConfig(includeSecret = false): Promise<ISmtpConfig | null> {
    const doc = await this.db.collection(SETTINGS_COLLECTION).findOne({ key: 'smtp' });
    if (!doc || !doc.value) {
      return {
        enabled: false,
        host: '',
        port: 587,
        secure: false,
        username: '',
        password: '',
        fromName: 'Rebar Optima Notifications',
        fromEmail: 'noreply@rebaroptima.com',
      };
    }
    const cfg = { ...doc.value } as ISmtpConfig;
    if (!includeSecret && cfg.password) {
      cfg.password = '••••••••';
    }
    return cfg;
  }

  async saveSmtpConfig(data: Partial<ISmtpConfig>, updatedBy: string): Promise<ISmtpConfig> {
    const existing = await this.db.collection(SETTINGS_COLLECTION).findOne({ key: 'smtp' });
    let password = data.password;
    if (existing?.value?.password && (data.password === '••••••••' || !data.password)) {
      password = existing.value.password;
    }

    const value: ISmtpConfig = {
      enabled: Boolean(data.enabled),
      host: data.host?.trim() || '',
      port: Number(data.port) || 587,
      secure: Boolean(data.secure),
      username: data.username?.trim() || '',
      password: password || '',
      fromName: data.fromName?.trim() || 'Rebar Optima Notifications',
      fromEmail: data.fromEmail?.trim() || 'noreply@rebaroptima.com',
      replyTo: data.replyTo?.trim() || undefined,
      updatedAt: new Date(),
      updatedBy,
    };

    await this.db.collection(SETTINGS_COLLECTION).updateOne(
      { key: 'smtp' },
      { $set: { key: 'smtp', value, updatedAt: new Date() } },
      { upsert: true }
    );

    return value;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // CONNECTION TESTERS
  // ══════════════════════════════════════════════════════════════════════════════

  async testSmtpConnection(testRecipient?: string): Promise<{ success: boolean; message: string; details?: any }> {
    const doc = await this.db.collection(SETTINGS_COLLECTION).findOne({ key: 'smtp' });
    if (!doc || !doc.value || !doc.value.host) {
      return { success: false, message: 'SMTP is not configured yet.' };
    }
    const cfg = doc.value as ISmtpConfig;

    try {
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.username ? { user: cfg.username, pass: cfg.password } : undefined,
        connectionTimeout: cfg.connectionTimeoutMs || 8000,
      });

      await transporter.verify();

      if (testRecipient && testRecipient.includes('@')) {
        const info = await transporter.sendMail({
          from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
          to: testRecipient,
          subject: '⚡ Rebar Optima — SMTP Test Email',
          text: `This is a verification test email from the Rebar Optima Developer Console.\n\nTimestamp: ${new Date().toISOString()}\nHost: ${cfg.host}:${cfg.port}\nStatus: Verified and Functional.`,
          html: `<div style="font-family:sans-serif;padding:24px;background:#0d1117;color:#c9d1d9;border-radius:8px;border:1px solid #30363d;">
            <h2 style="color:#58a6ff;margin-top:0;">⚡ Rebar Optima SMTP Verification</h2>
            <p>Your SMTP email configuration has connected successfully and passed validation.</p>
            <div style="background:#161b22;padding:12px;border-radius:6px;font-family:monospace;font-size:13px;color:#7ee787;">
              Host: ${cfg.host}:${cfg.port}<br/>
              Security: ${cfg.secure ? 'SSL/TLS (Port 465)' : 'STARTTLS'}<br/>
              From: ${cfg.fromName} &lt;${cfg.fromEmail}&gt;<br/>
              Timestamp: ${new Date().toISOString()}
            </div>
            <p style="margin-top:20px;font-size:12px;color:#8b949e;">Sent from Developer Console • Rebar Optima SaaS</p>
          </div>`,
        });

        await this.db.collection(EMAIL_LOGS_COLLECTION).insertOne({
          recipientEmail: testRecipient,
          subject: '⚡ Rebar Optima — SMTP Test Email',
          status: 'SUCCESS',
          sentAt: new Date(),
          metadata: { messageId: info.messageId, response: info.response },
        });

        return {
          success: true,
          message: `SMTP handshake verified and test email sent to ${testRecipient}!`,
          details: { messageId: info.messageId },
        };
      }

      return { success: true, message: 'SMTP connection verified successfully (handshake passed).' };
    } catch (err: any) {
      if (testRecipient) {
        await this.db.collection(EMAIL_LOGS_COLLECTION).insertOne({
          recipientEmail: testRecipient,
          subject: '⚡ Rebar Optima — SMTP Test Email',
          status: 'FAILED',
          errorMessage: err.message,
          sentAt: new Date(),
        });
      }
      return { success: false, message: `SMTP test failed: ${err.message}` };
    }
  }

  async testPushNotification(
    targetUserId?: string,
    testPayload?: { title: string; body: string }
  ): Promise<{ success: boolean; sentCount: number; errors: any[] }> {
    const doc = await this.db.collection(SETTINGS_COLLECTION).findOne({ key: 'web_push' });
    if (!doc || !doc.value || !doc.value.publicKey || !doc.value.privateKey) {
      return { success: false, sentCount: 0, errors: ['Web Push VAPID keys not configured.'] };
    }

    const cfg = doc.value as IWebPushConfig;
    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);

    const query: any = {};
    if (targetUserId) {
      query.userId = targetUserId;
    }

    const subs = await this.db.collection(PUSH_SUBS_COLLECTION).find(query).limit(10).toArray();
    if (subs.length === 0) {
      return {
        success: false,
        sentCount: 0,
        errors: ['No registered browser push subscriptions found. Please enable push notifications on a client browser first.'],
      };
    }

    let sentCount = 0;
    const errors: any[] = [];
    const payload = JSON.stringify({
      title: testPayload?.title || '🔔 Rebar Optima Test Notification',
      body: testPayload?.body || 'Push notification dispatched from Developer Console.',
      icon: '/vite.svg',
      badge: '/vite.svg',
      data: { url: '/chat', timestamp: Date.now() },
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payload
        );
        sentCount++;
        await this.db.collection(PUSH_LOGS_COLLECTION).insertOne({
          recipientUserId: sub.userId,
          title: testPayload?.title || 'Test Notification',
          body: testPayload?.body || '',
          endpoint: sub.endpoint,
          status: 'SUCCESS',
          sentAt: new Date(),
        });
      } catch (err: any) {
        errors.push({ endpoint: sub.endpoint, error: err.message });
        await this.db.collection(PUSH_LOGS_COLLECTION).insertOne({
          recipientUserId: sub.userId,
          title: testPayload?.title || 'Test Notification',
          body: testPayload?.body || '',
          endpoint: sub.endpoint,
          status: 'FAILED',
          errorMessage: err.message,
          sentAt: new Date(),
        });
        // If expired or gone (410), delete stale subscription
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.db.collection(PUSH_SUBS_COLLECTION).deleteOne({ _id: sub._id });
        }
      }
    }

    return {
      success: sentCount > 0,
      sentCount,
      errors,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // USER PUSH SUBSCRIPTIONS (Client registration)
  // ══════════════════════════════════════════════════════════════════════════════

  async registerUserSubscription(
    userId: string,
    companyId: string,
    subscription: any,
    userAgent?: string
  ): Promise<boolean> {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return false;
    }

    await this.db.collection(PUSH_SUBS_COLLECTION).updateOne(
      { endpoint: subscription.endpoint },
      {
        $set: {
          userId,
          companyId,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          userAgent: userAgent || '',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return true;
  }

  async unregisterUserSubscription(endpoint: string): Promise<boolean> {
    const res = await this.db.collection(PUSH_SUBS_COLLECTION).deleteOne({ endpoint });
    return res.deletedCount > 0;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TEMPLATES & LOGS
  // ══════════════════════════════════════════════════════════════════════════════

  async getNotificationTemplates(): Promise<INotificationTemplate[]> {
    const templates = await this.db.collection(TEMPLATES_COLLECTION).find().toArray();
    if (templates.length === 0) {
      // Seed default system templates
      const defaults: INotificationTemplate[] = [
        {
          key: 'CHAT_NEW_MESSAGE',
          name: 'Chat New Message Notification',
          subject: 'New message from {{senderName}} on Rebar Optima',
          htmlContent: '<p>Hi {{recipientName}},</p><p><strong>{{senderName}}</strong> sent a message in <strong>{{conversationTitle}}</strong>:</p><blockquote>{{messageText}}</blockquote><p><a href="{{actionUrl}}">Open Chat</a></p>',
          plainTextContent: 'Hi {{recipientName}},\n\n{{senderName}} sent a message in {{conversationTitle}}:\n"{{messageText}}"\n\nOpen chat: {{actionUrl}}',
          variables: ['recipientName', 'senderName', 'conversationTitle', 'messageText', 'actionUrl'],
          enabled: true,
          updatedAt: new Date(),
        },
        {
          key: 'USER_INVITATION',
          name: 'New User Platform Invitation',
          subject: 'Invitation to join Rebar Optima — {{companyName}}',
          htmlContent: '<p>Hello,</p><p>You have been invited to join <strong>{{companyName}}</strong> on Rebar Optima as a <strong>{{role}}</strong>.</p><p><a href="{{inviteUrl}}">Set Up Your Account</a></p>',
          plainTextContent: 'Hello,\n\nYou have been invited to join {{companyName}} on Rebar Optima as a {{role}}.\n\nSet up your account: {{inviteUrl}}',
          variables: ['companyName', 'role', 'inviteUrl'],
          enabled: true,
          updatedAt: new Date(),
        },
        {
          key: 'DAILY_PROJECT_REPORT',
          name: 'Daily Operational Progress Report',
          subject: 'Daily Site Progress Report — {{projectName}} ({{reportDate}})',
          htmlContent: '<p>Attached is the Daily Site Progress Report for <strong>{{projectName}}</strong> on {{reportDate}}.</p><p><a href="{{reportUrl}}">Download Report</a></p>',
          plainTextContent: 'Attached is the Daily Site Progress Report for {{projectName}} on {{reportDate}}.\n\nDownload: {{reportUrl}}',
          variables: ['projectName', 'reportDate', 'reportUrl'],
          enabled: true,
          updatedAt: new Date(),
        },
      ];
      await this.db.collection(TEMPLATES_COLLECTION).insertMany(defaults as any);
      return defaults;
    }
    return templates.map((t) => ({
      _id: t._id.toString(),
      key: t.key,
      name: t.name,
      subject: t.subject,
      htmlContent: t.htmlContent,
      plainTextContent: t.plainTextContent,
      variables: t.variables || [],
      enabled: t.enabled !== false,
      updatedAt: t.updatedAt,
    }));
  }

  async saveNotificationTemplate(data: Partial<INotificationTemplate>): Promise<boolean> {
    if (!data.key) return false;
    await this.db.collection(TEMPLATES_COLLECTION).updateOne(
      { key: data.key },
      {
        $set: {
          key: data.key,
          name: data.name || data.key,
          subject: data.subject || '',
          htmlContent: data.htmlContent || '',
          plainTextContent: data.plainTextContent || '',
          variables: data.variables || [],
          enabled: data.enabled !== false,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    return true;
  }

  async getDeliveryLogs(type: 'email' | 'push' = 'email', limit = 50, page = 1) {
    const collName = type === 'email' ? EMAIL_LOGS_COLLECTION : PUSH_LOGS_COLLECTION;
    const skip = (Math.max(1, page) - 1) * limit;
    const [total, items] = await Promise.all([
      this.db.collection(collName).countDocuments(),
      this.db.collection(collName).find().sort({ sentAt: -1 }).skip(skip).limit(limit).toArray(),
    ]);

    return {
      type,
      total,
      page,
      limit,
      items: items.map((i) => ({ ...i, _id: i._id.toString() })),
    };
  }

  async getSystemHealth() {
    const [emailCount, pushCount, subsCount, fcmTokensCount, dbPing] = await Promise.all([
      this.db.collection(EMAIL_LOGS_COLLECTION).countDocuments().catch(() => 0),
      this.db.collection(PUSH_LOGS_COLLECTION).countDocuments().catch(() => 0),
      this.db.collection(PUSH_SUBS_COLLECTION).countDocuments().catch(() => 0),
      this.db.collection(FCM_TOKENS_COLLECTION).countDocuments().catch(() => 0),
      this.db.command({ ping: 1 }).catch(() => null),
    ]);

    const pushConfig = await this.getWebPushConfig(false);
    const fcmConfig = await this.getFcmConfig(false);
    const smtpConfig = await this.getSmtpConfig(false);

    return {
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      database: {
        connected: Boolean(dbPing?.ok === 1),
      },
      services: {
        webPush: {
          configured: Boolean(pushConfig?.publicKey && pushConfig.enabled),
          subscribersCount: subsCount,
          totalPushesSent: pushCount,
        },
        fcm: {
          configured: Boolean(fcmConfig?.projectId && fcmConfig.enabled),
          registeredTokensCount: fcmTokensCount,
        },
        smtp: {
          configured: Boolean(smtpConfig?.host && smtpConfig.enabled),
          totalEmailsSent: emailCount,
        },
      },
    };
  }
}
