import { Link } from 'react-router-dom';
import type { AuctionSummary } from '../lib/types.js';
import { formatRupees, formatTimeRemaining } from '../lib/format.js';
import { Clock, Image as ImageIcon, Gavel } from 'lucide-react';

export function AuctionCard({ auction }: { auction: AuctionSummary }) {
  const msRemaining = Math.max(0, new Date(auction.closes_at).getTime() - Date.now());
  const isClosed = auction.status !== 'open' || msRemaining <= 0;

  const conditionLabels: Record<string, string> = {
    new: 'Brand New',
    like_new: 'Like New',
    good: 'Good',
    fair: 'Fair',
    poor: 'Usable',
  };

  return (
    <Link
      to={`/auctions/${auction.id}`}
      className="group block bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all flex flex-col"
    >
      {/* Photo container */}
      <div className="relative aspect-4/3 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
        {auction.photo ? (
          <img
            src={`/uploads/${auction.photo}`}
            alt={auction.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400">
            <ImageIcon className="w-10 h-10 mb-1 stroke-1" />
            <span className="text-xs">No Photo</span>
          </div>
        )}

        {/* Status / Category tag */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/90 text-slate-800 shadow-xs backdrop-blur-xs capitalize">
            {auction.category}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-900/80 text-white shadow-xs backdrop-blur-xs">
            {conditionLabels[auction.condition] || auction.condition}
          </span>
        </div>

        {/* Live timer badge */}
        <div className="absolute bottom-2.5 right-2.5">
          <span
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md shadow-xs ${
              isClosed
                ? 'bg-slate-800/90 text-slate-200'
                : msRemaining < 5 * 60 * 1000
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-indigo-600/90 text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {isClosed ? 'Ended' : formatTimeRemaining(msRemaining)}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 text-base line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {auction.title}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Listed by {auction.seller.name}</p>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between">
          <div>
            <span className="text-xs text-slate-500 block">
              {auction.current_price ? 'Current Bid' : 'Starting Price'}
            </span>
            <span className="text-lg font-bold text-slate-900">
              {formatRupees(auction.display_price)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
            <Gavel className="w-3.5 h-3.5 text-slate-600" />
            <span>{auction.bid_count} {auction.bid_count === 1 ? 'bid' : 'bids'}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
