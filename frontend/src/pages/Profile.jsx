import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ClipboardList, MessageSquare, User, Lock, Fingerprint, Headphones, Info, LogOut, ChevronRight, X, Heart, LayoutList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getTier } from '../lib/tiers';
import { useToast } from '../context/ToastContext';
import { useNotification } from '../context/NotificationContext';
import Layout from '../components/Layout';
import api from '../lib/api';

export default function Profile() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { unreadCount } = useNotification();
  const [modal, setModal] = useState(null); // 'profile' | 'password'
  const [stats, setStats] = useState(null);

  // Profile form
  const [profileForm, setProfileForm] = useState({ pharmacy_name: '', address: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password form
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') {
      api.get('/orders/stats').then(res => setStats(res.data)).catch(() => {});
    }
  }, [user]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const openProfile = () => {
    setProfileForm({ pharmacy_name: user?.pharmacy_name || '', address: user?.address || '' });
    setProfileError('');
    setModal('profile');
  };

  const openPassword = () => {
    setPwForm({ current_password: '', new_password: '', confirm: '' });
    setPwError('');
    setPwSuccess(false);
    setModal('password');
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true); setProfileError('');
    try {
      const res = await api.put('/auth/profile', profileForm);
      setUser(res.data);
      setModal(null);
      showToast('Cập nhật thành công', 'success');
    } catch (e) {
      setProfileError(e.response?.data?.error || 'Lỗi cập nhật');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm) {
      setPwError('Mật khẩu xác nhận không khớp'); return;
    }
    setPwSaving(true); setPwError('');
    try {
      await api.put('/auth/change-password', { current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwSuccess(true);
    } catch (e) {
      setPwError(e.response?.data?.error || 'Lỗi đổi mật khẩu');
    } finally {
      setPwSaving(false);
    }
  };

  const MenuItem = ({ icon, label, sub, onClick }) => (
    <button className="menu-item" onClick={onClick}>
      <span className="menu-icon">{icon}</span>
      <div className="menu-label">
        <span>{label}</span>
        {sub && <span className="menu-sub">{sub}</span>}
      </div>
      <ChevronRight size={16} className="menu-arrow" />
    </button>
  );

  const tier = getTier(user?.tier);

  return (
    <Layout>
      <div className="profile-page">
        <header className="profile-header">
          <h1>Cá nhân</h1>
          <button className="notif-bell-btn" onClick={() => navigate('/notifications')} style={{ position: 'relative', color: '#374151', padding: 4 }}>
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="cart-badge-header">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>
        </header>

        <div className="profile-card">
          <div className="profile-avatar">{user?.pharmacy_name?.[0] || '?'}</div>
          <div className="profile-info">
            <h2>{user?.pharmacy_name}</h2>
            <p>{user?.customer_code ? `${user.customer_code} · ` : ''}{user?.phone}</p>
            <span
              className="tier-badge"
              style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.color}40` }}
            >
              {tier.icon} {tier.label}
              {tier.discount > 0 && <span style={{ marginLeft: 4, fontSize: 10 }}>(-{tier.discount}%)</span>}
            </span>
            {user?.credit_limit > 0 && (
              <span className="tier-badge" style={{ marginLeft: 6, background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', fontSize: 11 }}>
                Hạn mức: {user.credit_limit.toLocaleString('vi-VN')}đ
              </span>
            )}
          </div>
          <button className="edit-profile-btn" onClick={openProfile}>✏️</button>
        </div>

        {stats && (
          <>
            {stats.unpaid_amount > 0 && (
              <div className="debt-alert-card" onClick={() => navigate('/orders')}>
                <div>
                  <p className="debt-alert-label">Công nợ chưa thanh toán</p>
                  <p className="debt-alert-amount">{stats.unpaid_amount.toLocaleString('vi-VN')}đ</p>
                </div>
                <span className="debt-alert-arrow">›</span>
              </div>
            )}
            <div className="profile-stats">
              <div className="stat-card">
                <span className="stat-num">{stats.total_orders}</span>
                <span className="stat-label">Tổng đơn</span>
              </div>
              <div className="stat-card">
                <span className="stat-num">{stats.delivered}</span>
                <span className="stat-label">Đã giao</span>
              </div>
              <div className="stat-card">
                <span className="stat-num">{stats.total_amount > 0 ? (stats.total_amount / 1e6).toFixed(1) + 'M' : '0'}</span>
                <span className="stat-label">Tổng chi</span>
              </div>
            </div>
          </>
        )}

        <div className="menu-section">
          <p className="menu-section-title">QUẢN LÝ</p>
          <MenuItem icon={<ClipboardList size={20} />} label="Lịch sử đơn hàng" onClick={() => navigate('/orders')} />
          <MenuItem icon={<Heart size={20} />} label="Sản phẩm yêu thích" onClick={() => navigate('/wishlist')} />
          <MenuItem icon={<LayoutList size={20} />} label="Bảng giá theo danh mục" onClick={() => navigate('/catalog')} />
          <MenuItem icon={<MessageSquare size={20} />} label="Tin nhắn hỗ trợ" onClick={() => navigate('/chat')} />
        </div>

        <div className="menu-section">
          <p className="menu-section-title">TÀI KHOẢN</p>
          <MenuItem icon={<User size={20} />} label="Thông tin cá nhân" onClick={openProfile} />
          <MenuItem icon={<Lock size={20} />} label="Đổi mật khẩu" onClick={openPassword} />
          <MenuItem icon={<Fingerprint size={20} />} label="Đăng nhập sinh trắc học" sub="Touch ID / Face ID" />
        </div>

        <div className="menu-section">
          <p className="menu-section-title">HỖ TRỢ</p>
          <MenuItem icon={<Headphones size={20} />} label="Liên hệ hỗ trợ" sub="Hotline: 0966 050 306" />
          <MenuItem icon={<Info size={20} />} label="Về ứng dụng" />
        </div>

        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={18} /> Đăng xuất
        </button>

        <p className="version-text">Phiên bản 1.0.0</p>
      </div>

      {/* Profile edit modal */}
      {modal === 'profile' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Thông tin cá nhân</h2>
              <button onClick={() => setModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tên nhà thuốc *</label>
                <input
                  type="text"
                  value={profileForm.pharmacy_name}
                  onChange={e => setProfileForm({ ...profileForm, pharmacy_name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Địa chỉ</label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Số điện thoại</label>
                <input type="text" value={user?.phone || ''} disabled style={{ background: '#f3f4f6', color: '#6b7280' }} />
              </div>
              {profileError && <div className="error-msg">{profileError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Hủy</button>
              <button className="btn-primary" onClick={handleSaveProfile} disabled={profileSaving}>
                {profileSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {modal === 'password' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Đổi mật khẩu</h2>
              <button onClick={() => setModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {pwSuccess ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>✅</p>
                  <p style={{ fontWeight: 600, color: '#16a34a' }}>Đổi mật khẩu thành công!</p>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Mật khẩu hiện tại *</label>
                    <input type="password" value={pwForm.current_password}
                      onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} autoFocus />
                  </div>
                  <div className="form-group">
                    <label>Mật khẩu mới *</label>
                    <input type="password" placeholder="Tối thiểu 6 ký tự" value={pwForm.new_password}
                      onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Xác nhận mật khẩu mới *</label>
                    <input type="password" value={pwForm.confirm}
                      onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} />
                  </div>
                  {pwError && <div className="error-msg">{pwError}</div>}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>{pwSuccess ? 'Đóng' : 'Hủy'}</button>
              {!pwSuccess && (
                <button className="btn-primary" onClick={handleChangePassword}
                  disabled={pwSaving || !pwForm.current_password || !pwForm.new_password || !pwForm.confirm}>
                  {pwSaving ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
