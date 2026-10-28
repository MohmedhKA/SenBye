import type { Response } from 'express';

interface ClientConnection {
  res: Response;
  connectedAt: Date;
}

// In-memory hub: auction channels & user channels
const auctionClients = new Map<string, Set<ClientConnection>>();
const userClients = new Map<string, Set<ClientConnection>>();

export function registerAuctionClient(auctionId: string, res: Response): () => void {
  if (!auctionClients.has(auctionId)) {
    auctionClients.set(auctionId, new Set());
  }

  const client: ClientConnection = { res, connectedAt: new Date() };
  auctionClients.get(auctionId)!.add(client);

  return () => {
    const clients = auctionClients.get(auctionId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        auctionClients.delete(auctionId);
      }
    }
  };
}

export function registerUserClient(userId: string, res: Response): () => void {
  if (!userClients.has(userId)) {
    userClients.set(userId, new Set());
  }

  const client: ClientConnection = { res, connectedAt: new Date() };
  userClients.get(userId)!.add(client);

  return () => {
    const clients = userClients.get(userId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        userClients.delete(userId);
      }
    }
  };
}

export function broadcastAuctionEvent(auctionId: string, eventName: string, data: unknown): void {
  const clients = auctionClients.get(auctionId);
  if (!clients || clients.size === 0) return;

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export function sendUserEvent(userId: string, eventName: string, data: unknown): void {
  const clients = userClients.get(userId);
  if (!clients || clients.size === 0) return;

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

// 15-second heartbeat ticker to prevent socket timeout and synchronize server time
setInterval(() => {
  const serverTime = new Date().toISOString();
  const payload = `event: heartbeat\ndata: ${JSON.stringify({ server_time: serverTime })}\n\n`;

  for (const [, clients] of auctionClients) {
    for (const client of clients) {
      try {
        client.res.write(payload);
      } catch {
        clients.delete(client);
      }
    }
  }

  for (const [, clients] of userClients) {
    for (const client of clients) {
      try {
        client.res.write(payload);
      } catch {
        clients.delete(client);
      }
    }
  }
}, 15000);
