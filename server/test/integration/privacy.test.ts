import { describe, it, expect, beforeEach } from 'vitest';
import { registerUser } from '../../src/services/authService.js';
import { createAuction, listAuctions, getAuctionDetail } from '../../src/services/auctionService.js';
import { placeBid } from '../../src/services/bidEngine.js';
import { closeDueAuctions, approveWinningBid, confirmHandover } from '../../src/services/saleService.js';
import { askQuestion, listQuestions } from '../../src/services/questionsService.js';
import { truncateAll } from './helpers.js';
import { pool } from '../../src/db/pool.js';

describe('Integration: Privacy Audit (I-11)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('I-11: no endpoint returns email, password_hash, or unauthorized contacts (Rules S2, Q1, AI5, I-11)', async () => {
    // 1. Register users with private contact and credentials
    const { user: sellerAlice } = await registerUser({
      name: 'Seller Alice',
      email: 'alice.private@campus.edu',
      password: 'SuperSecretPassword123!',
      contact: '+91-98765-11111',
    });

    const { user: buyerBob } = await registerUser({
      name: 'Buyer Bob',
      email: 'bob.private@campus.edu',
      password: 'SuperSecretPassword456!',
      contact: '+91-98765-22222',
    });

    const { user: observerCharlie } = await registerUser({
      name: 'Observer Charlie',
      email: 'charlie.private@campus.edu',
      password: 'SuperSecretPassword789!',
      contact: '+91-98765-33333',
    });

    // 2. Create auction
    const auction = await createAuction(
      sellerAlice.id,
      {
        title: 'Casio Scientific Calculator FX-991EX',
        category: 'calculator',
        starting_price: 500,
        min_increment: 50,
        condition: 'like_new',
        description: 'Hardly used engineering graphics calculator',
        closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      ['calc.jpg']
    );

    // Place a bid and ask a question
    await placeBid(auction.id, buyerBob.id, 500);
    await askQuestion(buyerBob.id, auction.id, 'Does it include the slide-on hard case?');

    // 3. Test Public Browse Listing (GET /api/auctions)
    const browseList = await listAuctions({});
    const browseJson = JSON.stringify(browseList);

    expect(browseJson).not.toContain('password');
    expect(browseJson).not.toContain('password_hash');
    expect(browseJson).not.toContain('alice.private@campus.edu');
    expect(browseJson).not.toContain('bob.private@campus.edu');
    expect(browseJson).not.toContain('+91-98765-11111');
    expect(browseJson).not.toContain('+91-98765-22222');

    // 4. Test Public Questions Thread (GET /api/auctions/:id/questions)
    const questions = await listQuestions(auction.id, null);
    const questionsJson = JSON.stringify(questions);

    expect(questionsJson).not.toContain('password');
    expect(questionsJson).not.toContain('bob.private@campus.edu');
    expect(questionsJson).not.toContain('+91-98765-22222');

    // 5. Test Auction Detail while OPEN (as guest, observer, seller, buyer)
    const guestDetail = await getAuctionDetail(auction.id, null);
    expect(guestDetail.counterparty_contact).toBeNull();

    const observerDetail = await getAuctionDetail(auction.id, observerCharlie.id);
    expect(observerDetail.counterparty_contact).toBeNull();

    const sellerDetailOpen = await getAuctionDetail(auction.id, sellerAlice.id);
    expect(sellerDetailOpen.counterparty_contact).toBeNull();

    const buyerDetailOpen = await getAuctionDetail(auction.id, buyerBob.id);
    expect(buyerDetailOpen.counterparty_contact).toBeNull();

    // 6. Transition to pending_approval (Rule S1)
    await pool.query(
      "UPDATE auctions SET closes_at = now() - interval '10 seconds', original_closes_at = now() - interval '10 seconds' WHERE id = $1",
      [auction.id]
    );
    await closeDueAuctions();

    const pendingDetail = await getAuctionDetail(auction.id, sellerAlice.id);
    expect(pendingDetail.status).toBe('pending_approval');
    // In pending_approval, contacts are STILL NOT disclosed (Rule S2 requires reserved status)
    expect(pendingDetail.counterparty_contact).toBeNull();

    // 7. Seller approves -> status = 'reserved' (Rule S2: contact disclosure active)
    await approveWinningBid(sellerAlice.id, auction.id);

    // Seller Alice can see winner Bob's contact
    const sellerDetailReserved = await getAuctionDetail(auction.id, sellerAlice.id);
    expect(sellerDetailReserved.counterparty_contact).toBe('+91-98765-22222');

    // Winner Bob can see seller Alice's contact
    const buyerDetailReserved = await getAuctionDetail(auction.id, buyerBob.id);
    expect(buyerDetailReserved.counterparty_contact).toBe('+91-98765-11111');

    // Observer Charlie NEVER sees contacts (Rule S2)
    const observerDetailReserved = await getAuctionDetail(auction.id, observerCharlie.id);
    expect(observerDetailReserved.counterparty_contact).toBeNull();

    // Guest NEVER sees contacts (Rule S2)
    const guestDetailReserved = await getAuctionDetail(auction.id, null);
    expect(guestDetailReserved.counterparty_contact).toBeNull();

    // 8. Both confirm handover -> status = 'sold'
    await confirmHandover(sellerAlice.id, auction.id);
    await confirmHandover(buyerBob.id, auction.id);

    // In sold state, counterparty contact is still accessible to parties for record
    const sellerDetailSold = await getAuctionDetail(auction.id, sellerAlice.id);
    expect(sellerDetailSold.status).toBe('sold');
    expect(sellerDetailSold.counterparty_contact).toBe('+91-98765-22222');

    // Third-party observer Charlie STILL cannot see contacts
    const observerDetailSold = await getAuctionDetail(auction.id, observerCharlie.id);
    expect(observerDetailSold.counterparty_contact).toBeNull();
  });
});
