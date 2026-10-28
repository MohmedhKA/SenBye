import { Router } from 'express';
import { NotImplementedError } from '../errors.js';

export const wantsRouter = Router();

wantsRouter.get('/', (_req, _res, next) => next(new NotImplementedError('W1')));
wantsRouter.post('/', (_req, _res, next) => next(new NotImplementedError('W1')));
wantsRouter.delete('/:id', (_req, _res, next) => next(new NotImplementedError('W1')));
