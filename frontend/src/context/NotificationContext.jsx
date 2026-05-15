import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  const fetchUnread = useCallback(async () => {
    if (!user || user.role === 'admin') return;
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch {
      // silent
    }
  }, [user]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000); // poll mỗi 1 phút
    return () => clearInterval(interval);
  }, [fetchUnread]);

  return (
    <NotificationContext.Provider value={{ unreadCount, setUnreadCount, fetchUnread }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
