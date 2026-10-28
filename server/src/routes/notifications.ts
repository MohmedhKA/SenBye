import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { listNotifications, markNotificationsRead } from '../services/notifier.js';

export const notificationsRouter = Router();

const readSchema = z.object({
  ids: z.array(z.number().int()).optional(),
});

// GET /api/notifications (Rule N1)
notificationsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;

    const result = await listNotifications(req.user!.id, { limit, before });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read (Rule N1)
notificationsRouter.post('/read', requireAuth, async (req, res, next) => {
  try {
    const parseResult = readSchema.safeParse(req.body || {});
    const ids = parseResult.success ? parseResult.data.ids : undefined;

    await markNotificationsRead(req.user!.id, ids);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
