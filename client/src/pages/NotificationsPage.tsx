import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NotificationItem } from '../lib/types.js';
import { apiFetch, ApiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { subscribeToUserStream } from '../lib/stream.js';
import { formatRelativeTime } from '../lib/format.js';
import {
  requestNotificationPermission,
  getBrowserNotificationPermission,
} from '../lib/browserNotify.js';
import { Bell, Check, BellRing } from 'lucide-react';

export function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState(getBrowserNotificationPermission());

  const fetchFeed = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await apiFetch<{ items: NotificationItem[]; unread_count: number }>(
        '/api/notifications?limit=50'
      );
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchFeed();
    }
  }, [user, fetchFeed]);

  // Live SSE listener
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserStream((eventType, data) => {
      if (eventType === 'notification') {
        const item = data as NotificationItem;
        setNotifications((prev) => [item, ...prev]);
        setUnreadCount((c) => c + 1);
      } else if (eventType === 'read_state') {
        fetchFeed();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, fetchFeed]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-blue-50 border border-blue-200 rounded-2xl text-center">
        <span className="text-3xl">🔐</span>
        <h2 className="text-lg font-bold text-blue-900 mt-2">Sign in Required</h2>
        <p className="text-sm text-blue-700 mt-1">
          Please log in with your campus account to view your notifications.
        </p>
        <Link
          to="/login?redirect=/notifications"
          className="inline-block mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/notifications/read', { method: 'POST', body: JSON.stringify({}) });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
    } catch {
      // Ignore
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.read_at) {
      apiFetch('/api/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ ids: [notif.id] }),
      }).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    if (notif.auction_id) {
      navigate(`/auctions/${notif.auction_id}`);
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.read_at;
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_bid':
        return '💰';
      case 'outbid':
        return '⚠️';
      case 'won_pending':
        return '🏆';
      case 'approved':
        return '🤝';
      case 'rejected':
        return '❌';
      case 'sold':
        return '🎉';
      case 'failed_pickup':
        return '🚨';
      case 'extended':
        return '⏱️';
      case 'want_match':
        return '🎯';
      default:
        return '🔔';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Realtime activity feed for your bids, sales, and watchlist matches.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="self-start sm:self-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Browser Notification Permission Banner (Rule N2) */}
      {permission === 'default' && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <h4 className="text-xs font-bold text-blue-900">
                Enable Instant Campus Alerts
              </h4>
              <p className="text-xs text-blue-700">
                Get notified when you’re outbid or when a senior approves your bid even if this tab is in the background.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestPermission}
            className="self-start sm:self-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex-shrink-0 flex items-center gap-1.5"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Enable Alerts</span>
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-blue-600 text-white'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-800'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Notifications List */}
      {loading ? (
        <div className="py-12 text-center text-gray-500">
          <div className="inline-block animate-spin text-2xl mb-2">🔄</div>
          <p className="text-sm">Loading activity feed...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-gray-50 rounded-2xl border border-gray-200 p-8 space-y-3">
          <Bell className="w-10 h-10 mx-auto text-gray-300 stroke-1" />
          <h3 className="text-base font-bold text-gray-800">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {filter === 'unread'
              ? 'You are all caught up! New bid and sale activity will appear here.'
              : 'When someone bids on your items or you get outbid, updates will show up here in real time.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs divide-y divide-gray-100">
          {filtered.map((item) => {
            const isUnread = !item.read_at;
            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-4 hover:bg-gray-50/80 cursor-pointer transition-colors flex gap-4 items-start ${
                  isUnread ? 'bg-blue-50/30' : ''
                }`}
              >
                <span className="text-2xl flex-shrink-0 mt-0.5">{getIcon(item.type)}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`text-sm ${
                        isUnread ? 'font-black text-gray-900' : 'font-semibold text-gray-800'
                      }`}
                    >
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(item.created_at)}
                      </span>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-600" title="Unread" />
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    {item.body}
                  </p>

                  {item.auction_id && (
                    <div className="mt-2.5">
                      <span className="text-xs text-blue-600 hover:underline font-semibold inline-flex items-center gap-1">
                        <span>Go to Auction</span>
                        <span>→</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
