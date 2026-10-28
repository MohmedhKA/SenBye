import { pool } from '../db/pool.js';
import { HttpError } from '../errors.js';
import { config } from '../config.js';
import { toQuestion, type QuestionDTO } from '../dto/mappers.js';
import { createNotification } from './notifier.js';
import { broadcastAuctionEvent } from './sseHub.js';

// URL detection pattern per Rule Q2: https?:// or www.
const URL_REGEX = /(?:https?:\/\/|www\.)/i;

/**
 * Asks a question on an auction thread with strict anti-spam moderation (Rules Q1–Q4, Q8).
 */
export async function askQuestion(
  askerId: string,
  auctionId: string,
  rawBody: string
): Promise<QuestionDTO> {
  const body = rawBody?.trim();

  // Rule Q2: Body length 5–280 chars
  if (
    !body ||
    body.length < config.rules.questionMinLength ||
    body.length > config.rules.questionMaxLength
  ) {
    throw new HttpError(
      400,
      'VALIDATION',
      `Question must be between ${config.rules.questionMinLength} and ${config.rules.questionMaxLength} characters`
    );
  }

  // Rule Q2: Reject URLs
  if (URL_REGEX.test(body)) {
    throw new HttpError(400, 'VALIDATION', 'Questions cannot contain links or URLs');
  }

  // Rule Q1: Check auction existence and seller
  const { rows: auctionRows } = await pool.query(
    'SELECT id, seller_id, title FROM auctions WHERE id = $1',
    [auctionId]
  );

  if (auctionRows.length === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'Auction not found');
  }

  const auction = auctionRows[0];
  if (auction.seller_id === askerId) {
    throw new HttpError(403, 'OWN_AUCTION', 'Sellers cannot ask questions on their own auctions');
  }

  // Rule Q3: Limit <= 3 unanswered questions per user per auction
  const { rows: unansweredCountRows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM questions
     WHERE auction_id = $1
       AND asker_id = $2
       AND answered_at IS NULL
       AND status = 'visible'`,
    [auctionId, askerId]
  );
  if (unansweredCountRows[0].count >= config.rules.maxUnansweredQuestionsPerUserPerAuction) {
    throw new HttpError(
      429,
      'RATE_LIMITED',
      `You have reached the limit of ${config.rules.maxUnansweredQuestionsPerUserPerAuction} unanswered questions on this auction`
    );
  }

  // Rule Q3: Limit <= 10 questions per user per hour
  const { rows: hourlyCountRows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM questions
     WHERE asker_id = $1
       AND created_at >= now() - interval '1 hour'`,
    [askerId]
  );
  if (hourlyCountRows[0].count >= config.rules.maxQuestionsPerUserPerHour) {
    throw new HttpError(
      429,
      'RATE_LIMITED',
      `You have reached the limit of ${config.rules.maxQuestionsPerUserPerHour} questions per hour`
    );
  }

  // Rule Q4: Exact duplicates (case/whitespace-normalized) on the same auction rejected
  const normalized = body.toLowerCase().replace(/\s+/g, ' ');
  const { rows: duplicateRows } = await pool.query(
    `SELECT id FROM questions
     WHERE auction_id = $1
       AND regexp_replace(lower(trim(body)), '\\s+', ' ', 'g') = $2`,
    [auctionId, normalized]
  );
  if (duplicateRows.length > 0) {
    throw new HttpError(
      409,
      'DUPLICATE_QUESTION',
      'An identical question has already been asked on this auction'
    );
  }

  // Insert the question
  const { rows: insertedRows } = await pool.query(
    `INSERT INTO questions (auction_id, asker_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, auction_id, asker_id, body, answer, answered_at, is_faq, status, created_at`,
    [auctionId, askerId, body]
  );
  const qRow = insertedRows[0];

  // Fetch asker name
  const { rows: askerRows } = await pool.query(
    'SELECT name FROM users WHERE id = $1',
    [askerId]
  );
  const askerName = askerRows[0]?.name || 'Student';

  const dto = toQuestion({
    ...qRow,
    asker_name: askerName,
  });

  // Rule Q8: Notify seller
  await createNotification(
    auction.seller_id,
    'question',
    `New Question on ${auction.title}`,
    `${askerName} asked: "${body.slice(0, 60)}${body.length > 60 ? '...' : ''}"`,
    auctionId
  );

  // Broadcast to live viewers
  broadcastAuctionEvent(auctionId, 'question', dto);

  return dto;
}

/**
 * Searches for similar questions on this auction using pg_trgm similarity (Rule Q5).
 */
export async function findSimilarQuestions(
  auctionId: string,
  query: string
): Promise<QuestionDTO[]> {
  const trimmed = query?.trim();
  if (!trimmed || trimmed.length < 3) {
    return [];
  }

  const { rows } = await pool.query(
    `SELECT q.id, q.auction_id, q.asker_id, q.body, q.answer, q.answered_at, q.is_faq, q.status, q.created_at,
            u.name AS asker_name,
            similarity(q.body, $2) AS score
     FROM questions q
     JOIN users u ON u.id = q.asker_id
     WHERE q.auction_id = $1
       AND q.status = 'visible'
       AND similarity(q.body, $2) >= $3
     ORDER BY score DESC
     LIMIT 3`,
    [auctionId, trimmed, config.rules.questionSimilarityThreshold]
  );

  return rows.map(toQuestion);
}

/**
 * Seller answers a question (Rules Q6, Q8).
 */
export async function answerQuestion(
  sellerId: string,
  questionId: number,
  rawAnswer: string
): Promise<QuestionDTO> {
  const answer = rawAnswer?.trim();
  if (!answer || answer.length > config.rules.answerMaxLength) {
    throw new HttpError(
      400,
      'VALIDATION',
      `Answer must be between 1 and ${config.rules.answerMaxLength} characters`
    );
  }

  // Verify ownership
  const { rows } = await pool.query(
    `SELECT q.id, q.auction_id, q.asker_id, q.body, q.is_faq, q.status,
            a.seller_id, a.title AS auction_title,
            u.name AS asker_name
     FROM questions q
     JOIN auctions a ON a.id = q.auction_id
     JOIN users u ON u.id = q.asker_id
     WHERE q.id = $1`,
    [questionId]
  );

  if (rows.length === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'Question not found');
  }

  const question = rows[0];
  if (question.seller_id !== sellerId) {
    throw new HttpError(403, 'FORBIDDEN', 'Only the seller can answer questions');
  }

  const { rows: updatedRows } = await pool.query(
    `UPDATE questions
     SET answer = $1, answered_at = now()
     WHERE id = $2
     RETURNING id, auction_id, asker_id, body, answer, answered_at, is_faq, status, created_at`,
    [answer, questionId]
  );

  const dto = toQuestion({
    ...updatedRows[0],
    asker_name: question.asker_name,
  });

  // Rule Q8: Notify asker
  await createNotification(
    question.asker_id,
    'answer',
    `Question Answered on ${question.auction_title}`,
    `The seller answered: "${answer.slice(0, 60)}${answer.length > 60 ? '...' : ''}"`,
    question.auction_id
  );

  broadcastAuctionEvent(question.auction_id, 'question', dto);

  return dto;
}

/**
 * Seller toggles FAQ status (Rule Q6). Pinned questions appear first.
 */
export async function toggleFaq(
  sellerId: string,
  questionId: number,
  isFaq: boolean
): Promise<QuestionDTO> {
  const { rows } = await pool.query(
    `SELECT q.id, q.auction_id, a.seller_id, u.name AS asker_name
     FROM questions q
     JOIN auctions a ON a.id = q.auction_id
     JOIN users u ON u.id = q.asker_id
     WHERE q.id = $1`,
    [questionId]
  );

  if (rows.length === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'Question not found');
  }

  if (rows[0].seller_id !== sellerId) {
    throw new HttpError(403, 'FORBIDDEN', 'Only the seller can toggle FAQ status');
  }

  const { rows: updatedRows } = await pool.query(
    `UPDATE questions
     SET is_faq = $1
     WHERE id = $2
     RETURNING id, auction_id, asker_id, body, answer, answered_at, is_faq, status, created_at`,
    [Boolean(isFaq), questionId]
  );

  const dto = toQuestion({
    ...updatedRows[0],
    asker_name: rows[0].asker_name,
  });

  broadcastAuctionEvent(rows[0].auction_id, 'question', dto);

  return dto;
}

/**
 * Seller hides a question from public view (Rule Q6).
 */
export async function hideQuestion(
  sellerId: string,
  questionId: number
): Promise<void> {
  const { rows } = await pool.query(
    `SELECT q.id, q.auction_id, a.seller_id, u.name AS asker_name
     FROM questions q
     JOIN auctions a ON a.id = q.auction_id
     JOIN users u ON u.id = q.asker_id
     WHERE q.id = $1`,
    [questionId]
  );

  if (rows.length === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'Question not found');
  }

  if (rows[0].seller_id !== sellerId) {
    throw new HttpError(403, 'FORBIDDEN', 'Only the seller can hide questions');
  }

  const { rows: updatedRows } = await pool.query(
    `UPDATE questions
     SET status = 'hidden'
     WHERE id = $1
     RETURNING id, auction_id, asker_id, body, answer, answered_at, is_faq, status, created_at`,
    [questionId]
  );

  const dto = toQuestion({
    ...updatedRows[0],
    asker_name: rows[0].asker_name,
  });

  broadcastAuctionEvent(rows[0].auction_id, 'question', dto);
}

/**
 * Lists questions for an auction (Rule Q1, Q6). Pinned FAQs first, then newest.
 * Hidden questions are only visible to the auction seller.
 */
export async function listQuestions(
  auctionId: string,
  viewerId?: string | null
): Promise<QuestionDTO[]> {
  const { rows: auctionRows } = await pool.query(
    'SELECT id, seller_id FROM auctions WHERE id = $1',
    [auctionId]
  );

  if (auctionRows.length === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'Auction not found');
  }

  const isSeller = Boolean(viewerId && viewerId === auctionRows[0].seller_id);

  const { rows } = await pool.query(
    `SELECT q.id, q.auction_id, q.asker_id, q.body, q.answer, q.answered_at, q.is_faq, q.status, q.created_at,
            u.name AS asker_name
     FROM questions q
     JOIN users u ON u.id = q.asker_id
     WHERE q.auction_id = $1
       AND ($2::boolean = true OR q.status = 'visible')
     ORDER BY q.is_faq DESC, q.created_at DESC`,
    [auctionId, isSeller]
  );

  return rows.map(toQuestion);
}
