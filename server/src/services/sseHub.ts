import type { Response } from 'express';
import { NotImplementedError } from '../errors.js';

export function registerAuctionClient(_auctionId: string, _res: Response): never {
  throw new NotImplementedError('M2');
}

export function registerUserClient(_userId: string, _res: Response): never {
  throw new NotImplementedError('M2');
}

export function broadcastAuctionEvent(_auctionId: string, _event: string, _data: unknown): never {
  throw new NotImplementedError('M2');
}

export function sendUserEvent(_userId: string, _event: string, _data: unknown): never {
  throw new NotImplementedError('M2');
}
