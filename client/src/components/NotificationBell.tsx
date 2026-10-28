import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NotificationItem } from '../lib/types.js';
import { apiFetch } from '../lib/api.js';
import { subscribeToUserStream } from '../lib/stream.js';
import { useAuth } from '../context/AuthContext.js';
import { formatRelativeTime } from '../lib/format.js';
import {
  requestNotificationPermission,
  showBackgroundNotification,
  getBrowserNotificationPermission,
} from '../lib/browserNotify.js';
import { Bell, Check, ExternalLink } from 'lucide-react';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>(
    getBrowserNotificationPermission()
  );

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchRecent = async () => {
    if (!user) return;
    try {
      const data = await apiFetch<{ items: NotificationItem[]; unread_count: number }>(
        '/api/notifications?limit=5'
      );
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
    } catch {
      // Ignore background errors
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchRecent();

    // Subscribe to live user notifications over SSE (Rule N1)
    const unsubscribe = subscribeToUserStream((eventType, data) => {
      if (eventType === 'notification') {
        const item = data as NotificationItem;
        setNotifications((prev) => [item, ...prev.slice(0, 4)]);
        setUnreadCount((c) => c + 1);

        // Mirror desktop alert if document.hidden (Rule N3)
        showBackgroundNotification(item.title, item.body, item.id.toString());
      } else if (eventType === 'read_state') {
        fetchRecent();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) {
    return null;
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
    setIsOpen(false);
    if (!notif.read_at) {
      apiFetch('/api/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ ids: [notif.id] }),
      }).catch(() => {});
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    if (notif.auction_id) {
      navigate(`/auctions/${notif.auction_id}`);
    } else {
      navigate('/notifications');
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setBrowserPermission(granted ? 'granted' : 'denied');
  };

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
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors focus:outline-none"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-orange-600 text-white text-[10px] font-mono font-bold rounded-full ring-2 ring-white shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">Campus Alerts</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-bold rounded-full border border-orange-200">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
              >
                <Check className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Desktop alerts prompt (Rule N2: requested only on explicit user click) */}
          {browserPermission === 'default' && (
            <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-xs">
              <span className="text-blue-900 font-medium">Turn on background alerts?</span>
              <button
                type="button"
                onClick={handleRequestPermission}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[11px] transition-colors"
              >
                Enable
              </button>
            </div>
          )}

          {/* List */}
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto text-gray-300 mb-2 stroke-1" />
                <p className="text-xs">No notifications yet.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.read_at;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`p-3.5 hover:bg-gray-50 cursor-pointer transition-colors flex gap-3 items-start ${
                      isUnread ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">{getIcon(notif.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4
                          className={`text-xs truncate ${
                            isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
                          }`}
                        >
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {formatRelativeTime(notif.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 line-clamp-2 mt-0.5 leading-relaxed">
                        {notif.body}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-gray-50 border-t border-gray-100 text-center">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs text-blue-600 hover:underline font-semibold inline-flex items-center gap-1"
            >
              <span>View all notifications</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
