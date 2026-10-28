import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { AuctionSummary } from '../lib/types.js';
import { apiFetch } from '../lib/api.js';
import { AuctionCard } from '../components/AuctionCard.js';
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  Bike,
  Calculator,
  BookOpen,
  BedDouble,
  Lamp,
  FlaskConical,
  LayoutGrid,
  Zap,
  ShieldCheck,
  Plus,
  BookmarkCheck,
  ArrowUpDown,
} from 'lucide-react';

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

  // Category Icon Resolver
  const getCategoryIcon = (slug: string) => {
    switch (slug) {
      case 'cycles':
        return <Bike className="w-4 h-4 text-orange-500" />;
      case 'calculators':
        return <Calculator className="w-4 h-4 text-blue-600" />;
      case 'textbooks':
        return <BookOpen className="w-4 h-4 text-emerald-600" />;
      case 'hostel-gear':
        return <BedDouble className="w-4 h-4 text-amber-600" />;
      case 'electronics':
        return <Lamp className="w-4 h-4 text-sky-600" />;
      case 'lab-equipment':
        return <FlaskConical className="w-4 h-4 text-rose-600" />;
      default:
        return <LayoutGrid className="w-4 h-4 text-slate-500" />;
    }
  };

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
    <div className="space-y-8">
      {/* Collegiate Editorial Hero Banner */}
      <div className="relative rounded-3xl bg-linear-to-br from-slate-900 via-slate-900 to-blue-950 text-white p-6 sm:p-10 overflow-hidden shadow-2xl border border-slate-800">
        {/* Ambient atmospheric glows */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-orange-500/15 blur-3xl pointer-events-none"></div>
        <div className="absolute right-1/4 -bottom-20 w-72 h-72 rounded-full bg-blue-600/20 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-orange-300">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
              <span>Class of 2026 Clearance &bull; Verified .edu Campus IDs</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Pass down iconic hostel gear. <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-400 via-amber-300 to-blue-300">
                Seniors move on. Good stuff moves forward.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
              Every bid inside the final 30 seconds triggers the anti-sniping extension (+60s). Inspect cycles, calculators, and hostel gear in person before dual-confirmation handover.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/sell/new"
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-600/30 flex items-center gap-2 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Sell Your Gear</span>
              </Link>
              <Link
                to="/wants"
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/15 flex items-center gap-2 transition-all"
              >
                <BookmarkCheck className="w-4 h-4 text-orange-400" />
                <span>Create Saved Want</span>
              </Link>
            </div>
          </div>

          {/* Live Campus Pulse Card */}
          <div className="lg:col-span-4 bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
                Campus Marketplace Pulse
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Live
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-2xl font-mono font-bold text-white">{total}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Active Campus Listings</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-2xl font-mono font-bold text-orange-400">+60s</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Anti-Snipe Guard</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-2xl font-mono font-bold text-emerald-400">100%</div>
                <div className="text-[11px] text-slate-400 mt-0.5">In-Person Dual Sign</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-2xl font-mono font-bold text-blue-400">₹0</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Platform Middleman Fee</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => {
            setSelectedCategory('');
            setPage(1);
          }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shrink-0 transition-all ${
            selectedCategory === ''
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-400'
          }`}
        >
          <LayoutGrid className="w-4 h-4 text-blue-500" />
          <span>All Items</span>
        </button>

        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => {
              setSelectedCategory(c.slug);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shrink-0 transition-all ${
              selectedCategory === c.slug
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-400'
            }`}
          >
            {getCategoryIcon(c.slug)}
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Search & Filter Controls Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Search input with live submit */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cycles, calculators, books, hostel room gear..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-blue-600/20 transition-all"
          >
            Search
          </button>
        </form>

        {/* Filter Toolbar Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
          {/* Condition selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Condition
            </label>
            <select
              value={selectedCondition}
              onChange={(e) => {
                setSelectedCondition(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-blue-500"
            >
              <option value="">All Conditions</option>
              <option value="new">Brand New (Sealed/Unused)</option>
              <option value="like_new">Like New (Spotless)</option>
              <option value="good">Good (Lightly Used)</option>
              <option value="fair">Fair (Normal Wear)</option>
              <option value="poor">Usable (Budget Friendly)</option>
            </select>
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Price Range (₹)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPage(1);
                }}
                className="w-1/2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-blue-500"
              />
              <span className="text-slate-400">&ndash;</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPage(1);
                }}
                className="w-1/2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          {/* Closing Soon Toggle */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Urgency
            </label>
            <button
              type="button"
              onClick={() => {
                setClosingSoon(!closingSoon);
                setPage(1);
              }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                closingSoon
                  ? 'bg-orange-50 border-orange-400 text-orange-700 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${closingSoon ? 'text-orange-600 animate-pulse' : 'text-slate-400'}`} />
              <span>Closing Soon (&lt; 2h)</span>
            </button>
          </div>

          {/* Sort By Dropdown */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Sort By
            </label>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-blue-500"
              >
                <option value="ending_soon">Ending Soonest</option>
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filters Pill Bar */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium">Active Filters:</span>
            {selectedCategory && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                Category: {selectedCategory}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCategory('')} />
              </span>
            )}
            {selectedCondition && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                Condition: {selectedCondition}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCondition('')} />
              </span>
            )}
            {closingSoon && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 font-semibold border border-orange-200">
                Closing Soon
                <X className="w-3 h-3 cursor-pointer" onClick={() => setClosingSoon(false)} />
              </span>
            )}
            {(minPrice || maxPrice) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                Price: ₹{minPrice || 0} - ₹{maxPrice || '∞'}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => {
                    setMinPrice('');
                    setMaxPrice('');
                  }}
                />
              </span>
            )}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 ml-auto"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Catalog Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 animate-pulse">
              <div className="aspect-4/3 bg-slate-200 rounded-xl w-full"></div>
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-3 bg-slate-100 rounded w-1/2"></div>
              <div className="h-6 bg-slate-200 rounded w-1/3 pt-2"></div>
            </div>
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Search className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">No campus auctions match your search</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Try adjusting your keyword, resetting category filters, or save a Want to be automatically alerted when seniors list this gear!
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-sm transition-colors"
            >
              Reset Filters
            </button>
            <Link
              to="/wants"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-xs transition-colors"
            >
              Save as a Want
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {auctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-6">
          <p className="text-xs text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-800">{(page - 1) * limit + 1}</span> to{' '}
            <span className="font-bold text-slate-800">{Math.min(page * limit, total)}</span> of{' '}
            <span className="font-bold text-slate-800">{total}</span> items
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-slate-600 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 px-2">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-slate-600 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
