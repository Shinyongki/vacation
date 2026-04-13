import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api/client';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

const POLL_INTERVAL = 30000; // 30 seconds

export function NotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const prevUnreadIdsRef = useRef(new Set());
  const dismissedIdsRef = useRef(new Set());
  const pollTimerRef = useRef(null);
  const permissionRef = useRef('default');

  // Request browser notification permission
  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          permissionRef.current = perm;
        });
      } else if (typeof Notification !== 'undefined') {
        permissionRef.current = Notification.permission;
      }
    } catch (e) {
      // Browser may not support Notification API
    }
  }, [isAuthenticated]);

  // Mark a notification as read on the server and update local state
  const dismissBrowserNotification = useCallback((notifId) => {
    dismissedIdsRef.current.add(notifId);
    prevUnreadIdsRef.current.delete(notifId);
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
    );
    apiClient.put(`/notifications/${notifId}/read`).catch(() => {});
  }, []);

  // Show browser notification for new items
  const showBrowserNotification = useCallback((notification) => {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const n = new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          requireInteraction: true
        });
        n.onclick = () => {
          window.focus();
          dismissBrowserNotification(notification.id);
          if (notification.targetUrl) {
            window.location.href = notification.targetUrl;
          }
          n.close();
        };
        n.onclose = () => {
          dismissBrowserNotification(notification.id);
        };
      }
    } catch (e) {
      // Ignore notification errors
    }
  }, [dismissBrowserNotification]);

  // Fetch notifications from server
  const fetchNotifications = useCallback(async (options = {}) => {
    if (!isAuthenticated) return;

    const { unreadOnly = false, pageNum = 1, append = false } = options;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (unreadOnly) params.set('unread', 'true');
      params.set('page', String(pageNum));
      params.set('limit', '20');

      const response = await apiClient.get(`/notifications?${params.toString()}`);

      if (response.success && response.data) {
        const { notifications: newNotifications, total: newTotal, unreadCount: newUnreadCount } = response.data;

        if (append && pageNum > 1) {
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const unique = newNotifications.filter((n) => !existingIds.has(n.id));
            return [...prev, ...unique];
          });
        } else {
          setNotifications(newNotifications);
        }

        setTotal(newTotal);
        setUnreadCount(newUnreadCount);
        setPage(pageNum);

        return { notifications: newNotifications, total: newTotal, unreadCount: newUnreadCount };
      }
    } catch (e) {
      // Silently fail polling errors
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Poll for unread notifications and detect new ones
  const pollUnread = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await apiClient.get('/notifications?unread=true&page=1&limit=50');

      if (response.success && response.data) {
        const { notifications: unreadNotifications, unreadCount: newUnreadCount } = response.data;

        // Detect new notifications
        const currentIds = new Set(unreadNotifications.map((n) => n.id));
        const prevIds = prevUnreadIdsRef.current;

        for (const notif of unreadNotifications) {
          if (!prevIds.has(notif.id) && !dismissedIdsRef.current.has(notif.id)) {
            showBrowserNotification(notif);
          }
        }

        prevUnreadIdsRef.current = currentIds;
        setUnreadCount(newUnreadCount);

        // If panel is open, refresh the full list
        if (showPanel) {
          setNotifications((prev) => {
            // Merge unread updates into existing list
            const map = new Map(prev.map((n) => [n.id, n]));
            for (const n of unreadNotifications) {
              map.set(n.id, n);
            }
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
          });
        }
      }
    } catch (e) {
      // Silently fail
    }
  }, [isAuthenticated, showPanel, showBrowserNotification]);

  // Start/stop polling
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear state on logout
      setNotifications([]);
      setUnreadCount(0);
      setShowPanel(false);
      prevUnreadIdsRef.current = new Set();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    // Initial fetch
    pollUnread();

    // Start polling
    pollTimerRef.current = setInterval(pollUnread, POLL_INTERVAL);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isAuthenticated, pollUnread]);

  const togglePanel = useCallback(() => {
    setShowPanel((prev) => {
      const willShow = !prev;
      if (willShow) {
        // Fetch full list when opening panel
        fetchNotifications({ pageNum: 1 });
      }
      return willShow;
    });
  }, [fetchNotifications]);

  const closePanel = useCallback(() => {
    setShowPanel(false);
  }, []);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await apiClient.put(`/notifications/${notificationId}/read`);

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Remove from tracked unread set
      prevUnreadIdsRef.current.delete(notificationId);
    } catch (e) {
      // Silently fail
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.put('/notifications/read-all');

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
      prevUnreadIdsRef.current = new Set();
    } catch (e) {
      // Silently fail
    }
  }, []);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    fetchNotifications({ pageNum: nextPage, append: true });
  }, [page, fetchNotifications]);

  const hasMore = notifications.length < total;

  const value = {
    notifications,
    unreadCount,
    showPanel,
    loading,
    hasMore,
    togglePanel,
    closePanel,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
    loadMore
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationContext;
