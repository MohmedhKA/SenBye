import React, { useState } from 'react';
import { AuctionDetail, User } from '../lib/types.js';
import { apiFetch, ApiError } from '../lib/api.js';
import { formatRupees, formatRelativeTime } from '../lib/format.js';
import { Countdown } from './Countdown.js';

interface SellerActionsProps {
  auction: AuctionDetail;
  currentUser: User | null;
  onActionComplete: () => void;
}

export const SellerActions: React.FC<SellerActionsProps> = ({
  auction,
  currentUser,
  onActionComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Failed pickup modal
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [failedReason, setFailedReason] = useState('');

  if (!currentUser) {
    return null;
  }

  const isSeller = currentUser.id === auction.seller.id;
  const isWinner = Boolean(auction.winner && currentUser.id === auction.winner.id);

  if (!isSeller && !isWinner && auction.status === 'open') {
    return null;
  }

  const handleApprove = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await apiFetch(`/api/auctions/${auction.id}/approve`, {
        method: 'POST',
      });
      onActionComplete();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      await apiFetch(`/api/auctions/${auction.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      setShowRejectModal(false);
      setRejectReason('');
      onActionComplete();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Rejection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleHandover = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await apiFetch(`/api/auctions/${auction.id}/handover`, {
        method: 'POST',
      });
      onActionComplete();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Handover confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFailedPickupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      await apiFetch(`/api/auctions/${auction.id}/failed-pickup`, {
        method: 'POST',
        body: JSON.stringify({ reason: failedReason.trim() }),
      });
      setShowFailedModal(false);
      setFailedReason('');
      onActionComplete();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Reporting failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* STATE 1: Pending Approval */}
      {auction.status === 'pending_approval' && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚖️</span>
            <div>
              <h3 className="text-base font-bold text-amber-900">
                Winning Bid Awaiting Decision (Rule S1)
              </h3>
              <p className="text-xs text-amber-800">
                {auction.winner?.name} has won the auction with a final bid of{' '}
                <span className="font-bold">{formatRupees(auction.display_price)}</span>.
              </p>
            </div>
          </div>

          {isSeller ? (
            <div className="pt-2 border-t border-amber-200/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={handleApprove}
                disabled={loading}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-xl transition-colors shadow-xs text-center justify-center whitespace-nowrap"
              >
                {loading ? 'Approving...' : '✓ Approve Winning Bid'}
              </button>
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition-colors text-center justify-center whitespace-nowrap"
              >
                ✕ Reject Bid with Reason
              </button>
            </div>
          ) : isWinner ? (
            <div className="p-3 bg-white/80 rounded-xl text-xs text-amber-900 border border-amber-200">
              🎉 You placed the winning bid! Waiting for the seller to approve the sale. You will be notified when contact details are unlocked.
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              This auction closed and is currently awaiting seller approval.
            </p>
          )}
        </div>
      )}

      {/* STATE 2: Reserved & Handover Coordination */}
      {auction.status === 'reserved' && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block">
                Sale in Progress
              </span>
              <h3 className="text-lg font-black text-blue-950">
                Item Reserved — Coordinate In-Person Handover
              </h3>
            </div>
            {auction.pickup_deadline && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-700">Pickup Deadline:</span>
                <Countdown closesAt={auction.pickup_deadline} compact />
              </div>
            )}
          </div>

          {/* Contact Details (Rule S2) */}
          {(isSeller || isWinner) && auction.counterparty_contact && (
            <div className="p-4 bg-white rounded-xl border border-blue-200 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
                📞 {isSeller ? `Winning Buyer's Contact (${auction.winner?.name})` : `Senior Seller's Contact (${auction.seller.name})`}
              </span>
              <p className="text-sm font-black text-gray-900">
                {auction.counterparty_contact}
              </p>
              <p className="text-[11px] text-gray-500">
                Use phone/hostel details above to coordinate a meeting place on campus.
              </p>
            </div>
          )}

          {/* Dual Handover Tracker (Rule S4) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
              Dual Handover Confirmation Matrix (Rule S4)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div
                className={`p-3 rounded-xl border ${
                  auction.seller_handover_at
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-white border-blue-200 text-gray-600'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <span>{auction.seller_handover_at ? '✅' : '⏳'}</span>
                  <span>Senior Seller Confirmation</span>
                </div>
                <p className="text-[11px] mt-1 opacity-80">
                  {auction.seller_handover_at
                    ? `Confirmed ${formatRelativeTime(auction.seller_handover_at)}`
                    : 'Pending seller handover confirmation'}
                </p>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  auction.buyer_handover_at
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-white border-blue-200 text-gray-600'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <span>{auction.buyer_handover_at ? '✅' : '⏳'}</span>
                  <span>Winning Buyer Confirmation</span>
                </div>
                <p className="text-[11px] mt-1 opacity-80">
                  {auction.buyer_handover_at
                    ? `Confirmed ${formatRelativeTime(auction.buyer_handover_at)}`
                    : 'Pending buyer receipt confirmation'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-blue-100">
            <div className="w-full sm:w-auto">
              {isSeller && !auction.seller_handover_at && (
                <button
                  type="button"
                  onClick={handleHandover}
                  disabled={loading}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-xl transition-colors shadow-xs text-center justify-center whitespace-nowrap"
                >
                  {loading ? 'Confirming...' : '🤝 I Handed Over the Item'}
                </button>
              )}

              {isWinner && !auction.buyer_handover_at && (
                <button
                  type="button"
                  onClick={handleHandover}
                  disabled={loading}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-xl transition-colors shadow-xs text-center justify-center whitespace-nowrap"
                >
                  {loading ? 'Confirming...' : '🤝 I Received the Item'}
                </button>
              )}

              {((isSeller && auction.seller_handover_at) || (isWinner && auction.buyer_handover_at)) && (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-lg inline-block text-center sm:text-left">
                  ✓ You have confirmed handover. Awaiting counterparty.
                </span>
              )}
            </div>

            {(isSeller || isWinner) && (
              <button
                type="button"
                onClick={() => setShowFailedModal(true)}
                disabled={loading}
                className="text-xs text-red-600 hover:text-red-700 underline font-medium text-center sm:text-right"
              >
                Report Pickup Issue / Failed Pickup
              </button>
            )}
          </div>
        </div>
      )}

      {/* STATE 3: Sold */}
      {auction.status === 'sold' && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <span className="text-4xl">🎉</span>
          <div>
            <h3 className="text-base font-black text-emerald-950">
              Completed Sale — Item Handed Over
            </h3>
            <p className="text-xs text-emerald-800 mt-0.5">
              Successfully sold to <span className="font-bold">{auction.winner?.name}</span> for{' '}
              <span className="font-bold">{formatRupees(auction.display_price)}</span>. Both parties verified handover.
            </p>
          </div>
        </div>
      )}

      {/* Rejection Modal (Rule S3) */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reject Winning Bid</h3>
            <p className="text-xs text-gray-600">
              Are you sure you want to decline this winning bid? You must provide a clear reason that will be visible on the public record.
            </p>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for Rejection (3–200 characters)
                </label>
                <textarea
                  required
                  minLength={3}
                  maxLength={200}
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Item broken during packing, accidental wrong listing..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || rejectReason.trim().length < 3}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Failed Pickup Modal (Rule S5) */}
      {showFailedModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Report Failed Pickup</h3>
            <p className="text-xs text-gray-600">
              Declare that in-person pickup could not be concluded. This will mark the auction outcome as failed pickup.
            </p>
            <form onSubmit={handleFailedPickupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason (3–200 characters)
                </label>
                <textarea
                  required
                  minLength={3}
                  maxLength={200}
                  rows={3}
                  value={failedReason}
                  onChange={(e) => setFailedReason(e.target.value)}
                  placeholder="e.g. Counterparty did not show up, item not as described..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFailedModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50"
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  disabled={loading || failedReason.trim().length < 3}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Reporting...' : 'Confirm Failed Pickup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
