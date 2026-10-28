import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import {
  createWant,
  listWants,
  deleteWant,
} from '../services/wantsService.js';

export const wantsRouter = Router();

const createWantSchema = z.object({
  keywords: z
    .string({ required_error: 'Keywords are required' })
    .min(config.rules.wantMinKeywordsLength, `Keywords must be at least ${config.rules.wantMinKeywordsLength} characters`)
    .max(config.rules.wantMaxKeywordsLength, `Keywords cannot exceed ${config.rules.wantMaxKeywordsLength} characters`),
  category: z.string().optional().nullable(),
  max_price: z
    .number({ required_error: 'Maximum price is required' })
    .int('Maximum price must be an integer')
    .positive('Maximum price must be greater than zero'),
});

// GET /api/wants - list saved wants of authenticated user
wantsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const wants = await listWants(req.user!.id);
    res.json(wants);
  } catch (err) {
    next(err);
  }
});

// POST /api/wants - create a saved want (Rule W1, W3)
wantsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = createWantSchema.parse(req.body);
    const want = await createWant(req.user!.id, parsed);
    res.status(201).json(want);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/wants/:id - delete a saved want
wantsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const wantId = parseInt(rawId as string, 10);
    if (isNaN(wantId)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION',
          message: 'Invalid want ID',
        },
      });
      return;
    }

    await deleteWant(req.user!.id, wantId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
