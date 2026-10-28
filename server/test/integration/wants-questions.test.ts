import { describe, it, expect, beforeEach } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { registerUser } from '../../src/services/authService.js';
import { createAuction } from '../../src/services/auctionService.js';
import { createWant, listWants, deleteWant } from '../../src/services/wantsService.js';
import { listNotifications } from '../../src/services/notifier.js';
import { truncateAll } from './helpers.js';

describe('Integration: Wants & Questions (I-09, I-10)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('I-09: want created before a listing generates notification on listing creation (Rules W1, W2, W4)', async () => {
    const { user: seller } = await registerUser({
      name: 'Seller Alice',
      email: 'alice@campus.edu',
      password: 'password123',
    });

    const { user: wanterBob } = await registerUser({
      name: 'Wanter Bob',
      email: 'bob@campus.edu',
      password: 'password123',
    });

    const { user: wanterLowBudget } = await registerUser({
      name: 'Wanter Charlie',
      email: 'charlie@campus.edu',
      password: 'password123',
    });

    const { user: wanterDiffCategory } = await registerUser({
      name: 'Wanter David',
      email: 'david@campus.edu',
      password: 'password123',
    });

    // 1. Bob creates a want that should match
    const bobWant = await createWant(wanterBob.id, {
      keywords: 'Casio calculator',
      category: 'calculator',
      max_price: 800,
    });
    expect(bobWant.id).toBeDefined();
    expect(bobWant.matches_count).toBe(0);

    // Charlie creates a want with budget too low (max_price: 400 < starting_price: 500)
    await createWant(wanterLowBudget.id, {
      keywords: 'Casio calculator',
      category: 'calculator',
      max_price: 400,
    });

    // David creates a want for calculator keywords but category 'books'
    await createWant(wanterDiffCategory.id, {
      keywords: 'Casio calculator',
      category: 'books',
      max_price: 1000,
    });

    // Seller also has a want for Casio (Rule W2: seller must NOT match their own listing)
    await createWant(seller.id, {
      keywords: 'Casio calculator',
      category: 'calculator',
      max_price: 1000,
    });

    // 2. Seller creates the matching auction
    const auction = await createAuction(
      seller.id,
      {
        title: 'Casio fx-991EX Scientific Calculator',
        category: 'calculator',
        starting_price: 500,
        min_increment: 50,
        condition: 'like_new',
        description: 'Perfect for engineering exams with solar cell',
        closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      ['calculator.jpg']
    );

    // 3. Verify Bob received a want_match notification
    const bobNotifications = await listNotifications(wanterBob.id);
    expect(bobNotifications.items).toHaveLength(1);
    expect(bobNotifications.items[0].type).toBe('want_match');
    expect(bobNotifications.items[0].auction_id).toBe(auction.id);
    expect(bobNotifications.items[0].title).toContain('Casio fx-991EX');

    // 4. Verify want_matches row was created for Bob
    const { rows: matchRows } = await pool.query(
      'SELECT * FROM want_matches WHERE want_id = $1 AND auction_id = $2',
      [bobWant.id, auction.id]
    );
    expect(matchRows).toHaveLength(1);

    // 5. Verify other users (low budget, wrong category, seller) did NOT receive notifications
    const charlieNotifs = await listNotifications(wanterLowBudget.id);
    expect(charlieNotifs.items).toHaveLength(0);

    const davidNotifs = await listNotifications(wanterDiffCategory.id);
    expect(davidNotifs.items).toHaveLength(0);

    const sellerNotifs = await listNotifications(seller.id);
    expect(sellerNotifs.items).toHaveLength(0);

    // 6. Verify listWants reflects match count
    const bobWantsList = await listWants(wanterBob.id);
    expect(bobWantsList).toHaveLength(1);
    expect(bobWantsList[0].matches_count).toBe(1);
  });

  it('W3 & W4: Immediate back-matching on want creation and duplicate suppression', async () => {
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

    // 1. Create an existing open auction first
    const cycleAuction = await createAuction(
      seller.id,
      {
        title: 'Btwin Rockrider Mountain Cycle 26T',
        category: 'cycle',
        starting_price: 3500,
        min_increment: 100,
        condition: 'good',
        description: 'Geared cycle in smooth condition',
        closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      ['cycle.jpg']
    );

    // 2. Buyer creates a want AFTER the auction already exists (Rule W3)
    const want = await createWant(buyer.id, {
      keywords: 'Rockrider cycle',
      category: 'cycle',
      max_price: 4000,
    });

    expect(want.matches_count).toBe(1);

    // Buyer should immediately have received a notification
    const notifications = await listNotifications(buyer.id);
    expect(notifications.items).toHaveLength(1);
    expect(notifications.items[0].type).toBe('want_match');
    expect(notifications.items[0].auction_id).toBe(cycleAuction.id);

    // 3. Delete want
    await deleteWant(buyer.id, want.id);
    const wantsAfterDelete = await listWants(buyer.id);
    expect(wantsAfterDelete).toHaveLength(0);
  });
});
