import { Router } from 'express';
import { z } from 'zod';
import { registerUser, loginUser, getUserById } from '../services/authService.js';
import { setSessionCookie, clearSessionCookie, optionalAuth } from '../middleware/auth.js';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  contact: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const { user, token } = await registerUser(input);
    setSessionCookie(res, token);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const { user, token } = await loginUser(input);
    setSessionCookie(res, token);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', optionalAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.json({ user: null });
    }
    const user = await getUserById(req.user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});
