import { NotImplementedError } from '../errors.js';

export async function createAuction(_sellerId: string, _data: unknown, _photos: string[]): Promise<never> {
  throw new NotImplementedError('L2');
}

export async function editAuction(_sellerId: string, _auctionId: string, _data: unknown): Promise<never> {
  throw new NotImplementedError('L3');
}

export async function cancelAuction(_sellerId: string, _auctionId: string, _reason: string): Promise<never> {
  throw new NotImplementedError('L4');
}

export async function relistAuction(_sellerId: string, _auctionId: string, _closesAt: Date): Promise<never> {
  throw new NotImplementedError('L5');
}

export async function listAuctions(_query: unknown): Promise<never> {
  throw new NotImplementedError('BR1');
}

export async function getAuctionDetail(_auctionId: string, _viewerId?: string | null): Promise<never> {
  throw new NotImplementedError('BR3');
}

export async function getMyAuctions(_userId: string, _role: 'selling' | 'bidding'): Promise<never> {
  throw new NotImplementedError('M1');
}
