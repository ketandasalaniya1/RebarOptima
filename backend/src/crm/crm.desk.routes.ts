import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { buildCalendar, buildToday } from './crm.desk.service';

function sendError(res: any, err: any) {
  const status = err.status || 500;
  if (status >= 500) console.error('CRM desk error:', err);
  res.status(status).json({ message: err.message || 'CRM request failed', code: err.code });
}

export function createCrmDeskRouter(getDb: () => any, authMiddleware: any, requirePermission?: any) {
  const router = Router();

  const permit = (feature: string) => (req: any, res: any, next: any) => {
    if (typeof requirePermission !== 'function') return next();
    const sub = String(req.user?.sub || '');
    if (!ObjectId.isValid(sub) || sub.length !== 24) return next();
    return requirePermission('crm', feature)(req, res, next);
  };

  router.get('/today', authMiddleware, permit('view'), async (req: any, res) => {
    try {
      res.json(await buildToday(getDb(), req, req.query.projectId ? String(req.query.projectId) : undefined));
    } catch (err: any) {
      sendError(res, err);
    }
  });

  router.get('/calendar', authMiddleware, permit('view'), async (req: any, res) => {
    try {
      res.json(await buildCalendar(getDb(), req, req.query || {}));
    } catch (err: any) {
      sendError(res, err);
    }
  });

  return router;
}
