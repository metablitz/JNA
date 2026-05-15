import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import AdminLayout from './AdminLayout';

function fmt(n) { return (n || 0).toLocaleString('vi-VN') + 'đ'; }

export default function AdminDebtReport() {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/debt-report');
      setReport(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/debt-report/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cong_no_${Date.now()}.xlsx`;
      a.click();
    } catch { showToast('Xuất thất bại', 'error'); }
    finally { setExporting(false); }
  };

  const filtered = report.filter(r =>
    !search || r.pharmacy_name?.toLowerCase().includes(search.toLowerCase()) || r.phone?.includes(search)
  );

  const totalUnpaid = filtered.reduce((s, r) => s + r.unpaid_amount, 0);
  const totalPaid   = filtered.reduce((s, r) => s + r.paid_amount, 0);

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Báo cáo công nợ</h1>
          <button className="btn-secondary btn-icon" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        </div>

        {/* Summary cards */}
        <div className="debt-summary">
          <div className="debt-sum-card unpaid">
            <p className="debt-sum-label">Tổng công nợ chưa thu</p>
            <p className="debt-sum-val">{fmt(totalUnpaid)}</p>
          </div>
          <div className="debt-sum-card paid">
            <p className="debt-sum-label">Tổng đã thanh toán</p>
            <p className="debt-sum-val">{fmt(totalPaid)}</p>
          </div>
          <div className="debt-sum-card neutral">
            <p className="debt-sum-label">Số khách còn nợ</p>
            <p className="debt-sum-val">{filtered.filter(r => r.unpaid_amount > 0).length}</p>
          </div>
        </div>

        <div className="admin-search" style={{ marginBottom: 16 }}>
          <input placeholder="Tìm tên nhà thuốc, SĐT..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nhà thuốc</th>
                <th>SĐT / Mã KH</th>
                <th style={{ textAlign: 'right' }}>Số đơn</th>
                <th style={{ textAlign: 'right' }}>Tổng đơn</th>
                <th style={{ textAlign: 'right' }}>Đã thu</th>
                <th style={{ textAlign: 'right' }}>Còn nợ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center">Đang tải...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center">Không có dữ liệu</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.user_id} className={r.unpaid_amount > 0 ? 'debt-row-unpaid' : ''}>
                  <td><strong>{r.pharmacy_name}</strong></td>
                  <td>
                    <p>{r.phone}</p>
                    {r.customer_code && <p className="text-sm text-gray">{r.customer_code}</p>}
                  </td>
                  <td style={{ textAlign: 'right' }}>{r.total_orders}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(r.total_amount)}</td>
                  <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{fmt(r.paid_amount)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={r.unpaid_amount > 0 ? 'debt-badge-red' : 'debt-badge-green'}>
                      {fmt(r.unpaid_amount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700, background: '#f9fafb' }}>
                  <td colSpan={3}>Tổng cộng ({filtered.length} khách)</td>
                  <td style={{ textAlign: 'right' }}>{fmt(filtered.reduce((s,r) => s + r.total_amount, 0))}</td>
                  <td style={{ textAlign: 'right', color: '#16a34a' }}>{fmt(totalPaid)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="debt-badge-red">{fmt(totalUnpaid)}</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
