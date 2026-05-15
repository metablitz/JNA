import { useState, useEffect } from 'react';
import { Users, Package, ClipboardList, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../lib/api';
import AdminLayout from './AdminLayout';
import { useNavigate } from 'react-router-dom';

function fmt(n) { return n?.toLocaleString('vi-VN') + 'đ'; }

function StatCard({ icon, label, value, color, onClick, sub }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className="stat-icon" style={{ color }}>{icon}</div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {sub && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
      <p style={{ fontWeight: 600, marginBottom: 2 }}>{label}</p>
      <p style={{ color: '#16a34a' }}>{fmt(payload[0].value)}</p>
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [chartDays, setChartDays] = useState(7);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setStats(null);
    api.get('/admin/stats', { params: { chart_days: chartDays } })
      .then((res) => setStats(res.data))
      .catch(console.error);
  }, [chartDays]);

  useEffect(() => {
    api.get('/admin/products/low-stock', { params: { threshold: 20 } })
      .then(res => setLowStock(res.data || []))
      .catch(() => {});
    loadPendingOrders();
  }, []);

  const loadPendingOrders = () => {
    api.get('/admin/orders', { params: { status: 'pending', limit: 5 } })
      .then(res => setPendingOrders(res.data.orders || []))
      .catch(() => {});
  };

  const confirmOrder = async (id) => {
    setConfirmingId(id);
    try {
      await api.put(`/admin/orders/${id}/status`, { status: 'confirmed' });
      setPendingOrders(prev => prev.filter(o => o.id !== id));
      setStats(s => s ? { ...s, pending_orders: Math.max(0, s.pending_orders - 1) } : s);
    } catch { /* ignore */ } finally { setConfirmingId(null); }
  };

  const maxRevenue = stats?.revenue_chart ? Math.max(...stats.revenue_chart.map(d => d.revenue), 1) : 1;

  return (
    <AdminLayout>
      <div className="admin-page">
        <h1 className="admin-page-title">Dashboard</h1>

        {/* Stat cards */}
        <div className="stats-grid">
          <StatCard icon={<Users size={28} />} label="Khách hàng" value={stats?.total_users ?? '...'} color="#3b82f6"
            onClick={() => navigate('/admin/users')} />
          <StatCard icon={<Package size={28} />} label="Sản phẩm" value={stats?.total_products ?? '...'} color="#10b981"
            onClick={() => navigate('/admin/products')} />
          <StatCard icon={<ClipboardList size={28} />} label="Tổng đơn hàng" value={stats?.total_orders ?? '...'}
            color="#f59e0b"
            sub={stats ? `⏳ ${stats.pending_orders} chờ · Hôm nay: ${stats.today_orders}` : undefined}
            onClick={() => navigate('/admin/orders')} />
          <StatCard icon={<TrendingUp size={28} />} label="Doanh thu (đã giao)"
            value={stats ? fmt(stats.total_revenue) : '...'} color="#8b5cf6"
            sub={stats ? `Hôm nay: ${fmt(stats.today_revenue)}` : undefined} />
        </div>

        {/* Pending orders quick action */}
        {pendingOrders.length > 0 && (
          <div className="dash-section dash-pending-orders">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 className="dash-section-title" style={{ marginBottom: 0, color: '#d97706' }}>
                ⏳ Đơn chờ xác nhận ({stats?.pending_orders ?? pendingOrders.length})
              </h2>
              <button
                className="btn-secondary"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => navigate('/admin/orders')}
              >
                Xem tất cả →
              </button>
            </div>
            <div className="pending-order-list">
              {pendingOrders.map(o => (
                <div key={o.id} className="pending-order-item">
                  <div className="pending-order-info">
                    <span className="pending-order-code">{o.order_code}</span>
                    <span className="pending-order-name">{o.users?.pharmacy_name}</span>
                  </div>
                  <div className="pending-order-right">
                    <span className="pending-order-amount">{(o.total_amount || 0).toLocaleString('vi-VN')}đ</span>
                    <button
                      className="btn-confirm-order"
                      onClick={() => confirmOrder(o.id)}
                      disabled={confirmingId === o.id}
                    >
                      {confirmingId === o.id ? '...' : '✓ XN'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue chart */}
        <div className="dash-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 className="dash-section-title" style={{ marginBottom: 0 }}>Doanh thu {chartDays} ngày gần nhất</h2>
            <div className="chart-period-btns">
              {[7, 14, 30, 90].map(d => (
                <button
                  key={d}
                  className={`chart-period-btn ${chartDays === d ? 'active' : ''}`}
                  onClick={() => setChartDays(d)}
                >{d}N</button>
              ))}
            </div>
          </div>
          {stats?.revenue_chart ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.revenue_chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }}
                  interval={chartDays <= 7 ? 0 : chartDays <= 14 ? 1 : chartDays <= 30 ? 4 : 9} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={v => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Đang tải...</div>
          )}
        </div>

        {/* Low stock alert */}
        {lowStock.length > 0 && (
          <div className="dash-section dash-low-stock">
            <h2 className="dash-section-title" style={{ color: '#d97706' }}>
              <AlertTriangle size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              Sản phẩm sắp hết hàng ({lowStock.length})
            </h2>
            <div className="low-stock-list">
              {lowStock.map(p => (
                <div key={p.id} className="low-stock-item">
                  <div className="low-stock-info">
                    <span className="low-stock-name">{p.name}</span>
                    {p.category && <span className="low-stock-cat">{p.category}</span>}
                  </div>
                  <span className={`low-stock-qty ${p.stock === 0 ? 'out' : p.stock <= 5 ? 'critical' : 'low'}`}>
                    {p.stock === 0 ? 'Hết hàng' : `${p.stock.toLocaleString('vi-VN')} ${p.unit}`}
                  </span>
                </div>
              ))}
            </div>
            <button
              className="btn-secondary"
              style={{ marginTop: 12, fontSize: 13, padding: '6px 14px' }}
              onClick={() => navigate('/admin/products')}
            >
              Quản lý kho →
            </button>
          </div>
        )}

        {/* Top products + top customers */}
        <div className="dash-two-col">
          <div className="dash-section">
            <h2 className="dash-section-title">Top sản phẩm (30 ngày)</h2>
            {!stats ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Đang tải...</p>
              : stats.top_products.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Chưa có dữ liệu</p>
              : stats.top_products.map((p, i) => (
              <div key={i} className="dash-rank-item">
                <span className="dash-rank-num">{i + 1}</span>
                <div className="dash-rank-info">
                  <p className="dash-rank-name">{p.name}</p>
                  <p className="dash-rank-sub">{p.qty.toLocaleString('vi-VN')} {p.unit}</p>
                </div>
                <span className="dash-rank-val">{fmt(p.revenue)}</span>
              </div>
            ))}
          </div>

          <div className="dash-section">
            <h2 className="dash-section-title">Top khách hàng (30 ngày)</h2>
            {!stats ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Đang tải...</p>
              : stats.top_customers.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Chưa có dữ liệu</p>
              : stats.top_customers.map((c, i) => (
              <div key={i} className="dash-rank-item">
                <span className="dash-rank-num">{i + 1}</span>
                <div className="dash-rank-info">
                  <p className="dash-rank-name">{c.name}</p>
                </div>
                <span className="dash-rank-val">{fmt(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
