export interface User {
  id: string;
  name: string;
  email?: string;
  contact?: string | null;
}

export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

export type AuctionStatus =
  | 'open'
  | 'pending_approval'
  | 'reserved'
  | 'sold'
  | 'unsold'
  | 'rejected'
  | 'cancelled'
  | 'failed_pickup';

export interface AuctionSummary {
  id: string;
  title: string;
  category: string;
  condition: ItemCondition;
  starting_price: number;
  min_increment: number;
  display_price: number;
  current_price: number | null;
  bid_count: number;
  leader_name: string | null;
  closes_at: string;
  status: AuctionStatus;
  photo: string | null;
  seller: {
    id: string;
    name: string;
  };
}

export interface BidRecord {
  id: number;
  bidder: {
    id: string;
    name: string;
  };
  amount: number;
  source: 'manual' | 'auto';
  placed_at: string;
  caused_extension: boolean;
}

export interface AutoBidRecord {
  bidder: {
    id: string;
    name: string;
  };
  max_amount: number;
  via: 'user' | 'assistant';
}

export interface AuctionDetail extends AuctionSummary {
  description: string;
  original_closes_at: string;
  extension_count: number;
  min_next_bid: number;
  photos: string[];
  bids: BidRecord[];
  auto_bids: AutoBidRecord[];
  winner: {
    id: string;
    name: string;
  } | null;
  outcome_reason: string | null;
  pickup_deadline?: string | null;
  seller_handover_at?: string | null;
  buyer_handover_at?: string | null;
  closed_at?: string | null;
  decided_at?: string | null;
  counterparty_contact: string | null;
  server_time: string;
}

export interface Question {
  id: number;
  auction_id: string;
  asker: {
    id: string;
    name: string;
  };
  body: string;
  answer: string | null;
  answered_at: string | null;
  is_faq: boolean;
  status: 'visible' | 'hidden';
  created_at: string;
}

export interface Want {
  id: number;
  keywords: string;
  category: string | null;
  max_price: number;
  active: boolean;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  auction_id: string | null;
  created_at: string;
  read_at: string | null;
}

export interface AssistantProposal {
  id: string;
  auction_id: string;
  max_amount: number;
  summary: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  created_at: string;
}
