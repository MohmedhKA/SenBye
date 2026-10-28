import { pool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';

export async function setup() {
  await runMigrations();
}

export async function teardown() {
  await pool.end();
}
