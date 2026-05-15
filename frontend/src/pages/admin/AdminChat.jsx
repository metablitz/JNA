import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import api from '../../lib/api';
import AdminLayout from './AdminLayout';

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d) / 60000);
  if (diff < 1) return 'vừa xong';
  if (diff < 60) return `${diff} phút trước`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h} giờ trước`;
  return d.toLocaleDateString('vi-VN');
}

export default function AdminChat() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/chat/admin/conversations');
      setConversations(res.data);
    } catch (e) { console.error(e); }
  }, []);

  const fetchMessages = useCallback(async (userId) => {
    try {
      const res = await api.get(`/chat/admin/messages/${userId}`);
      setMessages(res.data);
      // Clear unread badge for this conversation
      setConversations(prev => prev.map(c => c.user_id === userId ? { ...c, unread: 0 } : c));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchConversations();
    const t = setInterval(fetchConversations, 10000);
    return () => clearInterval(t);
  }, [fetchConversations]);

  useEffect(() => {
    if (!selected) return;
    fetchMessages(selected.user_id);
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchMessages(selected.user_id), 5000);
    return () => clearInterval(pollRef.current);
  }, [selected, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelect = (conv) => {
    setSelected(conv);
    setText('');
  };

  const handleSend = async () => {
    if (!text.trim() || sending || !selected) return;
    const content = text.trim();
    setText('');
    setSending(true);
    try {
      const res = await api.post(`/chat/admin/messages/${selected.user_id}`, { content });
      setMessages(prev => [...prev, res.data]);
      fetchConversations();
    } catch (e) {
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <AdminLayout>
      <div className="admin-chat-wrap">
        {/* Sidebar: conversation list */}
        <div className="admin-chat-sidebar">
          <div className="admin-chat-sidebar-header">
            <h2>
              Tin nhắn
              {totalUnread > 0 && <span className="chat-unread-badge">{totalUnread}</span>}
            </h2>
          </div>
          {conversations.length === 0 ? (
            <div className="admin-chat-empty-list">Chưa có hội thoại nào</div>
          ) : (
            conversations.map(c => (
              <button
                key={c.user_id}
                className={`admin-conv-item ${selected?.user_id === c.user_id ? 'active' : ''}`}
                onClick={() => handleSelect(c)}
              >
                <div className="admin-conv-avatar">{c.pharmacy_name?.[0] || '?'}</div>
                <div className="admin-conv-info">
                  <p className="admin-conv-name">{c.pharmacy_name}</p>
                  <p className="admin-conv-preview">
                    {c.last_sender === 'admin' ? '✓ ' : ''}{c.last_message}
                  </p>
                </div>
                <div className="admin-conv-meta">
                  <span className="admin-conv-time">{timeAgo(c.last_at)}</span>
                  {c.unread > 0 && <span className="chat-unread-badge">{c.unread}</span>}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Message area */}
        <div className="admin-chat-main">
          {!selected ? (
            <div className="admin-chat-placeholder">
              <MessageSquare size={48} strokeWidth={1} />
              <p>Chọn một hội thoại để xem tin nhắn</p>
            </div>
          ) : (
            <>
              <div className="admin-chat-thread-header">
                <div className="admin-conv-avatar">{selected.pharmacy_name?.[0]}</div>
                <div>
                  <p style={{ fontWeight: 700 }}>{selected.pharmacy_name}</p>
                  <p style={{ fontSize: 12, color: '#6b7280' }}>{selected.phone}</p>
                </div>
              </div>

              <div className="admin-chat-messages">
                {messages.map(m => {
                  const isAdmin = m.sender_role === 'admin';
                  return (
                    <div key={m.id} className={`chat-bubble-row ${isAdmin ? 'me' : 'them'}`}>
                      {!isAdmin && <div className="chat-avatar-sm" style={{ background: '#dbeafe', color: '#1d4ed8' }}>{selected.pharmacy_name?.[0]}</div>}
                      <div className={`chat-bubble ${isAdmin ? 'bubble-me' : 'bubble-them'}`}>
                        <p>{m.content}</p>
                        <span className="bubble-time">{formatTime(m.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="chat-input-bar" style={{ borderTop: '1px solid #e5e7eb' }}>
                <textarea
                  className="chat-input"
                  placeholder={`Trả lời ${selected.pharmacy_name}...`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                />
                <button
                  className="chat-send-btn"
                  onClick={handleSend}
                  disabled={!text.trim() || sending}
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
