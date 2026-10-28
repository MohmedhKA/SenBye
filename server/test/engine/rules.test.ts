import { describe, it, expect } from 'vitest';
import { nextMinBid, extendedClose } from '../../src/engine/rules.js';

describe('nextMinBid (Rule B1)', () => {
  it('B1: first bid must be at least starting price when no bids exist', () => {
    expect(nextMinBid(500, null, 50)).toBe(500);
    expect(nextMinBid(1000, null, 100)).toBe(1000);
  });

  it('B1: subsequent bids must be at least currentPrice + minIncrement', () => {
    expect(nextMinBid(500, 500, 50)).toBe(550);
    expect(nextMinBid(1000, 1200, 50)).toBe(1250);
  });
});

describe('extendedClose (Rule E1)', () => {
  const baseClose = new Date('2026-10-28T12:00:00.000Z');

  it('E1: extends when bid is placed within 30 seconds of close', () => {
    // 20s before close
    const bidTime = new Date('2026-10-28T11:59:40.000Z');
    const result = extendedClose(baseClose, bidTime, 30, 60);

    expect(result.causedExtension).toBe(true);
    // new close = bidTime + 60s
    expect(result.closesAt).toEqual(new Date('2026-10-28T12:00:40.000Z'));
  });

  it('E1: extends at exactly 30.000s boundary', () => {
    const bidTime = new Date('2026-10-28T11:59:30.000Z');
    const result = extendedClose(baseClose, bidTime, 30, 60);

    expect(result.causedExtension).toBe(true);
    expect(result.closesAt).toEqual(new Date('2026-10-28T12:00:30.000Z'));
  });

  it('E1: does not extend when bid is placed 30.001s before close', () => {
    const bidTime = new Date('2026-10-28T11:59:29.999Z');
    const result = extendedClose(baseClose, bidTime, 30, 60);

    expect(result.causedExtension).toBe(false);
    expect(result.closesAt).toEqual(baseClose);
  });

  it('E1: does not extend if bid arrives after closing time', () => {
    const bidTime = new Date('2026-10-28T12:00:01.000Z');
    const result = extendedClose(baseClose, bidTime, 30, 60);

    expect(result.causedExtension).toBe(false);
    expect(result.closesAt).toEqual(baseClose);
  });
});
