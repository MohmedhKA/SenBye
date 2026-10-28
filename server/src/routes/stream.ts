import { Router } from 'express';
import { registerAuctionClient, registerUserClient } from '../services/sseHub.js';
import { getAuctionDetail } from '../services/auctionService.js';
import { requireAuth } from '../middleware/auth.js';

export const streamRouter = Router();

// Auction realtime event stream
streamRouter.get('/auctions/:id/stream', async (req, res, next) => {
  const auctionId = req.params.id as string;

  try {
    // Check auction exists and get initial snapshot
    const snapshot = await getAuctionDetail(auctionId);

    // Set SSE headers per AGENT.md §8
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send initial snapshot event
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);

    // Register to SSE hub
    const unregister = registerAuctionClient(auctionId, res);

    req.on('close', () => {
      unregister();
    });
  } catch (err) {
    next(err);
  }
});

// Personal user notification stream
streamRouter.get('/me/stream', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ user_id: req.user!.id })}\n\n`);

  const unregister = registerUserClient(req.user!.id, res);

  req.on('close', () => {
    unregister();
  });
});
