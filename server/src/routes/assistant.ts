import { Router } from 'express';
import { NotImplementedError } from '../errors.js';

export const assistantRouter = Router();

assistantRouter.post('/chat', (_req, _res, next) => next(new NotImplementedError('AI1')));
assistantRouter.get('/history', (_req, _res, next) => next(new NotImplementedError('AI1')));
assistantRouter.post('/proposals/:id/confirm', (_req, _res, next) => next(new NotImplementedError('AI3')));
assistantRouter.post('/proposals/:id/cancel', (_req, _res, next) => next(new NotImplementedError('AI3')));
