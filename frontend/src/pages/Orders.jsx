import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, X, Search, RotateCcw } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useCart } from '../context/CartContext';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';

function formatPrice(price) {
  return price?.toLocaleString('vi-VN') + 'đ';
}

const STATUS_LABELS = {
  pending:   { label: 'Chờ XN',       color: '#f59e0b' },
  confirmed: { label: 'Đang kiểm tra', color: '#3b82f6' },
  shipping:  { label: 'Đang giao',     color: '#8b5cf6' },
  delivered: { label: 'Đã giao',       color: '#10b981' },
  cancelled: { label: 'Đã hủy',        color: '#ef4444' },
};

const TABS = [
  { key: 'all',       label: 'Tất cả' },
  { key: 'pending',   label: 'Chờ XN' },
  { key: 'shipping',  label: 'Đang giao' },
  { key: 'delivered', label: 'Đã giao' },
  { key: 'cancelled', label: 'Đã hủy' },
];

export default function Orders() {
  const [orders, setOrders]       = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading]     = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null); // { id, code }
  const [search, setSearch] = useState('');
  const [reordering, setReordering] = useState(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { addItem } = useCart();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = activeTab !== 'all' ? { status: activeTab } : {};
      const res = await api.get('/orders', { params });
      setOrders(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, [activeTab]);

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(o => o.order_code?.toLowerCase().includes(q));
  }, [orders, search]);

  const handleCancel = (e, orderId, orderCode) => {
    e.stopPropagation();
    setCancelTarget({ id: orderId, code: orderCode });
  };

  const confirmCancel = async () => {
    const { id } = cancelTarget;
    setCancelTarget(null);
    setCancelling(id);
    try {
      await api.put(`/orders/${id}/cancel`);
      fetchOrders();
      showToast('Đã hủy đơn hàng', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Lỗi hủy đơn', 'error');
    } finally {
      setCancelling(null);
    }
  };

  const handleReorder = async (e, orderId) => {
    e.stopPropagation();
    setReordering(orderId);
    try {
      const res = await api.get(`/orders/${orderId}`);
      const orderItems = res.data.order_items || [];
      if (orderItems.length === 0) { showToast('Đơn hàng không có sản phẩm', 'error'); return; }
      orderItems.forEach(item => { if (item.products) addItem(item.products, item.quantity); });
      showToast(`Đã thêm ${orderItems.length} sản phẩm vào giỏ hàng`, 'success');
      navigate('/cart');
    } catch { showToast('Không thể tải đơn hàng', 'error'); }
    finally { setReordering(null); }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  return (
    <Layout>
      <div className="orders-page">
        <header className="page-header">
          <h1>🗂 Đơn hàng của tôi</h1>
          <button className="icon-btn" onClick={fetchOrders}><RefreshCw size={20} /></button>
        </header>

        <div className="orders-search-bar">
          <Search size={15} />
          <input
            placeholder="Tìm mã đơn hàng..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')}><X size={14} /></button>}
        </div>

        <div className="order-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`order-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => { setActiveTab(t.key); setSearch(''); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="order-list">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="order-card skeleton-order-card">
                <div className="skeleton skeleton-order-header" />
                <div className="skeleton skeleton-order-footer" />
              </div>
            ))
          ) : filteredOrders.length === 0 ? (
            <div className="empty-text">{search ? `Không tìm thấy "${search}"` : 'Không có đơn hàng'}</div>
          ) : (
            filteredOrders.map((order) => {
              const status = STATUS_LABELS[order.status] || { label: order.status, color: '#6b7280' };
              return (
                <div key={order.id} className="order-card" onClick={() => navigate(`/orders/${order.id}`)}>
                  <div className="order-card-header">
                    <div>
                      <p className="order-code">Mã đơn: {order.order_code}</p>
                      <p className="order-date">⏰ {formatDate(order.created_at)}</p>
                    </div>
                    <span className="order-status-badge" style={{ backgroundColor: status.color + '20', color: status.color }}>
                      {status.label}
                    </span>
                  </div>
                  <div className="order-card-footer">
                    <div>
                      <span>🗂 {order.order_items?.length || 0} món</span>
                      <span className={`payment-status-badge ${order.payment_status === 'paid' ? 'paid' : 'unpaid'}`} style={{ marginLeft: 8 }}>
                        {order.payment_status === 'paid' ? '✓ Đã TT' : '⏳ Chưa TT'}
                      </span>
                    </div>
                    <div className="order-right">
                      <span className="order-total">{formatPrice(order.total_amount)}</span>
                      {order.status === 'pending' && (
                        <button
                          className="btn-cancel-order"
                          onClick={(e) => handleCancel(e, order.id, order.order_code)}
                          disabled={cancelling === order.id}
                          title="Hủy đơn hàng"
                        >
                          {cancelling === order.id ? '...' : <X size={14} />} Hủy
                        </button>
                      )}
                      <button
                        className="btn-reorder"
                        onClick={(e) => handleReorder(e, order.id)}
                        disabled={reordering === order.id}
                        title="Đặt lại đơn này"
                      >
                        {reordering === order.id ? '...' : <RotateCcw size={13} />}
                      </button>
                      <button className="btn-detail" onClick={(e) => { e.stopPropagation(); navigate(`/orders/${order.id}`); }}>Chi tiết</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {cancelTarget && (
        <ConfirmModal
          title="Hủy đơn hàng"
          message={`Bạn chắc chắn muốn hủy đơn ${cancelTarget.code}? Hành động này không thể hoàn tác.`}
          confirmLabel="Hủy đơn"
          onConfirm={confirmCancel}
          onCancel={() => setCancelTarget(null)}
        />
      )}
    </Layout>
  );
}
