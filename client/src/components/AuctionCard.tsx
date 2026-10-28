import { Link } from 'react-router-dom';
import type { AuctionSummary } from '../lib/types.js';
import { formatRupees, formatTimeRemaining } from '../lib/format.js';
import { Clock, Image as ImageIcon, Gavel, Zap, ShieldCheck } from 'lucide-react';

export function AuctionCard({ auction }: { auction: AuctionSummary }) {
  const msRemaining = Math.max(0, new Date(auction.closes_at).getTime() - Date.now());
  const isClosed = auction.status !== 'open' || msRemaining <= 0;
  const isCriticalSnipe = !isClosed && msRemaining < 30 * 1000;
  const isClosingSoon = !isClosed && msRemaining < 15 * 60 * 1000;

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
      className="group bg-white border border-slate-200/90 rounded-2xl overflow-hidden hover:border-blue-400 hover:shadow-xl hover:shadow-slate-900/5 transition-all duration-200 flex flex-col"
    >
      {/* Photo Container */}
      <div className="relative aspect-4/3 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
        {auction.photo ? (
          <img
            src={`/uploads/${auction.photo}`}
            alt={auction.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 bg-linear-to-br from-slate-100 to-slate-200 w-full h-full">
            <ImageIcon className="w-10 h-10 mb-1.5 stroke-1 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">Campus Gear</span>
          </div>
        )}

        {/* Category & Condition Floating Tags */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/95 text-slate-800 shadow-sm backdrop-blur-xs capitalize border border-slate-100">
            {auction.category}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-900/85 text-white shadow-sm backdrop-blur-xs">
            {conditionLabels[auction.condition] || auction.condition}
          </span>
        </div>

        {/* Live Dynamic Countdown Pill */}
        <div className="absolute bottom-3 right-3">
          <span
            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg shadow-md backdrop-blur-xs transition-colors ${
              isClosed
                ? 'bg-slate-900/90 text-slate-300'
                : isCriticalSnipe
                ? 'bg-orange-600 text-white animate-pulse ring-2 ring-orange-400/50'
                : isClosingSoon
                ? 'bg-amber-600 text-white'
                : 'bg-blue-600/95 text-white'
            }`}
          >
            {isCriticalSnipe ? (
              <Zap className="w-3.5 h-3.5 text-amber-300 animate-bounce" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            <span>
              {isClosed
                ? 'Ended'
                : isCriticalSnipe
                ? `Snipe Guard: ${formatTimeRemaining(msRemaining)}`
                : formatTimeRemaining(msRemaining)}
            </span>
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base line-clamp-1 group-hover:text-blue-600 transition-colors">
            {auction.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
            <span>By {auction.seller.name}</span>
            <span className="text-slate-300">&bull;</span>
            <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
              <ShieldCheck className="w-3 h-3" />
              Verified Student
            </span>
          </div>
        </div>

        {/* Pricing Row */}
        <div className="pt-3 border-t border-slate-100 flex items-end justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              {auction.current_price ? 'Current Bid' : 'Starting Price'}
            </span>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">
              {formatRupees(auction.display_price)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/60">
            <Gavel className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {auction.bid_count} {auction.bid_count === 1 ? 'bid' : 'bids'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
