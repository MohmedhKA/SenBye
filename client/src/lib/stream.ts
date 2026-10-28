export function subscribeToAuctionStream(_auctionId: string, _onEvent: (event: string, data: unknown) => void): () => void {
  return () => {}; // Stub for M2
}

export function subscribeToUserStream(_onNotification: (data: unknown) => void): () => void {
  return () => {}; // Stub for M2
}
