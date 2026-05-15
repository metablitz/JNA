import { useState, useEffect } from 'react';
import { Send, Bell } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import AdminLayout from './AdminLayout';

const QUICK_TEMPLATES = [
  { label: '🆕 Sản phẩm mới', title: 'Có sản phẩm mới!', body: 'JNA vừa cập nhật danh sách sản phẩm mới. Vào ứng dụng để xem ngay.' },
  { label: '💰 Cập nhật giá', title: 'Bảng giá đã được cập nhật', body: 'Danh sách giá tháng này đã được cập nhật. Vui lòng kiểm tra lại.' },
  { label: '🎁 Khuyến mãi', title: 'Chương trình khuyến mãi đặc biệt', body: 'JNA có chương trình ưu đãi đặc biệt trong tháng này. Liên hệ để biết thêm chi tiết.' },
  { label: '📦 Hàng về kho', title: 'Hàng đã về kho', body: 'Một số sản phẩm đã có hàng trở lại sau thời gian hết hàng. Vào ứng dụng đặt hàng ngay.' },
];

export default function AdminBroadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]); // empty = all
  const [mode, setMode] = useState('all'); // 'all' | 'select'
  const { showToast } = useToast();

  useEffect(() => {
    api.get('/admin/users').then(res => setUsers(res.data.filter(u => u.role === 'customer' && u.is_active))).catch(() => {});
  }, []);

  const applyTemplate = (t) => { setTitle(t.title); setBody(t.body); setResult(null); };

  const toggleUser = (id) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    if (mode === 'select' && selectedUsers.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 khách hàng', 'error'); return;
    }
    setSending(true); setResult(null);
    try {
      const payload = { title, body };
      if (mode === 'select') payload.user_ids = selectedUsers;
      const res = await api.post('/admin/notifications/broadcast', payload);
      setResult({ success: true, sent: res.data.sent });
      setTitle(''); setBody(''); setSelectedUsers([]);
    } catch (e) {
      setResult({ success: false, error: e.response?.data?.error || 'Gửi thất bại' });
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout>
      <div className="admin-page" style={{ maxWidth: 640 }}>
        <div className="admin-page-header">
          <h1 className="admin-page-title">Gửi thông báo</h1>
        </div>

        {/* Quick templates */}
        <div className="broadcast-templates">
          <p className="broadcast-label">Mẫu nhanh:</p>
          <div className="broadcast-template-row">
            {QUICK_TEMPLATES.map((t, i) => (
              <button key={i} className="broadcast-tpl-btn" onClick={() => applyTemplate(t)}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="broadcast-form">
          <div className="form-group">
            <label>Tiêu đề *</label>
            <input type="text" value={title} onChange={e => { setTitle(e.target.value); setResult(null); }}
              placeholder="VD: Bảng giá tháng 6 đã cập nhật" />
          </div>
          <div className="form-group">
            <label>Nội dung *</label>
            <textarea value={body} onChange={e => { setBody(e.target.value); setResult(null); }}
              placeholder="Nội dung thông báo..." rows={4}
              style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {/* Recipient mode */}
          <div className="form-group">
            <label>Gửi đến</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button
                className={`broadcast-mode-btn ${mode === 'all' ? 'active' : ''}`}
                onClick={() => { setMode('all'); setSelectedUsers([]); }}
              >
                👥 Tất cả khách hàng ({users.length})
              </button>
              <button
                className={`broadcast-mode-btn ${mode === 'select' ? 'active' : ''}`}
                onClick={() => setMode('select')}
              >
                ✔ Chọn khách hàng
              </button>
            </div>

            {mode === 'select' && (
              <div className="broadcast-user-list">
                {users.map(u => (
                  <label key={u.id} className={`broadcast-user-item ${selectedUsers.includes(u.id) ? 'selected' : ''}`}>
                    <input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={() => toggleUser(u.id)} />
                    <span>{u.pharmacy_name}</span>
                    <span className="text-sm text-gray">{u.phone}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {result && (
            <div className={`broadcast-result ${result.success ? 'ok' : 'err'}`}>
              {result.success ? `✅ Đã gửi thành công đến ${result.sent} khách hàng!` : `❌ ${result.error}`}
            </div>
          )}

          <button
            className="btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim()}
          >
            <Send size={16} />
            {sending ? 'Đang gửi...' : `Gửi thông báo${mode === 'select' && selectedUsers.length > 0 ? ` (${selectedUsers.length} KH)` : ''}`}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
