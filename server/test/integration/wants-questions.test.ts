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

  it('I-10: Q&A anti-spam limits (duplicate, rate limit, url block) and pg_trgm similarity (Rules Q1–Q8)', async () => {
    const { user: seller } = await registerUser({
      name: 'Seller Alice',
      email: 'alice.qa@campus.edu',
      password: 'password123',
    });

    const { user: buyerBob } = await registerUser({
      name: 'Buyer Bob',
      email: 'bob.qa@campus.edu',
      password: 'password123',
    });

    const auction = await createAuction(
      seller.id,
      {
        title: 'Drafting Board and T-Scale Set',
        category: 'other',
        starting_price: 600,
        min_increment: 50,
        condition: 'good',
        description: 'Complete engineering graphics set for first year',
        closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      ['drafting.jpg']
    );

    const {
      askQuestion,
      findSimilarQuestions,
      answerQuestion,
      toggleFaq,
      hideQuestion,
      listQuestions,
    } = await import('../../src/services/questionsService.js');

    // 1. Rule Q1: Seller cannot ask on their own auction
    await expect(
      askQuestion(seller.id, auction.id, 'Can I ask myself a question?')
    ).rejects.toMatchObject({
      code: 'OWN_AUCTION',
      statusCode: 403,
    });

    // 2. Rule Q2: URL block
    await expect(
      askQuestion(buyerBob.id, auction.id, 'Check this link http://cheaperdeals.com for discount')
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      statusCode: 400,
    });
    await expect(
      askQuestion(buyerBob.id, auction.id, 'Visit www.mysite.com please')
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      statusCode: 400,
    });

    // 3. Valid question 1
    const q1 = await askQuestion(buyerBob.id, auction.id, 'Are clips and clamps included?');
    expect(q1.id).toBeDefined();
    expect(q1.is_faq).toBe(false);

    // Verify seller received question notification (Rule Q8)
    const sellerNotifs = await listNotifications(seller.id);
    expect(sellerNotifs.items).toHaveLength(1);
    expect(sellerNotifs.items[0].type).toBe('question');

    // 4. Rule Q4: Exact duplicate rejection
    await expect(
      askQuestion(buyerBob.id, auction.id, '   are clips and   clamps included?   ')
    ).rejects.toMatchObject({
      code: 'DUPLICATE_QUESTION',
      statusCode: 409,
    });

    // 5. Rule Q5: pg_trgm similarity search
    const similar = await findSimilarQuestions(auction.id, 'clips and clamps');
    expect(similar.length).toBeGreaterThanOrEqual(1);
    expect(similar[0].id).toBe(q1.id);

    // 6. Rule Q3: Limit <= 3 unanswered questions per user per auction
    const q2 = await askQuestion(buyerBob.id, auction.id, 'What is the board dimension?');
    const q3 = await askQuestion(buyerBob.id, auction.id, 'Is the T-scale wooden or acrylic?');

    // 4th unanswered question should be rate-limited
    await expect(
      askQuestion(buyerBob.id, auction.id, 'Can you deliver to Hostel 5?')
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      statusCode: 429,
    });

    // 7. Rule Q6, Q8: Seller answers a question
    const answeredQ1 = await answerQuestion(seller.id, q1.id, 'Yes, 4 metal board clips are included.');
    expect(answeredQ1.answer).toBe('Yes, 4 metal board clips are included.');
    expect(answeredQ1.answered_at).toBeDefined();

    // Verify buyer received answer notification (Rule Q8)
    const buyerNotifs = await listNotifications(buyerBob.id);
    expect(buyerNotifs.items.some((n) => n.type === 'answer')).toBe(true);

    // Now buyer has only 2 unanswered questions, so they can ask another question
    const q4 = await askQuestion(buyerBob.id, auction.id, 'Can you deliver to Hostel 5?');
    expect(q4.id).toBeDefined();

    // 8. Rule Q6: Seller toggles FAQ (pinned first)
    await toggleFaq(seller.id, q1.id, true);

    const publicQuestions = await listQuestions(auction.id, null);
    expect(publicQuestions[0].id).toBe(q1.id); // Pinned FAQ appears first!
    expect(publicQuestions[0].is_faq).toBe(true);

    // 9. Rule Q6: Seller hides a question
    await hideQuestion(seller.id, q2.id);

    // Public list excludes hidden question
    const publicListAfterHide = await listQuestions(auction.id, null);
    expect(publicListAfterHide.some((q) => q.id === q2.id)).toBe(false);

    // Seller list includes hidden question
    const sellerList = await listQuestions(auction.id, seller.id);
    expect(sellerList.some((q) => q.id === q2.id)).toBe(true);
  });
});
