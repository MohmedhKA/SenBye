import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { NotificationBell } from './NotificationBell.js';
import { Sparkles, PlusCircle, Gavel, BookmarkCheck } from 'lucide-react';

export function Layout() {
  const { user } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-indigo-600">SenBye</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Campus Auctions
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  isActive('/') ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Browse
              </Link>
              <Link
                to="/wants"
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${
                  isActive('/wants') ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                Wants
              </Link>
              <Link
                to="/assistant"
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${
                  isActive('/assistant') ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                Assistant
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/sell/new"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              List an Item
            </Link>

            {user ? (
              <div className="flex items-center gap-3">
                <NotificationBell />
                <Link
                  to="/me/selling"
                  className="text-sm font-medium text-slate-700 hover:text-indigo-600"
                >
                  My Sales
                </Link>
                <Link
                  to="/me/bidding"
                  className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-indigo-600"
                >
                  <Gavel className="w-4 h-4" />
                  My Bids
                </Link>
                <span className="text-sm font-medium text-slate-900 bg-slate-100 px-2.5 py-1 rounded-full">
                  {user.name}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        SenBye &copy; {new Date().getFullYear()} &mdash; Fair campus auctions for departing seniors and incoming juniors.
      </footer>
    </div>
  );
}
