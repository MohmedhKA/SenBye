import { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  LogOut,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  // Click outside to close user menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      setUserMenuOpen(false);
      setMobileMenuOpen(false);
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-900">
      {/* Top Campus Trust Ribbon */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-3 sm:px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-orange-400 bg-orange-950/60 border border-orange-500/30 px-2 py-0.5 rounded-full shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
              Campus Marketplace
            </span>
            <span className="hidden sm:inline text-slate-400 text-xs truncate">
              Verified gear clearance &bull; In-person hostel handovers
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs font-medium shrink-0">
            <span className="flex items-center gap-1 text-slate-300">
              <Zap className="w-3.5 h-3.5 text-orange-400" />
              <span>Anti-Sniping (+60s) Guard</span>
            </span>
            <span className="hidden md:flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Dual Handover</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-4 sm:gap-6 shrink-0 min-w-0">
            <Link to="/" className="group flex items-center gap-2 focus:outline-hidden min-w-0">
              <Logo size="md" withTagline={true} />
            </Link>

            {/* Desktop Navigation Links */}
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
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            
            {/* List an Item (Prominent Orange Brand Button) */}
            <Link
              to="/sell/new"
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-xl text-white bg-orange-600 hover:bg-orange-700 shadow-sm shadow-orange-600/25 active:scale-95 transition-all whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span className="hidden xs:inline">Sell Gear</span>
              <span className="xs:hidden">Sell</span>
            </Link>

            {user ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <NotificationBell />

                <Link
                  to="/me/selling"
                  className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
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
                  className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                    isActive('/me/bidding')
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="My Active Bids"
                >
                  <Gavel className="w-4 h-4 text-blue-600" />
                  <span>My Bids</span>
                </Link>

                {/* User Profile Dropdown Pill */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition-all text-left focus:outline-hidden"
                    title="User account menu & logout"
                    aria-expanded={userMenuOpen}
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-slate-800 hidden md:inline max-w-[90px] truncate">
                      {user.name}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in-50 zoom-in-95">
                      <div className="p-3.5 bg-slate-50">
                        <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1.5 border border-emerald-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          Verified Campus Member
                        </span>
                      </div>

                      <div className="p-1.5 text-xs font-semibold space-y-0.5">
                        <Link
                          to="/me/selling"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <Package className="w-4 h-4 text-slate-500" />
                          <span>My Listings &amp; Sales</span>
                        </Link>
                        <Link
                          to="/me/bidding"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <Gavel className="w-4 h-4 text-blue-600" />
                          <span>My Bids &amp; Watchlist</span>
                        </Link>
                        <Link
                          to="/wants"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <BookmarkCheck className="w-4 h-4 text-orange-500" />
                          <span>Saved Wants</span>
                        </Link>
                        <Link
                          to="/assistant"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span>AI Assistant</span>
                        </Link>
                      </div>

                      <div className="p-1.5">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors text-left"
                        >
                          <LogOut className="w-4 h-4 text-rose-600" />
                          <span>Log Out of SenBye</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Link
                  to="/login"
                  className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors whitespace-nowrap"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Mobile Navigation Drawer Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              aria-label="Toggle mobile navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Slide-Down Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-4 space-y-2 shadow-lg animate-in slide-in-from-top-2">
            <nav className="flex flex-col space-y-1 text-sm font-semibold pt-1">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                  isActive('/') ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Compass className="w-4 h-4 text-blue-600" />
                <span>Browse Catalog</span>
              </Link>
              <Link
                to="/wants"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                  isActive('/wants') ? 'bg-orange-50 text-orange-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <BookmarkCheck className="w-4 h-4 text-orange-500" />
                <span>Saved Wants</span>
              </Link>
              <Link
                to="/assistant"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                  isActive('/assistant') ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-4 h-4 text-orange-500" />
                <span>AI Assistant</span>
              </Link>

              {user ? (
                <>
                  <Link
                    to="/me/selling"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                      isActive('/me/selling') ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Package className="w-4 h-4 text-slate-500" />
                    <span>My Sales &amp; Listings</span>
                  </Link>
                  <Link
                    to="/me/bidding"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                      isActive('/me/bidding') ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Gavel className="w-4 h-4 text-blue-600" />
                    <span>My Bids &amp; Watchlist</span>
                  </Link>

                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-left transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out ({user.name})</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center py-2 text-xs font-bold text-slate-700 bg-slate-100 rounded-xl"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center py-2 text-xs font-bold text-white bg-blue-600 rounded-xl"
                  >
                    Register
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
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
