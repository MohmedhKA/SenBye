import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuctionSummary } from '../lib/types.js';
import { apiFetch, ApiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Countdown } from '../components/Countdown.js';
import { formatRupees, formatCategory, formatCondition, photoUrl } from '../lib/format.js';

export function MyBidsPage() {
  const { user } = useAuth();
  const [auctions, setAuctions] = useState<AuctionSummary[]>([]);
  const [filter, setFilter] = useState<'all' | 'leading' | 'outbid' | 'ended'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBiddingAuctions = async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch<AuctionSummary[]>('/api/me/auctions?role=bidding');
      setAuctions(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load your bids.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBiddingAuctions();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-blue-50 border border-blue-200 rounded-2xl text-center">
        <span className="text-3xl">🔐</span>
        <h2 className="text-lg font-bold text-blue-900 mt-2">Sign in Required</h2>
        <p className="text-sm text-blue-700 mt-1">
          Please log in with your campus account to view your active bids and won auctions.
        </p>
        <Link
          to="/login?redirect=/me/bidding"
          className="inline-block mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const filteredAuctions = auctions.filter((a) => {
    const isLeading = a.leader_name === user.name;
    const isClosed = a.status !== 'open';

    if (filter === 'leading') return !isClosed && isLeading;
    if (filter === 'outbid') return !isClosed && !isLeading;
    if (filter === 'ended') return isClosed;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            My Bids & Watchlist
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track auctions you’ve bid on and see if you’re currently winning.
          </p>
        </div>

        <Link
          to="/"
          className="self-start sm:self-auto px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-bold transition-all border border-blue-200"
        >
          🔍 Browse More Gear
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
            filter === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          All ({auctions.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('leading')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
            filter === 'leading'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
          }`}
        >
          🏆 Leading ({auctions.filter((a) => a.status === 'open' && a.leader_name === user.name).length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('outbid')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
            filter === 'outbid'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200'
          }`}
        >
          ⚠️ Outbid ({auctions.filter((a) => a.status === 'open' && a.leader_name !== user.name).length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('ended')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
            filter === 'ended'
              ? 'bg-slate-700 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          Closed ({auctions.filter((a) => a.status !== 'open').length})
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Items List */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-500">
          <div className="inline-block animate-spin text-2xl mb-2">🔄</div>
          <p className="text-sm">Loading your bids...</p>
        </div>
      ) : filteredAuctions.length === 0 ? (
        <div className="py-16 text-center bg-slate-50 rounded-2xl border border-slate-200 p-8 space-y-3">
          <span className="text-4xl">🏷️</span>
          <h3 className="text-base font-bold text-slate-800">No auctions match this filter</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You haven’t placed any bids that match this view. Check the active catalog to place your first bid!
          </p>
          <Link
            to="/"
            className="inline-block mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
          >
            Explore Campus Listings
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAuctions.map((auction) => {
            const isLeading = auction.leader_name === user.name;
            const isClosed = auction.status !== 'open';

            let statusBadge = (
              <span className="px-2.5 py-1 bg-orange-100 border border-orange-200 text-orange-800 text-xs font-bold rounded-lg">
                ⚠️ Outbid
              </span>
            );

            if (!isClosed && isLeading) {
              statusBadge = (
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">
                  🏆 Leading ({formatRupees(auction.display_price)})
                </span>
              );
            } else if (isClosed) {
              statusBadge = (
                <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-md">
                  Status: {auction.status}
                </span>
              );
            }

            return (
              <div
                key={auction.id}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row gap-4 items-center"
              >
                {/* Photo Thumbnail */}
                <div className="w-24 h-24 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100 flex items-center justify-center">
                  <img
                    src={photoUrl(auction.photo)}
                    alt={auction.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f3f4f6"/></svg>';
                    }}
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                    <span className="text-gray-400 capitalize">{formatCategory(auction.category)}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-500">Condition: {formatCondition(auction.condition)}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-500">Seller: {auction.seller.name}</span>
                  </div>

                  <h3 className="font-bold text-gray-900 text-base truncate">
                    <Link to={`/auctions/${auction.id}`} className="hover:text-blue-600 transition-colors">
                      {auction.title}
                    </Link>
                  </h3>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs pt-1">
                    <div>
                      <span className="text-gray-400">Current Price: </span>
                      <span className="font-extrabold text-gray-900 text-sm">
                        {formatRupees(auction.display_price)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Total Bids: </span>
                      <span className="font-bold text-gray-700">{auction.bid_count}</span>
                    </div>
                  </div>
                </div>

                {/* Status & Action */}
                <div className="flex flex-col items-center sm:items-end gap-2.5 flex-shrink-0 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    {statusBadge}
                  </div>

                  <Countdown closesAt={auction.closes_at} compact />

                  <Link
                    to={`/auctions/${auction.id}`}
                    className="w-full sm:w-auto text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors whitespace-nowrap"
                  >
                    {isClosed ? 'View Result' : isLeading ? 'View Auction' : 'Increase Bid ⚡'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
