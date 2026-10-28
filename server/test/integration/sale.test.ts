import { describe, it, expect, beforeEach } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { registerUser } from '../../src/services/authService.js';
import { createAuction, getAuctionDetail } from '../../src/services/auctionService.js';
import { placeBid } from '../../src/services/bidEngine.js';
import {
  closeDueAuctions,
  approveWinningBid,
  rejectWinningBid,
  confirmHandover,
  reportFailedPickup,
  expirePickupDeadlines,
} from '../../src/services/saleService.js';
import { truncateAll } from './helpers.js';

describe('Integration: Sale Lifecycle (I-04, I-05, I-06, I-07)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('I-04: closer closes due auctions with winner or unsold', async () => {
    const { user: seller } = await registerUser({
      name: 'Seller Alice',
      email: 'alice@campus.edu',
      password: 'password123',
    });

    const { user: buyer } = await registerUser({
      name: 'Buyer Bob',
      email: 'bob@campus.edu',
      password: 'password123',
    });

    // Auction 1: will have a bid
    const auctionWithBid = await createAuction(
      seller.id,
      {
        title: 'Casio FX-991EX',
        category: 'calculator',
        starting_price: 500,
        min_increment: 50,
        condition: 'like_new',
        closes_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      ['calc.jpg']
    );

    await placeBid(auctionWithBid.id, buyer.id, 500);

    // Auction 2: will have NO bids
    const auctionNoBids = await createAuction(
      seller.id,
      {
        title: 'Old Engineering Drawing Kit',
        category: 'other',
        starting_price: 300,
        min_increment: 30,
        condition: 'fair',
        closes_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      ['kit.jpg']
    );

    // Simulate both auctions reaching and passing closing time
    await pool.query(
      `UPDATE auctions
       SET closes_at = NOW() - interval '5 seconds',
           original_closes_at = NOW() - interval '5 seconds'
       WHERE id IN ($1, $2)`,
      [auctionWithBid.id, auctionNoBids.id]
    );

    const closed = await closeDueAuctions();
    expect(closed.length).toBe(2);

    const detailWithBid = await getAuctionDetail(auctionWithBid.id);
    expect(detailWithBid.status).toBe('pending_approval');
    expect(detailWithBid.winner?.id).toBe(buyer.id);
    expect(detailWithBid.current_price).toBe(500);
    expect(detailWithBid.closed_at).toBeDefined();

    const detailNoBids = await getAuctionDetail(auctionNoBids.id);
    expect(detailNoBids.status).toBe('unsold');
    expect(detailNoBids.winner).toBeNull();
    expect(detailNoBids.outcome_reason).toBe('no_bids');
    expect(detailNoBids.closed_at).toBeDefined();
  });

  it('I-05: approve -> reserved, contact disclosure, both handovers -> sold', async () => {
    const { user: seller } = await registerUser({
      name: 'Seller Carol',
      email: 'carol@campus.edu',
      password: 'password123',
      contact: 'Hostel 4, Room 210 (+91 9876543210)',
    });

    const { user: buyer } = await registerUser({
      name: 'Buyer Dan',
      email: 'dan@campus.edu',
      password: 'password123',
      contact: 'Hostel 1, Room 105 (+91 9123456789)',
    });

    const { user: stranger } = await registerUser({
      name: 'Stranger Eve',
      email: 'eve@campus.edu',
      password: 'password123',
    });

    const auction = await createAuction(
      seller.id,
      {
        title: 'Hercules Road Cycle',
        category: 'cycle',
        starting_price: 2000,
        min_increment: 100,
        condition: 'good',
        closes_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      ['cycle.jpg']
    );

    await placeBid(auction.id, buyer.id, 2000);

    // Close auction
    await pool.query(
      `UPDATE auctions SET closes_at = NOW() - interval '1 second', original_closes_at = NOW() - interval '1 second' WHERE id = $1`,
      [auction.id]
    );
    await closeDueAuctions();

    // 1. Non-seller cannot approve (403 FORBIDDEN)
    await expect(approveWinningBid(buyer.id, auction.id)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    // 2. Seller approves -> status transitions to 'reserved' (Rule S1)
    const approved = await approveWinningBid(seller.id, auction.id);
    expect(approved.status).toBe('reserved');
    expect(approved.pickup_deadline).toBeDefined();

    // 3. Contact disclosure (Rule S2):
    // Stranger cannot see contact
    const strangerView = await getAuctionDetail(auction.id, stranger.id);
    expect(strangerView.counterparty_contact).toBeNull();

    // Seller sees buyer contact
    const sellerView = await getAuctionDetail(auction.id, seller.id);
    expect(sellerView.counterparty_contact).toBe(buyer.contact);

    // Buyer sees seller contact
    const buyerView = await getAuctionDetail(auction.id, buyer.id);
    expect(buyerView.counterparty_contact).toBe(seller.contact);

    // 4. Dual Handover Confirmation (Rule S4):
    // First: buyer confirms handover
    const buyerConfirmed = await confirmHandover(buyer.id, auction.id);
    expect(buyerConfirmed.status).toBe('reserved'); // Still reserved until both confirm!
    expect(buyerConfirmed.buyer_handover_at).toBeDefined();
    expect(buyerConfirmed.seller_handover_at).toBeNull();

    // Second: seller confirms handover -> automatically completes to 'sold'!
    const fullySold = await confirmHandover(seller.id, auction.id);
    expect(fullySold.status).toBe('sold');
    expect(fullySold.seller_handover_at).toBeDefined();
    expect(fullySold.buyer_handover_at).toBeDefined();
  });

  it('I-06: reject / cancel / failed pickup outcome records', async () => {
    const { user: seller } = await registerUser({
      name: 'Seller Frank',
      email: 'frank@campus.edu',
      password: 'password123',
    });

    const { user: buyer } = await registerUser({
      name: 'Buyer Grace',
      email: 'grace@campus.edu',
      password: 'password123',
    });

    // Subtest A: Rejection with reason
    const auctionA = await createAuction(
      seller.id,
      {
        title: 'Mattress & Pillow',
        category: 'furniture',
        starting_price: 400,
        min_increment: 50,
        condition: 'good',
        closes_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      ['bed.jpg']
    );

    await placeBid(auctionA.id, buyer.id, 400);
    await pool.query(
      `UPDATE auctions SET closes_at = NOW() - interval '1 second', original_closes_at = NOW() - interval '1 second' WHERE id = $1`,
      [auctionA.id]
    );
    await closeDueAuctions();

    // Rejection without valid reason fails (400 VALIDATION)
    await expect(rejectWinningBid(seller.id, auctionA.id, ' ')).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION',
    });

    const rejected = await rejectWinningBid(
      seller.id,
      auctionA.id,
      'Item was damaged during hostel shifting'
    );
    expect(rejected.status).toBe('rejected');
    expect(rejected.outcome_reason).toBe('Item was damaged during hostel shifting');

    // Subtest B: Failed pickup reported by participant
    const auctionB = await createAuction(
      seller.id,
      {
        title: 'Desk Study Lamp',
        category: 'electronics',
        starting_price: 250,
        min_increment: 25,
        condition: 'like_new',
        closes_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      ['lamp.jpg']
    );

    await placeBid(auctionB.id, buyer.id, 250);
    await pool.query(
      `UPDATE auctions SET closes_at = NOW() - interval '1 second', original_closes_at = NOW() - interval '1 second' WHERE id = $1`,
      [auctionB.id]
    );
    await closeDueAuctions();
    await approveWinningBid(seller.id, auctionB.id);

    const failed = await reportFailedPickup(
      buyer.id,
      auctionB.id,
      'Seller did not appear at security gate'
    );
    expect(failed.status).toBe('failed_pickup');
    expect(failed.outcome_reason).toBe('Seller did not appear at security gate');
  });

  it('I-07: pickup-deadline expiry -> failed_pickup', async () => {
    const { user: seller } = await registerUser({
      name: 'Seller Henry',
      email: 'henry@campus.edu',
      password: 'password123',
    });

    const { user: buyer } = await registerUser({
      name: 'Buyer Isabel',
      email: 'isabel@campus.edu',
      password: 'password123',
    });

    const auction = await createAuction(
      seller.id,
      {
        title: 'Mini Kettle',
        category: 'electronics',
        starting_price: 300,
        min_increment: 30,
        condition: 'like_new',
        closes_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      ['kettle.jpg']
    );

    await placeBid(auction.id, buyer.id, 300);
    await pool.query(
      `UPDATE auctions SET closes_at = NOW() - interval '1 second', original_closes_at = NOW() - interval '1 second' WHERE id = $1`,
      [auction.id]
    );
    await closeDueAuctions();
    await approveWinningBid(seller.id, auction.id);

    // Fast-forward pickup deadline to 10 seconds in the past
    await pool.query(
      `UPDATE auctions
       SET pickup_deadline = NOW() - interval '10 seconds'
       WHERE id = $1`,
      [auction.id]
    );

    const expiredCount = await expirePickupDeadlines();
    expect(expiredCount).toBe(1);

    const detail = await getAuctionDetail(auction.id);
    expect(detail.status).toBe('failed_pickup');
    expect(detail.outcome_reason).toBe('Pickup deadline expired');
  });
});
