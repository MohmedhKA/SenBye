import { pool } from '../db/pool.js';
import { HttpError } from '../errors.js';
import { listAuctions, getAuctionDetail } from './auctionService.js';

export interface WhitelistAuctionSummary {
  id: string;
  title: string;
  url: string;
  category: string;
  condition: string;
  starting_price: number;
  current_price: number | null;
  display_price: number;
  min_increment: number;
  bid_count: number;
  closes_at: string;
  seller_name: string;
}

export interface WhitelistAuctionDetail extends WhitelistAuctionSummary {
  description: string;
  min_next_bid: number;
  extension_count: number;
  bids: Array<{
    amount: number;
    bidder_name: string;
    placed_at: string;
  }>;
}

export interface WhitelistProposalResult {
  proposal_id: string;
  auction_id: string;
  auction_title: string;
  max_amount: number;
  status: 'pending';
  summary: string;
}

/**
 * Strict whitelist mapper (Rule AI5) guaranteeing no emails, password hashes, or private contact details
 * are ever exposed to the LLM context.
 */
export function mapAuctionToWhitelistSummary(item: any): WhitelistAuctionSummary {
  return {
    id: item.id,
    title: item.title,
    url: `/auctions/${item.id}`,
    category: item.category,
    condition: item.condition,
    starting_price: item.starting_price,
    current_price: item.current_price ?? null,
    display_price: item.display_price ?? item.starting_price,
    min_increment: item.min_increment,
    bid_count: item.bid_count,
    closes_at: item.closes_at,
    seller_name: item.seller?.name || item.seller_name || 'Seller',
  };
}

export function mapAuctionToWhitelistDetail(detail: any): WhitelistAuctionDetail {
  const summary = mapAuctionToWhitelistSummary(detail);
  // Rule AI6: Listing description is treated as untrusted user input wrapped in <listing_text> tags
  const sanitizedDescription = `<listing_text>${detail.description || ''}</listing_text>`;

  return {
    ...summary,
    description: sanitizedDescription,
    min_next_bid: detail.min_next_bid,
    extension_count: detail.extension_count,
    bids: (detail.bids || []).map((b: any) => ({
      amount: b.amount,
      bidder_name: b.bidder?.name || 'Bidder',
      placed_at: b.placed_at,
    })),
  };
}

export function mapToolResult(toolName: string, raw: any): any {
  if (toolName === 'search_auctions') {
    const items = Array.isArray(raw) ? raw : (raw?.items || []);
    return {
      results: items.map(mapAuctionToWhitelistSummary),
      count: items.length,
    };
  }
  if (toolName === 'get_auction') {
    return mapAuctionToWhitelistDetail(raw);
  }
  if (toolName === 'propose_bid') {
    return {
      proposal_id: raw.id,
      auction_id: raw.auction_id,
      auction_title: raw.auction_title,
      max_amount: raw.max_amount,
      status: 'pending',
      summary: raw.summary,
    };
  }
  return raw;
}

/**
 * Tool 1: search_auctions (Rule AI2)
 */
export async function executeSearchAuctions(args: {
  query: string;
  category?: string;
  max_price?: number;
}): Promise<any> {
  const query = args.query?.trim() || '';
  const result = await listAuctions({
    q: query || undefined,
    category: args.category || undefined,
    max_price: args.max_price || undefined,
    status: 'open',
    limit: 5,
  });

  return mapToolResult('search_auctions', result.items);
}

/**
 * Tool 2: get_auction (Rule AI2)
 */
export async function executeGetAuction(args: { id: string }): Promise<any> {
  if (!args.id) {
    throw new HttpError(400, 'VALIDATION', 'Auction ID is required');
  }

  const detail = await getAuctionDetail(args.id, null);
  return mapToolResult('get_auction', detail);
}

/**
 * Tool 3: propose_bid (Rule AI2, AI3)
 * ONLY creates a pending proposal in assistant_proposals.
 * NEVER acts without student's confirmation. Never calls placeBid or setAutoBid.
 */
export async function executeProposeBid(
  userId: string,
  args: { auction_id: string; max_amount: number }
): Promise<WhitelistProposalResult> {
  const { auction_id, max_amount } = args;
  if (!auction_id || !max_amount || max_amount <= 0) {
    throw new HttpError(400, 'VALIDATION', 'Valid auction_id and positive max_amount are required');
  }

  // Verify auction exists and is open
  const { rows: auctionRows } = await pool.query(
    'SELECT id, title, status, seller_id, starting_price, display_price FROM auctions WHERE id = $1',
    [auction_id]
  );

  if (auctionRows.length === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'Auction not found');
  }

  const auction = auctionRows[0];
  if (auction.status !== 'open') {
    throw new HttpError(409, 'AUCTION_CLOSED', 'Cannot propose bids on closed auctions');
  }

  if (auction.seller_id === userId) {
    throw new HttpError(403, 'OWN_AUCTION', 'You cannot bid on your own listing');
  }

  const summary = `Proposed automated proxy bid up to ₹${max_amount} on "${auction.title}"`;

  const { rows: proposalRows } = await pool.query(
    `INSERT INTO assistant_proposals (user_id, auction_id, max_amount, summary, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id, user_id, auction_id, max_amount, summary, status, created_at`,
    [userId, auction_id, Math.floor(max_amount), summary]
  );

  const proposal = proposalRows[0];
  return {
    proposal_id: proposal.id,
    auction_id: proposal.auction_id,
    auction_title: auction.title,
    max_amount: proposal.max_amount,
    status: 'pending',
    summary: proposal.summary,
  };
}

/**
 * Declarations for Google Gemini API
 */
export const googleFunctionDeclarations = [
  {
    name: 'search_auctions',
    description: 'Search open campus auctions by title/keywords, optional category, and optional maximum budget.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Keywords to search (e.g. "cycle", "calculator", "drafter")' },
        category: { type: 'STRING', description: 'Optional category (cycle, calculator, books, electronics, furniture, other)' },
        max_price: { type: 'NUMBER', description: 'Optional maximum price in ₹' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_auction',
    description: 'Retrieve detailed information and current bidding state for a specific auction by ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: 'The unique auction UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'propose_bid',
    description: 'Propose an automated proxy bid with a maximum budget for the user to review and confirm. Does not execute until the student confirms.',
    parameters: {
      type: 'OBJECT',
      properties: {
        auction_id: { type: 'STRING', description: 'The auction UUID to bid on' },
        max_amount: { type: 'NUMBER', description: 'The ceiling/maximum amount in ₹ the user is willing to spend' },
      },
      required: ['auction_id', 'max_amount'],
    },
  },
];

/**
 * Tool schemas for OpenAI/OpenRouter compatible format
 */
export const openAiToolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'search_auctions',
      description: 'Search open campus auctions by title/keywords, optional category, and optional maximum budget.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keywords to search' },
          category: { type: 'string', description: 'Optional category slug' },
          max_price: { type: 'number', description: 'Optional maximum price in ₹' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_auction',
      description: 'Retrieve detailed information and current bidding state for a specific auction by ID.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The unique auction UUID' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_bid',
      description: 'Propose an automated proxy bid with a maximum budget for the user to review and confirm.',
      parameters: {
        type: 'object',
        properties: {
          auction_id: { type: 'string', description: 'The auction UUID to bid on' },
          max_amount: { type: 'number', description: 'The ceiling/maximum amount in ₹' },
        },
        required: ['auction_id', 'max_amount'],
      },
    },
  },
];
