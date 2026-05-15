import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useNotification } from '../context/NotificationContext';

const TYPE_ICON = {
  order_placed:    '🛒',
  order_confirmed: '✅',
  order_shipping:  '🚚',
  order_delivered: '📦',
  order_cancelled: '❌',
  back_in_stock:   '💊',
};

function groupByDay(notifications) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = {};
  notifications.forEach((n) => {
    const d = new Date(n.created_at);
    d.setHours(0, 0, 0, 0);
    let label;
    if (d.getTime() === today.getTime()) label = 'Hôm nay';
    else if (d.getTime() === yesterday.getTime()) label = 'Hôm qua';
    else label = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  });
  return groups;
}

function formatTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { setUnreadCount } = useNotification();
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    await api.put('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleClick = async (notif) => {
    if (!notif.is_read) {
      await api.put(`/notifications/${notif.id}/read`);
      setNotifications((prev) =>
        prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n)
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (notif.order_id) navigate(`/orders/${notif.order_id}`);
  };

  const unread = notifications.filter((n) => !n.is_read).length;
  const groups = groupByDay(notifications);

  return (
    <Layout>
      <div className="notif-page">
        <header className="page-header">
          <button onClick={() => navigate(-1)} className="back-btn"><ArrowLeft size={22} /></button>
          <h1>Thông báo</h1>
          {unread > 0 && (
            <button className="notif-read-all-btn" onClick={markAllRead}>
              <CheckCheck size={16} /> Đọc tất cả
            </button>
          )}
        </header>

        {loading ? (
          <div className="notif-group">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="notif-item" style={{ pointerEvents: 'none' }}>
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div className="skeleton skeleton-title" style={{ width: '60%' }} />
                  <div className="skeleton skeleton-line" style={{ width: '85%' }} />
                  <div className="skeleton skeleton-line" style={{ width: '30%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="notif-empty">
            <Bell size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
            <p>Chưa có thông báo nào</p>
          </div>
        ) : (
          Object.entries(groups).map(([day, items]) => (
            <div key={day} className="notif-group">
              <p className="notif-day-label">{day}</p>
              {items.map((n) => (
                <button
                  key={n.id}
                  className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                  onClick={() => handleClick(n)}
                >
                  <span className="notif-icon">{TYPE_ICON[n.type] || '🔔'}</span>
                  <div className="notif-content">
                    <p className="notif-title">{n.title}</p>
                    <p className="notif-body">{n.body}</p>
                    <p className="notif-time">{formatTime(n.created_at)}</p>
                  </div>
                  {!n.is_read && <span className="notif-dot" />}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
