import { Router } from 'express';
import { NotImplementedError } from '../errors.js';

export const questionsRouter = Router();

questionsRouter.get('/auctions/:id/questions', (_req, _res, next) => next(new NotImplementedError('Q1')));
questionsRouter.get('/auctions/:id/questions/similar', (_req, _res, next) => next(new NotImplementedError('Q5')));
questionsRouter.post('/auctions/:id/questions', (_req, _res, next) => next(new NotImplementedError('Q1')));
questionsRouter.post('/questions/:qid/answer', (_req, _res, next) => next(new NotImplementedError('Q6')));
questionsRouter.post('/questions/:qid/faq', (_req, _res, next) => next(new NotImplementedError('Q6')));
questionsRouter.post('/questions/:qid/hide', (_req, _res, next) => next(new NotImplementedError('Q6')));
