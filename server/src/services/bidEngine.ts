import { withTx, pool } from '../db/pool.js';
import { HttpError } from '../errors.js';
import { config } from '../config.js';
import { nextMinBid, extendedClose } from '../engine/rules.js';
import { resolveAutoBids, type AutoBidCap } from '../engine/autoBid.js';
import { getAuctionDetail } from './auctionService.js';
import { broadcastAuctionEvent } from './sseHub.js';
import { createNotification } from './notifier.js';

export interface PlaceBidResult {
  bid: {
    id: number;
    amount: number;
    source: 'manual' | 'auto';
    placed_at: string;
    caused_extension: boolean;
  };
  auction: Awaited<ReturnType<typeof getAuctionDetail>>;
}

export interface SetAutoBidResult {
  auto_bid: {
    max_amount: number;
    via: 'user' | 'assistant';
  };
  auction: Awaited<ReturnType<typeof getAuctionDetail>>;
}

export async function placeBid(
  auctionId: string,
  bidderId: string,
  amount: number
): Promise<PlaceBidResult> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new HttpError(400, 'VALIDATION', 'Bid amount must be a positive integer in rupees');
  }

  if (amount > config.rules.maxBidAmount) {
    throw new HttpError(400, 'VALIDATION', `Bid amount cannot exceed ₹${config.rules.maxBidAmount}`);
  }

  let manualBidRow: any;
  let causedExtension = false;

  await withTx(async (client) => {
    // 1. Lock auction row
    const { rows: auctionRows } = await client.query(
      'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
      [auctionId]
    );

    if (auctionRows.length === 0) {
      throw new HttpError(404, 'NOT_FOUND', 'Auction not found');
    }

    const auction = auctionRows[0];

    // 2. Read database clock under lock
    const { rows: timeRows } = await client.query('SELECT clock_timestamp() AS t');
    const t: Date = timeRows[0].t;

    // 3. Validation
    if (auction.status !== 'open') {
      throw new HttpError(409, 'INVALID_STATE', `Auction is not open for bidding (current status: ${auction.status})`);
    }

    const closesAt = new Date(auction.closes_at);
    if (t.getTime() >= closesAt.getTime()) {
      throw new HttpError(409, 'AUCTION_CLOSED', 'This auction has already closed');
    }

    if (auction.seller_id === bidderId) {
      throw new HttpError(403, 'OWN_AUCTION', 'Sellers cannot bid on their own auction');
    }

    if (auction.leader_id === bidderId) {
      throw new HttpError(409, 'ALREADY_LEADING', 'You are already the leading bidder. To increase your limit, raise your auto-bid maximum.');
    }

    const minNext = nextMinBid(auction.starting_price, auction.current_price, auction.min_increment);
    if (amount < minNext) {
      throw new HttpError(409, 'BID_TOO_LOW', `Bid amount must be at least ₹${minNext}`, {
        min_next_bid: minNext,
      });
    }

    // 4. Extension check (Rule E1)
    const ext = extendedClose(
      closesAt,
      t,
      config.rules.extensionWindowSeconds,
      config.rules.extensionSeconds
    );
    causedExtension = ext.causedExtension;
    const finalClosesAt = ext.closesAt;

    if (causedExtension) {
      await client.query(
        `UPDATE auctions
         SET closes_at = $1, extension_count = extension_count + 1
         WHERE id = $2`,
        [finalClosesAt, auctionId]
      );
    }

    // 5. Insert manual bid
    const { rows: bidRows } = await client.query(
      `INSERT INTO bids (auction_id, bidder_id, amount, source, placed_at, caused_extension)
       VALUES ($1, $2, $3, 'manual', $4, $5)
       RETURNING id, amount, source, placed_at, caused_extension`,
      [auctionId, bidderId, amount, t, causedExtension]
    );
    manualBidRow = bidRows[0];

    let currentPrice = amount;
    let currentLeader = bidderId;
    let newBidCount = auction.bid_count + 1;

    // 6. Check and resolve competing auto-bids (Rule A3–A6)
    const { rows: autoBidRows } = await client.query(
      `SELECT bidder_id, max_amount, priority_at
       FROM auto_bids
       WHERE auction_id = $1`,
      [auctionId]
    );

    const caps: AutoBidCap[] = autoBidRows.map((r) => ({
      bidderId: r.bidder_id,
      max: r.max_amount,
      priorityAt: new Date(r.priority_at),
    }));

    const autoResult = resolveAutoBids(
      {
        startingPrice: auction.starting_price,
        increment: auction.min_increment,
        currentPrice: amount,
        leaderId: bidderId,
      },
      caps
    );

    if (autoResult.plannedBids.length > 0) {
      for (const planned of autoResult.plannedBids) {
        await client.query(
          `INSERT INTO bids (auction_id, bidder_id, amount, source, placed_at, caused_extension)
           VALUES ($1, $2, $3, 'auto', $4, false)`,
          [auctionId, planned.bidderId, planned.amount, t]
        );
      }
      currentPrice = autoResult.finalPrice!;
      currentLeader = autoResult.finalLeaderId!;
      newBidCount += autoResult.plannedBids.length;
    }

    // Update auction summary state
    await client.query(
      `UPDATE auctions
       SET current_price = $1, leader_id = $2, bid_count = $3, updated_at = now()
       WHERE id = $4`,
      [currentPrice, currentLeader, newBidCount, auctionId]
    );

    // Audit event
    await client.query(
      `INSERT INTO auction_events (auction_id, type, actor_id, data)
       VALUES ($1, 'bid', $2, $3)`,
      [
        auctionId,
        bidderId,
        JSON.stringify({
          amount,
          final_price: currentPrice,
          final_leader_id: currentLeader,
          caused_extension: causedExtension,
        }),
      ]
    );

    if (causedExtension) {
      await client.query(
        `INSERT INTO auction_events (auction_id, type, actor_id, data)
         VALUES ($1, 'extended', $2, $3)`,
        [auctionId, bidderId, JSON.stringify({ new_closes_at: finalClosesAt })]
      );
    }

    // Notify seller of new bid
    await createNotification(
      auction.seller_id,
      'new_bid',
      `New bid on ${auction.title}: ₹${amount}`,
      `A new bid of ₹${amount} was placed. Current leading price is ₹${currentPrice}.`,
      auctionId,
      client
    );

    // Notify previous leader if outbid
    if (auction.leader_id && auction.leader_id !== currentLeader) {
      await createNotification(
        auction.leader_id,
        'outbid',
        `You were outbid on ${auction.title}!`,
        `The leading bid has increased to ₹${currentPrice}. Raise your bid to stay in front!`,
        auctionId,
        client
      );
    }
  });

  // Post-commit: fetch fresh detail and broadcast over SSE
  const freshDetail = await getAuctionDetail(auctionId);

  broadcastAuctionEvent(auctionId, 'bid', {
    bids: freshDetail.bids,
    current_price: freshDetail.current_price,
    leader_name: freshDetail.leader_name,
    bid_count: freshDetail.bid_count,
    closes_at: freshDetail.closes_at,
    extension_count: freshDetail.extension_count,
    min_next_bid: freshDetail.min_next_bid,
  });

  return {
    bid: {
      id: manualBidRow.id,
      amount: manualBidRow.amount,
      source: manualBidRow.source,
      placed_at: new Date(manualBidRow.placed_at).toISOString(),
      caused_extension: manualBidRow.caused_extension,
    },
    auction: freshDetail,
  };
}

export async function setAutoBid(
  auctionId: string,
  bidderId: string,
  maxAmount: number,
  via: 'user' | 'assistant' = 'user'
): Promise<SetAutoBidResult> {
  if (!Number.isInteger(maxAmount) || maxAmount <= 0) {
    throw new HttpError(400, 'VALIDATION', 'Auto-bid max amount must be a positive integer in rupees');
  }

  if (maxAmount > config.rules.maxBidAmount) {
    throw new HttpError(400, 'VALIDATION', `Auto-bid cannot exceed ₹${config.rules.maxBidAmount}`);
  }

  await withTx(async (client) => {
    // 1. Lock auction
    const { rows: auctionRows } = await client.query(
      'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
      [auctionId]
    );

    if (auctionRows.length === 0) {
      throw new HttpError(404, 'NOT_FOUND', 'Auction not found');
    }

    const auction = auctionRows[0];

    // 2. Read database clock
    const { rows: timeRows } = await client.query('SELECT clock_timestamp() AS t');
    const t: Date = timeRows[0].t;

    if (auction.status !== 'open') {
      throw new HttpError(409, 'INVALID_STATE', `Auction is not open (status: ${auction.status})`);
    }

    const closesAt = new Date(auction.closes_at);
    if (t.getTime() >= closesAt.getTime()) {
      throw new HttpError(409, 'AUCTION_CLOSED', 'This auction has already closed');
    }

    if (auction.seller_id === bidderId) {
      throw new HttpError(403, 'OWN_AUCTION', 'Sellers cannot bid on their own auction');
    }

    // Check existing auto-bid (Rule A2: raise-only!)
    const { rows: existingRows } = await client.query(
      'SELECT max_amount FROM auto_bids WHERE auction_id = $1 AND bidder_id = $2',
      [auctionId, bidderId]
    );

    if (existingRows.length > 0 && maxAmount <= existingRows[0].max_amount) {
      throw new HttpError(
        409,
        'AUTO_BID_LOWER',
        `Your maximum bid is already ₹${existingRows[0].max_amount}. Auto-bid maximums can only be raised, not lowered.`
      );
    }

    const minNext = nextMinBid(auction.starting_price, auction.current_price, auction.min_increment);
    if (maxAmount < minNext) {
      throw new HttpError(
        409,
        'AUTO_BID_TOO_LOW',
        `Maximum bid must be at least the next minimum bid of ₹${minNext}`,
        { min_next_bid: minNext }
      );
    }

    // Upsert auto-bid (priority reset on create or raise)
    await client.query(
      `INSERT INTO auto_bids (auction_id, bidder_id, max_amount, priority_at, via)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (auction_id, bidder_id)
       DO UPDATE SET max_amount = $3, priority_at = $4, via = $5`,
      [auctionId, bidderId, maxAmount, t, via]
    );

    // If bidder is NOT currently the leader: setting a maximum triggers immediate bidding
    if (auction.leader_id !== bidderId) {
      const { rows: allCapsRows } = await client.query(
        'SELECT bidder_id, max_amount, priority_at FROM auto_bids WHERE auction_id = $1',
        [auctionId]
      );

      const caps: AutoBidCap[] = allCapsRows.map((r) => ({
        bidderId: r.bidder_id,
        max: r.max_amount,
        priorityAt: new Date(r.priority_at),
      }));

      const autoResult = resolveAutoBids(
        {
          startingPrice: auction.starting_price,
          increment: auction.min_increment,
          currentPrice: auction.current_price,
          leaderId: auction.leader_id,
        },
        caps
      );

      if (autoResult.plannedBids.length > 0) {
        // Check extension for the triggering action
        const ext = extendedClose(
          closesAt,
          t,
          config.rules.extensionWindowSeconds,
          config.rules.extensionSeconds
        );
        let causedExtension = ext.causedExtension;

        if (causedExtension) {
          await client.query(
            `UPDATE auctions
             SET closes_at = $1, extension_count = extension_count + 1
             WHERE id = $2`,
            [ext.closesAt, auctionId]
          );
        }

        for (let i = 0; i < autoResult.plannedBids.length; i++) {
          const planned = autoResult.plannedBids[i];
          // First bid takes extension flag if caused
          const isTrigger = i === 0 && causedExtension;
          await client.query(
            `INSERT INTO bids (auction_id, bidder_id, amount, source, placed_at, caused_extension)
             VALUES ($1, $2, $3, 'auto', $4, $5)`,
            [auctionId, planned.bidderId, planned.amount, t, isTrigger]
          );
        }

        await client.query(
          `UPDATE auctions
           SET current_price = $1, leader_id = $2, bid_count = bid_count + $3, updated_at = now()
           WHERE id = $4`,
          [autoResult.finalPrice, autoResult.finalLeaderId, autoResult.plannedBids.length, auctionId]
        );
      }
    }

    // Audit event
    await client.query(
      `INSERT INTO auction_events (auction_id, type, actor_id, data)
       VALUES ($1, 'auto_bid_set', $2, $3)`,
      [auctionId, bidderId, JSON.stringify({ max_amount: maxAmount, via })]
    );
  });

  const freshDetail = await getAuctionDetail(auctionId);

  broadcastAuctionEvent(auctionId, 'bid', {
    bids: freshDetail.bids,
    auto_bids: freshDetail.auto_bids,
    current_price: freshDetail.current_price,
    leader_name: freshDetail.leader_name,
    bid_count: freshDetail.bid_count,
    closes_at: freshDetail.closes_at,
    extension_count: freshDetail.extension_count,
    min_next_bid: freshDetail.min_next_bid,
  });

  return {
    auto_bid: {
      max_amount: maxAmount,
      via,
    },
    auction: freshDetail,
  };
}
