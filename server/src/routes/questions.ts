import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import {
  askQuestion,
  findSimilarQuestions,
  answerQuestion,
  toggleFaq,
  hideQuestion,
  listQuestions,
} from '../services/questionsService.js';

export const questionsRouter = Router();

const askQuestionSchema = z.object({
  body: z
    .string({ required_error: 'Question body is required' })
    .min(config.rules.questionMinLength, `Question must be at least ${config.rules.questionMinLength} characters`)
    .max(config.rules.questionMaxLength, `Question cannot exceed ${config.rules.questionMaxLength} characters`),
});

const answerQuestionSchema = z.object({
  answer: z
    .string({ required_error: 'Answer is required' })
    .min(1, 'Answer cannot be empty')
    .max(config.rules.answerMaxLength, `Answer cannot exceed ${config.rules.answerMaxLength} characters`),
});

const toggleFaqSchema = z.object({
  is_faq: z.boolean({ required_error: 'is_faq is required' }),
});

function parseQuestionId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

// GET /api/auctions/:id/questions - public thread (FAQ first, then newest)
questionsRouter.get('/auctions/:id/questions', optionalAuth, async (req, res, next) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const questions = await listQuestions(rawId, req.user?.id);
    res.json(questions);
  } catch (err) {
    next(err);
  }
});

// GET /api/auctions/:id/questions/similar - similarity search before posting (Rule Q5)
questionsRouter.get('/auctions/:id/questions/similar', requireAuth, async (req, res, next) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const similar = await findSimilarQuestions(rawId, query);
    res.json(similar);
  } catch (err) {
    next(err);
  }
});

// POST /api/auctions/:id/questions - ask question (Rules Q1–Q4, Q8)
questionsRouter.post('/auctions/:id/questions', requireAuth, async (req, res, next) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parsed = askQuestionSchema.parse(req.body);
    const question = await askQuestion(req.user!.id, rawId, parsed.body);
    res.status(201).json(question);
  } catch (err) {
    next(err);
  }
});

// POST /api/questions/:qid/answer - seller answers (Rules Q6, Q8)
questionsRouter.post('/questions/:qid/answer', requireAuth, async (req, res, next) => {
  try {
    const qid = parseQuestionId(req.params.qid);
    if (isNaN(qid)) {
      res.status(400).json({ error: { code: 'VALIDATION', message: 'Invalid question ID' } });
      return;
    }

    const parsed = answerQuestionSchema.parse(req.body);
    const question = await answerQuestion(req.user!.id, qid, parsed.answer);
    res.json(question);
  } catch (err) {
    next(err);
  }
});

// POST /api/questions/:qid/faq - seller toggles FAQ status (Rule Q6)
questionsRouter.post('/questions/:qid/faq', requireAuth, async (req, res, next) => {
  try {
    const qid = parseQuestionId(req.params.qid);
    if (isNaN(qid)) {
      res.status(400).json({ error: { code: 'VALIDATION', message: 'Invalid question ID' } });
      return;
    }

    const parsed = toggleFaqSchema.parse(req.body);
    const question = await toggleFaq(req.user!.id, qid, parsed.is_faq);
    res.json(question);
  } catch (err) {
    next(err);
  }
});

// POST /api/questions/:qid/hide - seller hides question (Rule Q6)
questionsRouter.post('/questions/:qid/hide', requireAuth, async (req, res, next) => {
  try {
    const qid = parseQuestionId(req.params.qid);
    if (isNaN(qid)) {
      res.status(400).json({ error: { code: 'VALIDATION', message: 'Invalid question ID' } });
      return;
    }

    await hideQuestion(req.user!.id, qid);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
