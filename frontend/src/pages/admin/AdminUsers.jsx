import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, X, KeyRound, ClipboardList, Search, Eye, FileText, ExternalLink } from 'lucide-react';
import api from '../../lib/api';
import { TIERS } from '../../lib/tiers';
import { useToast } from '../../context/ToastContext';
import AdminLayout from './AdminLayout';

function LicenseCard({ label, url }) {
  const [imgError, setImgError] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  if (!url) return <p style={{ fontSize: 13, color: '#9ca3af' }}>— Không có</p>;
  const isPdf = url.toLowerCase().includes('.pdf');
  return (
    <div className="license-card">
      <p className="license-card-label">{label}</p>
      {isPdf || imgError ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="license-pdf-btn">
          <FileText size={16} /> Xem PDF <ExternalLink size={13} />
        </a>
      ) : (
        <img src={url} alt={label} className="license-thumb"
          onError={() => setImgError(true)} onClick={() => setLightbox(true)} />
      )}
      {lightbox && (
        <div className="license-lightbox" onClick={() => setLightbox(false)}>
          <img src={url} alt={label} className="license-lightbox-img" onClick={e => e.stopPropagation()} />
          <button className="license-lightbox-close" onClick={() => setLightbox(false)}><X size={22} /></button>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value || '—'}</span>
    </div>
  );
}

const STATUS_COLORS = {
  pending: '#f59e0b', confirmed: '#3b82f6', shipping: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
};
const STATUS_LABELS = {
  pending: 'Chờ XN', confirmed: 'Đã XN', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy',
};

const emptyUser = { phone: '', password: '', pharmacy_name: '', customer_code: '', address: '', role: 'customer', is_active: true, tier: 'dong', credit_limit: '' };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [ordersUser, setOrdersUser] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [search, setSearch] = useState('');
  const { showToast } = useToast();

  const fetch = async () => {
    setLoading(true);
    try { const res = await api.get('/admin/users'); setUsers(res.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      u.pharmacy_name?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.customer_code?.toLowerCase().includes(q)
    );
  }, [users, search]);

  useEffect(() => { fetch(); }, []);

  const openAdd = () => { setForm(emptyUser); setModal('add'); setError(''); };
  const openEdit = (u) => { setForm({ ...u, password: '' }); setModal('edit'); setError(''); };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (modal === 'add') await api.post('/admin/users', form);
      else {
        const updates = { ...form };
        if (!updates.password) delete updates.password;
        await api.put(`/admin/users/${form.id}`, updates);
      }
      setModal(null); fetch();
    } catch (e) { setError(e.response?.data?.error || 'Lỗi lưu tài khoản'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (u) => {
    await api.put(`/admin/users/${u.id}`, { is_active: !u.is_active });
    fetch();
  };

  const changeTier = async (u, tier) => {
    await api.put(`/admin/users/${u.id}`, { tier });
    fetch();
  };

  const openReset = (u) => { setResetTarget(u); setNewPassword(''); };

  const openOrders = async (u) => {
    setOrdersUser(u); setUserOrders([]); setOrdersLoading(true);
    try {
      const res = await api.get('/admin/orders', { params: { user_id: u.id, limit: 20 } });
      setUserOrders(res.data.orders || []);
    } catch (e) { console.error(e); }
    finally { setOrdersLoading(false); }
  };

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 6) return;
    setResetSaving(true);
    try {
      await api.put(`/admin/users/${resetTarget.id}`, { password: newPassword });
      setResetTarget(null);
      showToast(`Đã đặt lại mật khẩu cho ${resetTarget.pharmacy_name}`, 'success');
    } catch (e) { showToast(e.response?.data?.error || 'Lỗi', 'error'); }
    finally { setResetSaving(false); }
  };

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Khách hàng</h1>
          <button className="btn-primary" onClick={openAdd}><Plus size={16} /> Thêm tài khoản</button>
        </div>

        <div className="admin-search" style={{ marginBottom: 16 }}>
          <Search size={15} />
          <input
            placeholder="Tìm tên nhà thuốc, SĐT, mã KH..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Nhà thuốc</th><th>Số ĐT / Mã KH</th><th>Tier</th><th>Hạn mức CN</th><th>Trạng thái</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 4, width: j === 0 ? '75%' : j === 2 ? '50%' : '65%' }} /></td>
                    ))}
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="text-center">{search ? 'Không tìm thấy khách hàng' : 'Chưa có khách hàng'}</td></tr>
              ) : filteredUsers.map((u) => {
                const tierInfo = TIERS[u.tier] || TIERS.dong;
                return (
                <tr key={u.id}>
                  <td>
                    <strong>{u.pharmacy_name}</strong>
                    <p className="text-sm text-gray">{u.address || '-'}</p>
                  </td>
                  <td>
                    <p>{u.phone}</p>
                    <p className="text-sm text-gray">{u.customer_code || '-'}</p>
                  </td>
                  <td>
                    <select
                      className="tier-select"
                      value={u.tier || 'dong'}
                      onChange={(e) => changeTier(u, e.target.value)}
                      style={{ color: tierInfo.color, fontWeight: 700, background: tierInfo.bg, border: `1px solid ${tierInfo.color}40` }}
                    >
                      {Object.entries(TIERS).map(([key, t]) => (
                        <option key={key} value={key}>{t.icon} {t.label} (-{t.discount}%)</option>
                      ))}
                    </select>
                  </td>
                  <td>{u.credit_limit > 0 ? u.credit_limit.toLocaleString('vi-VN') + 'đ' : '-'}</td>
                  <td>
                    <button
                      className={`toggle-btn ${u.is_active ? 'active' : 'inactive'}`}
                      onClick={() => toggleActive(u)}
                    >
                      {u.is_active ? 'Hoạt động' : 'Đã khóa'}
                    </button>
                  </td>
                  <td>
                    <button className="action-btn" style={{ background: '#f0fdf4', color: '#16a34a' }} onClick={() => setDetailUser(u)} title="Xem chi tiết đăng ký"><Eye size={15} /></button>
                    <button className="action-btn edit" onClick={() => openEdit(u)} title="Sửa thông tin"><Pencil size={15} /></button>
                    <button className="action-btn" style={{ background: '#fffbeb', color: '#d97706' }} onClick={() => openReset(u)} title="Đặt lại mật khẩu"><KeyRound size={15} /></button>
                    <button className="action-btn" style={{ background: '#eff6ff', color: '#2563eb' }} onClick={() => openOrders(u)} title="Xem đơn hàng"><ClipboardList size={15} /></button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>

        {resetTarget && (
          <div className="modal-overlay" onClick={() => setResetTarget(null)}>
            <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Đặt lại mật khẩu</h2>
                <button onClick={() => setResetTarget(null)}><X size={20} /></button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: 14, color: '#6b7280', fontSize: 13 }}>
                  Khách hàng: <strong style={{ color: '#1f2937' }}>{resetTarget.pharmacy_name}</strong> ({resetTarget.phone})
                </p>
                <p style={{ marginBottom: 14, fontSize: 13, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', color: '#92400e' }}>
                  Admin không thể xem mật khẩu cũ. Nhập mật khẩu mới rồi thông báo cho khách hàng qua điện thoại.
                </p>
                <div className="form-group">
                  <label>Mật khẩu mới *</label>
                  <input
                    type="text"
                    placeholder="Tối thiểu 6 ký tự"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setResetTarget(null)}>Hủy</button>
                <button className="btn-primary" onClick={handleReset} disabled={resetSaving || newPassword.length < 6}>
                  {resetSaving ? 'Đang lưu...' : 'Xác nhận đặt lại'}
                </button>
              </div>
            </div>
          </div>
        )}

        {modal && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{modal === 'add' ? 'Thêm tài khoản' : 'Sửa tài khoản'}</h2>
                <button onClick={() => setModal(null)}><X size={20} /></button>
              </div>
              <div className="modal-body">
                {[
                  ['phone', 'Số điện thoại *', 'tel'],
                  ['password', modal === 'add' ? 'Mật khẩu *' : 'Mật khẩu mới (để trống nếu không đổi)', 'password'],
                  ['pharmacy_name', 'Tên nhà thuốc *', 'text'],
                  ['customer_code', 'Mã khách hàng', 'text'],
                  ['address', 'Địa chỉ', 'text'],
                ].map(([key, label, type]) => (
                  <div key={key} className="form-group">
                    <label>{label}</label>
                    <input type={type} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                  </div>
                ))}
                <div className="form-group">
                  <label>Vai trò</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="customer">Khách hàng</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Tier khách hàng</label>
                  <select value={form.tier || 'dong'} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
                    {Object.entries(TIERS).map(([key, t]) => (
                      <option key={key} value={key}>{t.icon} {t.label} (giảm {t.discount}%)</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Hạn mức công nợ (đ)</label>
                  <input type="number" placeholder="VD: 50000000" value={form.credit_limit || ''} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
                </div>
                {error && <div className="error-msg">{error}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setModal(null)}>Hủy</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Customer detail modal */}
      {detailUser && (
        <div className="modal-overlay" onClick={() => setDetailUser(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chi tiết đăng ký — {detailUser.pharmacy_name}</h2>
              <button onClick={() => setDetailUser(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="detail-section">
                <p className="detail-section-title">Thông tin cơ bản</p>
                <div className="detail-grid">
                  <DetailRow label="Tên nhà thuốc" value={detailUser.pharmacy_name} />
                  <DetailRow label="Số điện thoại" value={detailUser.phone} />
                  <DetailRow label="Địa chỉ" value={detailUser.address} />
                  <DetailRow label="Mã khách hàng" value={detailUser.customer_code} />
                  <DetailRow label="Ngày đăng ký" value={new Date(detailUser.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} />
                </div>
              </div>
              <div className="detail-section">
                <p className="detail-section-title">Phân loại & trạng thái</p>
                <div className="detail-grid">
                  <DetailRow label="Vai trò" value={detailUser.role === 'admin' ? 'Admin' : 'Khách hàng'} />
                  <DetailRow label="Tier" value={(() => { const t = TIERS[detailUser.tier] || TIERS.dong; return `${t.icon} ${t.label} (−${t.discount}%)`; })()} />
                  <DetailRow label="Hạn mức công nợ" value={detailUser.credit_limit > 0 ? detailUser.credit_limit.toLocaleString('vi-VN') + 'đ' : '—'} />
                  <DetailRow label="Trạng thái TK" value={detailUser.is_active ? 'Hoạt động' : 'Đã khóa'} />
                  <DetailRow label="Trạng thái đăng ký" value={{ pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Đã từ chối' }[detailUser.registration_status] || detailUser.registration_status} />
                </div>
              </div>
              <div className="detail-section">
                <p className="detail-section-title">Giấy phép kinh doanh</p>
                <div className="reg-license-previews">
                  <LicenseCard label="Giấy chứng nhận ĐKKD" url={detailUser.business_license_url} />
                  <LicenseCard label="Giấy ĐK kinh doanh Dược" url={detailUser.pharma_license_url} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDetailUser(null)}>Đóng</button>
              <button className="btn-primary" onClick={() => { setDetailUser(null); openEdit(detailUser); }}>
                <Pencil size={14} /> Chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer orders modal */}
      {ordersUser && (
        <div className="modal-overlay" onClick={() => setOrdersUser(null)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Đơn hàng — {ordersUser.pharmacy_name}</h2>
              <button onClick={() => setOrdersUser(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              {ordersLoading ? (
                <p style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</p>
              ) : userOrders.length === 0 ? (
                <p style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Chưa có đơn hàng</p>
              ) : (
                <table className="admin-table" style={{ margin: 0 }}>
                  <thead><tr><th>Mã đơn</th><th>Ngày</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead>
                  <tbody>
                    {userOrders.map(o => (
                      <tr key={o.id}>
                        <td><strong>{o.order_code}</strong></td>
                        <td style={{ fontSize: 12, color: '#6b7280' }}>{new Date(o.created_at).toLocaleDateString('vi-VN')}</td>
                        <td style={{ color: '#16a34a', fontWeight: 600 }}>{(o.total_amount || 0).toLocaleString('vi-VN')}đ</td>
                        <td>
                          <span className="status-pill" style={{ background: (STATUS_COLORS[o.status] || '#6b7280') + '20', color: STATUS_COLORS[o.status] || '#6b7280' }}>
                            {STATUS_LABELS[o.status] || o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setOrdersUser(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
