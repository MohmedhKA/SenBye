import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { registerUser } from '../services/authService.js';
import { createAuction } from '../services/auctionService.js';
import { placeBid, setAutoBid } from '../services/bidEngine.js';
import { approveWinningBid, confirmHandover } from '../services/saleService.js';
import { askQuestion, answerQuestion, toggleFaq } from '../services/questionsService.js';
import { createWant } from '../services/wantsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');

// Minimal valid 1x1 JPEG buffer for seed image placeholders
const PLACEHOLDER_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

function ensureSeedPhotos(filenames: string[]) {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  for (const name of filenames) {
    const fullPath = path.join(uploadsDir, name);
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, PLACEHOLDER_JPEG);
    }
  }
}

export async function runSeed() {
  console.log('🌱 Starting SenBye campus auction database seed...');

  // 1. Truncate existing tables
  await pool.query(`
    TRUNCATE users, auctions, auction_photos, bids, auto_bids,
             auction_events, notifications, wants, want_matches,
             questions, assistant_messages, assistant_proposals
    CASCADE;
  `);

  // 2. Ensure photo assets exist on disk in uploads/
  const seedPhotoFiles = [
    'rockrider-cycle-1.jpg',
    'rockrider-cycle-2.jpg',
    'casio-classwiz-1.jpg',
    'casio-classwiz-2.jpg',
    'gate-textbooks.jpg',
    'study-chair.jpg',
    'mini-drafter.jpg',
    'lab-coat.jpg',
    'desk-lamp.jpg',
    'casio-82ms.jpg',
    'shoe-rack.jpg',
    'electric-kettle.jpg',
    'networks-book.jpg',
    'hercules-cycle.jpg',
  ];
  ensureSeedPhotos(seedPhotoFiles);

  // 3. Register 3 demo students
  console.log('👤 Registering 3 demo campus users...');
  const { user: arun } = await registerUser({
    name: 'Arun Senior (Graduating B.Tech)',
    email: 'arun@campus.edu',
    password: 'password123',
    contact: '+91-98765-11111',
  });

  const { user: priya } = await registerUser({
    name: 'Priya Junior (3rd Year CSE)',
    email: 'priya@campus.edu',
    password: 'password123',
    contact: '+91-98765-22222',
  });

  const { user: rahul } = await registerUser({
    name: 'Rahul Sophomore (2nd Year ECE)',
    email: 'rahul@campus.edu',
    password: 'password123',
    contact: '+91-98765-33333',
  });

  console.log('   ✓ Arun Senior (arun@campus.edu) - Password: password123');
  console.log('   ✓ Priya Junior (priya@campus.edu) - Password: password123');
  console.log('   ✓ Rahul Sophomore (rahul@campus.edu) - Password: password123');

  // 4. Create ~12 realistic auctions across all campus categories
  console.log('📦 Creating realistic campus auctions across all categories...');

  // --- Auction 1: Anti-Sniping & Extension Demo (Closes in ~2 minutes) ---
  const auc1 = await createAuction(
    arun.id,
    {
      title: 'Btwin Rockrider 26T MTB Mountain Cycle (21-Speed Gears)',
      category: 'cycle',
      condition: 'good',
      starting_price: 2000,
      min_increment: 50,
      description: 'Used for campus commutes between hostels and lecture halls. Smooth front suspension, Shimano gears, and brand new brake wires. Bid in the last 30 seconds to watch anti-sniping extend the timer by 60s!',
      closes_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      faqs: [
        {
          question: 'Is the saddle height adjustable?',
          answer: 'Yes, it has a quick-release clamp fitting heights between 5ft 2in and 6ft 1in.',
        },
      ],
    },
    ['rockrider-cycle-1.jpg', 'rockrider-cycle-2.jpg']
  );
  await placeBid(auc1.id, priya.id, 2000);
  await placeBid(auc1.id, rahul.id, 2050);

  // Set closing time to ~2 minutes from now for live demo extension testing (Rule E1)
  await pool.query(
    "UPDATE auctions SET closes_at = now() + interval '120 seconds', original_closes_at = now() + interval '120 seconds' WHERE id = $1",
    [auc1.id]
  );
  await askQuestion(priya.id, auc1.id, 'Are the tires punctured or leaking air?');
  const qList1 = await pool.query('SELECT id FROM questions WHERE auction_id = $1 ORDER BY id DESC LIMIT 1', [auc1.id]);
  if (qList1.rows[0]) {
    await answerQuestion(arun.id, qList1.rows[0].id, 'Both tubes were replaced last month; holds air perfectly.');
  }

  // --- Auction 2: Auto-Bid War & Public Maxima (ClassWiz) ---
  const auc2 = await createAuction(
    arun.id,
    {
      title: 'Casio fx-991EX ClassWiz Solar Scientific Calculator',
      category: 'calculator',
      condition: 'like_new',
      starting_price: 400,
      min_increment: 25,
      description: 'Genuine Casio ClassWiz with high-res LCD and natural textbook display. Approved for all semester end and competitive university exams. Both students entered auto-bid caps!',
      closes_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    ['casio-classwiz-1.jpg', 'casio-classwiz-2.jpg']
  );
  // Priya sets auto-bid 700; Rahul sets auto-bid 600
  await setAutoBid(auc2.id, priya.id, 700, 'user');
  await setAutoBid(auc2.id, rahul.id, 600, 'user');
  await askQuestion(rahul.id, auc2.id, 'Does the solar panel work under hostel LED tube light?');
  const qList2 = await pool.query('SELECT id FROM questions WHERE auction_id = $1 ORDER BY id DESC LIMIT 1', [auc2.id]);
  if (qList2.rows[0]) {
    await answerQuestion(arun.id, qList2.rows[0].id, 'Yes, solar works under indoor lights without battery drain.');
  }

  // --- Auction 3: Pending Seller Approval Demo (Textbooks) ---
  const auc3 = await createAuction(
    arun.id,
    {
      title: 'GATE CSE Standard Textbook Bundle (CLRS, Tanenbaum, Galvin)',
      category: 'books',
      condition: 'good',
      starting_price: 800,
      min_increment: 50,
      description: 'Complete core computer science trio: Algorithms (Cormen), Computer Networks (Tanenbaum), and Operating Systems Concepts (Galvin). No torn pages.',
      closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    ['gate-textbooks.jpg']
  );
  await placeBid(auc3.id, priya.id, 800);
  await placeBid(auc3.id, rahul.id, 850);
  await placeBid(auc3.id, priya.id, 900);
  // Age auction into past and close to pending_approval
  await pool.query(
    "UPDATE auctions SET closes_at = now() - interval '1 hour', original_closes_at = now() - interval '1 hour', status = 'pending_approval', winner_id = $1, winning_amount = 900, closed_at = now() - interval '1 hour' WHERE id = $2",
    [priya.id, auc3.id]
  );

  // --- Auction 4: Reserved with Contact Disclosure & Dual Handover (Chair) ---
  const auc4 = await createAuction(
    arun.id,
    {
      title: 'Ergonomic High-Back Breathable Mesh Study Chair',
      category: 'furniture',
      condition: 'good',
      starting_price: 1200,
      min_increment: 100,
      description: 'Adjustable lumbar support and hydraulic lift. Sturdy nylon wheels. Approved by seller, contacts disclosed for hostel room pickup!',
      closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    ['study-chair.jpg']
  );
  await placeBid(auc4.id, priya.id, 1200);
  await pool.query(
    `UPDATE auctions
     SET closes_at = now() - interval '2 hours', original_closes_at = now() - interval '2 hours',
         status = 'reserved', winner_id = $1, winning_amount = 1200, closed_at = now() - interval '2 hours',
         decided_at = now() - interval '1 hour',
         pickup_deadline = now() + interval '71 hours',
         seller_handover_at = now() - interval '30 minutes'
     WHERE id = $2`,
    [priya.id, auc4.id]
  );

  // --- Auction 5: Completed Handover (Sold) ---
  const auc5 = await createAuction(
    arun.id,
    {
      title: 'Engineering Graphics Mini-Drafter Kit & Precision T-Scale',
      category: 'other',
      condition: 'like_new',
      starting_price: 350,
      min_increment: 25,
      description: 'First year engineering graphics set. Both parties confirmed handover; marked as SOLD.',
      closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    ['mini-drafter.jpg']
  );
  await placeBid(auc5.id, rahul.id, 350);
  await pool.query(
    `UPDATE auctions
     SET closes_at = now() - interval '1 day', original_closes_at = now() - interval '1 day',
         status = 'sold', winner_id = $1, winning_amount = 350,
         closed_at = now() - interval '1 day', decided_at = now() - interval '20 hours',
         seller_handover_at = now() - interval '5 hours',
         buyer_handover_at = now() - interval '5 hours'
     WHERE id = $2`,
    [rahul.id, auc5.id]
  );

  // --- Auction 6: Unsold Listing (0 bids) ---
  const auc6 = await createAuction(
    arun.id,
    {
      title: 'Chemistry Lab Apron / White Coat (Size L) & Safety Goggles',
      category: 'other',
      condition: 'good',
      starting_price: 250,
      min_increment: 20,
      description: '100% cotton lab coat required for organic chemistry practicals. Ended with 0 bids.',
      closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    ['lab-coat.jpg']
  );
  await pool.query(
    `UPDATE auctions
     SET closes_at = now() - interval '3 hours', original_closes_at = now() - interval '3 hours',
         status = 'unsold', closed_at = now() - interval '3 hours',
         outcome_reason = 'No bids received before closing time'
     WHERE id = $1`,
    [auc6.id]
  );

  // --- Auction 7: Open Electronics ---
  await createAuction(
    priya.id,
    {
      title: 'Mi Smart LED Desk Lamp 1S (Focus Mode & Color Tuning)',
      category: 'electronics',
      condition: 'like_new',
      starting_price: 750,
      min_increment: 50,
      description: 'Flicker-free study lamp with rotary knob and smartphone app connectivity. Perfect for late night coding.',
      closes_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    ['desk-lamp.jpg']
  );

  // --- Auction 8: Open Calculator ---
  await createAuction(
    priya.id,
    {
      title: 'Casio fx-82MS 2nd Gen Scientific Calculator',
      category: 'calculator',
      condition: 'good',
      starting_price: 250,
      min_increment: 25,
      description: 'Reliable 240 functions calculator with slide-on case. Battery replaced recently.',
      closes_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    ['casio-82ms.jpg']
  );

  // --- Auction 9: Open Furniture ---
  await createAuction(
    priya.id,
    {
      title: '4-Tier Wooden Hostel Shoe Rack & Entry Shelf',
      category: 'furniture',
      condition: 'good',
      starting_price: 450,
      min_increment: 50,
      description: 'Compact 4-tier solid wood rack. Keeps hostel hallway and room entrance clean.',
      closes_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    ['shoe-rack.jpg']
  );

  // --- Auction 10: Open Other Gear ---
  await createAuction(
    rahul.id,
    {
      title: 'Pigeon 1.5L Stainless Steel Electric Kettle for Hostel',
      category: 'other',
      condition: 'good',
      starting_price: 350,
      min_increment: 25,
      description: 'Auto shut-off kettle for instant noodles, coffee, and green tea during exam weeks.',
      closes_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    ['electric-kettle.jpg']
  );

  // --- Auction 11: Open Books ---
  await createAuction(
    rahul.id,
    {
      title: 'Computer Networks 5th Edition by Andrew S. Tanenbaum',
      category: 'books',
      condition: 'good',
      starting_price: 300,
      min_increment: 25,
      description: 'Essential textbook for computer networks course. Clear diagrams, TCP/IP reference.',
      closes_at: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
    ['networks-book.jpg']
  );

  // --- Auction 12: Open Cycle ---
  await createAuction(
    rahul.id,
    {
      title: 'Hercules Road EO 26-Inch Single Speed Urban Cycle',
      category: 'cycle',
      condition: 'fair',
      starting_price: 1600,
      min_increment: 100,
      description: 'Low-maintenance single-speed campus cycle with front basket and rear reflector.',
      closes_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    ['hercules-cycle.jpg']
  );

  // 5. Create Saved Wants & Alerts (Rule W1–W4)
  console.log('🔔 Creating saved wants and matching alerts...');
  await createWant(rahul.id, {
    keywords: 'Casio calculator',
    category: 'calculator',
    max_price: 700,
  });

  await createWant(priya.id, {
    keywords: 'Rockrider cycle',
    category: 'cycle',
    max_price: 3000,
  });

  console.log('✅ Database seeded successfully with realistic campus auctions!');
  console.log('-------------------------------------------------------------');
  console.log('Demo Credentials for Evaluators:');
  console.log('  1. Arun (Seller/Senior): arun@campus.edu    / password123');
  console.log('  2. Priya (Junior/Bidder): priya@campus.edu  / password123');
  console.log('  3. Rahul (Sophomore):    rahul@campus.edu  / password123');
  console.log('-------------------------------------------------------------');
}

// Run directly when called via CLI
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
