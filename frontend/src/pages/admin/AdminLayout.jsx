import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, FileSpreadsheet, Users, UserPlus, LogOut, MessageSquare, ClipboardList, TrendingDown, Bell, BarChart2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);

  const [pendingOrders, setPendingOrders] = useState(0);

  useEffect(() => {
    api.get('/admin/registrations')
      .then(res => setPendingCount(res.data.filter(r => r.registration_status === 'pending').length))
      .catch(() => {});
    api.get('/admin/orders', { params: { status: 'pending', limit: 1 } })
      .then(res => setPendingOrders(res.data.total || 0))
      .catch(() => {});
    const fetchChatUnread = () => {
      api.get('/chat/admin/conversations')
        .then(res => setChatUnread(res.data.reduce((s, c) => s + c.unread, 0)))
        .catch(() => {});
    };
    fetchChatUnread();
    const t = setInterval(fetchChatUnread, 15000);
    return () => clearInterval(t);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItem = ({ isActive }) => isActive ? 'admin-nav-item active' : 'admin-nav-item';

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <span>💊</span>
          <strong>Admin Panel</strong>
        </div>
        <nav className="admin-nav">
          <NavLink to="/admin" end className={navItem}>
            <LayoutDashboard size={20} /> Dashboard
          </NavLink>
          <NavLink to="/admin/products" className={navItem}>
            <Package size={20} /> Sản phẩm
          </NavLink>
          <NavLink to="/admin/pricelist" className={navItem}>
            <FileSpreadsheet size={20} /> Bảng giá
          </NavLink>
          <NavLink to="/admin/users" className={navItem}>
            <Users size={20} /> Khách hàng
          </NavLink>
          <NavLink to="/admin/orders" className={navItem}>
            <ClipboardList size={20} /> Đơn hàng
            {pendingOrders > 0 && <span className="nav-badge">{pendingOrders > 99 ? '99+' : pendingOrders}</span>}
          </NavLink>
          <NavLink to="/admin/registrations" className={navItem}>
            <UserPlus size={20} /> Đăng ký mới
            {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
          </NavLink>
          <NavLink to="/admin/chat" className={navItem}>
            <MessageSquare size={20} /> Tin nhắn
            {chatUnread > 0 && <span className="nav-badge">{chatUnread}</span>}
          </NavLink>
          <NavLink to="/admin/debt" className={navItem}>
            <TrendingDown size={20} /> Công nợ
          </NavLink>
          <NavLink to="/admin/revenue" className={navItem}>
            <BarChart2 size={20} /> Doanh thu
          </NavLink>
          <NavLink to="/admin/broadcast" className={navItem}>
            <Bell size={20} /> Gửi thông báo
          </NavLink>
        </nav>
        <button className="admin-logout" onClick={handleLogout}><LogOut size={18} /> Đăng xuất</button>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
