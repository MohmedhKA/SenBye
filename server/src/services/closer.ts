import { closeDueAuctions, expirePickupDeadlines } from './saleService.js';
import { pool } from '../db/pool.js';
import { broadcastAuctionEvent } from './sseHub.js';

let closerInterval: NodeJS.Timeout | null = null;
let isTicking = false;

/**
 * Runs a single tick of the closer loop:
 * 1. Closes open auctions whose closing time has arrived (Rule C1).
 * 2. Marks 'ending_soon' flag on auctions within 10 minutes of closing (Rule C4).
 * 3. Expired reserved auctions transition to 'failed_pickup' (Rule S5, C5).
 */
export async function tickCloser(): Promise<{
  closed: number;
  expiredPickups: number;
  endingSoonCount: number;
}> {
  if (isTicking) {
    return { closed: 0, expiredPickups: 0, endingSoonCount: 0 };
  }

  isTicking = true;
  try {
    // 1. Close due auctions
    const closedList = await closeDueAuctions();

    // 2. Mark ending soon auctions (10-minute window)
    const { rows: endingSoonRows } = await pool.query<{ id: string }>(
      `UPDATE auctions
       SET ending_soon_sent = true, updated_at = now()
       WHERE status = 'open'
         AND ending_soon_sent = false
         AND closes_at <= clock_timestamp() + interval '10 minutes'
       RETURNING id`
    );

    for (const { id } of endingSoonRows) {
      broadcastAuctionEvent(id, 'ending_soon', { auction_id: id });
    }

    // 3. Expire pickup deadlines
    const expiredPickups = await expirePickupDeadlines();

    return {
      closed: closedList.length,
      expiredPickups,
      endingSoonCount: endingSoonRows.length,
    };
  } finally {
    isTicking = false;
  }
}

/**
 * Starts the closer background daemon ticking at 1000ms intervals.
 * Returns a teardown function.
 */
export function startCloser(): () => void {
  if (closerInterval) {
    return () => stopCloser();
  }

  closerInterval = setInterval(() => {
    tickCloser().catch((err) => {
      console.error('[Closer] Error during tick:', err);
    });
  }, 1000);

  return () => {
    stopCloser();
  };
}

export function stopCloser(): void {
  if (closerInterval) {
    clearInterval(closerInterval);
    closerInterval = null;
  }
}
