import { nextMinBid } from '../engine/rules.js';

export interface RawAuctionRow {
  id: string;
  seller_id: string;
  seller_name: string;
  title: string;
  category: string;
  description: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  starting_price: number;
  min_increment: number;
  current_price: number | null;
  leader_id: string | null;
  leader_name: string | null;
  bid_count: number;
  display_price: number;
  closes_at: Date | string;
  original_closes_at: Date | string;
  extension_count: number;
  status:
    | 'open'
    | 'pending_approval'
    | 'reserved'
    | 'sold'
    | 'unsold'
    | 'rejected'
    | 'cancelled'
    | 'failed_pickup';
  winner_id: string | null;
  winner_name: string | null;
  winning_amount: number | null;
  outcome_reason: string | null;
  seller_contact?: string | null;
  winner_contact?: string | null;
  primary_photo?: string | null;
  pickup_deadline?: Date | string | null;
  seller_handover_at?: Date | string | null;
  buyer_handover_at?: Date | string | null;
  closed_at?: Date | string | null;
  decided_at?: Date | string | null;
}

export interface RawBidRow {
  id: number;
  bidder_id: string;
  bidder_name: string;
  amount: number;
  source: 'manual' | 'auto';
  placed_at: Date | string;
  caused_extension: boolean;
}

export interface RawAutoBidRow {
  bidder_id: string;
  bidder_name: string;
  max_amount: number;
  via: 'user' | 'assistant';
}

export function toAuctionSummary(row: RawAuctionRow) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    condition: row.condition,
    starting_price: row.starting_price,
    min_increment: row.min_increment,
    display_price: row.display_price ?? (row.current_price ?? row.starting_price),
    current_price: row.current_price,
    bid_count: row.bid_count,
    leader_name: row.leader_name,
    closes_at: new Date(row.closes_at).toISOString(),
    status: row.status,
    photo: row.primary_photo || null,
    seller: {
      id: row.seller_id,
      name: row.seller_name,
    },
  };
}

export function toAuctionDetail(
  row: RawAuctionRow,
  photos: string[],
  bids: RawBidRow[],
  autoBids: RawAutoBidRow[],
  viewerId?: string | null
) {
  const summary = toAuctionSummary(row);

  // Counterparty contact disclosure per Rule S2:
  // ONLY visible while reserved or sold, and ONLY between seller and winner
  let counterpartyContact: string | null = null;
  const isReservedOrSold = row.status === 'reserved' || row.status === 'sold';

  if (isReservedOrSold && viewerId) {
    if (viewerId === row.seller_id) {
      // Seller sees winner's contact
      counterpartyContact = row.winner_contact || null;
    } else if (viewerId === row.winner_id) {
      // Winner sees seller's contact
      counterpartyContact = row.seller_contact || null;
    }
  }

  const minNext = nextMinBid(row.starting_price, row.current_price, row.min_increment);

  return {
    ...summary,
    description: row.description,
    original_closes_at: new Date(row.original_closes_at).toISOString(),
    extension_count: row.extension_count,
    min_next_bid: minNext,
    photos,
    bids: bids.map((b) => ({
      id: b.id,
      bidder: {
        id: b.bidder_id,
        name: b.bidder_name,
      },
      amount: b.amount,
      source: b.source,
      placed_at: new Date(b.placed_at).toISOString(),
      caused_extension: b.caused_extension,
    })),
    auto_bids: autoBids.map((ab) => ({
      bidder: {
        id: ab.bidder_id,
        name: ab.bidder_name,
      },
      max_amount: ab.max_amount,
      via: ab.via,
    })),
    winner: row.winner_id
      ? {
          id: row.winner_id,
          name: row.winner_name || '',
        }
      : null,
    outcome_reason: row.outcome_reason || null,
    pickup_deadline: row.pickup_deadline ? new Date(row.pickup_deadline).toISOString() : null,
    seller_handover_at: row.seller_handover_at ? new Date(row.seller_handover_at).toISOString() : null,
    buyer_handover_at: row.buyer_handover_at ? new Date(row.buyer_handover_at).toISOString() : null,
    closed_at: row.closed_at ? new Date(row.closed_at).toISOString() : null,
    decided_at: row.decided_at ? new Date(row.decided_at).toISOString() : null,
    counterparty_contact: counterpartyContact,
    server_time: new Date().toISOString(),
  };
}

export interface WantDTO {
  id: number;
  keywords: string;
  category: string | null;
  max_price: number;
  active: boolean;
  created_at: string;
  matches_count: number;
}

export function toWant(row: any): WantDTO {
  return {
    id: Number(row.id),
    keywords: row.keywords,
    category: row.category || null,
    max_price: Number(row.max_price),
    active: Boolean(row.active),
    created_at: new Date(row.created_at).toISOString(),
    matches_count: row.matches_count !== undefined ? Number(row.matches_count) : 0,
  };
}
