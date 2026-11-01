import { Db, ObjectId } from 'mongodb';
import webpush from 'web-push';
import nodemailer from 'nodemailer';
import { MulticastMessage } from 'firebase-admin/messaging';
import { IWebPushConfig, IFirebaseFcmConfig, ISmtpConfig, IUserPushSubscription } from '../developer-console/developer.types';
import { getFirebaseMessaging } from './firebase-admin.helper';

function toObjectId(id: any): ObjectId | null {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  const str = String(id).trim();
  if (ObjectId.isValid(str) && str.length === 24) {
    try {
      return new ObjectId(str);
    } catch {
      return null;
    }
  }
  return null;
}

const SETTINGS_COLL = 'system_settings';
const PUSH_SUBS_COLL = 'user_push_subscriptions';
const FCM_TOKENS_COLL = 'user_fcm_tokens';
const EMAIL_LOGS_COLL = 'email_delivery_logs';
const PUSH_LOGS_COLL = 'push_delivery_logs';

export class NotificationService {
  constructor(private db: Db) {}

  /**
   * Returns public VAPID key for frontend browser subscription registration
   */
  async getPublicVapidKey(): Promise<string | null> {
    const doc = await this.db.collection(SETTINGS_COLL).findOne({ key: 'web_push' });
    if (doc?.value?.publicKey && doc.value.enabled) {
      return doc.value.publicKey;
    }
    // Fallback to .env configuration if set
    if (process.env.VAPID_PUBLIC_KEY) {
      return process.env.VAPID_PUBLIC_KEY;
    }
    return null;
  }

  /**
   * Save user's browser push subscription
   */
  async subscribeUser(
    userId: string,
    companyId: string,
    subscription: any,
    userAgent?: string
  ): Promise<boolean> {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return false;
    }

    await this.db.collection(PUSH_SUBS_COLL).updateOne(
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

    // If browser is Chrome/Edge/Chromium, the endpoint is hosted on Google FCM:
    // https://fcm.googleapis.com/fcm/send/<FCM_REGISTRATION_TOKEN>
    // Automatically save as an active FCM token for this user as well!
    if (subscription.endpoint && subscription.endpoint.includes('/fcm/send/')) {
      const fcmToken = subscription.endpoint.split('/fcm/send/')[1];
      if (fcmToken) {
        await this.saveFcmToken(userId, companyId, fcmToken, 'web', userAgent || 'Web Browser (FCM)');
      }
    }

    return true;
  }

  /**
   * Unsubscribe user device
   */
  async unsubscribeUser(endpoint: string): Promise<boolean> {
    const res = await this.db.collection(PUSH_SUBS_COLL).deleteOne({ endpoint });
    return res.deletedCount > 0;
  }

  /**
   * Save user's FCM device token (from mobile or web)
   */
  async saveFcmToken(
    userId: string,
    companyId: string,
    token: string,
    platform: 'android' | 'ios' | 'web' = 'web',
    deviceInfo?: string
  ): Promise<boolean> {
    if (!token || !userId) return false;

    await this.db.collection(FCM_TOKENS_COLL).updateOne(
      { token: token.trim() },
      {
        $set: {
          userId,
          companyId: companyId || '',
          token: token.trim(),
          platform,
          deviceInfo: deviceInfo || '',
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

  /**
   * Remove user's FCM device token
   */
  async removeFcmToken(token: string): Promise<boolean> {
    if (!token) return false;
    const res = await this.db.collection(FCM_TOKENS_COLL).deleteOne({ token: token.trim() });
    return res.deletedCount > 0;
  }

  /**
   * Send Push notification to user(s) via both Web Push (VAPID) and Firebase Cloud Messaging (FCM)
   */
  async sendPushNotification(
    targetUserIds: string | string[],
    payload: { title: string; body: string; icon?: string; badge?: string; data?: any }
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    const userIds = Array.isArray(targetUserIds) ? targetUserIds : [targetUserIds];
    const stringIds = userIds.map(String);
    const objectIds = userIds.map(toObjectId).filter((id): id is ObjectId => id !== null);
    const userQuery: any = {
      $or: [
        { userId: { $in: stringIds } },
        { userId: { $in: objectIds } },
      ],
    };

    // ─────────────────────────────────────────────────────────────
    // 1. Web Push (VAPID) Dispatch
    // ─────────────────────────────────────────────────────────────
    try {
      const doc = await this.db.collection(SETTINGS_COLL).findOne({ key: 'web_push' });
      let cfg: IWebPushConfig | null = null;

      if (doc?.value?.publicKey && doc.value.privateKey && doc.value.enabled) {
        cfg = doc.value as IWebPushConfig;
      } else if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        cfg = {
          enabled: true,
          publicKey: process.env.VAPID_PUBLIC_KEY,
          privateKey: process.env.VAPID_PRIVATE_KEY,
          subject: process.env.VAPID_SUBJECT || 'mailto:support@rebaroptima.com',
        };
      }

      if (cfg && cfg.publicKey && cfg.privateKey) {
        webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);

        const subs = await this.db.collection(PUSH_SUBS_COLL).find(userQuery).toArray();

        if (subs.length > 0) {
          const notificationPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/vite.svg',
            badge: payload.badge || '/vite.svg',
            data: payload.data || {},
          });

          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: sub.keys,
                },
                notificationPayload
              );
              sent++;
              await this.db.collection(PUSH_LOGS_COLL).insertOne({
                recipientUserId: sub.userId,
                title: payload.title,
                body: payload.body,
                endpoint: sub.endpoint,
                status: 'SUCCESS',
                sentAt: new Date(),
              });
            } catch (err: any) {
              failed++;
              await this.db.collection(PUSH_LOGS_COLL).insertOne({
                recipientUserId: sub.userId,
                title: payload.title,
                body: payload.body,
                endpoint: sub.endpoint,
                status: 'FAILED',
                errorMessage: err.message,
                sentAt: new Date(),
              });

              if (err.statusCode === 410 || err.statusCode === 404) {
                // Stale subscription removed
                await this.db.collection(PUSH_SUBS_COLL).deleteOne({ _id: sub._id });
              }
            }
          }
        }
      }
    } catch (webPushErr: any) {
      console.error('Error dispatching Web Push (VAPID):', webPushErr.message);
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Firebase Cloud Messaging (FCM) Dispatch
    // ─────────────────────────────────────────────────────────────
    try {
      const fcmDoc = await this.db.collection(SETTINGS_COLL).findOne({ key: 'fcm' });
      if (fcmDoc?.value?.enabled && fcmDoc.value.projectId && fcmDoc.value.clientEmail && fcmDoc.value.privateKey) {
        const messaging = getFirebaseMessaging(fcmDoc.value as IFirebaseFcmConfig);
        if (messaging) {
          const fcmTokens = await this.db.collection(FCM_TOKENS_COLL).find(userQuery).toArray();

          if (fcmTokens.length > 0) {
            const tokens = fcmTokens.map((t) => t.token).filter(Boolean);
            if (tokens.length > 0) {
              const formattedData: Record<string, string> = {
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
                timestamp: String(Date.now()),
              };
              if (payload.data && typeof payload.data === 'object') {
                for (const [k, v] of Object.entries(payload.data)) {
                  formattedData[k] = String(v ?? '');
                }
              }

              const fcmMessage: MulticastMessage = {
                tokens,
                notification: {
                  title: payload.title,
                  body: payload.body,
                },
                data: formattedData,
              };

              const response = await messaging.sendEachForMulticast(fcmMessage);
              sent += response.successCount;
              failed += response.failureCount;

              // Handle responses and clean up stale or invalid tokens
              for (let i = 0; i < response.responses.length; i++) {
                const resp = response.responses[i];
                const targetToken = tokens[i];
                const recipientId = fcmTokens[i]?.userId || 'user';

                if (resp.success) {
                  await this.db.collection(PUSH_LOGS_COLL).insertOne({
                    recipientUserId: recipientId,
                    title: payload.title,
                    body: payload.body,
                    endpoint: `fcm:${targetToken.slice(-10)}`,
                    status: 'SUCCESS',
                    sentAt: new Date(),
                  });
                } else {
                  await this.db.collection(PUSH_LOGS_COLL).insertOne({
                    recipientUserId: recipientId,
                    title: payload.title,
                    body: payload.body,
                    endpoint: `fcm:${targetToken.slice(-10)}`,
                    status: 'FAILED',
                    errorMessage: resp.error?.message || 'FCM error',
                    sentAt: new Date(),
                  });

                  const errorCode = resp.error?.code;
                  if (
                    errorCode === 'messaging/registration-token-not-registered' ||
                    errorCode === 'messaging/invalid-registration-token'
                  ) {
                    await this.db.collection(FCM_TOKENS_COLL).deleteOne({ token: targetToken });
                  }
                }
              }
            }
          }
        }
      }
    } catch (fcmErr: any) {
      console.error('Error dispatching Firebase Cloud Messaging (FCM):', fcmErr.message);
    }

    return { sent, failed };
  }

  /**
   * Send Email via configured SMTP
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    templateKey?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const doc = await this.db.collection(SETTINGS_COLL).findOne({ key: 'smtp' });
    if (!doc || !doc.value || !doc.value.host || !doc.value.enabled) {
      return { success: false, error: 'SMTP is not enabled or configured' };
    }

    const cfg = doc.value as ISmtpConfig;
    try {
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.username ? { user: cfg.username, pass: cfg.password } : undefined,
      });

      const info = await transporter.sendMail({
        from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
        to: options.to,
        replyTo: cfg.replyTo || undefined,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      await this.db.collection(EMAIL_LOGS_COLL).insertOne({
        recipientEmail: options.to,
        subject: options.subject,
        templateKey: options.templateKey,
        status: 'SUCCESS',
        sentAt: new Date(),
        metadata: { messageId: info.messageId },
      });

      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      await this.db.collection(EMAIL_LOGS_COLL).insertOne({
        recipientEmail: options.to,
        subject: options.subject,
        templateKey: options.templateKey,
        status: 'FAILED',
        errorMessage: err.message,
        sentAt: new Date(),
      });
      return { success: false, error: err.message };
    }
  }
}
