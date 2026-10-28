import { Router } from 'express';
import { NotImplementedError } from '../errors.js';

export const saleRouter = Router();

saleRouter.post('/:id/approve', (_req, _res, next) => next(new NotImplementedError('S1')));
saleRouter.post('/:id/reject', (_req, _res, next) => next(new NotImplementedError('S3')));
saleRouter.post('/:id/handover', (_req, _res, next) => next(new NotImplementedError('S4')));
saleRouter.post('/:id/failed-pickup', (_req, _res, next) => next(new NotImplementedError('S5')));
