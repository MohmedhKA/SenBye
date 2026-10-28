import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isTest = process.env.NODE_ENV === 'test';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: isTest
    ? process.env.TEST_DATABASE_URL || 'postgres://mohmedh:mohmedh@localhost:5432/senbye_test'
    : process.env.DATABASE_URL || 'postgres://mohmedh:mohmedh@localhost:5432/senbye',
  testDatabaseUrl: process.env.TEST_DATABASE_URL || 'postgres://mohmedh:mohmedh@localhost:5432/senbye_test',
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-key-32-chars-long-minimum!',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  allowedEmailDomain: process.env.ALLOWED_EMAIL_DOMAIN || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  googleApiKey: process.env.GOOGLE_API_KEY || '',
  assistantModel: process.env.ASSISTANT_MODEL || '',

  rules: {
    // Listing rules (L2)
    titleMinLength: 3,
    titleMaxLength: 100,
    descriptionMaxLength: 2000,
    minStartingPrice: 1,
    maxStartingPrice: 1000000,
    minIncrement: 1,
    minCloseDurationMs: 10 * 60 * 1000, // 10 min
    maxCloseDurationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    minPhotos: 1,
    maxPhotos: 5,
    maxPhotoSize: 3 * 1024 * 1024, // 3 MB
    allowedPhotoMimes: ['image/jpeg', 'image/png', 'image/webp'],
    maxPreFaqs: 5,

    // Bidding rules (B2, E1)
    maxBidAmount: 10000000,
    extensionWindowSeconds: parseInt(process.env.EXTENSION_WINDOW_SECONDS || '30', 10),
    extensionSeconds: parseInt(process.env.EXTENSION_SECONDS || '60', 10),

    // Closing & sale (C5, S1, S5)
    endingSoonWindowSeconds: 10 * 60, // 10 min
    pickupDeadlineHours: 72,

    // Questions (Q2, Q3, Q5)
    questionMinLength: 5,
    questionMaxLength: 280,
    answerMaxLength: 1000,
    maxUnansweredQuestionsPerUserPerAuction: 3,
    maxQuestionsPerUserPerHour: 10,
    questionSimilarityThreshold: 0.4,

    // Wants (W1)
    wantMinKeywordsLength: 2,
    wantMaxKeywordsLength: 100,

    // Assistant (AI6)
    proposalExpiryMinutes: 30,

    // Categories and conditions
    categories: ['cycle', 'calculator', 'books', 'electronics', 'furniture', 'other'] as const,
    conditions: ['new', 'like_new', 'good', 'fair', 'poor'] as const,
  },
} as const;
