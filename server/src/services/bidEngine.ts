import { NotImplementedError } from '../errors.js';

export async function placeBid(_auctionId: string, _bidderId: string, _amount: number): Promise<never> {
  throw new NotImplementedError('B1');
}

export async function setAutoBid(
  _auctionId: string,
  _bidderId: string,
  _maxAmount: number,
  _via: 'user' | 'assistant' = 'user'
): Promise<never> {
  throw new NotImplementedError('A1');
}
