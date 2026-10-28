import type { AuctionSummary } from '../lib/types.js';

export function AuctionCard({ auction }: { auction: AuctionSummary }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <h3 className="font-semibold">{auction.title}</h3>
      <p className="text-sm text-slate-500">Starting: ₹{auction.starting_price}</p>
    </div>
  );
}
