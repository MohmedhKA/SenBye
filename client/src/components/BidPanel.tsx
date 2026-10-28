import React, { useState } from 'react';
import { AuctionDetail, User } from '../lib/types.js';
import { apiFetch, ApiError } from '../lib/api.js';
import { formatRupees } from '../lib/format.js';
import { Link } from 'react-router-dom';

interface BidPanelProps {
  auction: AuctionDetail;
  currentUser: User | null;
  onBidSuccess: () => void;
}

export const BidPanel: React.FC<BidPanelProps> = ({
  auction,
  currentUser,
  onBidSuccess,
}) => {
  const [manualAmount, setManualAmount] = useState<number>(auction.min_next_bid);
  const [autoAmount, setAutoAmount] = useState<number>(auction.min_next_bid + auction.min_increment);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [isSubmittingAuto, setIsSubmittingAuto] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Keep manual bid input in sync when min_next_bid changes from outside
  React.useEffect(() => {
    setManualAmount((prev) => Math.max(prev, auction.min_next_bid));
    setAutoAmount((prev) => Math.max(prev, auction.min_next_bid + auction.min_increment));
  }, [auction.min_next_bid, auction.min_increment]);

  const isSeller = currentUser?.id === auction.seller.id;
  const isLeader = currentUser && auction.bids.length > 0 && auction.bids[0].bidder.id === currentUser.id;
  const isClosed = auction.status !== 'open';

  // Check if current user has an existing auto-bid
  const myAutoBid = currentUser
    ? auction.auto_bids.find((ab) => ab.bidder.id === currentUser.id)
    : null;

  const handleManualBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (manualAmount < auction.min_next_bid) {
      setErrorMsg(`Bid must be at least ₹${auction.min_next_bid}`);
      return;
    }

    try {
      setIsSubmittingManual(true);
      await apiFetch(`/api/auctions/${auction.id}/bids`, {
        method: 'POST',
        body: JSON.stringify({ amount: manualAmount }),
      });
      setSuccessMsg(`Bid of ${formatRupees(manualAmount)} placed successfully!`);
      onBidSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to place bid. Please try again.');
      }
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleAutoBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      setIsSubmittingAuto(true);
      await apiFetch(`/api/auctions/${auction.id}/auto-bid`, {
        method: 'PUT',
        body: JSON.stringify({ max_amount: autoAmount }),
      });
      setSuccessMsg(`Auto-bid maximum set to ${formatRupees(autoAmount)}!`);
      onBidSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to set auto-bid. Please try again.');
      }
    } finally {
      setIsSubmittingAuto(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <h3 className="font-bold text-amber-900 mb-2">Login to Participate</h3>
        <p className="text-sm text-amber-800 mb-4">
          You must be signed in with your campus account to place bids or set auto-bids.
        </p>
        <Link
          to={`/login?redirect=/auctions/${auction.id}`}
          className="inline-block px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-sm transition-colors"
        >
          Sign In to Bid
        </Link>
      </div>
    );
  }

  if (isSeller) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <span className="text-2xl">🏷️</span>
        <h3 className="font-bold text-gray-800 mt-2">Your Listing</h3>
        <p className="text-sm text-gray-600 mt-1">
          As the seller, you cannot place bids on your own auction (Rule B2).
        </p>
      </div>
    );
  }

  if (isClosed) {
    return (
      <div className="bg-gray-100 border border-gray-200 rounded-xl p-6 text-center">
        <h3 className="font-bold text-gray-700">Auction Closed</h3>
        <p className="text-sm text-gray-500 mt-1">
          Bidding has concluded for this item (Status: {auction.status}).
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
      {/* Price Summary */}
      <div className="flex justify-between items-baseline border-b border-gray-100 pb-4">
        <div>
          <span className="text-xs uppercase font-bold text-gray-400">Current Price</span>
          <div className="text-3xl font-black text-emerald-600">
            {formatRupees(auction.display_price)}
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase font-bold text-gray-400">Next Minimum Bid</span>
          <div className="text-lg font-bold text-gray-900">
            {formatRupees(auction.min_next_bid)}
          </div>
          <span className="text-xs text-gray-500">
            (+{formatRupees(auction.min_increment)} min increment)
          </span>
        </div>
      </div>

      {/* Status Alerts */}
      {isLeader && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-sm font-medium">
          <span>🏆</span>
          <span>You are currently the leading bidder! You do not need to bid right now.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {successMsg}
        </div>
      )}

      {/* Manual Bid Form */}
      <div>
        <h4 className="text-sm font-bold text-gray-900 mb-2">Place Direct Bid</h4>
        <form onSubmit={handleManualBid} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-gray-500 font-bold">₹</span>
              <input
                type="number"
                min={auction.min_next_bid}
                step="1"
                value={manualAmount}
                onChange={(e) => setManualAmount(parseInt(e.target.value, 10) || 0)}
                disabled={isLeader || isSubmittingManual}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
            <button
              type="submit"
              disabled={isLeader || isSubmittingManual || manualAmount < auction.min_next_bid}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold rounded-lg transition-colors"
            >
              {isSubmittingManual ? 'Bidding...' : 'Bid'}
            </button>
          </div>

          {/* Quick Increment Buttons */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-gray-400 self-center">Quick:</span>
            {[1, 2, 5].map((multiplier) => {
              const suggested = auction.min_next_bid + auction.min_increment * (multiplier - 1);
              return (
                <button
                  type="button"
                  key={multiplier}
                  onClick={() => setManualAmount(suggested)}
                  disabled={isLeader || isSubmittingManual}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors disabled:opacity-50"
                >
                  {formatRupees(suggested)}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-gray-500">
            ⚠️ Bids are binding and irrevocable (Rule B6). Bidding in the last 30s extends the auction by 60s (Rule E1).
          </p>
        </form>
      </div>

      <hr className="border-gray-100" />

      {/* Auto-Bid Form (Rules A1-A6) */}
      <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-100">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-purple-900 flex items-center gap-1.5">
            <span>🤖</span>
            <span>Set Proxy Auto-Bid</span>
          </h4>
          {myAutoBid && (
            <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
              Current Cap: {formatRupees(myAutoBid.max_amount)}
            </span>
          )}
        </div>
        <p className="text-xs text-purple-700 mb-3">
          SenBye will bid for you automatically in minimum increments up to your maximum cap. Maximums can only be raised, not lowered.
        </p>

        <form onSubmit={handleAutoBid} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-gray-500 font-bold">₹</span>
              <input
                type="number"
                min={myAutoBid ? myAutoBid.max_amount + 1 : auction.min_next_bid}
                step="1"
                value={autoAmount}
                onChange={(e) => setAutoAmount(parseInt(e.target.value, 10) || 0)}
                disabled={isSubmittingAuto}
                className="w-full pl-8 pr-3 py-2 border border-purple-200 rounded-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmittingAuto || Boolean(myAutoBid && autoAmount <= myAutoBid.max_amount)}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-bold rounded-lg transition-colors text-sm"
            >
              {isSubmittingAuto ? 'Saving...' : myAutoBid ? 'Raise Max' : 'Set Auto-Bid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
