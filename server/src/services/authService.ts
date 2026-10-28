import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { HttpError } from '../errors.js';
import { config } from '../config.js';
import { signToken, type AuthUser } from '../middleware/auth.js';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  contact?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: string;
    name: string;
    email: string;
    contact: string | null;
  };
  token: string;
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const { name, email, password, contact } = input;

  // Domain restriction check (if configured)
  if (config.allowedEmailDomain && !email.toLowerCase().endsWith(`@${config.allowedEmailDomain}`)) {
    throw new HttpError(
      400,
      'VALIDATION',
      `Registration is restricted to @${config.allowedEmailDomain} email addresses`
    );
  }

  // Check email uniqueness
  const existing = await pool.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [email]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, contact)
     VALUES ($1, lower($2), $3, $4)
     RETURNING id, name, email, contact`,
    [name.trim(), email.trim(), passwordHash, contact?.trim() || null]
  );

  const user = rows[0];
  const authUser: AuthUser = { id: user.id, email: user.email, name: user.name };
  const token = signToken(authUser);

  return { user, token };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const { email, password } = input;

  const { rows } = await pool.query(
    'SELECT id, name, email, password_hash, contact FROM users WHERE lower(email) = lower($1)',
    [email.trim()]
  );

  if (rows.length === 0) {
    throw new HttpError(401, 'BAD_CREDENTIALS', 'Invalid email or password');
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new HttpError(401, 'BAD_CREDENTIALS', 'Invalid email or password');
  }

  const authUser: AuthUser = { id: user.id, email: user.email, name: user.name };
  const token = signToken(authUser);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      contact: user.contact,
    },
    token,
  };
}

export async function getUserById(id: string) {
  const { rows } = await pool.query(
    'SELECT id, name, email, contact FROM users WHERE id = $1',
    [id]
  );
  if (rows.length === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found');
  }
  return rows[0];
}
