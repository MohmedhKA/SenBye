/**
 * Manages Server-Sent Events (SSE) subscriptions for live auction telemetry and notifications.
 */

export function subscribeToAuctionStream(
  auctionId: string,
  onEvent: (event: string, data: any) => void
): () => void {
  const url = `/api/auctions/${encodeURIComponent(auctionId)}/stream`;
  const es = new EventSource(url, { withCredentials: true });

  const eventTypes = ['snapshot', 'bid', 'extended', 'closed'];

  eventTypes.forEach((type) => {
    es.addEventListener(type, (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        onEvent(type, payload);
      } catch (err) {
        console.error(`[SSE] Failed to parse event '${type}' payload:`, err);
      }
    });
  });

  es.onerror = (err) => {
    // EventSource automatically retries connection
    console.debug(`[SSE] Auction ${auctionId} stream connection state:`, es.readyState, err);
  };

  return () => {
    es.close();
  };
}

export function subscribeToUserStream(
  onEvent: (event: string, data: any) => void
): () => void {
  const url = '/api/me/stream';
  const es = new EventSource(url, { withCredentials: true });

  const eventTypes = ['notification', 'outbid', 'outbid_auto', 'ping'];

  eventTypes.forEach((type) => {
    es.addEventListener(type, (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        onEvent(type, payload);
      } catch (err) {
        console.error(`[SSE] Failed to parse user stream '${type}' payload:`, err);
      }
    });
  });

  es.onerror = (err) => {
    console.debug('[SSE] User stream connection state:', es.readyState, err);
  };

  return () => {
    es.close();
  };
}
