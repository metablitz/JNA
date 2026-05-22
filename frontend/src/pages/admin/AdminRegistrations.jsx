import { useState, useEffect } from 'react';
import { Eye, Check, X, Clock, ChevronUp, FileText, ExternalLink } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/ConfirmModal';
import AdminLayout from './AdminLayout';

function LicenseCard({ label, url }) {
  const [imgError, setImgError] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  if (!url) return null;
  const isPdf = url.toLowerCase().includes('.pdf');

  return (
    <div className="license-card">
      <p className="license-card-label">{label}</p>
      {isPdf || imgError ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="license-pdf-btn">
          <FileText size={16} /> Xem PDF <ExternalLink size={13} />
        </a>
      ) : (
        <img
          src={url}
          alt={label}
          className="license-thumb"
          onError={() => setImgError(true)}
          onClick={() => setLightbox(true)}
        />
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

export default function AdminRegistrations() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [customerCode, setCustomerCode] = useState('');
  const [processing, setProcessing] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    try { const res = await api.get('/admin/registrations'); setList(res.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openDetail = (r) => {
    setDetail(detail?.id === r.id ? null : r);
    setCustomerCode('');
  };

  const approve = async (id) => {
    setProcessing(id);
    try {
      await api.put(`/admin/registrations/${id}/approve`, { customer_code: customerCode });
      showToast('Đã duyệt và kích hoạt tài khoản', 'success');
      setDetail(null);
      load();
    } catch (e) {
      showToast(e.userMessage || 'Lỗi không xác định', 'error');
    } finally { setProcessing(null); }
  };

  const reject = (id) => setRejectTarget(id);

  const confirmReject = async () => {
    const id = rejectTarget;
    setRejectTarget(null);
    setProcessing(id);
    try {
      await api.put(`/admin/registrations/${id}/reject`);
      setDetail(null);
      load();
      showToast('Đã từ chối đăng ký', 'info');
    } catch (e) {
      showToast(e.userMessage || 'Lỗi không xác định', 'error');
    }
    finally { setProcessing(null); }
  };

  const pending = list.filter(r => r.registration_status === 'pending');
  const rejected = list.filter(r => r.registration_status === 'rejected');

  const RegistrationRow = ({ r }) => {
    const isOpen = detail?.id === r.id;
    const isPending = r.registration_status === 'pending';

    return (
      <>
        <tr>
          <td>
            <strong>{r.pharmacy_name}</strong>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{r.phone}</div>
          </td>
          <td style={{ fontSize: 13, color: '#6b7280' }}>{r.address}</td>
          <td>{new Date(r.created_at).toLocaleDateString('vi-VN')}</td>
          <td>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {isPending && (
                <>
                  <button
                    className="reg-btn-approve"
                    onClick={() => approve(r.id)}
                    disabled={processing === r.id}
                    title="Duyệt ngay"
                  >
                    <Check size={14} /> Duyệt
                  </button>
                  <button
                    className="reg-btn-reject"
                    onClick={() => reject(r.id)}
                    disabled={processing === r.id}
                    title="Từ chối"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
              <button
                className="action-btn edit"
                onClick={() => openDetail(r)}
                title={isOpen ? 'Đóng' : 'Xem giấy phép & đặt mã KH'}
              >
                {isOpen ? <ChevronUp size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </td>
        </tr>

        {isOpen && (
          <tr className="reg-detail-row">
            <td colSpan={4}>
              <div className="reg-detail-panel">
                <div className="reg-license-previews" style={{ marginBottom: isPending ? 14 : 0 }}>
                  <LicenseCard label="Giấy chứng nhận ĐKKD" url={r.business_license_url} />
                  <LicenseCard label="Giấy ĐK kinh doanh Dược" url={r.pharma_license_url} />
                </div>

                {isPending && (
                  <div className="reg-approve-row">
                    <input
                      type="text"
                      placeholder="Mã khách hàng (tuỳ chọn, VD: KH001)"
                      value={customerCode}
                      onChange={(e) => setCustomerCode(e.target.value)}
                      className="reg-code-input"
                    />
                    <button
                      className="btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px' }}
                      onClick={() => approve(r.id)}
                      disabled={processing === r.id}
                    >
                      <Check size={16} />
                      {processing === r.id ? 'Đang xử lý...' : 'Duyệt & Kích hoạt'}
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => reject(r.id)}
                      disabled={processing === r.id}
                    >
                      <X size={16} /> Từ chối
                    </button>
                  </div>
                )}
              </div>
            </td>
          </tr>
        )}
      </>
    );
  };

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">
            Đăng ký tài khoản
            {pending.length > 0 && <span className="badge-count">{pending.length}</span>}
          </h1>
        </div>

        {loading ? (
          <p style={{ padding: 20 }}>Đang tải...</p>
        ) : list.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>
            <Clock size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>Không có đơn đăng ký nào</p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <>
                <p className="reg-group-title">Chờ xét duyệt ({pending.length})</p>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Nhà thuốc / SĐT</th><th>Địa chỉ</th><th>Ngày gửi</th><th>Thao tác</th></tr>
                    </thead>
                    <tbody>
                      {pending.map(r => <RegistrationRow key={r.id} r={r} />)}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {rejected.length > 0 && (
              <>
                <p className="reg-group-title" style={{ marginTop: 24 }}>Đã từ chối ({rejected.length})</p>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Nhà thuốc / SĐT</th><th>Địa chỉ</th><th>Ngày gửi</th><th>Thao tác</th></tr>
                    </thead>
                    <tbody>
                      {rejected.map(r => <RegistrationRow key={r.id} r={r} />)}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
      {rejectTarget && (
        <ConfirmModal
          title="Từ chối đăng ký"
          message="Bạn chắc chắn muốn từ chối đơn đăng ký này? Khách hàng sẽ không được cấp tài khoản."
          confirmLabel="Từ chối"
          onConfirm={confirmReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </AdminLayout>
  );
}
