import { pool } from '../db/pool.js';
import { HttpError } from '../errors.js';
import { config } from '../config.js';
import { toWant, type WantDTO } from '../dto/mappers.js';
import { createNotification } from './notifier.js';
import type pg from 'pg';

export interface CreateWantInput {
  keywords: string;
  category?: string | null;
  max_price: number;
}

/**
 * Creates a saved want and immediately matches it against currently open auctions (Rules W1, W3).
 */
export async function createWant(userId: string, input: CreateWantInput): Promise<WantDTO> {
  const keywords = input.keywords?.trim();
  if (!keywords || keywords.length < config.rules.wantMinKeywordsLength || keywords.length > config.rules.wantMaxKeywordsLength) {
    throw new HttpError(
      400,
      'VALIDATION',
      `Keywords must be between ${config.rules.wantMinKeywordsLength} and ${config.rules.wantMaxKeywordsLength} characters`
    );
  }

  const maxPrice = Number(input.max_price);
  if (!Number.isInteger(maxPrice) || maxPrice <= 0) {
    throw new HttpError(400, 'VALIDATION', 'Maximum price must be a positive whole number');
  }

  const category = input.category ? input.category.trim() : null;
  if (category && !(config.rules.categories as readonly string[]).includes(category)) {
    throw new HttpError(400, 'VALIDATION', `Invalid category: ${category}`);
  }

  // 1. Insert the saved want
  const { rows } = await pool.query(
    `INSERT INTO wants (user_id, keywords, category, max_price)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, keywords, category, max_price, active, created_at`,
    [userId, keywords, category, maxPrice]
  );
  const wantRow = rows[0];

  // 2. Rule W3: Match against existing open auctions immediately
  const { rows: matchedAuctions } = await pool.query(
    `SELECT a.id, a.title, a.starting_price, a.display_price
     FROM auctions a
     WHERE a.status = 'open'
       AND a.seller_id != $1
       AND ($2::text IS NULL OR a.category = $2)
       AND a.starting_price <= $3
       AND a.search @@ plainto_tsquery('english', $4)`,
    [userId, category, maxPrice, keywords]
  );

  let matchCount = 0;
  for (const auction of matchedAuctions) {
    // Insert into want_matches (Rule W4: one alert per want, auction)
    const { rowCount } = await pool.query(
      `INSERT INTO want_matches (want_id, auction_id)
       VALUES ($1, $2)
       ON CONFLICT (want_id, auction_id) DO NOTHING`,
      [wantRow.id, auction.id]
    );

    if (rowCount && rowCount > 0) {
      matchCount++;
      await createNotification(
        userId,
        'want_match',
        `New Match: ${auction.title}`,
        `An item matching "${keywords}" was found starting at ₹${auction.display_price || auction.starting_price}`,
        auction.id
      );
    }
  }

  return toWant({
    ...wantRow,
    matches_count: matchCount,
  });
}

/**
 * Lists all saved wants for the given user with current match count (Rule W1).
 */
export async function listWants(userId: string): Promise<WantDTO[]> {
  const { rows } = await pool.query(
    `SELECT w.id, w.user_id, w.keywords, w.category, w.max_price, w.active, w.created_at,
            COUNT(wm.auction_id)::int AS matches_count
     FROM wants w
     LEFT JOIN want_matches wm ON wm.want_id = w.id
     WHERE w.user_id = $1
     GROUP BY w.id
     ORDER BY w.created_at DESC`,
    [userId]
  );

  return rows.map(toWant);
}

/**
 * Deletes a saved want owned by the given user.
 */
export async function deleteWant(userId: string, wantId: number): Promise<void> {
  const { rowCount } = await pool.query(
    `DELETE FROM wants WHERE id = $1 AND user_id = $2`,
    [wantId, userId]
  );

  if (!rowCount || rowCount === 0) {
    // Check if the want exists but belongs to someone else
    const { rows: exists } = await pool.query(
      `SELECT id, user_id FROM wants WHERE id = $1`,
      [wantId]
    );

    if (exists.length > 0) {
      throw new HttpError(403, 'FORBIDDEN', 'You do not own this saved want');
    }
    throw new HttpError(404, 'NOT_FOUND', 'Saved want not found');
  }
}

/**
 * Matches a newly created auction against active wants in the same transaction (Rules W1, W2, W4).
 */
export async function matchWantsForNewAuction(
  auctionId: string,
  client?: pg.PoolClient
): Promise<number> {
  const runner = client || pool;

  // Rule W1: status is open (it was just inserted as open), starting_price <= max_price,
  // category matches if set, search @@ plainto_tsquery('english', keywords), user != seller
  const { rows: matchedWants } = await runner.query(
    `SELECT w.id AS want_id, w.user_id, w.keywords, a.title, a.starting_price
     FROM wants w
     JOIN auctions a ON a.id = $1
     WHERE w.active = true
       AND w.user_id != a.seller_id
       AND (w.category IS NULL OR w.category = a.category)
       AND a.starting_price <= w.max_price
       AND a.search @@ plainto_tsquery('english', w.keywords)`,
    [auctionId]
  );

  let notifiedCount = 0;
  for (const match of matchedWants) {
    // Rule W4: At most one alert per (want, auction)
    const { rowCount } = await runner.query(
      `INSERT INTO want_matches (want_id, auction_id)
       VALUES ($1, $2)
       ON CONFLICT (want_id, auction_id) DO NOTHING`,
      [match.want_id, auctionId]
    );

    if (rowCount && rowCount > 0) {
      notifiedCount++;
      await createNotification(
        match.user_id,
        'want_match',
        `New Match: ${match.title}`,
        `An item matching "${match.keywords}" was listed at ₹${match.starting_price}`,
        auctionId,
        client
      );
    }
  }

  return notifiedCount;
}
