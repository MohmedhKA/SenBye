import { describe, it, expect } from 'vitest';
import { resolveAutoBids } from '../../src/engine/autoBid.js';

describe('resolveAutoBids (Rules A3–A6, PLAN §6 prototype tests)', () => {
  const start = 1000;
  const inc = 50;

  it('Case 1: No bids; C sets auto 1800 -> C 1000, final C at 1000', () => {
    const result = resolveAutoBids(
      { startingPrice: start, increment: inc, currentPrice: null, leaderId: null },
      [{ bidderId: 'C', max: 1800, priorityAt: new Date(100) }]
    );

    expect(result.plannedBids).toEqual([{ bidderId: 'C', amount: 1000 }]);
    expect(result.finalPrice).toBe(1000);
    expect(result.finalLeaderId).toBe('C');
  });

  it('Case 2: Leader B manual 1200; A has auto 1800 -> A 1250, final A at 1250', () => {
    const result = resolveAutoBids(
      { startingPrice: start, increment: inc, currentPrice: 1200, leaderId: 'B' },
      [{ bidderId: 'A', max: 1800, priorityAt: new Date(100) }]
    );

    expect(result.plannedBids).toEqual([{ bidderId: 'A', amount: 1250 }]);
    expect(result.finalPrice).toBe(1250);
    expect(result.finalLeaderId).toBe('A');
  });

  it('Case 3: Leader B manual 1900; A has auto 1800 -> none, final B at 1900', () => {
    const result = resolveAutoBids(
      { startingPrice: start, increment: inc, currentPrice: 1900, leaderId: 'B' },
      [{ bidderId: 'A', max: 1800, priorityAt: new Date(100) }]
    );

    expect(result.plannedBids).toEqual([]);
    expect(result.finalPrice).toBe(1900);
    expect(result.finalLeaderId).toBe('B');
  });

  it('Case 4: A auto 1800 leads at 1700; C sets auto 1820 -> A 1770, C 1820, final C at 1820', () => {
    const result = resolveAutoBids(
      { startingPrice: start, increment: inc, currentPrice: 1700, leaderId: 'A' },
      [
        { bidderId: 'A', max: 1800, priorityAt: new Date(100) },
        { bidderId: 'C', max: 1820, priorityAt: new Date(200) },
      ]
    );

    expect(result.plannedBids).toEqual([
      { bidderId: 'A', amount: 1770 },
      { bidderId: 'C', amount: 1820 },
    ]);
    expect(result.finalPrice).toBe(1820);
    expect(result.finalLeaderId).toBe('C');
  });

  it('Case 5: Same as 4, C max 1800 (A set first) -> C 1750, A 1800, final A at 1800', () => {
    const result = resolveAutoBids(
      { startingPrice: start, increment: inc, currentPrice: 1700, leaderId: 'A' },
      [
        { bidderId: 'A', max: 1800, priorityAt: new Date(100) },
        { bidderId: 'C', max: 1800, priorityAt: new Date(200) },
      ]
    );

    expect(result.plannedBids).toEqual([
      { bidderId: 'C', amount: 1750 },
      { bidderId: 'A', amount: 1800 },
    ]);
    expect(result.finalPrice).toBe(1800);
    expect(result.finalLeaderId).toBe('A');
  });

  it("Case 6: A auto 1740 leads at 1700; C auto 1900 -> C 1750, final C at 1750 (A can't answer)", () => {
    const result = resolveAutoBids(
      { startingPrice: start, increment: inc, currentPrice: 1700, leaderId: 'A' },
      [
        { bidderId: 'A', max: 1740, priorityAt: new Date(100) },
        { bidderId: 'C', max: 1900, priorityAt: new Date(200) },
      ]
    );

    expect(result.plannedBids).toEqual([{ bidderId: 'C', amount: 1750 }]);
    expect(result.finalPrice).toBe(1750);
    expect(result.finalLeaderId).toBe('C');
  });

  it('Case 7: Leader L auto 1800 at 1000; C1 auto 1500; C2 auto 1700 -> C2 1700, L 1750, final L at 1750', () => {
    const result = resolveAutoBids(
      { startingPrice: start, increment: inc, currentPrice: 1000, leaderId: 'L' },
      [
        { bidderId: 'L', max: 1800, priorityAt: new Date(100) },
        { bidderId: 'C1', max: 1500, priorityAt: new Date(150) },
        { bidderId: 'C2', max: 1700, priorityAt: new Date(200) },
      ]
    );

    expect(result.plannedBids).toEqual([
      { bidderId: 'C2', amount: 1700 },
      { bidderId: 'L', amount: 1750 },
    ]);
    expect(result.finalPrice).toBe(1750);
    expect(result.finalLeaderId).toBe('L');
  });
});
