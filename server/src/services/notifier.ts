import { NotImplementedError } from '../errors.js';

export async function createNotification(
  _userId: string,
  _type: string,
  _title: string,
  _body: string,
  _auctionId?: string
): Promise<never> {
  throw new NotImplementedError('N1');
}

export async function listNotifications(_userId: string, _options: unknown): Promise<never> {
  throw new NotImplementedError('N1');
}

export async function markNotificationsRead(_userId: string, _ids?: number[]): Promise<never> {
  throw new NotImplementedError('N1');
}
