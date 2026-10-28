import { Router } from 'express';
import { NotImplementedError } from '../errors.js';

export const streamRouter = Router();

streamRouter.get('/auctions/:id/stream', (_req, _res, next) => next(new NotImplementedError('M2')));
streamRouter.get('/me/stream', (_req, _res, next) => next(new NotImplementedError('M2')));
