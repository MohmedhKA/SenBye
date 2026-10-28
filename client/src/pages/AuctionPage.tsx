import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AuctionDetail } from '../lib/types.js';
import { apiFetch, ApiError } from '../lib/api.js';
import { syncServerClock } from '../lib/clock.js';
import { subscribeToAuctionStream } from '../lib/stream.js';
import { useAuth } from '../context/AuthContext.js';
import { Countdown } from '../components/Countdown.js';
import { BidPanel } from '../components/BidPanel.js';
import { BidHistory } from '../components/BidHistory.js';
import { SellerActions } from '../components/SellerActions.js';
import { QASection } from '../components/QASection.js';
import { formatRupees, formatCondition, formatCategory, formatRelativeTime, photoUrl } from '../lib/format.js';

export function AuctionPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extensionFlash, setExtensionFlash] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiFetch<AuctionDetail>(`/api/auctions/${id}`);
      setAuction(data);
      if (data.server_time) {
        syncServerClock(data.server_time);
      }
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load auction details.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Subscribe to live SSE updates for this auction
  useEffect(() => {
    if (!id) return;

    const unsubscribe = subscribeToAuctionStream(id, (eventType, data) => {
      if (eventType === 'snapshot') {
        setAuction(data);
        if (data.server_time) syncServerClock(data.server_time);
      } else if (eventType === 'bid') {
        setAuction((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            current_price: data.current_price,
            display_price: data.current_price ?? prev.starting_price,
            leader_name: data.leader_name,
            bid_count: data.bid_count,
            closes_at: data.closes_at,
            extension_count: data.extension_count,
            min_next_bid: data.min_next_bid,
            bids: data.bids ?? prev.bids,
          };
        });
      } else if (eventType === 'extended') {
        setExtensionFlash(true);
        setTimeout(() => setExtensionFlash(false), 3000);
        setAuction((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            closes_at: data.new_closes_at,
            extension_count: prev.extension_count + 1,
          };
        });
      } else if (eventType === 'closed') {
        fetchDetail();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [id, fetchDetail]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-12 px-4 text-center">
        <div className="inline-block animate-spin text-3xl mb-3">🔄</div>
        <p className="text-gray-500 font-medium">Loading auction details...</p>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-red-50 border border-red-200 rounded-xl text-center">
        <span className="text-3xl">⚠️</span>
        <h2 className="text-lg font-bold text-red-900 mt-2">Auction Not Found</h2>
        <p className="text-sm text-red-700 mt-1">{error || 'This listing does not exist or has been removed.'}</p>
        <Link
          to="/"
          className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          Return to Browse
        </Link>
      </div>
    );
  }

  const isSeller = user?.id === auction.seller.id;
  const isWinner = Boolean(user && auction.winner && user.id === auction.winner.id);
  const activePhoto = auction.photos[activePhotoIdx];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Extension alert banner */}
      {extensionFlash && (
        <div className="p-4 bg-orange-600 text-white text-center font-bold text-sm rounded-2xl shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 animate-bounce">
          <span>⚡</span>
          <span>Anti-Sniping Triggered! Closing time extended by +60 seconds! (Rule E1)</span>
        </div>
      )}

      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <Link to="/" className="hover:underline text-blue-600 font-semibold">Campus Auctions</Link>
          <span>/</span>
          <span className="capitalize">{formatCategory(auction.category)}</span>
          <span>/</span>
          <span className="text-slate-900 font-bold truncate max-w-xs">{auction.title}</span>
        </div>

        {isSeller && auction.bid_count === 0 && auction.status === 'open' && (
          <Link
            to={`/sell/${auction.id}/edit`}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors"
          >
            ✏️ Edit Listing
          </Link>
        )}
      </div>

      {/* Main Grid: Left Column (Photos & Info) | Right Column (Actions & Stream) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Photo Gallery */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
            <div className="w-full aspect-[4/3] bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center border border-gray-100">
              <img
                src={photoUrl(activePhoto)}
                alt={auction.title}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-family="sans-serif" font-size="16">No Photo</text></svg>';
                }}
              />
            </div>

            {/* Thumbnails */}
            {auction.photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {auction.photos.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePhotoIdx(idx)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 ${
                      activePhotoIdx === idx ? 'border-blue-600 ring-2 ring-blue-100' : 'border-gray-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={photoUrl(url)} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Item Description & Specs */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">
                {formatCategory(auction.category)}
              </span>
              <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                Condition: {formatCondition(auction.condition)}
              </span>
            </div>

            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              {auction.title}
            </h1>

            <div className="prose prose-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {auction.description}
            </div>

            <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-400 block">Starting Price</span>
                <span className="font-bold text-gray-800 text-sm">{formatRupees(auction.starting_price)}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Min Increment</span>
                <span className="font-bold text-gray-800 text-sm">{formatRupees(auction.min_increment)}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Listed By</span>
                <span className="font-bold text-gray-800 text-sm">{auction.seller.name}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Original Close</span>
                <span className="font-medium text-gray-600">{formatRelativeTime(auction.original_closes_at)}</span>
              </div>
            </div>
          </div>

          {/* Interactive Sale & Handover Workflow (Milestone M3) */}
          <SellerActions
            auction={auction}
            currentUser={user}
            onActionComplete={fetchDetail}
          />

          {/* Outcome & Contact Card (if closed) */}
          {auction.status !== 'open' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
              <h3 className="font-bold text-emerald-900 text-base mb-1">
                Auction Outcome: <span className="uppercase">{auction.status}</span>
              </h3>
              {auction.winner && (
                <p className="text-sm text-emerald-800">
                  Winning Bidder: <span className="font-bold">{auction.winner.name}</span> at {formatRupees(auction.current_price || auction.starting_price)}
                  {isWinner && (
                    <span className="ml-2 px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded font-bold text-xs">
                      🎉 That’s you!
                    </span>
                  )}
                </p>
              )}
              {auction.outcome_reason && (
                <p className="text-xs text-emerald-700 mt-1 italic">
                  Note: {auction.outcome_reason}
                </p>
              )}

              {/* Private contact disclosure for winner & seller only (Rule S2) */}
              {auction.counterparty_contact && (
                <div className="mt-4 p-4 bg-white rounded-xl border border-emerald-300">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 block mb-1">
                    📞 Handover Contact Information
                  </span>
                  <p className="text-sm font-semibold text-gray-900">
                    {auction.counterparty_contact}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {isSeller ? 'This is the winning buyer’s contact details for item collection.' : 'This is the senior’s contact details for item handover.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Public Anti-Spam Q&A Thread (Rules Q1–Q8) */}
          <QASection
            auctionId={auction.id}
            sellerId={auction.seller.id}
            currentUser={user}
          />
        </div>

        {/* Right Column (Live Bidding Controls & History) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Countdown & Extension Indicator */}
          <Countdown
            closesAt={auction.closes_at}
            extensionCount={auction.extension_count}
          />

          {/* Interactive Bid Submission Panel */}
          <BidPanel
            auction={auction}
            currentUser={user}
            onBidSuccess={fetchDetail}
          />

          {/* Real-time Bid History Table & Transparent Auto-Bid Caps */}
          <BidHistory
            bids={auction.bids}
            autoBids={auction.auto_bids}
            startingPrice={auction.starting_price}
          />
        </div>
      </div>
    </div>
  );
}
