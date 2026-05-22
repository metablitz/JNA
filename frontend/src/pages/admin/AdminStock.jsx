import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { Download } from 'lucide-react';
import api from '../../lib/api';
import AdminLayout from './AdminLayout';

const REASON_OPTIONS = [
  { value: 'all',        label: 'Tất cả lý do' },
  { value: 'import',     label: 'Nhập hàng' },
  { value: 'export',     label: 'Xuất hàng' },
  { value: 'adjustment', label: 'Điều chỉnh' },
  { value: 'order',      label: 'Đơn hàng' },
];

function fmt(n) { return (n || 0).toLocaleString('vi-VN'); }

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: '#374151' }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
};

export default function AdminStock() {
  const [from, setFrom]     = useState(defaultRange().from);
  const [to, setTo]         = useState(defaultRange().to);
  const [reason, setReason] = useState('all');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/stock/report', { params: { from, to, reason } });
      setData(res.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const base  = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const params = new URLSearchParams({ from, to, ...(reason !== 'all' ? { reason } : {}) });
      const resp = await window.fetch(`${base}/admin/stock/report/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'bao-cao-kho.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
    finally { setExporting(false); }
  };

  const summary = (data?.summary || []).filter(p =>
    !search.trim() || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalImport = summary.reduce((s, p) => s + p.import_qty, 0);
  const totalExport = summary.reduce((s, p) => s + p.export_qty, 0);
  const totalOrder  = summary.reduce((s, p) => s + p.order_qty,  0);
  const totalAdj    = summary.reduce((s, p) => s + p.adjustment_qty, 0);

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Báo cáo xuất nhập kho</h1>
          <button className="btn-export" onClick={handleExport} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        </div>

        {/* Filters */}
        <div className="stock-filter-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 13, color: '#6b7280', flexShrink: 0 }}>Từ ngày</label>
            <input type="date" className="filter-input" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 13, color: '#6b7280', flexShrink: 0 }}>Đến ngày</label>
            <input type="date" className="filter-input" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <select className="filter-input" value={reason} onChange={e => setReason(e.target.value)}>
            {REASON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className="btn-primary" style={{ padding: '8px 18px', fontSize: 13 }} onClick={load} disabled={loading}>
            {loading ? 'Đang tải...' : 'Xem báo cáo'}
          </button>
        </div>

        {data && (
          <>
            {/* Summary cards */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card" style={{ borderLeftColor: '#16a34a' }}>
                <div className="stat-icon" style={{ color: '#16a34a' }}>📦</div>
                <div>
                  <p className="stat-label">Tổng nhập hàng</p>
                  <p className="stat-value">{fmt(totalImport)}</p>
                </div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: '#ef4444' }}>
                <div className="stat-icon" style={{ color: '#ef4444' }}>🚚</div>
                <div>
                  <p className="stat-label">Tổng xuất hàng</p>
                  <p className="stat-value">{fmt(totalExport)}</p>
                </div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: '#3b82f6' }}>
                <div className="stat-icon" style={{ color: '#3b82f6' }}>🛒</div>
                <div>
                  <p className="stat-label">Xuất theo đơn</p>
                  <p className="stat-value">{fmt(totalOrder)}</p>
                </div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: '#8b5cf6' }}>
                <div className="stat-icon" style={{ color: '#8b5cf6' }}>⚖️</div>
                <div>
                  <p className="stat-label">Điều chỉnh</p>
                  <p className="stat-value">{totalAdj > 0 ? '+' : ''}{fmt(totalAdj)}</p>
                </div>
              </div>
            </div>

            {/* Chart */}
            {data.chart.length > 0 && (
              <div className="dash-section" style={{ marginBottom: 20 }}>
                <h2 className="dash-section-title">Biến động xuất nhập theo ngày</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.chart} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }}
                      tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="in"  name="Nhập" fill="#16a34a" radius={[3,3,0,0]} />
                    <Bar dataKey="out" name="Xuất" fill="#ef4444" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Summary table */}
            <div className="dash-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
                <h2 className="dash-section-title" style={{ margin: 0 }}>
                  Chi tiết theo sản phẩm ({data.summary.length} SP)
                </h2>
                <input
                  className="filter-input"
                  style={{ maxWidth: 220 }}
                  placeholder="Tìm tên sản phẩm..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {summary.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 24 }}>
                  Không có dữ liệu xuất nhập trong kỳ này
                </p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Sản phẩm</th>
                        <th>Danh mục</th>
                        <th>ĐVT</th>
                        <th style={{ color: '#16a34a' }}>Nhập hàng</th>
                        <th style={{ color: '#ef4444' }}>Xuất hàng</th>
                        <th style={{ color: '#3b82f6' }}>Xuất đơn</th>
                        <th style={{ color: '#8b5cf6' }}>Điều chỉnh</th>
                        <th>Tồn hiện tại</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map(p => (
                        <tr key={p.product_id}>
                          <td style={{ fontWeight: 600 }}>{p.name}</td>
                          <td><span style={{ fontSize: 11, background: '#f3f4f6', borderRadius: 4, padding: '2px 6px' }}>{p.category || '—'}</span></td>
                          <td>{p.unit}</td>
                          <td style={{ color: '#16a34a', fontWeight: 600 }}>{p.import_qty > 0 ? `+${fmt(p.import_qty)}` : '—'}</td>
                          <td style={{ color: '#ef4444', fontWeight: 600 }}>{p.export_qty > 0 ? `-${fmt(p.export_qty)}` : '—'}</td>
                          <td style={{ color: '#3b82f6', fontWeight: 600 }}>{p.order_qty > 0 ? `-${fmt(p.order_qty)}` : '—'}</td>
                          <td style={{ color: p.adjustment_qty > 0 ? '#16a34a' : p.adjustment_qty < 0 ? '#ef4444' : '#9ca3af', fontWeight: 600 }}>
                            {p.adjustment_qty !== 0 ? (p.adjustment_qty > 0 ? `+${fmt(p.adjustment_qty)}` : fmt(p.adjustment_qty)) : '—'}
                          </td>
                          <td>
                            <span style={{
                              fontWeight: 700, fontSize: 13,
                              color: p.current_stock === 0 ? '#ef4444' : p.current_stock <= 10 ? '#d97706' : '#16a34a',
                            }}>
                              {fmt(p.current_stock)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f0fdf4', fontWeight: 700 }}>
                        <td colSpan={3}>TỔNG CỘNG</td>
                        <td style={{ color: '#16a34a' }}>{totalImport > 0 ? `+${fmt(totalImport)}` : '—'}</td>
                        <td style={{ color: '#ef4444' }}>{totalExport > 0 ? `-${fmt(totalExport)}` : '—'}</td>
                        <td style={{ color: '#3b82f6' }}>{totalOrder > 0 ? `-${fmt(totalOrder)}` : '—'}</td>
                        <td style={{ color: '#8b5cf6' }}>{totalAdj !== 0 ? (totalAdj > 0 ? `+${fmt(totalAdj)}` : fmt(totalAdj)) : '—'}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {!data && !loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            Chọn khoảng thời gian và nhấn "Xem báo cáo"
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
