import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Headphones } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN');
}

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get('/chat');
      setMessages(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const content = text.trim();
    setText('');
    setSending(true);
    try {
      const res = await api.post('/chat', { content });
      setMessages(prev => [...prev, res.data]);
    } catch (e) {
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Group messages by day
  const groups = [];
  let lastDay = null;
  messages.forEach(m => {
    const day = formatDay(m.created_at);
    if (day !== lastDay) { groups.push({ type: 'divider', label: day }); lastDay = day; }
    groups.push({ type: 'msg', ...m });
  });

  return (
    <Layout>
      <div className="chat-page">
        <header className="chat-header">
          <div className="chat-header-avatar">
            <Headphones size={20} />
          </div>
          <div>
            <p className="chat-header-name">JNA - Hỗ trợ khách hàng</p>
            <p className="chat-header-sub">Phản hồi trong giờ hành chính</p>
          </div>
        </header>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">
              <p>👋 Xin chào <strong>{user?.pharmacy_name}</strong>!</p>
              <p>Nhắn tin cho chúng tôi nếu cần hỗ trợ về đơn hàng, sản phẩm hoặc tài khoản.</p>
            </div>
          )}

          {groups.map((item, idx) => {
            if (item.type === 'divider') {
              return <div key={idx} className="chat-day-divider"><span>{item.label}</span></div>;
            }
            const isMe = item.sender_role === 'customer';
            return (
              <div key={item.id} className={`chat-bubble-row ${isMe ? 'me' : 'them'}`}>
                {!isMe && <div className="chat-avatar-sm">JNA</div>}
                <div className={`chat-bubble ${isMe ? 'bubble-me' : 'bubble-them'}`}>
                  <p>{item.content}</p>
                  <span className="bubble-time">{formatTime(item.created_at)}</span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-bar">
          <textarea
            className="chat-input"
            placeholder="Nhắn tin..."
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
      </div>
    </Layout>
  );
}
