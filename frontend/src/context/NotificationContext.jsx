import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();
  const esRef = useRef(null);

  const fetchUnread = useCallback(async () => {
    if (!user || user.role === 'admin') return;
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => {
    if (!user || user.role === 'admin') {
      setUnreadCount(0);
      return;
    }

    fetchUnread();

    const token = localStorage.getItem('token');
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const url = `${apiBase}/notifications/stream?token=${encodeURIComponent(token)}`;

    let fallbackInterval;

    try {
      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'notification') setUnreadCount(c => c + 1);
          else if (data.type === 'unread_count') setUnreadCount(data.count);
        } catch { /* ignore */ }
      };

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED && !fallbackInterval) {
          fallbackInterval = setInterval(fetchUnread, 60000);
        }
      };
    } catch {
      fallbackInterval = setInterval(fetchUnread, 60000);
    }

    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [user, fetchUnread]);

  return (
    <NotificationContext.Provider value={{ unreadCount, setUnreadCount, fetchUnread }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
