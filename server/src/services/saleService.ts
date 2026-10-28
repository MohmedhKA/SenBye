import { pool, withTx } from '../db/pool.js';
import { HttpError } from '../errors.js';
import { config } from '../config.js';
import { getAuctionDetail } from './auctionService.js';
import { broadcastAuctionEvent } from './sseHub.js';

export interface ClosedAuctionRecord {
  id: string;
  status: 'unsold' | 'pending_approval';
  winner_id: string | null;
  winning_amount: number | null;
}

/**
 * Evaluates all open auctions that have passed their closing time.
 * Transitions to:
 * - 'unsold' if bid_count === 0 (Rule C1)
 * - 'pending_approval' if bid_count >= 1 with leader set as provisional winner (Rule C1)
 */
export async function closeDueAuctions(): Promise<ClosedAuctionRecord[]> {
  const { rows: dueRows } = await pool.query<{ id: string }>(
    `SELECT id FROM auctions
     WHERE status = 'open' AND closes_at <= clock_timestamp()`
  );

  const results: ClosedAuctionRecord[] = [];

  for (const { id } of dueRows) {
    let closedRecord: ClosedAuctionRecord | null = null;

    await withTx(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (rows.length === 0) return;
      const auction = rows[0];

      // Re-verify under row-lock (might have extended or already closed)
      const { rows: timeRows } = await client.query('SELECT clock_timestamp() AS t');
      const t: Date = timeRows[0].t;

      if (auction.status !== 'open' || t.getTime() < new Date(auction.closes_at).getTime()) {
        return;
      }

      if (auction.bid_count === 0) {
        await client.query(
          `UPDATE auctions
           SET status = 'unsold', closed_at = $1, outcome_reason = 'no_bids', updated_at = now()
           WHERE id = $2`,
          [t, id]
        );

        await client.query(
          `INSERT INTO auction_events (auction_id, type, actor_id, data)
           VALUES ($1, 'closed', NULL, $2)`,
          [id, JSON.stringify({ status: 'unsold', reason: 'no_bids' })]
        );

        closedRecord = {
          id,
          status: 'unsold',
          winner_id: null,
          winning_amount: null,
        };
      } else {
        await client.query(
          `UPDATE auctions
           SET status = 'pending_approval', closed_at = $1, winner_id = $2, winning_amount = $3, updated_at = now()
           WHERE id = $4`,
          [t, auction.leader_id, auction.current_price, id]
        );

        await client.query(
          `INSERT INTO auction_events (auction_id, type, actor_id, data)
           VALUES ($1, 'closed', NULL, $2)`,
          [
            id,
            JSON.stringify({
              status: 'pending_approval',
              winner_id: auction.leader_id,
              winning_amount: auction.current_price,
            }),
          ]
        );

        closedRecord = {
          id,
          status: 'pending_approval',
          winner_id: auction.leader_id,
          winning_amount: auction.current_price,
        };
      }
    });

    if (closedRecord) {
      results.push(closedRecord);
      broadcastAuctionEvent(id, 'closed', closedRecord);
    }
  }

  return results;
}

/**
 * Seller approves the highest winning bid (Rule S1).
 * Transitions status from 'pending_approval' to 'reserved'.
 * Establishes the pickup_deadline (+72h) and enables counterparty contact disclosure.
 */
export async function approveWinningBid(sellerId: string, auctionId: string) {
  await withTx(async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
      [auctionId]
    );

    if (rows.length === 0) {
      throw new HttpError(404, 'NOT_FOUND', 'Auction not found');
    }

    const auction = rows[0];

    if (auction.seller_id !== sellerId) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the seller can approve this sale');
    }

    if (auction.status !== 'pending_approval') {
      throw new HttpError(
        409,
        'INVALID_STATE',
        `Cannot approve sale in status '${auction.status}'. Auction must be in 'pending_approval'.`
      );
    }

    const hours = config.rules.pickupDeadlineHours;
    await client.query(
      `UPDATE auctions
       SET status = 'reserved',
           decided_at = now(),
           pickup_deadline = now() + (interval '1 hour' * $1),
           updated_at = now()
       WHERE id = $2`,
      [hours, auctionId]
    );

    await client.query(
      `INSERT INTO auction_events (auction_id, type, actor_id, data)
       VALUES ($1, 'approved', $2, json_build_object('hours', $3::int))`,
      [auctionId, sellerId, hours]
    );
  });

  const detail = await getAuctionDetail(auctionId, sellerId);
  broadcastAuctionEvent(auctionId, 'approved', detail);
  return detail;
}

/**
 * Seller rejects the highest bid with mandatory reason (Rule S3).
 * Transitions status from 'pending_approval' to 'rejected'.
 */
export async function rejectWinningBid(sellerId: string, auctionId: string, reason: string) {
  if (!reason || reason.trim().length < 3 || reason.trim().length > 200) {
    throw new HttpError(400, 'VALIDATION', 'A rejection reason between 3 and 200 characters is required');
  }

  await withTx(async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
      [auctionId]
    );

    if (rows.length === 0) {
      throw new HttpError(404, 'NOT_FOUND', 'Auction not found');
    }

    const auction = rows[0];

    if (auction.seller_id !== sellerId) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the seller can reject this sale');
    }

    if (auction.status !== 'pending_approval') {
      throw new HttpError(
        409,
        'INVALID_STATE',
        `Cannot reject sale in status '${auction.status}'. Auction must be in 'pending_approval'.`
      );
    }

    await client.query(
      `UPDATE auctions
       SET status = 'rejected',
           outcome_reason = $1,
           decided_at = now(),
           updated_at = now()
       WHERE id = $2`,
      [reason.trim(), auctionId]
    );

    await client.query(
      `INSERT INTO auction_events (auction_id, type, actor_id, data)
       VALUES ($1, 'rejected', $2, $3)`,
      [auctionId, sellerId, JSON.stringify({ reason: reason.trim() })]
    );
  });

  const detail = await getAuctionDetail(auctionId, sellerId);
  broadcastAuctionEvent(auctionId, 'rejected', detail);
  return detail;
}

/**
 * Handover confirmation (Rule S4).
 * Dual-confirmation model:
 * Requires BOTH the seller and the winning buyer to confirm handover.
 * Once both timestamps are set, status automatically transitions to 'sold'.
 */
export async function confirmHandover(userId: string, auctionId: string) {
  await withTx(async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
      [auctionId]
    );

    if (rows.length === 0) {
      throw new HttpError(404, 'NOT_FOUND', 'Auction not found');
    }

    const auction = rows[0];

    if (auction.status !== 'reserved') {
      throw new HttpError(
        409,
        'INVALID_STATE',
        `Cannot confirm handover in status '${auction.status}'. Auction must be 'reserved'.`
      );
    }

    const isSeller = auction.seller_id === userId;
    const isWinner = auction.winner_id === userId;

    if (!isSeller && !isWinner) {
      throw new HttpError(
        403,
        'FORBIDDEN',
        'Only the seller or the winning buyer can confirm handover'
      );
    }

    const hasSellerConfirmed = isSeller || auction.seller_handover_at !== null;
    const hasBuyerConfirmed = isWinner || auction.buyer_handover_at !== null;

    if (hasSellerConfirmed && hasBuyerConfirmed) {
      // Both have confirmed -> completed sale!
      await client.query(
        `UPDATE auctions
         SET status = 'sold',
             seller_handover_at = COALESCE(seller_handover_at, now()),
             buyer_handover_at = COALESCE(buyer_handover_at, now()),
             updated_at = now()
         WHERE id = $1`,
        [auctionId]
      );

      await client.query(
        `INSERT INTO auction_events (auction_id, type, actor_id, data)
         VALUES ($1, 'sold', $2, $3)`,
        [auctionId, userId, JSON.stringify({ completed_by: isSeller ? 'seller' : 'buyer' })]
      );
    } else {
      // One party confirmed; record timestamp and await counterparty
      if (isSeller) {
        await client.query(
          `UPDATE auctions
           SET seller_handover_at = COALESCE(seller_handover_at, now()),
               updated_at = now()
           WHERE id = $1`,
          [auctionId]
        );
      } else {
        await client.query(
          `UPDATE auctions
           SET buyer_handover_at = COALESCE(buyer_handover_at, now()),
               updated_at = now()
           WHERE id = $1`,
          [auctionId]
        );
      }

      await client.query(
        `INSERT INTO auction_events (auction_id, type, actor_id, data)
         VALUES ($1, 'handover', $2, $3)`,
        [auctionId, userId, JSON.stringify({ party: isSeller ? 'seller' : 'buyer' })]
      );
    }
  });

  const detail = await getAuctionDetail(auctionId, userId);
  broadcastAuctionEvent(auctionId, 'handover', detail);
  return detail;
}

/**
 * Report failed pickup during reserved state (Rule S5).
 * Either seller or buyer can declare pickup failure with a mandatory reason.
 */
export async function reportFailedPickup(userId: string, auctionId: string, reason: string) {
  if (!reason || reason.trim().length < 3 || reason.trim().length > 200) {
    throw new HttpError(400, 'VALIDATION', 'A reason between 3 and 200 characters is required');
  }

  await withTx(async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
      [auctionId]
    );

    if (rows.length === 0) {
      throw new HttpError(404, 'NOT_FOUND', 'Auction not found');
    }

    const auction = rows[0];

    if (auction.status !== 'reserved') {
      throw new HttpError(
        409,
        'INVALID_STATE',
        `Cannot report failed pickup in status '${auction.status}'. Auction must be 'reserved'.`
      );
    }

    const isSeller = auction.seller_id === userId;
    const isWinner = auction.winner_id === userId;

    if (!isSeller && !isWinner) {
      throw new HttpError(
        403,
        'FORBIDDEN',
        'Only the seller or the winning buyer can report a failed pickup'
      );
    }

    await client.query(
      `UPDATE auctions
       SET status = 'failed_pickup',
           outcome_reason = $1,
           updated_at = now()
       WHERE id = $2`,
      [reason.trim(), auctionId]
    );

    await client.query(
      `INSERT INTO auction_events (auction_id, type, actor_id, data)
       VALUES ($1, 'failed_pickup', $2, $3)`,
      [
        auctionId,
        userId,
        JSON.stringify({
          reason: reason.trim(),
          reported_by: isSeller ? 'seller' : 'buyer',
        }),
      ]
    );
  });

  const detail = await getAuctionDetail(auctionId, userId);
  broadcastAuctionEvent(auctionId, 'failed_pickup', detail);
  return detail;
}

/**
 * Automatic pickup-window expiration daemon (Rule S5, C5).
 * Expired reserved auctions transition to 'failed_pickup'.
 */
export async function expirePickupDeadlines(): Promise<number> {
  const { rows: expiredRows } = await pool.query<{ id: string }>(
    `SELECT id FROM auctions
     WHERE status = 'reserved' AND pickup_deadline <= clock_timestamp()`
  );

  let expiredCount = 0;

  for (const { id } of expiredRows) {
    let marked = false;

    await withTx(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (rows.length === 0) return;
      const auction = rows[0];

      if (
        auction.status === 'reserved' &&
        auction.pickup_deadline &&
        new Date(auction.pickup_deadline).getTime() <= Date.now()
      ) {
        await client.query(
          `UPDATE auctions
           SET status = 'failed_pickup',
               outcome_reason = 'Pickup deadline expired',
               updated_at = now()
           WHERE id = $1`,
          [id]
        );

        await client.query(
          `INSERT INTO auction_events (auction_id, type, actor_id, data)
           VALUES ($1, 'failed_pickup', NULL, $2)`,
          [id, JSON.stringify({ reason: 'Pickup deadline expired' })]
        );

        marked = true;
      }
    });

    if (marked) {
      expiredCount++;
      const detail = await getAuctionDetail(id);
      broadcastAuctionEvent(id, 'failed_pickup', detail);
    }
  }

  return expiredCount;
}
