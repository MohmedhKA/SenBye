import { describe, it, expect, beforeEach } from 'vitest';
import { registerUser } from '../../src/services/authService.js';
import { createAuction, getAuctionDetail } from '../../src/services/auctionService.js';
import { placeBid, setAutoBid } from '../../src/services/bidEngine.js';
import { pool } from '../../src/db/pool.js';
import { truncateAll } from './helpers.js';

describe('Integration: Bidding Engine (I-01, I-02, I-03, I-08)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('I-01: 20 parallel identical bids -> exactly one succeeds, 19 rejected', async () => {
    const { user: seller } = await registerUser({
      name: 'Seller Sam',
      email: 'seller@campus.edu',
      password: 'password123',
    });

    const closesAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const auction = await createAuction(
      seller.id,
      {
        title: 'Casio 991CW Calculator',
        category: 'calculator',
        starting_price: 500,
        min_increment: 50,
        condition: 'like_new',
        closes_at: closesAt,
      },
      ['calc.jpg']
    );

    // Register 20 unique buyers
    const buyers = await Promise.all(
      Array.from({ length: 20 }).map((_, i) =>
        registerUser({
          name: `Buyer ${i}`,
          email: `buyer${i}@campus.edu`,
          password: 'password123',
        })
      )
    );

    // Concurrently try placing the identical minimum bid of ₹500
    const results = await Promise.allSettled(
      buyers.map((b) => placeBid(auction.id, b.user.id, 500))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    // Exactly 1 must succeed because of row-level lock and UNIQUE (auction_id, amount)
    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(19);

    const fresh = await getAuctionDetail(auction.id);
    expect(fresh.current_price).toBe(500);
    expect(fresh.bid_count).toBe(1);
  });

  it('I-02: rejected bid codes (below min, first below start, seller, leader)', async () => {
    const { user: seller } = await registerUser({
      name: 'Seller Sara',
      email: 'sara@campus.edu',
      password: 'password123',
    });

    const { user: buyerA } = await registerUser({
      name: 'Buyer Alice',
      email: 'alice.b@campus.edu',
      password: 'password123',
    });

    const closesAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const auction = await createAuction(
      seller.id,
      {
        title: 'Engineering Mechanics Book',
        category: 'books',
        starting_price: 400,
        min_increment: 50,
        condition: 'good',
        closes_at: closesAt,
      },
      ['book.jpg']
    );

    // First bid below starting price (400) -> BID_TOO_LOW
    await expect(placeBid(auction.id, buyerA.id, 350)).rejects.toMatchObject({
      code: 'BID_TOO_LOW',
    });

    // Seller cannot bid on own auction -> OWN_AUCTION
    await expect(placeBid(auction.id, seller.id, 400)).rejects.toMatchObject({
      code: 'OWN_AUCTION',
    });

    // Valid first bid
    await placeBid(auction.id, buyerA.id, 400);

    // Current leader cannot place a second manual bid -> ALREADY_LEADING
    await expect(placeBid(auction.id, buyerA.id, 450)).rejects.toMatchObject({
      code: 'ALREADY_LEADING',
    });

    // Subsequent bid below current (400) + increment (50) -> BID_TOO_LOW
    const { user: buyerB } = await registerUser({
      name: 'Buyer Bob',
      email: 'bob.b@campus.edu',
      password: 'password123',
    });

    await expect(placeBid(auction.id, buyerB.id, 420)).rejects.toMatchObject({
      code: 'BID_TOO_LOW',
    });
  });

  it('I-03: extension at 30s boundary extends closes_at and increments count (Rule E1)', async () => {
    const { user: seller } = await registerUser({
      name: 'Seller Dave',
      email: 'dave@campus.edu',
      password: 'password123',
    });

    const { user: buyer } = await registerUser({
      name: 'Buyer Eve',
      email: 'eve@campus.edu',
      password: 'password123',
    });

    // Create auction with valid duration (>10 min), then simulate final 20s
    const auction = await createAuction(
      seller.id,
      {
        title: 'Study Table Lamp',
        category: 'electronics',
        starting_price: 200,
        min_increment: 20,
        condition: 'like_new',
        closes_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      ['lamp.jpg']
    );

    await pool.query(
      `UPDATE auctions SET closes_at = NOW() + interval '20 seconds', original_closes_at = NOW() + interval '20 seconds' WHERE id = $1`,
      [auction.id]
    );

    // Place bid in the final 20 seconds
    const result = await placeBid(auction.id, buyer.id, 200);

    expect(result.bid.caused_extension).toBe(true);
    expect(result.auction.extension_count).toBe(1);

    // New closing time should be roughly 60s in the future
    const newClosesAtMs = new Date(result.auction.closes_at).getTime();
    expect(newClosesAtMs).toBeGreaterThan(Date.now() + 50 * 1000);
  });

  it('I-08: auto-bid end to end (competing proxy bids keep minimum price)', async () => {
    const { user: seller } = await registerUser({
      name: 'Seller Frank',
      email: 'frank@campus.edu',
      password: 'password123',
    });

    const { user: buyerA } = await registerUser({
      name: 'Buyer Anna',
      email: 'anna@campus.edu',
      password: 'password123',
    });

    const { user: buyerB } = await registerUser({
      name: 'Buyer Ben',
      email: 'ben@campus.edu',
      password: 'password123',
    });

    // Start 1000, increment 50
    const auction = await createAuction(
      seller.id,
      {
        title: 'Btwin Cycle 7-Speed',
        category: 'cycle',
        starting_price: 1000,
        min_increment: 50,
        condition: 'good',
        closes_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      },
      ['btwin.jpg']
    );

    // Buyer A sets auto-bid max 1800 -> leads at 1000 (Case 1)
    const resA = await setAutoBid(auction.id, buyerA.id, 1800);
    expect(resA.auction.current_price).toBe(1000);
    expect(resA.auction.leader_name).toBe('Buyer Anna');

    // Buyer B sets auto-bid max 1500 -> Anna outbids Ben at 1550!
    const resB = await setAutoBid(auction.id, buyerB.id, 1500);
    expect(resB.auction.current_price).toBe(1550);
    expect(resB.auction.leader_name).toBe('Buyer Anna');

    // Buyer B raises auto-bid to 1900 -> Ben now leads at 1850!
    const resB2 = await setAutoBid(auction.id, buyerB.id, 1900);
    expect(resB2.auction.current_price).toBe(1850);
    expect(resB2.auction.leader_name).toBe('Buyer Ben');

    // Auto-bid maximum cannot be lowered (Rule A2)
    await expect(setAutoBid(auction.id, buyerB.id, 1700)).rejects.toMatchObject({
      code: 'AUTO_BID_LOWER',
    });
  });
});
