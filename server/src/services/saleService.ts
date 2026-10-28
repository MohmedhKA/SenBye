import { NotImplementedError } from '../errors.js';

export async function approveWinningBid(_sellerId: string, _auctionId: string): Promise<never> {
  throw new NotImplementedError('S1');
}

export async function rejectWinningBid(_sellerId: string, _auctionId: string, _reason: string): Promise<never> {
  throw new NotImplementedError('S3');
}

export async function confirmHandover(_userId: string, _auctionId: string): Promise<never> {
  throw new NotImplementedError('S4');
}

export async function reportFailedPickup(_userId: string, _auctionId: string, _reason: string): Promise<never> {
  throw new NotImplementedError('S5');
}

export async function closeDueAuctions(): Promise<never> {
  throw new NotImplementedError('C1');
}

export async function expirePickupDeadlines(): Promise<never> {
  throw new NotImplementedError('S5');
}
