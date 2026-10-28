import { describe, it, expect, beforeEach } from 'vitest';
import { registerUser, loginUser } from '../../src/services/authService.js';
import {
  createAuction,
  editAuction,
  cancelAuction,
  listAuctions,
  getAuctionDetail,
} from '../../src/services/auctionService.js';
import { truncateAll } from './helpers.js';

describe('Auth & Auctions Backend Services (Milestone M1.1)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('registers and authenticates a user', async () => {
    const { user, token } = await registerUser({
      name: 'Alice Senior',
      email: 'alice@campus.edu',
      password: 'password123',
      contact: 'Hostel A-101',
    });

    expect(user.name).toBe('Alice Senior');
    expect(user.email).toBe('alice@campus.edu');
    expect(token).toBeDefined();

    // Duplicate email rejected with 409 EMAIL_TAKEN
    await expect(
      registerUser({
        name: 'Alice Imposter',
        email: 'alice@campus.edu',
        password: 'anotherpassword',
      })
    ).rejects.toThrow('An account with this email already exists');

    // Login succeeds
    const logged = await loginUser({
      email: 'alice@campus.edu',
      password: 'password123',
    });
    expect(logged.user.id).toBe(user.id);
  });

  it('creates, edits, lists, and cancels auctions with privacy guarantees', async () => {
    const { user: seller } = await registerUser({
      name: 'Senior Bob',
      email: 'bob@campus.edu',
      password: 'password123',
    });

    const closesAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours from now

    // 1. Create auction
    const created = await createAuction(
      seller.id,
      {
        title: 'Hero Sprint Cycle 21 Speed',
        category: 'cycle',
        description: 'Used for 2 semesters, perfect brakes',
        condition: 'good',
        starting_price: 1500,
        min_increment: 50,
        closes_at: closesAt,
        faqs: [{ question: 'Are gears smooth?', answer: 'Yes, recently tuned.' }],
      },
      ['cycle_photo1.jpg', 'cycle_photo2.jpg']
    );

    expect(created.id).toBeDefined();
    expect(created.title).toBe('Hero Sprint Cycle 21 Speed');
    expect(created.starting_price).toBe(1500);
    expect(created.min_next_bid).toBe(1500);
    expect(created.photos.length).toBe(2);
    expect(created.seller.name).toBe('Senior Bob');

    // PRIVACY VERIFICATION: password_hash, email, and private contact must NOT be leaked
    const detailJson = JSON.stringify(created);
    expect(detailJson).not.toContain('password_hash');
    expect(detailJson).not.toContain('bob@campus.edu');

    // 2. List auctions
    const listResult = await listAuctions({ category: 'cycle' });
    expect(listResult.total).toBe(1);
    expect(listResult.items[0].title).toBe('Hero Sprint Cycle 21 Speed');

    // 3. Edit auction before bids
    const edited = await editAuction(seller.id, created.id, {
      description: 'Used for 2 semesters, perfect brakes, free lock included',
    });
    expect(edited.description).toContain('free lock included');

    // 4. Cancel auction
    const cancelled = await cancelAuction(seller.id, created.id, 'Selling to roommate directly');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.outcome_reason).toBe('Selling to roommate directly');
  });
});
