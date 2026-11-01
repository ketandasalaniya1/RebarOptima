import { Router } from 'express';
import { Db } from 'mongodb';
import { DeveloperService } from './developer.service';

export function createDeveloperConsoleRouter(
  getDb: () => any,
  developerAuthMiddleware: any
): Router {
  const router = Router();

  // Web Push Config
  router.get('/push/config', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const config = await service.getWebPushConfig(false);
      res.json({ success: true, data: config });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/push/config', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const saved = await service.saveWebPushConfig(req.body, req.user?.sub || 'developer');
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/push/generate-keys', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const keys = service.generateVapidKeys();
      res.json({ success: true, data: keys });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/push/test', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const result = await service.testPushNotification(req.body.targetUserId, {
        title: req.body.title || '🔔 Rebar Optima Developer Test',
        body: req.body.body || 'This is a live test notification from Developer Console.',
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Firebase Cloud Messaging (FCM) Config & Testing
  router.get('/push/fcm/config', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const config = await service.getFcmConfig(false);
      res.json({ success: true, data: config });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/push/fcm/config', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const saved = await service.saveFcmConfig(req.body, req.user?.sub || 'developer');
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/push/fcm/test', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const result = await service.testFcmNotification(req.body.deviceToken, {
        title: req.body.title || '🔔 Rebar Optima FCM Test',
        body: req.body.body || 'Firebase Cloud Messaging test dispatched from Developer Console.',
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.get('/push/fcm/tokens', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const tokens = await service.getRegisteredFcmTokens();
      res.json({ success: true, data: tokens });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/push/fcm/tokens', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const result = await service.registerFcmTokenForUser(
        req.body.userId,
        req.body.token,
        req.body.platform,
        req.body.deviceInfo
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.delete('/push/fcm/tokens/:id', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const result = await service.deleteFcmToken(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // SMTP Config
  router.get('/smtp/config', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const config = await service.getSmtpConfig(false);
      res.json({ success: true, data: config });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/smtp/config', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const saved = await service.saveSmtpConfig(req.body, req.user?.sub || 'developer');
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/smtp/test', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const result = await service.testSmtpConnection(req.body.testRecipient);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Notification Templates
  router.get('/templates', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const templates = await service.getNotificationTemplates();
      res.json({ success: true, data: templates });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/templates', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const ok = await service.saveNotificationTemplate(req.body);
      res.json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Logs
  router.get('/logs', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const type = (req.query.type as any) === 'push' ? 'push' : 'email';
      const limit = Number(req.query.limit) || 50;
      const page = Number(req.query.page) || 1;
      const logs = await service.getDeliveryLogs(type, limit, page);
      res.json({ success: true, data: logs });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // System Health
  router.get('/health', developerAuthMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new DeveloperService(db);
      const health = await service.getSystemHealth();
      res.json({ success: true, data: health });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
}
