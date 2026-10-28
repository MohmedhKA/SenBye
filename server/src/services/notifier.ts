import { pool } from '../db/pool.js';
import { sendUserEvent } from './sseHub.js';
import type pg from 'pg';

export interface NotificationItem {
  id: number;
  user_id: string;
  type: string;
  title: string;
  body: string;
  auction_id: string | null;
  created_at: string;
  read_at: string | null;
}

export interface ListNotificationsOptions {
  limit?: number;
  before?: number;
}

/**
 * Creates and persists a notification row, then dispatches it over the user's live SSE stream (Rule N1).
 */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  auctionId?: string | null,
  client?: pg.PoolClient
): Promise<NotificationItem> {
  const runner = client || pool;

  const { rows } = await runner.query(
    `INSERT INTO notifications (user_id, type, title, body, auction_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, type, title, body, auction_id, created_at, read_at`,
    [userId, type, title, body, auctionId || null]
  );

  const row = rows[0];
  const item: NotificationItem = {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    auction_id: row.auction_id,
    created_at: new Date(row.created_at).toISOString(),
    read_at: row.read_at ? new Date(row.read_at).toISOString() : null,
  };

  // Push directly to user's SSE channel if connected
  sendUserEvent(userId, 'notification', item);

  return item;
}

/**
 * Lists notifications for a user with unread count (Rule N1).
 */
export async function listNotifications(
  userId: string,
  options: ListNotificationsOptions = {}
): Promise<{ items: NotificationItem[]; unread_count: number }> {
  const limit = Math.min(Math.max(options.limit || 20, 1), 50);
  const before = options.before || null;

  const { rows } = await pool.query(
    `SELECT id, user_id, type, title, body, auction_id, created_at, read_at
     FROM notifications
     WHERE user_id = $1
       AND ($2::bigint IS NULL OR id < $2)
     ORDER BY id DESC
     LIMIT $3`,
    [userId, before, limit]
  );

  const { rows: countRows } = await pool.query(
    `SELECT count(*)::int AS unread_count
     FROM notifications
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );

  const items: NotificationItem[] = rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    auction_id: r.auction_id,
    created_at: new Date(r.created_at).toISOString(),
    read_at: r.read_at ? new Date(r.read_at).toISOString() : null,
  }));

  return {
    items,
    unread_count: countRows[0]?.unread_count ?? 0,
  };
}

/**
 * Marks specific notification IDs or all notifications as read for a user.
 */
export async function markNotificationsRead(
  userId: string,
  ids?: number[]
): Promise<number> {
  let updatedCount = 0;

  if (ids && ids.length > 0) {
    const { rowCount } = await pool.query(
      `UPDATE notifications
       SET read_at = clock_timestamp()
       WHERE user_id = $1 AND id = ANY($2::bigint[]) AND read_at IS NULL`,
      [userId, ids]
    );
    updatedCount = rowCount || 0;
  } else {
    const { rowCount } = await pool.query(
      `UPDATE notifications
       SET read_at = clock_timestamp()
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    updatedCount = rowCount || 0;
  }

  sendUserEvent(userId, 'read_state', { ids: ids || 'all', updated_count: updatedCount });
  return updatedCount;
}
