import { pool } from '../../src/db/pool.js';

export async function truncateAll(): Promise<void> {
  await pool.query(`
    TRUNCATE users, auctions, auction_photos, bids, auto_bids,
             auction_events, notifications, wants, want_matches,
             questions, assistant_messages, assistant_proposals
    CASCADE;
  `);
}
