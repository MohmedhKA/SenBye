import React from 'react';
import { BidRecord, AutoBidRecord } from '../lib/types.js';
import { formatRupees, formatRelativeTime } from '../lib/format.js';

interface BidHistoryProps {
  bids: BidRecord[];
  autoBids?: AutoBidRecord[];
  startingPrice: number;
}

export const BidHistory: React.FC<BidHistoryProps> = ({ bids, autoBids = [], startingPrice }) => {
  return (
    <div className="space-y-6">
      {/* Placed Bids Stream */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 text-sm">
            Bid History ({bids.length})
          </h3>
          <span className="text-xs text-gray-500">Live Updates via SSE</span>
        </div>

        {bids.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-sm">No bids placed yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Starting price is {formatRupees(startingPrice)}. Be the first to bid!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 text-xs text-gray-500 uppercase border-b border-gray-100">
                <tr>
                  <th className="py-2.5 px-4">Amount</th>
                  <th className="py-2.5 px-4">Bidder</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bids.map((bid, index) => {
                  const isTop = index === 0;
                  return (
                    <tr
                      key={bid.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        isTop ? 'bg-emerald-50/40 font-medium' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <span className="font-bold text-gray-900">
                          {formatRupees(bid.amount)}
                        </span>
                        {isTop && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                            Leading
                          </span>
                        )}
                        {bid.caused_extension && (
                          <span className="ml-1 inline-block px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded" title="Triggered anti-sniping +60s extension">
                            +60s
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-gray-700">
                        {bid.bidder.name}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs ${
                            bid.source === 'auto'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {bid.source === 'auto' ? '🤖 Auto-Proxy' : '👤 Manual'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-500 text-xs">
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
        <div className="bg-purple-50/50 rounded-xl border border-purple-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🤖</span>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900">
                Active Proxy Auto-Bids (Rule A6)
              </h4>
              <p className="text-xs text-purple-700">
                Proxy caps are public for fairness. The engine only raises the price when competing bids arrive.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {autoBids.map((ab, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-1.5 px-3 bg-white/80 rounded border border-purple-100"
              >
                <span className="font-medium text-gray-800">
                  {ab.bidder.name}
                  {ab.via === 'assistant' && (
                    <span className="ml-1 text-[10px] text-purple-600 font-mono">(via AI)</span>
                  )}
                </span>
                <span className="font-bold text-purple-900">
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
