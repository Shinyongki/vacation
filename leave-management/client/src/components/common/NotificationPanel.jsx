import React, { useEffect, useRef } from 'react';
import {
  FileCheck,
  CheckCircle,
  XCircle,
  UserCheck,
  Ban,
  AlertTriangle,
  RefreshCw,
  Clock,
  Undo2,
  X,
  Bell
} from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';

/**
 * Map notification type to icon and color
 */
const TYPE_ICON_MAP = {
  approval_request: { Icon: FileCheck, color: '#3B82F6' },
  approved: { Icon: CheckCircle, color: '#10B981' },
  rejected: { Icon: XCircle, color: '#EF4444' },
  delegate_request: { Icon: UserCheck, color: '#3B82F6' },
  cancelled: { Icon: Ban, color: '#6B7280' },
  urgent: { Icon: AlertTriangle, color: '#F59E0B' },
  auto_delegate: { Icon: RefreshCw, color: '#3B82F6' },
  unprocessed_warning: { Icon: Clock, color: '#F59E0B' },
  recalled: { Icon: Undo2, color: '#6B7280' }
};

/**
 * Format relative time in Korean
 */
function formatTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  // YYYY-MM-DD
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const NotificationPanel = () => {
  const {
    notifications,
    unreadCount,
    showPanel,
    loading,
    hasMore,
    closePanel,
    markAsRead,
    markAllAsRead,
    loadMore
  } = useNotification();

  const panelRef = useRef(null);

  // Close panel on outside click
  useEffect(() => {
    if (!showPanel) return;

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        // Check if click was on the notification bell
        const bell = e.target.closest('.notification-bell');
        if (!bell) {
          closePanel();
        }
      }
    };

    // Delay to avoid closing immediately from the toggle click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPanel, closePanel]);

  // Close on Escape
  useEffect(() => {
    if (!showPanel) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closePanel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showPanel, closePanel]);

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.targetUrl) {
      window.location.href = notification.targetUrl;
    }
    closePanel();
  };

  if (!showPanel) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div style={styles.backdrop} />

      <div ref={panelRef} style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h3 style={styles.headerTitle}>알림</h3>
            {unreadCount > 0 && (
              <span style={styles.unreadBadge}>{unreadCount}</span>
            )}
          </div>
          <div style={styles.headerRight}>
            {unreadCount > 0 && (
              <button
                style={styles.readAllButton}
                onClick={markAllAsRead}
              >
                모두 읽음
              </button>
            )}
            <button
              style={styles.closeButton}
              onClick={closePanel}
              title="닫기"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div style={styles.list}>
          {notifications.length === 0 && !loading && (
            <div style={styles.empty}>
              <Bell size={32} color="#9CA3AF" />
              <p style={styles.emptyText}>새 알림이 없습니다</p>
            </div>
          )}

          {notifications.map((notification) => {
            const typeConfig = TYPE_ICON_MAP[notification.type] || { Icon: Bell, color: '#6B7280' };
            const { Icon, color } = typeConfig;

            return (
              <div
                key={notification.id}
                style={{
                  ...styles.item,
                  backgroundColor: notification.isRead ? '#FFFFFF' : '#F0F7FF'
                }}
                onClick={() => handleNotificationClick(notification)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNotificationClick(notification);
                }}
              >
                {/* Unread dot */}
                <div style={styles.dotColumn}>
                  {!notification.isRead && <div style={styles.unreadDot} />}
                </div>

                {/* Icon */}
                <div style={{ ...styles.iconWrap, color }}>
                  <Icon size={20} />
                </div>

                {/* Content */}
                <div style={styles.content}>
                  <div style={styles.titleRow}>
                    <span
                      style={{
                        ...styles.itemTitle,
                        fontWeight: notification.isRead ? 400 : 600
                      }}
                    >
                      {notification.title}
                    </span>
                    <span style={styles.time}>
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                  <p style={styles.message}>{notification.message}</p>
                </div>
              </div>
            );
          })}

          {/* Load more */}
          {hasMore && (
            <div style={styles.loadMore}>
              <button
                style={styles.loadMoreButton}
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? '불러오는 중...' : '더보기'}
              </button>
            </div>
          )}

          {loading && notifications.length === 0 && (
            <div style={styles.empty}>
              <p style={styles.emptyText}>불러오는 중...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const styles = {
  backdrop: {
    position: 'fixed',
    top: '44px',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    zIndex: 999
  },
  panel: {
    position: 'fixed',
    top: '44px',
    right: 0,
    width: '360px',
    height: 'calc(100vh - 44px)',
    backgroundColor: '#FFFFFF',
    borderLeft: '1px solid #DDE1E7',
    boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif',
    animation: 'slideInRight 0.2s ease-out'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #DDE1E7',
    flexShrink: 0
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  headerTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#1F2937'
  },
  unreadBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    height: '20px',
    padding: '0 6px',
    borderRadius: '999px',
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    fontSize: '11px',
    fontWeight: 600
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  readAllButton: {
    background: 'none',
    border: 'none',
    color: '#3B82F6',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#6B7280',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden'
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '12px 16px',
    borderBottom: '1px solid #F3F4F6',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    gap: '8px'
  },
  dotColumn: {
    width: '12px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'flex-start',
    paddingTop: '6px'
  },
  unreadDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#3B82F6'
  },
  iconWrap: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '1px'
  },
  content: {
    flex: 1,
    minWidth: 0
  },
  titleRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '2px'
  },
  itemTitle: {
    fontSize: '14px',
    color: '#1F2937',
    lineHeight: '1.4'
  },
  time: {
    fontSize: '12px',
    color: '#9CA3AF',
    flexShrink: 0,
    whiteSpace: 'nowrap'
  },
  message: {
    margin: 0,
    fontSize: '13px',
    color: '#6B7280',
    lineHeight: '1.4',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 16px',
    gap: '12px'
  },
  emptyText: {
    margin: 0,
    fontSize: '14px',
    color: '#9CA3AF'
  },
  loadMore: {
    padding: '12px 16px',
    textAlign: 'center'
  },
  loadMoreButton: {
    background: 'none',
    border: '1px solid #DDE1E7',
    color: '#374151',
    fontSize: '13px',
    padding: '8px 24px',
    borderRadius: '6px',
    cursor: 'pointer',
    width: '100%'
  }
};

export default NotificationPanel;
