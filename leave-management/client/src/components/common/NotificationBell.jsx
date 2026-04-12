import React from 'react';
import { Bell } from 'lucide-react';

const NotificationBell = ({ unreadCount = 0, onClick }) => {
  return (
    <button className="notification-bell" onClick={onClick} title="알림">
      <Bell size={18} />
      {unreadCount > 0 && (
        <span className="notification-bell__badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;
