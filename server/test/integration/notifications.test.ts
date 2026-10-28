import { describe, it, expect, beforeEach } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { registerUser } from '../../src/services/authService.js';
import { createAuction } from '../../src/services/auctionService.js';
import { placeBid } from '../../src/services/bidEngine.js';
import {
  closeDueAuctions,
  approveWinningBid,
  confirmHandover,
} from '../../src/services/saleService.js';
import {
  listNotifications,
  markNotificationsRead,
} from '../../src/services/notifier.js';
import { truncateAll } from './helpers.js';

describe('Integration: Notifications Feed & Lifecycle Triggers (Milestone M4)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('generates new_bid and outbid notifications on bidding', async () => {
    const { user: seller } = await registerUser({
      name: 'Seller Maya',
      email: 'maya@campus.edu',
      password: 'password123',
    });

    const { user: buyerA } = await registerUser({
      name: 'Buyer Aryan',
      email: 'aryan@campus.edu',
      password: 'password123',
    });

    const { user: buyerB } = await registerUser({
      name: 'Buyer Bhavya',
      email: 'bhavya@campus.edu',
      password: 'password123',
    });

    const auction = await createAuction(
      seller.id,
      {
        title: 'Sony Noise Cancelling Headphones',
        category: 'electronics',
        starting_price: 1500,
        min_increment: 100,
        condition: 'like_new',
        closes_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      ['headphones.jpg']
    );

    // 1. Buyer A places initial bid
    await placeBid(auction.id, buyerA.id, 1500);

    // Seller receives 'new_bid'
    const sellerFeed = await listNotifications(seller.id);
    expect(sellerFeed.unread_count).toBe(1);
    expect(sellerFeed.items[0].type).toBe('new_bid');
    expect(sellerFeed.items[0].title).toContain('New bid');

    // 2. Buyer B outbids Buyer A
    await placeBid(auction.id, buyerB.id, 1600);

    // Buyer A receives 'outbid' notification (Rule N1)
    const buyerAFeed = await listNotifications(buyerA.id);
    expect(buyerAFeed.unread_count).toBe(1);
    expect(buyerAFeed.items[0].type).toBe('outbid');
    expect(buyerAFeed.items[0].title).toContain('outbid');

    // 3. Mark notification as read
    const notifId = buyerAFeed.items[0].id;
    const marked = await markNotificationsRead(buyerA.id, [notifId]);
    expect(marked).toBe(1);

    const buyerAFeedAfter = await listNotifications(buyerA.id);
    expect(buyerAFeedAfter.unread_count).toBe(0);
    expect(buyerAFeedAfter.items[0].read_at).toBeDefined();
  });

  it('triggers won_pending, approved, and sold notifications across sale lifecycle', async () => {
    const { user: seller } = await registerUser({
      name: 'Seller Karan',
      email: 'karan@campus.edu',
      password: 'password123',
    });

    const { user: buyer } = await registerUser({
      name: 'Buyer Leela',
      email: 'leela@campus.edu',
      password: 'password123',
    });

    const auction = await createAuction(
      seller.id,
      {
        title: 'Lab Stethoscope',
        category: 'other',
        starting_price: 800,
        min_increment: 50,
        condition: 'good',
        closes_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      ['steth.jpg']
    );

    await placeBid(auction.id, buyer.id, 800);

    // Simulate closing
    await pool.query(
      `UPDATE auctions SET closes_at = NOW() - interval '1 second', original_closes_at = NOW() - interval '1 second' WHERE id = $1`,
      [auction.id]
    );
    await closeDueAuctions();

    // Buyer gets 'won_pending'
    const buyerFeedAfterClose = await listNotifications(buyer.id);
    const wonNotif = buyerFeedAfterClose.items.find((n) => n.type === 'won_pending');
    expect(wonNotif).toBeDefined();

    // Seller gets 'closed'
    const sellerFeedAfterClose = await listNotifications(seller.id);
    const closedNotif = sellerFeedAfterClose.items.find((n) => n.type === 'closed');
    expect(closedNotif).toBeDefined();

    // Seller approves sale -> buyer gets 'approved'
    await approveWinningBid(seller.id, auction.id);
    const buyerFeedAfterApprove = await listNotifications(buyer.id);
    const approvedNotif = buyerFeedAfterApprove.items.find((n) => n.type === 'approved');
    expect(approvedNotif).toBeDefined();

    // Both confirm handover -> both get 'sold'
    await confirmHandover(buyer.id, auction.id);
    await confirmHandover(seller.id, auction.id);

    const buyerFinalFeed = await listNotifications(buyer.id);
    expect(buyerFinalFeed.items.some((n) => n.type === 'sold')).toBe(true);

    const sellerFinalFeed = await listNotifications(seller.id);
    expect(sellerFinalFeed.items.some((n) => n.type === 'sold')).toBe(true);
  });
});
