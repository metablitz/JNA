import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, RotateCcw, X, Download } from 'lucide-react';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import Layout from '../components/Layout';
import PrintInvoice from '../components/PrintInvoice';
import ConfirmModal from '../components/ConfirmModal';

function formatPrice(price) {
  return price?.toLocaleString('vi-VN') + 'đ';
}

const STATUS_LABELS = {
  pending: { label: 'Chờ xác nhận', color: '#f59e0b' },
  confirmed: { label: 'Đang kiểm tra', color: '#3b82f6' },
  shipping: { label: 'Đang giao', color: '#8b5cf6' },
  delivered: { label: 'Đã giao', color: '#10b981' },
  cancelled: { label: 'Đã hủy', color: '#ef4444' },
};

const TIMELINE_STEPS = [
  { key: 'pending',   label: 'Đặt hàng',  icon: '🛒' },
  { key: 'confirmed', label: 'Xác nhận',   icon: '✅' },
  { key: 'shipping',  label: 'Đang giao',  icon: '🚚' },
  { key: 'delivered', label: 'Đã giao',    icon: '📦' },
];

function OrderTimeline({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="order-timeline cancelled-timeline">
        <span className="cancelled-badge">❌ Đơn hàng đã bị hủy</span>
      </div>
    );
  }
  const currentIdx = TIMELINE_STEPS.findIndex(s => s.key === status);
  return (
    <div className="order-timeline">
      {TIMELINE_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.key} className="timeline-step">
            <div className={`timeline-node ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
              {done ? step.icon : <span className="timeline-node-num">{idx + 1}</span>}
            </div>
            <p className={`timeline-label ${active ? 'tl-active' : done ? 'tl-done' : 'tl-future'}`}>{step.label}</p>
            {idx < TIMELINE_STEPS.length - 1 && (
              <div className={`timeline-line ${idx < currentIdx ? 'done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const navigate = useNavigate();
  const { setItemQty } = useCart();
  const { showToast } = useToast();

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then((res) => setOrder(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await window.fetch(`${apiBase}/orders/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hoa-don-${order.order_code}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { showToast('Không thể tải PDF', 'error'); }
  };

  const handleReorder = () => {
    order.order_items?.forEach(item => {
      if (item.products) setItemQty(item.products, item.quantity);
    });
    navigate('/cart');
  };

  const handleCancel = async () => {
    setShowCancelConfirm(false);
    setCancelling(true);
    try {
      await api.put(`/orders/${id}/cancel`);
      setOrder(o => ({ ...o, status: 'cancelled' }));
      showToast('Đã hủy đơn hàng', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Lỗi hủy đơn', 'error');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <Layout><div className="loading-text">Đang tải...</div></Layout>;
  if (!order) return <Layout><div className="empty-text">Không tìm thấy đơn hàng</div></Layout>;

  const status = STATUS_LABELS[order.status] || { label: order.status, color: '#6b7280' };

  return (
    <Layout>
      <div className="order-detail-page">
        <header className="page-header no-print">
          <button onClick={() => navigate(-1)} className="back-btn"><ArrowLeft size={22} /></button>
          <h1>Chi tiết đơn hàng</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {order.status === 'pending' && (
              <button
                className="btn-cancel-order no-print"
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelling}
                title="Hủy đơn hàng"
              >
                <X size={14} /> {cancelling ? '...' : 'Hủy đơn'}
              </button>
            )}
            <button className="btn-reorder no-print" onClick={handleReorder} title="Đặt lại đơn này">
              <RotateCcw size={15} /> Đặt lại
            </button>
            <button className="icon-action-btn" onClick={handleDownloadPdf} title="Tải PDF">
              <Download size={20} />
            </button>
            <button className="icon-action-btn" onClick={handlePrint} title="In đơn hàng">
              <Printer size={20} />
            </button>
          </div>
        </header>

        <OrderTimeline status={order.status} />

        <div className="detail-section no-print">
          <div className="detail-row"><strong>Mã đơn:</strong> {order.order_code}</div>
          <div className="detail-row">
            <strong>Trạng thái:</strong>
            <span style={{ color: status.color, fontWeight: 600 }}> {status.label}</span>
          </div>
          <div className="detail-row"><strong>Địa chỉ giao:</strong> {order.shipping_address}</div>
          <div className="detail-row">
            <strong>Thanh toán:</strong>
            <span style={{ marginLeft: 6 }}>
              {order.payment_method === 'cong_no' ? '💳 Công nợ' : order.payment_method === 'cash' ? '💵 Tiền mặt' : '🏦 Chuyển khoản'}
            </span>
          </div>
          <div className="detail-row">
            <strong>Trạng thái TT:</strong>
            <span className={`payment-status-badge ${order.payment_status === 'paid' ? 'paid' : 'unpaid'}`}>
              {order.payment_status === 'paid' ? '✓ Đã thanh toán' : '⏳ Chưa thanh toán'}
            </span>
            {order.paid_at && (
              <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 6 }}>
                ({new Date(order.paid_at).toLocaleDateString('vi-VN')})
              </span>
            )}
          </div>
          {order.note && <div className="detail-row"><strong>Ghi chú:</strong> {order.note}</div>}
        </div>

        <div className="detail-items no-print">
          <h3>Sản phẩm</h3>
          {order.order_items?.map((item) => (
            <div key={item.id} className="detail-item-row">
              <div>
                <p className="item-name">{item.products?.name}</p>
                <p className="item-meta">{formatPrice(item.unit_price)} / {item.products?.unit} × {item.quantity}</p>
              </div>
              <strong>{formatPrice(item.total_price)}</strong>
            </div>
          ))}
        </div>

        <div className="detail-total no-print">
          <span>Tổng cộng</span>
          <strong>{formatPrice(order.total_amount)}</strong>
        </div>

        <PrintInvoice order={order} />
      </div>
      {showCancelConfirm && (
        <ConfirmModal
          title="Hủy đơn hàng"
          message={`Bạn chắc chắn muốn hủy đơn ${order.order_code}? Hành động này không thể hoàn tác.`}
          confirmLabel="Hủy đơn"
          onConfirm={handleCancel}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}
    </Layout>
  );
}
