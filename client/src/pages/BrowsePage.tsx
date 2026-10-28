import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { AuctionSummary } from '../lib/types.js';
import { apiFetch } from '../lib/api.js';
import { AuctionCard } from '../components/AuctionCard.js';
import { Search, SlidersHorizontal, ArrowUpDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CategoryItem {
  slug: string;
  label: string;
}

export function BrowsePage() {
  const [auctions, setAuctions] = useState<AuctionSummary[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [closingSoon, setClosingSoon] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'ending_soon' | 'newest' | 'price_asc' | 'price_desc'>('ending_soon');
  const [page, setPage] = useState<number>(1);
  const limit = 12;

  // Fetch metadata once for categories
  useEffect(() => {
    apiFetch<{ categories: CategoryItem[] }>('/api/meta')
      .then((res) => setCategories(res.categories || []))
      .catch(() => {});
  }, []);

  // Fetch auctions when filters change
  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedCondition) params.set('condition', selectedCondition);
      if (minPrice) params.set('min_price', minPrice);
      if (maxPrice) params.set('max_price', maxPrice);
      if (closingSoon) params.set('closing_soon', 'true');
      params.set('sort', sortBy);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await apiFetch<{
        items: AuctionSummary[];
        total: number;
        page: number;
        limit: number;
      }>(`/api/auctions?${params.toString()}`);

      setAuctions(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load auctions:', err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedCondition, minPrice, maxPrice, closingSoon, sortBy, page]);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAuctions();
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setSelectedCondition('');
    setMinPrice('');
    setMaxPrice('');
    setClosingSoon(false);
    setSortBy('ending_soon');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search || selectedCategory || selectedCondition || minPrice || maxPrice || closingSoon
  );

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Campus Marketplace</h1>
          <p className="text-indigo-100 text-sm sm:text-base mt-1 max-w-xl">
            Cycles, scientific calculators, textbooks & hostel gear leaving campus. Fair timed bidding with anti-sniping protection.
          </p>
        </div>
        <Link
          to="/sell/new"
          className="self-start md:self-auto px-5 py-2.5 bg-white text-indigo-700 font-semibold rounded-xl hover:bg-indigo-50 shadow-sm transition-colors text-sm"
        >
          Sell Your Items
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by keywords (e.g. cycle, Casio 991, DBMS book)..."
              className="w-full pl-11 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Search
          </button>
        </form>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm scrollbar-none">
          <button
            onClick={() => {
              setSelectedCategory('');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedCategory === ''
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => {
                setSelectedCategory(c.slug);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === c.slug
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Secondary Filters & Sort */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Condition select */}
            <select
              value={selectedCondition}
              onChange={(e) => {
                setSelectedCondition(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Any Condition</option>
              <option value="new">Brand New</option>
              <option value="like_new">Like New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>

            {/* Price inputs */}
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Min ₹"
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPage(1);
                }}
                className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                placeholder="Max ₹"
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPage(1);
                }}
                className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm"
              />
            </div>

            {/* Closing soon checkbox */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={closingSoon}
                onChange={(e) => {
                  setClosingSoon(e.target.checked);
                  setPage(1);
                }}
                className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Closing in 24h
            </label>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-slate-500 hover:text-red-600 font-medium transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 flex items-center gap-1 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="ending_soon">Ending Soon</option>
              <option value="newest">Recently Listed</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Auction Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="border border-slate-200 rounded-xl p-4 bg-white animate-pulse space-y-3"
            >
              <div className="aspect-4/3 bg-slate-200 rounded-lg" />
              <div className="h-4 bg-slate-200 rounded-sm w-3/4" />
              <div className="h-4 bg-slate-200 rounded-sm w-1/2" />
            </div>
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <SlidersHorizontal className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800">No auctions match your filters</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Try adjusting your search keywords, price range, or category filter. You can also save a Want to be alerted when someone lists it!
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Clear all filters
            </button>
            <Link
              to="/wants"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Save a Want alert
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {auctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {total > limit && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} auctions
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-xs font-medium text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
