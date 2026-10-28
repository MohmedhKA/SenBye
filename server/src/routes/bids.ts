import { Router } from 'express';
import { z } from 'zod';
import { placeBid, setAutoBid } from '../services/bidEngine.js';
import { requireAuth } from '../middleware/auth.js';

export const bidsRouter = Router();

const placeBidSchema = z.object({
  amount: z.coerce.number().int().positive('Bid amount must be a positive integer in rupees'),
});

const autoBidSchema = z.object({
  max_amount: z.coerce.number().int().positive('Maximum bid must be a positive integer in rupees'),
});

// Manual bid endpoint (Rule B1)
bidsRouter.post('/:id/bids', requireAuth, async (req, res, next) => {
  try {
    const auctionId = req.params.id as string;
    const { amount } = placeBidSchema.parse(req.body);
    const result = await placeBid(auctionId, req.user!.id, amount);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// Auto-bid proxy maximum endpoint (Rule A1, A2)
bidsRouter.put('/:id/auto-bid', requireAuth, async (req, res, next) => {
  try {
    const auctionId = req.params.id as string;
    const { max_amount } = autoBidSchema.parse(req.body);
    const result = await setAutoBid(auctionId, req.user!.id, max_amount, 'user');
    res.json(result);
  } catch (err) {
    next(err);
  }
});
