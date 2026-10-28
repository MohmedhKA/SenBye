import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { AuctionSummary } from '../lib/types.js';
import { apiFetch, ApiError } from '../lib/api.js';
import { formatRupees, formatTimeRemaining } from '../lib/format.js';
import { Plus, Edit2, Ban, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';

export function MyListingsPage() {
  const [auctions, setAuctions] = useState<AuctionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states for Cancel and Relist
  const [cancelModalAuction, setCancelModalAuction] = useState<AuctionSummary | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [relistModalAuction, setRelistModalAuction] = useState<AuctionSummary | null>(null);
  const [relistCloseTime, setRelistCloseTime] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadMyAuctions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<AuctionSummary[]>('/api/me/auctions?role=selling');
      setAuctions(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your listings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyAuctions();
  }, [loadMyAuctions]);

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalAuction) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/auctions/${cancelModalAuction.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      });
      setCancelModalAuction(null);
      setCancelReason('');
      await loadMyAuctions();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Cancellation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relistModalAuction) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/auctions/${relistModalAuction.id}/relist`, {
        method: 'POST',
        body: JSON.stringify({ closes_at: new Date(relistCloseTime).toISOString() }),
      });
      setRelistModalAuction(null);
      setRelistCloseTime('');
      await loadMyAuctions();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Relisting failed');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configMap: Record<string, { label: string; color: string }> = {
      open: { label: 'Active', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      pending_approval: { label: 'Pending Approval', color: 'bg-amber-50 text-amber-700 border-amber-200' },
      reserved: { label: 'Reserved / Pickup', color: 'bg-blue-50 text-blue-700 border-blue-200' },
      sold: { label: 'Sold', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      unsold: { label: 'Unsold', color: 'bg-slate-100 text-slate-700 border-slate-200' },
      rejected: { label: 'Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200' },
      cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-500 border-slate-200' },
      failed_pickup: { label: 'Failed Pickup', color: 'bg-red-50 text-red-700 border-red-200' },
    };
    const c = configMap[status] || { label: status, color: 'bg-slate-100 text-slate-600' };
    return (
      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${c.color}`}>
        {c.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Sales & Listings</h1>
          <p className="text-sm text-slate-600">Track and manage items you have put up for auction.</p>
        </div>
        <Link
          to="/sell/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          List New Item
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading your listings...</div>
      ) : auctions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
          <h3 className="text-lg font-bold text-slate-800">You haven&apos;t listed any items yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Ready to pass on your cycle, books, or electronics? Put them up for an auction in under 2 minutes.
          </p>
          <Link
            to="/sell/new"
            className="inline-block px-5 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Create Your First Listing
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
          {auctions.map((item) => {
            const msRemaining = Math.max(0, new Date(item.closes_at).getTime() - Date.now());
            const canRelist = ['unsold', 'rejected', 'cancelled', 'failed_pickup'].includes(item.status);

            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                {/* Item Summary */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                    {item.photo ? (
                      <img
                        src={`/uploads/${item.photo}`}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                        No pic
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(item.status)}
                      <span className="text-xs text-slate-500 uppercase tracking-wider">{item.category}</span>
                    </div>
                    <Link
                      to={`/auctions/${item.id}`}
                      className="font-semibold text-slate-900 hover:text-indigo-600 line-clamp-1 text-base transition-colors"
                    >
                      {item.title}
                    </Link>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                      <span>Price: <strong className="text-slate-900">{formatRupees(item.display_price)}</strong></span>
                      <span>Bids: <strong className="text-slate-900">{item.bid_count}</strong></span>
                      {item.status === 'open' && (
                        <span>Closes in: <strong>{formatTimeRemaining(msRemaining)}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Link
                    to={`/auctions/${item.id}`}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="View Auction"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>

                  {item.status === 'open' && (
                    <>
                      <Link
                        to={`/sell/${item.id}/edit`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </Link>
                      <button
                        onClick={() => setCancelModalAuction(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </>
                  )}

                  {canRelist && (
                    <button
                      onClick={() => {
                        const defaultClose = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                        const isoLocal = new Date(
                          defaultClose.getTime() - defaultClose.getTimezoneOffset() * 60000
                        )
                          .toISOString()
                          .slice(0, 16);
                        setRelistCloseTime(isoLocal);
                        setRelistModalAuction(item);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Relist
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Modal (Rule L4) */}
      {cancelModalAuction && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Cancel Auction</h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to cancel &quot;{cancelModalAuction.title}&quot;? All active bidders will be notified.
            </p>
            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Cancellation (3–200 characters)
                </label>
                <textarea
                  required
                  minLength={3}
                  maxLength={200}
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Item broken accidentally, sold elsewhere, decided to keep..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelModalAuction(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50"
                >
                  Keep Auction
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || cancelReason.trim().length < 3}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                >
                  {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Relist Modal (Rule L5) */}
      {relistModalAuction && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Relist Item</h3>
            <p className="text-sm text-slate-600">
              Create a fresh auction copying details and photos from &quot;{relistModalAuction.title}&quot;.
            </p>
            <form onSubmit={handleRelistSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Closing Time (Min 10m from now)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={relistCloseTime}
                  onChange={(e) => setRelistCloseTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRelistModalAuction(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !relistCloseTime}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                >
                  {actionLoading ? 'Relisting...' : 'Start New Auction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
