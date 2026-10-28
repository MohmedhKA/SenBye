import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  approveWinningBid,
  rejectWinningBid,
  confirmHandover,
  reportFailedPickup,
} from '../services/saleService.js';
import { HttpError } from '../errors.js';

export const saleRouter = Router();

const reasonSchema = z.object({
  reason: z
    .string()
    .min(3, 'Reason must be at least 3 characters')
    .max(200, 'Reason cannot exceed 200 characters'),
});

// POST /api/auctions/:id/approve (Rule S1)
saleRouter.post('/:id/approve', requireAuth, async (req, res, next) => {
  try {
    const auctionId = req.params.id as string;
    const detail = await approveWinningBid(req.user!.id, auctionId);
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

// POST /api/auctions/:id/reject (Rule S3)
saleRouter.post('/:id/reject', requireAuth, async (req, res, next) => {
  try {
    const auctionId = req.params.id as string;
    const parseResult = reasonSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new HttpError(
        400,
        'VALIDATION',
        parseResult.error.errors[0]?.message || 'Invalid reason'
      );
    }

    const detail = await rejectWinningBid(
      req.user!.id,
      auctionId,
      parseResult.data.reason
    );
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

// POST /api/auctions/:id/handover (Rule S4)
saleRouter.post('/:id/handover', requireAuth, async (req, res, next) => {
  try {
    const auctionId = req.params.id as string;
    const detail = await confirmHandover(req.user!.id, auctionId);
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

// POST /api/auctions/:id/failed-pickup (Rule S5)
saleRouter.post('/:id/failed-pickup', requireAuth, async (req, res, next) => {
  try {
    const auctionId = req.params.id as string;
    const parseResult = reasonSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new HttpError(
        400,
        'VALIDATION',
        parseResult.error.errors[0]?.message || 'Invalid reason'
      );
    }

    const detail = await reportFailedPickup(
      req.user!.id,
      auctionId,
      parseResult.data.reason
    );
    res.json(detail);
  } catch (err) {
    next(err);
  }
});
