import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch, ApiError } from '../lib/api.js';
import { formatRupees, formatRelativeTime, formatCategory } from '../lib/format.js';
import type { Want } from '../lib/types.js';
import {
  BookmarkCheck,
  Plus,
  Trash2,
  Search,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

const CATEGORIES = [
  { value: '', label: 'All Categories (Any)' },
  { value: 'cycle', label: 'Cycles' },
  { value: 'calculator', label: 'Calculators' },
  { value: 'books', label: 'Books & Notes' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'furniture', label: 'Hostel Furniture' },
  { value: 'other', label: 'Other Gear' },
];

export function WantsPage() {
  const { user } = useAuth();
  const [wants, setWants] = useState<Want[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [keywords, setKeywords] = useState('');
  const [category, setCategory] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Deleting state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    async function loadWants() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiFetch<Want[]>('/api/wants');
        setWants(data);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load saved wants');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadWants();
  }, [user]);

  async function handleCreateWant(e: React.FormEvent) {
    e.preventDefault();
    if (!keywords.trim()) {
      setError('Please enter item keywords');
      return;
    }

    const priceNum = parseInt(maxPrice, 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Please enter a valid maximum price in ₹');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const created = await apiFetch<Want>('/api/wants', {
        method: 'POST',
        body: JSON.stringify({
          keywords: keywords.trim(),
          category: category ? category : null,
          max_price: priceNum,
        }),
      });

      setWants((prev) => [created, ...prev]);
      setKeywords('');
      setCategory('');
      setMaxPrice('');
      setShowAddForm(false);
      setSuccessMsg(
        created.matches_count && created.matches_count > 0
          ? `Saved! Found ${created.matches_count} existing item(s) matching your criteria.`
          : 'Saved! You will receive an instant notification whenever a matching item is listed.'
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create saved want');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteWant(wantId: number) {
    if (!window.confirm('Are you sure you want to delete this saved want?')) {
      return;
    }

    try {
      setDeletingId(wantId);
      await apiFetch(`/api/wants/${wantId}`, {
        method: 'DELETE',
      });
      setWants((prev) => prev.filter((w) => w.id !== wantId));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to delete saved want');
      }
    } finally {
      setDeletingId(null);
    }
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
          <BookmarkCheck className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Saved Wants & Alerts</h1>
        <p className="text-slate-600 max-w-md mx-auto mb-6">
          Sign in to save what you're looking for. SenBye will monitor campus auctions 24/7 and alert you the second a matching item is posted.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-xs"
        >
          Sign In to Continue
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Saved Wants & Alerts</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="w-3 h-3" />
              Automated Match Engine
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Specify what you need. When graduating seniors list matching items within your budget, you'll be alerted immediately.
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setError(null);
            setSuccessMsg(null);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? 'Close Form' : 'New Saved Want'}
        </button>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">{successMsg}</div>
        </div>
      )}

      {/* Add Want Form Modal / Card */}
      {showAddForm && (
        <form
          onSubmit={handleCreateWant}
          className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm space-y-4 ring-2 ring-indigo-500/10"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">Create Item Alert</h2>
            <span className="text-xs text-slate-500">Rules W1–W4</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Keywords */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Keywords <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. Casio scientific calculator, Hercules cycle, Drafter"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                required
              />
              <span className="text-xs text-slate-500 mt-1 block">
                Full-text search matches item titles and descriptions.
              </span>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category (Optional)</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500 mt-1 block">Limit alerts to a specific department/gear.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Max Budget */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Max Budget (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-slate-400 font-medium">₹</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full pl-7 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  required
                />
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                Matches when starting price ≤ this amount.
              </span>
            </div>

            <div className="md:col-span-2 flex items-end justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                {isSubmitting ? 'Saving...' : 'Save & Check Matches'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Wants List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : wants.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">No saved wants yet</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
              Add the textbooks, lab equipment, or campus gear you are looking for and get notified the moment a junior or senior posts them.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-slate-400">Popular ideas:</span>
            {['Scientific Calculator', 'Geared Cycle', 'Hostel Table Lamp', 'Engineering Drafter'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setKeywords(tag);
                  setMaxPrice('1000');
                  setShowAddForm(true);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {wants.map((want) => {
            const browseQuery = new URLSearchParams();
            browseQuery.set('q', want.keywords);
            if (want.category) browseQuery.set('category', want.category);
            browseQuery.set('max_price', want.max_price.toString());
            const browseUrl = `/?${browseQuery.toString()}`;

            return (
              <div
                key={want.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-slate-900 tracking-tight">
                          {want.keywords}
                        </span>
                        {want.category && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {formatCategory(want.category)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-indigo-600">
                        Budget: Up to {formatRupees(want.max_price)}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteWant(want.id)}
                      disabled={deletingId === want.id}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50"
                      title="Delete want"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Added {formatRelativeTime(want.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {want.matches_count !== undefined && want.matches_count > 0 ? (
                      <Link
                        to={browseUrl}
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full transition-colors"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{want.matches_count} matched</span>
                        <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                      </Link>
                    ) : (
                      <Link
                        to={browseUrl}
                        className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                      >
                        <span>Search now</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
