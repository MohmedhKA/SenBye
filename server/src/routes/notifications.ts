import { Router } from 'express';
import { NotImplementedError } from '../errors.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', (_req, _res, next) => next(new NotImplementedError('N1')));
notificationsRouter.post('/read', (_req, _res, next) => next(new NotImplementedError('N1')));
