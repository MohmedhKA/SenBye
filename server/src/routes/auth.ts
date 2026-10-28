import { Router } from 'express';
import { NotImplementedError } from '../errors.js';

export const authRouter = Router();

authRouter.post('/register', (_req, _res, next) => next(new NotImplementedError('M1')));
authRouter.post('/login', (_req, _res, next) => next(new NotImplementedError('M1')));
authRouter.post('/logout', (_req, _res, next) => next(new NotImplementedError('M1')));
authRouter.get('/me', (_req, _res, next) => next(new NotImplementedError('M1')));
