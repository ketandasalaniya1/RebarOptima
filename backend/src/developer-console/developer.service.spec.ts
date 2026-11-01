import { DeveloperService } from './developer.service';

describe('DeveloperService Unit Tests', () => {
  let mockDb: any;
  let service: DeveloperService;
  let settingsStore: Record<string, any> = {};
  let templatesStore: any[] = [];

  beforeEach(() => {
    settingsStore = {};
    templatesStore = [];

    mockDb = {
      collection: jest.fn((name: string) => {
        if (name === 'system_settings') {
          return {
            findOne: jest.fn(async (q: any) => {
              const val = settingsStore[q.key];
              return val ? { key: q.key, value: val } : null;
            }),
            updateOne: jest.fn(async (q: any, update: any) => {
              settingsStore[q.key] = update.$set.value;
              return { upsertedCount: 1 };
            }),
          };
        }
        if (name === 'notification_templates') {
          return {
            find: jest.fn(() => ({
              toArray: jest.fn(async () => [...templatesStore]),
            })),
            insertMany: jest.fn(async (docs: any[]) => {
              templatesStore.push(...docs.map((d, i) => ({ ...d, _id: `tpl-${i + 1}` })));
              return { insertedCount: docs.length };
            }),
            updateOne: jest.fn(async (q: any, update: any) => {
              const target = templatesStore.find(t => t.key === q.key);
              if (target) {
                Object.assign(target, update.$set);
              } else {
                templatesStore.push({ ...update.$set, _id: `tpl-${templatesStore.length + 1}` });
              }
              return { modifiedCount: 1 };
            }),
          };
        }
        if (
          name === 'email_delivery_logs' ||
          name === 'push_delivery_logs' ||
          name === 'user_push_subscriptions' ||
          name === 'user_fcm_tokens'
        ) {
          return {
            countDocuments: jest.fn(async () => 5),
            find: jest.fn(() => ({
              sort: jest.fn(() => ({
                skip: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    toArray: jest.fn(async () => []),
                  })),
                })),
              })),
            })),
            insertOne: jest.fn(async () => ({ insertedId: 'log-1' })),
            updateOne: jest.fn(async () => ({ upsertedCount: 1 })),
            deleteOne: jest.fn(async () => ({ deletedCount: 1 })),
          };
        }
        if (name === 'users') {
          return {
            find: jest.fn(() => ({
              project: jest.fn(() => ({
                toArray: jest.fn(async () => []),
              })),
            })),
          };
        }
        return {};
      }),
      command: jest.fn(async () => ({ ok: 1 })),
    };

    service = new DeveloperService(mockDb);
  });

  test('generateVapidKeys should return valid public and private keys', () => {
    const keys = service.generateVapidKeys();
    expect(keys.publicKey).toBeDefined();
    expect(keys.privateKey).toBeDefined();
    expect(keys.publicKey.length).toBeGreaterThan(20);
    expect(keys.privateKey.length).toBeGreaterThan(20);
  });

  test('saveWebPushConfig and getWebPushConfig with masking', async () => {
    const vapid = service.generateVapidKeys();
    await service.saveWebPushConfig({
      enabled: true,
      publicKey: vapid.publicKey,
      privateKey: vapid.privateKey,
      subject: 'mailto:developer@rebaroptima.com',
    }, 'dev-user-1');

    // Retrieve masked for UI
    const masked = await service.getWebPushConfig(false);
    expect(masked).toBeDefined();
    expect(masked?.enabled).toBe(true);
    expect(masked?.publicKey).toBe(vapid.publicKey);
    expect(masked?.privateKey).toContain('****');

    // Retrieve unmasked for internal services
    const unmasked = await service.getWebPushConfig(true);
    expect(unmasked?.privateKey).toBe(vapid.privateKey);
  });

  test('saveFcmConfig and getFcmConfig with masking and JSON parsing', async () => {
    const sampleServiceAccount = JSON.stringify({
      type: 'service_account',
      project_id: 'rebar-optima-test',
      client_email: 'firebase-admin@rebar-optima-test.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n',
    });

    await service.saveFcmConfig({
      enabled: true,
      serviceAccountJson: sampleServiceAccount,
    }, 'dev-user-1');

    // Retrieve masked for frontend display
    const masked = await service.getFcmConfig(false);
    expect(masked?.enabled).toBe(true);
    expect(masked?.projectId).toBe('rebar-optima-test');
    expect(masked?.clientEmail).toBe('firebase-admin@rebar-optima-test.iam.gserviceaccount.com');
    expect(masked?.privateKey).toContain('****');

    // Retrieve unmasked for internal backend dispatch
    const unmasked = await service.getFcmConfig(true);
    expect(unmasked?.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
  });

  test('saveSmtpConfig and getSmtpConfig with password masking', async () => {
    await service.saveSmtpConfig({
      enabled: true,
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      username: 'apikey',
      password: 'SG.super-secret-password-key-12345',
      fromName: 'Rebar Optima Dispatch',
      fromEmail: 'noreply@rebaroptima.com',
    }, 'dev-user-1');

    const masked = await service.getSmtpConfig(false);
    expect(masked?.password).toBe('••••••••');
    expect(masked?.host).toBe('smtp.sendgrid.net');

    const unmasked = await service.getSmtpConfig(true);
    expect(unmasked?.password).toBe('SG.super-secret-password-key-12345');
  });

  test('getNotificationTemplates should seed default templates if empty', async () => {
    const tpls = await service.getNotificationTemplates();
    expect(tpls.length).toBeGreaterThanOrEqual(3);
    const keys = tpls.map(t => t.key);
    expect(keys).toContain('CHAT_NEW_MESSAGE');
    expect(keys).toContain('USER_INVITATION');
  });

  test('getSystemHealth should return health metrics and service status', async () => {
    const health = await service.getSystemHealth();
    expect(health.status).toBe('HEALTHY');
    expect(health.database.connected).toBe(true);
    expect(health.services.webPush).toBeDefined();
    expect(health.services.fcm).toBeDefined();
    expect(health.services.smtp).toBeDefined();
  });
});
