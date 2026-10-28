import { Router } from 'express';
import { NotImplementedError } from '../errors.js';

export const auctionsRouter = Router();

auctionsRouter.get('/', (_req, _res, next) => next(new NotImplementedError('BR1')));
auctionsRouter.post('/', (_req, _res, next) => next(new NotImplementedError('L2')));
auctionsRouter.get('/:id', (_req, _res, next) => next(new NotImplementedError('BR3')));
auctionsRouter.patch('/:id', (_req, _res, next) => next(new NotImplementedError('L3')));
auctionsRouter.post('/:id/cancel', (_req, _res, next) => next(new NotImplementedError('L4')));
auctionsRouter.post('/:id/relist', (_req, _res, next) => next(new NotImplementedError('L5')));
