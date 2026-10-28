import { pool, withTx } from '../db/pool.js';
import { HttpError } from '../errors.js';
import { config } from '../config.js';
import {
  toAuctionSummary,
  toAuctionDetail,
  type RawAuctionRow,
  type RawBidRow,
  type RawAutoBidRow,
} from '../dto/mappers.js';
import { matchWantsForNewAuction } from './wantsService.js';

export interface CreateAuctionInput {
  title: string;
  category: string;
  description?: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  starting_price: number;
  min_increment: number;
  closes_at: string;
  faqs?: Array<{ question: string; answer: string }>;
}

export interface EditAuctionInput {
  title?: string;
  category?: string;
  description?: string;
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  starting_price?: number;
  min_increment?: number;
  closes_at?: string;
}

export interface ListAuctionsParams {
  q?: string;
  category?: string;
  condition?: string;
  min_price?: number;
  max_price?: number;
  closing_soon?: boolean;
  status?: string;
  sort?: 'ending_soon' | 'newest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}

const AUCTION_BASE_SELECT = `
  SELECT
    a.*,
    s.name AS seller_name,
    s.contact AS seller_contact,
    l.name AS leader_name,
    w.name AS winner_name,
    w.contact AS winner_contact,
    (SELECT path FROM auction_photos WHERE auction_id = a.id ORDER BY position ASC LIMIT 1) AS primary_photo
  FROM auctions a
  JOIN users s ON a.seller_id = s.id
  LEFT JOIN users l ON a.leader_id = l.id
  LEFT JOIN users w ON a.winner_id = w.id
`;

export async function createAuction(
  sellerId: string,
  input: CreateAuctionInput,
  photoFilenames: string[]
) {
  if (photoFilenames.length < config.rules.minPhotos || photoFilenames.length > config.rules.maxPhotos) {
    throw new HttpError(
      400,
      'VALIDATION',
      `Auctions must include between ${config.rules.minPhotos} and ${config.rules.maxPhotos} photos`
    );
  }

  const closesAtDate = new Date(input.closes_at);
  const now = Date.now();
  if (
    closesAtDate.getTime() < now + config.rules.minCloseDurationMs ||
    closesAtDate.getTime() > now + config.rules.maxCloseDurationMs
  ) {
    throw new HttpError(
      400,
      'VALIDATION',
      'Closing time must be between 10 minutes and 30 days from now'
    );
  }

  return withTx(async (client) => {
    // 1. Insert auction
    const { rows: auctionRows } = await client.query(
      `INSERT INTO auctions (
         seller_id, title, category, description, condition,
         starting_price, min_increment, closes_at, original_closes_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING id`,
      [
        sellerId,
        input.title.trim(),
        input.category,
        input.description?.trim() || '',
        input.condition,
        input.starting_price,
        input.min_increment,
        closesAtDate,
      ]
    );

    const auctionId = auctionRows[0].id;

    // 2. Insert photos with positions
    for (let i = 0; i < photoFilenames.length; i++) {
      await client.query(
        'INSERT INTO auction_photos (auction_id, path, position) VALUES ($1, $2, $3)',
        [auctionId, photoFilenames[i], i]
      );
    }

    // 3. Optional pre-written FAQs (Rule Q7)
    if (input.faqs && Array.isArray(input.faqs)) {
      const validFaqs = input.faqs.slice(0, config.rules.maxPreFaqs);
      for (const faq of validFaqs) {
        if (faq.question && faq.answer) {
          await client.query(
            `INSERT INTO questions (auction_id, asker_id, body, answer, answered_at, is_faq, status)
             VALUES ($1, $2, $3, $4, now(), true, 'visible')`,
            [auctionId, sellerId, faq.question.trim(), faq.answer.trim()]
          );
        }
      }
    }

    // 4. Audit event
    await client.query(
      `INSERT INTO auction_events (auction_id, type, actor_id, data)
       VALUES ($1, 'created', $2, $3)`,
      [auctionId, sellerId, JSON.stringify({ title: input.title })]
    );

    // 5. Match active wants of other users (Rule W2)
    await matchWantsForNewAuction(auctionId, client);

    // Fetch full row and map
    const { rows: fullRows } = await client.query(
      `${AUCTION_BASE_SELECT} WHERE a.id = $1`,
      [auctionId]
    );

    return toAuctionDetail(fullRows[0] as RawAuctionRow, photoFilenames, [], [], sellerId);
  });
}

export async function editAuction(
  sellerId: string,
  auctionId: string,
  input: EditAuctionInput
) {
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
      throw new HttpError(403, 'FORBIDDEN', 'Only the seller can edit this auction');
    }

    if (auction.status !== 'open') {
      throw new HttpError(409, 'INVALID_STATE', 'Only open auctions can be edited');
    }

    // Rule L3: If there are bids, ONLY description can be edited
    if (auction.bid_count > 0) {
      const hasOtherChanges =
        input.title !== undefined ||
        input.category !== undefined ||
        input.condition !== undefined ||
        input.starting_price !== undefined ||
        input.min_increment !== undefined ||
        input.closes_at !== undefined;

      if (hasOtherChanges) {
        throw new HttpError(
          409,
          'LISTING_LOCKED',
          'Auction details are locked after the first bid. Only description may be edited.'
        );
      }

      await client.query(
        'UPDATE auctions SET description = $1, updated_at = now() WHERE id = $2',
        [input.description?.trim() || '', auctionId]
      );
    } else {
      // No bids yet: all fields editable
      let newClosesAt = auction.closes_at;
      if (input.closes_at) {
        const candidate = new Date(input.closes_at);
        if (candidate.getTime() < Date.now() + config.rules.minCloseDurationMs) {
          throw new HttpError(400, 'VALIDATION', 'Closing time must be at least 10 minutes from now');
        }
        newClosesAt = candidate;
      }

      await client.query(
        `UPDATE auctions SET
           title = COALESCE($1, title),
           category = COALESCE($2, category),
           description = COALESCE($3, description),
           condition = COALESCE($4, condition),
           starting_price = COALESCE($5, starting_price),
           min_increment = COALESCE($6, min_increment),
           closes_at = $7,
           original_closes_at = $7,
           updated_at = now()
         WHERE id = $8`,
        [
          input.title?.trim() || null,
          input.category || null,
          input.description !== undefined ? input.description.trim() : null,
          input.condition || null,
          input.starting_price || null,
          input.min_increment || null,
          newClosesAt,
          auctionId,
        ]
      );
    }

    await client.query(
      `INSERT INTO auction_events (auction_id, type, actor_id, data)
       VALUES ($1, 'edited', $2, $3)`,
      [auctionId, sellerId, JSON.stringify(input)]
    );
  });

  return getAuctionDetail(auctionId, sellerId);
}

export async function cancelAuction(
  sellerId: string,
  auctionId: string,
  reason: string
) {
  if (!reason || reason.trim().length < 3 || reason.trim().length > 200) {
    throw new HttpError(400, 'VALIDATION', 'A cancellation reason between 3 and 200 characters is required');
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
      throw new HttpError(403, 'FORBIDDEN', 'Only the seller can cancel this auction');
    }

    if (auction.status !== 'open') {
      throw new HttpError(409, 'INVALID_STATE', 'Only open auctions can be cancelled');
    }

    await client.query(
      `UPDATE auctions
       SET status = 'cancelled', outcome_reason = $1, closed_at = now(), updated_at = now()
       WHERE id = $2`,
      [reason.trim(), auctionId]
    );

    await client.query(
      `INSERT INTO auction_events (auction_id, type, actor_id, data)
       VALUES ($1, 'cancelled', $2, $3)`,
      [auctionId, sellerId, JSON.stringify({ reason: reason.trim() })]
    );
  });

  return getAuctionDetail(auctionId, sellerId);
}

export async function relistAuction(
  sellerId: string,
  auctionId: string,
  closesAt: Date
) {
  if (closesAt.getTime() < Date.now() + config.rules.minCloseDurationMs) {
    throw new HttpError(400, 'VALIDATION', 'New closing time must be at least 10 minutes from now');
  }

  const newAuctionId = await withTx(async (client) => {
    const { rows: sourceRows } = await client.query(
      'SELECT * FROM auctions WHERE id = $1',
      [auctionId]
    );

    if (sourceRows.length === 0) {
      throw new HttpError(404, 'NOT_FOUND', 'Auction not found');
    }

    const source = sourceRows[0];

    if (source.seller_id !== sellerId) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the original seller can relist this auction');
    }

    const relistableStatuses = ['unsold', 'rejected', 'cancelled', 'failed_pickup'];
    if (!relistableStatuses.includes(source.status)) {
      throw new HttpError(
        409,
        'INVALID_STATE',
        `Cannot relist auction with status '${source.status}'. Only unsold, rejected, cancelled, or failed pickup items can be relisted.`
      );
    }

    // 1. Create new auction
    const { rows: newAuctionRows } = await client.query(
      `INSERT INTO auctions (
         seller_id, title, category, description, condition,
         starting_price, min_increment, closes_at, original_closes_at,
         relisted_from
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)
       RETURNING id`,
      [
        sellerId,
        source.title,
        source.category,
        source.description,
        source.condition,
        source.starting_price,
        source.min_increment,
        closesAt,
        source.id,
      ]
    );

    const newId = newAuctionRows[0].id;

    // 2. Copy photos
    const { rows: photoRows } = await client.query(
      'SELECT path, position FROM auction_photos WHERE auction_id = $1 ORDER BY position ASC',
      [source.id]
    );

    for (const photo of photoRows) {
      await client.query(
        'INSERT INTO auction_photos (auction_id, path, position) VALUES ($1, $2, $3)',
        [newId, photo.path, photo.position]
      );
    }

    // 3. Audit events
    await client.query(
      `INSERT INTO auction_events (auction_id, type, actor_id, data)
       VALUES ($1, 'relisted', $2, $3)`,
      [newId, sellerId, JSON.stringify({ relisted_from: source.id })]
    );

    return newId;
  });

  return getAuctionDetail(newAuctionId, sellerId);
}

export async function listAuctions(params: ListAuctionsParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Status (default 'open')
  const status = params.status || 'open';
  if (status !== 'all') {
    conditions.push(`a.status = $${paramIndex++}`);
    values.push(status);
  }

  // Search keyword (Rule BR1)
  if (params.q && params.q.trim()) {
    const q = params.q.trim();
    conditions.push(
      `(a.search @@ websearch_to_tsquery('english', $${paramIndex}) OR a.title ILIKE $${paramIndex + 1})`
    );
    values.push(q, `%${q}%`);
    paramIndex += 2;
  }

  // Category filter (Rule BR2)
  if (params.category) {
    conditions.push(`a.category = $${paramIndex++}`);
    values.push(params.category);
  }

  // Condition filter
  if (params.condition) {
    conditions.push(`a.condition = $${paramIndex++}`);
    values.push(params.condition);
  }

  // Price filters (on display_price)
  if (params.min_price !== undefined) {
    conditions.push(`a.display_price >= $${paramIndex++}`);
    values.push(params.min_price);
  }
  if (params.max_price !== undefined) {
    conditions.push(`a.display_price <= $${paramIndex++}`);
    values.push(params.max_price);
  }

  // Closing soon filter (closes within 24h)
  if (params.closing_soon) {
    conditions.push(`a.closes_at <= now() + interval '24 hours'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Sort order (Rule BR2)
  let orderClause = 'ORDER BY a.closes_at ASC'; // default ending_soon
  if (params.sort === 'newest') {
    orderClause = 'ORDER BY a.created_at DESC';
  } else if (params.sort === 'price_asc') {
    orderClause = 'ORDER BY a.display_price ASC';
  } else if (params.sort === 'price_desc') {
    orderClause = 'ORDER BY a.display_price DESC';
  }

  // Count total
  const countSql = `SELECT count(*)::int AS total FROM auctions a ${whereClause}`;
  const { rows: countRows } = await pool.query(countSql, values);
  const total = countRows[0]?.total || 0;

  // Fetch page items
  const querySql = `
    ${AUCTION_BASE_SELECT}
    ${whereClause}
    ${orderClause}
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
  values.push(limit, offset);

  const { rows } = await pool.query(querySql, values);
  const items = rows.map((r) => toAuctionSummary(r as RawAuctionRow));

  return { items, total, page, limit };
}

export async function getAuctionDetail(auctionId: string, viewerId?: string | null) {
  const { rows } = await pool.query(
    `${AUCTION_BASE_SELECT} WHERE a.id = $1`,
    [auctionId]
  );

  if (rows.length === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'Auction not found');
  }

  const auctionRow = rows[0] as RawAuctionRow;

  // Fetch photos
  const { rows: photoRows } = await pool.query(
    'SELECT path FROM auction_photos WHERE auction_id = $1 ORDER BY position ASC',
    [auctionId]
  );
  const photos = photoRows.map((p) => p.path);

  // Fetch public bids
  const { rows: bidRows } = await pool.query(
    `SELECT b.id, b.bidder_id, u.name AS bidder_name, b.amount, b.source, b.placed_at, b.caused_extension
     FROM bids b
     JOIN users u ON b.bidder_id = u.id
     WHERE b.auction_id = $1
     ORDER BY b.id DESC`,
    [auctionId]
  );

  // Fetch public auto-bids (Rule B6)
  const { rows: autoBidRows } = await pool.query(
    `SELECT ab.bidder_id, u.name AS bidder_name, ab.max_amount, ab.via
     FROM auto_bids ab
     JOIN users u ON ab.bidder_id = u.id
     WHERE ab.auction_id = $1
     ORDER BY ab.max_amount DESC`,
    [auctionId]
  );

  return toAuctionDetail(
    auctionRow,
    photos,
    bidRows as RawBidRow[],
    autoBidRows as RawAutoBidRow[],
    viewerId
  );
}

export async function getMyAuctions(userId: string, role: 'selling' | 'bidding') {
  let querySql = '';

  if (role === 'selling') {
    querySql = `
      ${AUCTION_BASE_SELECT}
      WHERE a.seller_id = $1
      ORDER BY a.created_at DESC
    `;
  } else {
    querySql = `
      ${AUCTION_BASE_SELECT}
      WHERE a.id IN (
        SELECT DISTINCT auction_id FROM bids WHERE bidder_id = $1
        UNION
        SELECT DISTINCT auction_id FROM auto_bids WHERE bidder_id = $1
      )
      ORDER BY a.closes_at ASC
    `;
  }

  const { rows } = await pool.query(querySql, [userId]);
  return rows.map((r) => toAuctionSummary(r as RawAuctionRow));
}
