import { Router } from 'express';
import { NotImplementedError } from '../errors.js';

export const bidsRouter = Router();

bidsRouter.post('/:id/bids', (_req, _res, next) => next(new NotImplementedError('B1')));
bidsRouter.put('/:id/auto-bid', (_req, _res, next) => next(new NotImplementedError('A1')));
