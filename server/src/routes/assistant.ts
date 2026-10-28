import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db/pool.js';
import { HttpError } from '../errors.js';
import { config } from '../config.js';
import {
  chatAssistant,
  getAssistantHistory,
  cancelProposal,
} from '../services/assistantService.js';
import { setAutoBid } from '../services/bidEngine.js';

export const assistantRouter = Router();

const chatSchema = z.object({
  message: z.string({ required_error: 'Message is required' }).min(1, 'Message cannot be empty'),
});

const confirmProposalSchema = z.object({
  max_amount: z
    .number({ required_error: 'max_amount is required' })
    .int('max_amount must be an integer')
    .positive('max_amount must be positive'),
});

// POST /api/assistant/chat (Rule AI1)
assistantRouter.post('/chat', requireAuth, async (req, res, next) => {
  try {
    const parsed = chatSchema.parse(req.body);
    const result = await chatAssistant(req.user!.id, parsed.message);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/assistant/history (Rule AI1)
assistantRouter.get('/history', requireAuth, async (req, res, next) => {
  try {
    const history = await getAssistantHistory(req.user!.id);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

// POST /api/assistant/proposals/:id/confirm (Rules AI3, AI4, AI6)
assistantRouter.post('/proposals/:id', async (req, res, next) => {
  // If endpoint is called directly as /proposals/:id, pass or handle
  next();
});

assistantRouter.post('/proposals/:id/confirm', requireAuth, async (req, res, next) => {
  try {
    const proposalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parsed = confirmProposalSchema.parse(req.body);

    // 1. Fetch proposal with row lock
    const { rows } = await pool.query(
      `SELECT id, user_id, auction_id, max_amount, status, created_at
       FROM assistant_proposals
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [proposalId, req.user!.id]
    );

    if (rows.length === 0) {
      throw new HttpError(404, 'NOT_FOUND', 'Proposal not found');
    }

    const proposal = rows[0];

    // 2. State check: must be pending (Rule AI3)
    if (proposal.status !== 'pending') {
      throw new HttpError(409, 'PROPOSAL_NOT_PENDING', 'Proposal is no longer pending');
    }

    // 3. Expiration check: 30 minutes (Rule AI6)
    const expiryMs = (config.rules.proposalExpiryMinutes || 30) * 60 * 1000;
    const isExpired = Date.now() - new Date(proposal.created_at).getTime() > expiryMs;
    if (isExpired) {
      await pool.query(
        "UPDATE assistant_proposals SET status = 'expired', decided_at = now() WHERE id = $1",
        [proposalId]
      );
      throw new HttpError(409, 'PROPOSAL_NOT_PENDING', 'Proposal has expired');
    }

    // 4. Ceiling check: user may lower, never raise above proposal max (Rule AI4)
    if (parsed.max_amount > proposal.max_amount) {
      throw new HttpError(
        400,
        'VALIDATION',
        `Cannot exceed proposed maximum amount of ₹${proposal.max_amount}`
      );
    }

    // 5. Execute auto-bid with via='assistant' (Rule AI4)
    const result = await setAutoBid(
      proposal.auction_id,
      req.user!.id,
      parsed.max_amount,
      'assistant'
    );

    // 6. Mark proposal as confirmed
    await pool.query(
      "UPDATE assistant_proposals SET status = 'confirmed', decided_at = now() WHERE id = $1",
      [proposalId]
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/assistant/proposals/:id/cancel (Rule AI3)
assistantRouter.post('/proposals/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const proposalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await cancelProposal(req.user!.id, proposalId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
