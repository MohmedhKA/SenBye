/**
 * Pure engine automatic bidding algorithm per PLAN §6 (A3–A6).
 * NO DB, NO Express, NO config, NO I/O.
 */

export interface AutoBidCap {
  bidderId: string;
  max: number;
  priorityAt: Date;
}

export interface AuctionSnapshot {
  startingPrice: number;
  increment: number;
  currentPrice: number | null;
  leaderId: string | null;
}

export interface PlannedBid {
  bidderId: string;
  amount: number;
}

export interface AutoBidResult {
  plannedBids: PlannedBid[];
  finalPrice: number | null;
  finalLeaderId: string | null;
}

/**
 * Resolves automatic bids purely using snapshot state and active caps.
 */
export function resolveAutoBids(
  snapshot: AuctionSnapshot,
  caps: AutoBidCap[]
): AutoBidResult {
  let price = snapshot.currentPrice;
  let leader = snapshot.leaderId;
  const plannedBids: PlannedBid[] = [];

  const getNextMinBid = (): number => {
    if (price === null) {
      return snapshot.startingPrice;
    }
    return price + snapshot.increment;
  };

  while (true) {
    const N = getNextMinBid();

    // 1. Challenger C = the cap (not current leader) with max >= N
    const candidates = caps.filter((c) => c.bidderId !== leader && c.max >= N);
    if (candidates.length === 0) {
      break;
    }

    // Sort: highest max first, ties broken by earlier priorityAt
    candidates.sort((a, b) => {
      if (b.max !== a.max) {
        return b.max - a.max;
      }
      return a.priorityAt.getTime() - b.priorityAt.getTime();
    });

    const C = candidates[0];

    // 2. No leader yet -> C bids N and becomes leader
    if (leader === null) {
      plannedBids.push({ bidderId: C.bidderId, amount: N });
      price = N;
      leader = C.bidderId;
      continue;
    }

    // 3. Leader cap ML = leader's auto max, or current price if none
    if (price === null) {
      throw new Error('Invariant violation: leader is set but price is null');
    }
    const currentPriceNum = price;
    const leaderCap = caps.find((c) => c.bidderId === leader);
    const ML = leaderCap ? leaderCap.max : currentPriceNum;

    // If leader cannot answer even C's minimum bid N (needs at least N + increment)
    if (ML < N + snapshot.increment) {
      plannedBids.push({ bidderId: C.bidderId, amount: N });
      price = N;
      leader = C.bidderId;
      continue;
    }

    // 4. Both have capacity to compete. Higher cap wins (tie -> earlier priorityAt)
    const cWins =
      C.max > ML ||
      (C.max === ML && leaderCap && C.priorityAt.getTime() < leaderCap.priorityAt.getTime());

    if (cWins) {
      const final = Math.min(C.max, ML + snapshot.increment);
      const leaderLast = Math.min(ML, final - snapshot.increment);
      if (leaderLast > currentPriceNum) {
        plannedBids.push({ bidderId: leader, amount: leaderLast });
      }
      plannedBids.push({ bidderId: C.bidderId, amount: final });
      price = final;
      leader = C.bidderId;
    } else {
      const final = Math.min(ML, C.max + snapshot.increment);
      const cLast = Math.min(C.max, final - snapshot.increment);
      if (cLast > currentPriceNum) {
        plannedBids.push({ bidderId: C.bidderId, amount: cLast });
      }
      plannedBids.push({ bidderId: leader, amount: final });
      price = final;
    }
  }

  return {
    plannedBids,
    finalPrice: price,
    finalLeaderId: leader,
  };
}
