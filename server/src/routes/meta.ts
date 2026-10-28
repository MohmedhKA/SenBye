import { Router } from 'express';
import { pool } from '../db/pool.js';
import { config } from '../config.js';

export const metaRouter = Router();

metaRouter.get('/', async (_req, res, next) => {
  try {
    const { rows: categories } = await pool.query(
      'SELECT slug, label, sort_order FROM categories ORDER BY sort_order ASC'
    );

    res.json({
      categories,
      conditions: config.rules.conditions,
      rules: config.rules,
      server_time: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
