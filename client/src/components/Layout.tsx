import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { NotificationBell } from './NotificationBell.js';
import { Logo } from './Logo.js';
import {
  Sparkles,
  Plus,
  Gavel,
  BookmarkCheck,
  Compass,
  Package,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export function Layout() {
  const { user } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-900">
      {/* Top Campus Trust Ribbon */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 bg-orange-950/60 border border-orange-500/30 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
              Campus Marketplace
            </span>
            <span className="hidden sm:inline text-slate-400 text-xs">
              Verified campus gear clearance &bull; In-person hostel handovers
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1 text-slate-300">
              <Zap className="w-3.5 h-3.5 text-orange-400" />
              <span>Anti-Sniping (+60s) Guard</span>
            </span>
            <span className="hidden md:flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Dual Handover Verification</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-6 shrink-0">
            <Link to="/" className="group flex items-center gap-2 focus:outline-none">
              <Logo size="md" withTagline={true} />
            </Link>

            {/* Main Nav Links */}
            <nav className="hidden lg:flex items-center gap-1 text-sm font-semibold">
              <Link
                to="/"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive('/')
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Compass className="w-4 h-4 text-blue-600" />
                <span>Browse</span>
              </Link>
              <Link
                to="/wants"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive('/wants')
                    ? 'bg-orange-50 text-orange-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <BookmarkCheck className="w-4 h-4 text-orange-500" />
                <span>Saved Wants</span>
              </Link>
              <Link
                to="/assistant"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive('/assistant')
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Sparkles className="w-4 h-4 text-orange-500" />
                <span>AI Assistant</span>
              </Link>
            </nav>
          </div>

          {/* Right Action Suite */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* List an Item (Prominent Orange Brand Button) */}
            <Link
              to="/sell/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl text-white bg-orange-600 hover:bg-orange-700 shadow-sm shadow-orange-600/25 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Sell Gear</span>
            </Link>

            {user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <NotificationBell />

                <Link
                  to="/me/selling"
                  className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                    isActive('/me/selling')
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="My Listings & Sales"
                >
                  <Package className="w-4 h-4 text-slate-500" />
                  <span>My Sales</span>
                </Link>

                <Link
                  to="/me/bidding"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                    isActive('/me/bidding')
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="My Active Bids"
                >
                  <Gavel className="w-4 h-4 text-blue-600" />
                  <span className="hidden md:inline">My Bids</span>
                </Link>

                {/* User Profile Pill */}
                <div className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-slate-800 hidden sm:inline max-w-[100px] truncate">
                    {user.name}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* Collegiate Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12 py-10 text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-slate-100">
            {/* Brand column */}
            <div className="md:col-span-1 space-y-3">
              <Logo size="md" withTagline={true} />
              <p className="text-xs text-slate-500 leading-relaxed">
                Empowering graduating seniors to pass down cycles, calculators, books, and hostel gear to incoming juniors through fair, anti-sniped auctions.
              </p>
            </div>

            {/* Invariant Highlights */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Fair Auction Rules</h4>
              <ul className="text-xs space-y-1.5 text-slate-500">
                <li>&bull; Automatic +60s Anti-Sniping Extension</li>
                <li>&bull; Transparent Proxy Maximums</li>
                <li>&bull; Authoritative PostgreSQL Transaction Clock</li>
                <li>&bull; Strict Single-Turn Increment Rungs</li>
              </ul>
            </div>

            {/* Campus Categories */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Campus Categories</h4>
              <ul className="text-xs space-y-1.5 text-slate-500">
                <li>&bull; Cycles &amp; Campus Mobility</li>
                <li>&bull; Scientific Calculators (ClassWiz)</li>
                <li>&bull; Engineering &amp; Science Textbooks</li>
                <li>&bull; Hostel Furniture &amp; Appliances</li>
              </ul>
            </div>

            {/* Handover & Privacy */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Safety &amp; Handover</h4>
              <ul className="text-xs space-y-1.5 text-slate-500">
                <li>&bull; 100% In-Person Physical Handover</li>
                <li>&bull; Dual Confirmation Sign-Off Matrix</li>
                <li>&bull; 72-Hour Hostel Collection Window</li>
                <li>&bull; Zero Contact Leaks Before Approval</li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
            <p>
              SenBye &copy; {new Date().getFullYear()} &mdash; <span className="text-slate-600 font-semibold">Seniors move on. Good stuff moves forward.</span>
            </p>
            <div className="flex items-center gap-4 text-slate-500">
              <span>Departing Seniors &rarr; Incoming Juniors</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
