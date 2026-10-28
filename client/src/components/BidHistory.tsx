import React from 'react';
import { BidRecord, AutoBidRecord } from '../lib/types.js';
import { formatRupees, formatRelativeTime } from '../lib/format.js';
import { Sparkles, Trophy, Zap } from 'lucide-react';

interface BidHistoryProps {
  bids: BidRecord[];
  autoBids?: AutoBidRecord[];
  startingPrice: number;
}

export const BidHistory: React.FC<BidHistoryProps> = ({ bids, autoBids = [], startingPrice }) => {
  return (
    <div className="space-y-6">
      {/* Placed Bids Stream */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 text-sm">
            Live Bid History ({bids.length})
          </h3>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            SSE Synced
          </span>
        </div>

        {bids.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-sm font-semibold text-slate-700">No bids placed yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Starting price is {formatRupees(startingPrice)}. Be the first student to bid!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-4">Amount</th>
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Method</th>
                  <th className="py-2.5 px-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bids.map((bid, index) => {
                  const isTop = index === 0;
                  return (
                    <tr
                      key={bid.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isTop ? 'bg-blue-50/40 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <span className="font-bold text-slate-900">
                          {formatRupees(bid.amount)}
                        </span>
                        {isTop && (
                          <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                            <Trophy className="w-2.5 h-2.5 text-emerald-600" />
                            Leading
                          </span>
                        )}
                        {bid.caused_extension && (
                          <span
                            className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-bold rounded-md"
                            title="Triggered anti-sniping +60s extension"
                          >
                            <Zap className="w-2.5 h-2.5 text-orange-600" />
                            +60s
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 font-medium">
                        {bid.bidder.name}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${
                            bid.source === 'auto'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {bid.source === 'auto' ? '🤖 Auto-Proxy' : '👤 Direct'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-xs text-right">
                        {formatRelativeTime(bid.placed_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transparent Auto-Bid Maximums (Rule A6) */}
      {autoBids.length > 0 && (
        <div className="bg-orange-50/60 rounded-2xl border border-orange-200/80 p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-orange-950">
                Transparent Proxy Auto-Bids (Rule A6)
              </h4>
              <p className="text-xs text-orange-900/80">
                Proxy caps are public to guarantee fair play and prevent shill manipulation.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {autoBids.map((ab, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-2 px-3.5 bg-white/90 rounded-xl border border-orange-100 shadow-2xs font-medium"
              >
                <span className="text-slate-800">
                  {ab.bidder.name}
                  {ab.via === 'assistant' && (
                    <span className="ml-1 text-[10px] text-blue-600 font-mono font-semibold">(via AI)</span>
                  )}
                </span>
                <span className="font-bold text-orange-950 font-mono">
                  Cap: {formatRupees(ab.max_amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
