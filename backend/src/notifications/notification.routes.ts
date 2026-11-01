import { Router } from 'express';
import { Db } from 'mongodb';
import { NotificationService } from './notification.service';

export function createNotificationRouter(
  getDb: () => any,
  authMiddleware: any
): Router {
  const router = Router();

  // Public endpoint for client app to fetch public VAPID key
  router.get('/vapid-key', async (req, res) => {
    try {
      const db: Db = getDb();
      const service = new NotificationService(db);
      const publicKey = await service.getPublicVapidKey();
      res.json({ success: true, publicKey });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Client subscribes device to push notifications
  router.post('/subscribe', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new NotificationService(db);
      const userId = String(req.user?.sub || req.user?.id || req.user?._id || '');
      const companyId = String(req.user?.companyId || req.headers['x-company-id'] || '');
      const { subscription, userAgent } = req.body;

      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ success: false, message: 'Invalid subscription object' });
      }

      const ok = await service.subscribeUser(userId, companyId, subscription, userAgent);
      res.json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Client unsubscribes device
  router.post('/unsubscribe', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new NotificationService(db);
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ success: false, message: 'Missing endpoint' });
      }
      const ok = await service.unsubscribeUser(endpoint);
      res.json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Client (Mobile App or Web) registers FCM token
  router.post('/fcm-token', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new NotificationService(db);
      const userId = String(req.user?.sub || req.user?.id || req.user?._id || '');
      const companyId = String(req.user?.companyId || req.headers['x-company-id'] || '');
      const { token, platform, deviceInfo } = req.body;

      if (!token) {
        return res.status(400).json({ success: false, message: 'Missing FCM token' });
      }

      const ok = await service.saveFcmToken(userId, companyId, token, platform, deviceInfo);
      res.json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Client unregisters FCM token
  router.delete('/fcm-token', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new NotificationService(db);
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, message: 'Missing FCM token' });
      }
      const ok = await service.removeFcmToken(token);
      res.json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
}
