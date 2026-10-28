import React, { useState } from 'react';
import { AuctionDetail, User } from '../lib/types.js';
import { apiFetch, ApiError } from '../lib/api.js';
import { formatRupees } from '../lib/format.js';
import { Link } from 'react-router-dom';
import { Gavel, Sparkles, Trophy, ShieldAlert, CheckCircle2 } from 'lucide-react';

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
      <div className="bg-orange-50/80 border border-orange-200 rounded-2xl p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto text-orange-600">
          <Gavel className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-orange-950 text-base">Sign In to Bid</h3>
          <p className="text-xs text-orange-800 mt-1 max-w-sm mx-auto">
            You must be signed in with your campus account to submit manual bids or set proxy auto-bids.
          </p>
        </div>
        <Link
          to={`/login?redirect=/auctions/${auction.id}`}
          className="inline-block px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all"
        >
          Sign In with Campus ID
        </Link>
      </div>
    );
  }

  if (isSeller) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-slate-900">Your Senior Listing</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          As the seller, you cannot place bids on your own auction (Rule B2). Watch incoming bids live below!
        </p>
      </div>
    );
  }

  if (isClosed) {
    return (
      <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center space-y-1">
        <h3 className="font-bold text-slate-800">Bidding Concluded</h3>
        <p className="text-xs text-slate-500">
          This auction is no longer accepting bids (Status: <span className="uppercase font-semibold">{auction.status}</span>).
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-6">
      {/* Price Summary */}
      <div className="flex justify-between items-baseline border-b border-slate-100 pb-4">
        <div>
          <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
            Current Price
          </span>
          <div className="text-3xl font-extrabold text-blue-600 tracking-tight">
            {formatRupees(auction.display_price)}
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
            Next Minimum Bid
          </span>
          <div className="text-xl font-bold text-slate-900">
            {formatRupees(auction.min_next_bid)}
          </div>
          <span className="text-xs text-slate-500">
            (+{formatRupees(auction.min_increment)} min step)
          </span>
        </div>
      </div>

      {/* Status Alerts */}
      {isLeader && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-900 text-xs sm:text-sm font-semibold">
          <Trophy className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>You are currently the leading bidder! You hold the winning position.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs sm:text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs sm:text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Manual Bid Form */}
      <div>
        <h4 className="text-sm font-bold text-slate-900 mb-2">Place Direct Bid</h4>
        <form onSubmit={handleManualBid} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-2.5 text-slate-500 font-bold">₹</span>
              <input
                type="number"
                min={auction.min_next_bid}
                step="1"
                value={manualAmount}
                onChange={(e) => setManualAmount(parseInt(e.target.value, 10) || 0)}
                disabled={isLeader || isSubmittingManual}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 transition-all text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isLeader || isSubmittingManual || manualAmount < auction.min_next_bid}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-all shadow-xs text-sm"
            >
              {isSubmittingManual ? 'Bidding...' : 'Bid Now'}
            </button>
          </div>

          {/* Quick Increment Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium">Quick Step:</span>
            {[1, 2, 5].map((multiplier) => {
              const suggested = auction.min_next_bid + auction.min_increment * (multiplier - 1);
              return (
                <button
                  type="button"
                  key={multiplier}
                  onClick={() => setManualAmount(suggested)}
                  disabled={isLeader || isSubmittingManual}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors disabled:opacity-40"
                >
                  {formatRupees(suggested)}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500 leading-tight">
            ⚡ Invariant: Bids in the last 30s auto-extend the timer by +60s (Rule E1). All bids are binding.
          </p>
        </form>
      </div>

      <hr className="border-slate-100" />

      {/* Auto-Bid Form (Rules A1-A6) */}
      <div className="bg-orange-50/60 rounded-2xl p-4 border border-orange-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-orange-950 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-orange-600" />
            <span>Set Proxy Auto-Bid</span>
          </h4>
          {myAutoBid && (
            <span className="text-xs font-bold text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-full border border-orange-200">
              Your Cap: {formatRupees(myAutoBid.max_amount)}
            </span>
          )}
        </div>
        <p className="text-xs text-orange-900/80 leading-relaxed">
          SenBye automatically defends your bid in minimal rungs up to your ceiling. Maximums are published to prevent shill games (Rule A2) and can only be raised.
        </p>

        <form onSubmit={handleAutoBid} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-2.5 text-slate-500 font-bold">₹</span>
              <input
                type="number"
                min={myAutoBid ? myAutoBid.max_amount + 1 : auction.min_next_bid}
                step="1"
                value={autoAmount}
                onChange={(e) => setAutoAmount(parseInt(e.target.value, 10) || 0)}
                disabled={isSubmittingAuto}
                className="w-full pl-8 pr-3 py-2 bg-white border border-orange-200 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmittingAuto || Boolean(myAutoBid && autoAmount <= myAutoBid.max_amount)}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-all shadow-xs text-sm"
            >
              {isSubmittingAuto ? 'Saving...' : myAutoBid ? 'Raise Max' : 'Set Auto-Bid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
