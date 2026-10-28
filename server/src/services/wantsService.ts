import { NotImplementedError } from '../errors.js';

export async function createWant(_userId: string, _data: unknown): Promise<never> {
  throw new NotImplementedError('W1');
}

export async function listWants(_userId: string): Promise<never> {
  throw new NotImplementedError('W1');
}

export async function deleteWant(_userId: string, _wantId: number): Promise<never> {
  throw new NotImplementedError('W1');
}

export async function matchWantsForAuction(_auctionId: string): Promise<never> {
  throw new NotImplementedError('W2');
}
