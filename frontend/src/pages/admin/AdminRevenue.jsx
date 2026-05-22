import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import api from '../../lib/api';
import AdminLayout from './AdminLayout';

function fmt(n) { return (n || 0).toLocaleString('vi-VN') + 'đ'; }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ fontWeight: 700, marginBottom: 6 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
};

export default function AdminRevenue() {
  const [data, setData] = useState([]);
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/stats/revenue-monthly', { params: { months } })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [months]);

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalOrders  = data.reduce((s, d) => s + d.orders, 0);
  const totalPaid    = data.reduce((s, d) => s + d.paid, 0);
  const avgMonthly   = data.length ? Math.round(totalRevenue / data.length) : 0;
  const bestMonth    = data.reduce((best, d) => d.revenue > (best?.revenue || 0) ? d : best, null);

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Báo cáo doanh thu</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {[6, 12, 24].map(m => (
              <button
                key={m}
                className={months === m ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 14px', fontSize: 13 }}
                onClick={() => setMonths(m)}
              >
                {m} tháng
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card" style={{ borderLeftColor: '#16a34a' }}>
            <div className="stat-icon" style={{ color: '#16a34a' }}>💰</div>
            <div>
              <p className="stat-label">Tổng doanh thu (đã giao)</p>
              <p className="stat-value" style={{ fontSize: 16 }}>{fmt(totalRevenue)}</p>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#3b82f6' }}>
            <div className="stat-icon" style={{ color: '#3b82f6' }}>📦</div>
            <div>
              <p className="stat-label">Tổng đơn đã giao</p>
              <p className="stat-value">{totalOrders.toLocaleString('vi-VN')}</p>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#10b981' }}>
            <div className="stat-icon" style={{ color: '#10b981' }}>✓</div>
            <div>
              <p className="stat-label">Đã thu tiền</p>
              <p className="stat-value" style={{ fontSize: 16 }}>{fmt(totalPaid)}</p>
              <p style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>Chưa thu: {fmt(totalRevenue - totalPaid)}</p>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#8b5cf6' }}>
            <div className="stat-icon" style={{ color: '#8b5cf6' }}>📊</div>
            <div>
              <p className="stat-label">Trung bình / tháng</p>
              <p className="stat-value" style={{ fontSize: 16 }}>{fmt(avgMonthly)}</p>
              {bestMonth && <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Tháng tốt nhất: {bestMonth.month}</p>}
            </div>
          </div>
        </div>

        {/* Revenue chart */}
        <div className="dash-section">
          <h2 className="dash-section-title">Doanh thu theo tháng</h2>
          {loading ? (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Đang tải...</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={v => v >= 1e9 ? (v/1e9).toFixed(1)+'T' : v >= 1e6 ? (v/1e6).toFixed(0)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : v} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="paid" name="Đã thu" fill="#16a34a" radius={[3, 3, 0, 0]} stackId="a" />
                <Bar dataKey="unpaid" name="Chưa thu" fill="#fca5a5" radius={[3, 3, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Monthly table */}
        <div className="dash-section">
          <h2 className="dash-section-title">Chi tiết theo tháng</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th>Đơn đã giao</th>
                  <th>Doanh thu</th>
                  <th>Đã thu</th>
                  <th>Chưa thu</th>
                  <th>Tỉ lệ thu</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.month}>
                    <td><strong>{row.month}</strong></td>
                    <td>{row.orders}</td>
                    <td className="price-col">{fmt(row.revenue)}</td>
                    <td style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(row.paid)}</td>
                    <td style={{ color: row.unpaid > 0 ? '#ef4444' : '#9ca3af' }}>{fmt(row.unpaid)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${row.revenue ? Math.round(row.paid / row.revenue * 100) : 0}%`, background: '#16a34a', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>
                          {row.revenue ? Math.round(row.paid / row.revenue * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr style={{ background: '#f0fdf4', fontWeight: 700 }}>
                  <td>TỔNG</td>
                  <td>{totalOrders}</td>
                  <td className="price-col">{fmt(totalRevenue)}</td>
                  <td style={{ color: '#16a34a' }}>{fmt(totalPaid)}</td>
                  <td style={{ color: '#ef4444' }}>{fmt(totalRevenue - totalPaid)}</td>
                  <td style={{ fontSize: 13 }}>
                    {totalRevenue ? Math.round(totalPaid / totalRevenue * 100) : 0}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
