/**
 * Pure engine bidding rules per PLAN §4 (B1, E1).
 * NO DB, NO Express, NO config, NO I/O.
 */

/**
 * Calculates the next minimum required bid (Rule B1).
 * If there are no bids yet, the minimum bid is the starting price.
 * Otherwise, it is currentPrice + minIncrement.
 */
export function nextMinBid(
  startingPrice: number,
  currentPrice: number | null,
  minIncrement: number
): number {
  if (currentPrice === null) {
    return startingPrice;
  }
  return currentPrice + minIncrement;
}

/**
 * Calculates last-minute extension on a new bid (Rule E1).
 * If a valid bid arrives in the last `extensionWindowSeconds` (default 30s) before closes_at,
 * the closing time extends to `extensionSeconds` (default 60s) after that bid.
 * It never shortens closing time.
 */
export function extendedClose(
  currentClosesAt: Date,
  bidTime: Date,
  extensionWindowSeconds = 30,
  extensionSeconds = 60
): { closesAt: Date; causedExtension: boolean } {
  const remainingMs = currentClosesAt.getTime() - bidTime.getTime();
  const windowMs = extensionWindowSeconds * 1000;

  // Only trigger if bid arrives strictly within the window and not after close
  if (remainingMs > 0 && remainingMs <= windowMs) {
    const candidateClosesAt = new Date(bidTime.getTime() + extensionSeconds * 1000);
    if (candidateClosesAt.getTime() > currentClosesAt.getTime()) {
      return { closesAt: candidateClosesAt, causedExtension: true };
    }
  }

  return { closesAt: currentClosesAt, causedExtension: false };
}
