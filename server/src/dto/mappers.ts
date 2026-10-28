import { NotImplementedError } from '../errors.js';

export function toAuctionSummary(_row: unknown): never {
  throw new NotImplementedError('M1');
}

export function toAuctionDetail(_row: unknown, _viewerId?: string | null): never {
  throw new NotImplementedError('M1');
}
