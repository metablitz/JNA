import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Minus, Plus, MapPin, CheckCircle, CreditCard } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../lib/api';
import Layout from '../components/Layout';

function formatPrice(price) {
  return price?.toLocaleString('vi-VN') + 'đ';
}

export default function Cart() {
  const { items, updateQuantity, removeItem, clearCart, totalItems, totalAmount, getTierPrice } = useCart();
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cong_no');
  const [customAddress, setCustomAddress] = useState('');
  const [editingAddress, setEditingAddress] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleOrder = async () => {
    if (items.length === 0) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/orders', {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        shipping_address: customAddress || user.address || 'Địa chỉ mặc định',
        note,
        payment_method: paymentMethod,
      });
      clearCart();
      showToast('Đặt hàng thành công!', 'success');
      navigate('/orders');
    } catch (err) {
      setError(err.response?.data?.error || 'Đặt hàng thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="cart-page">
        <header className="page-header">
          <button onClick={() => navigate(-1)} className="back-btn"><ArrowLeft size={22} /></button>
          <h1>Giỏ hàng</h1>
          {items.length > 0 && (
            <button className="clear-btn" onClick={clearCart}>Xóa tất cả</button>
          )}
        </header>

        {items.length === 0 ? (
          <div className="empty-cart">
            <p>Giỏ hàng trống</p>
            <button className="btn-primary" onClick={() => navigate('/')}>+ Thêm sản phẩm</button>
          </div>
        ) : (
          <>
            <div className="cart-summary-bar">
              <span>🛒 {totalItems} loại sản phẩm</span>
              <button className="btn-add" onClick={() => navigate('/')}>+ Thêm sản phẩm</button>
            </div>

            <div className="cart-table">
              <div className="cart-table-header">
                <span className="col-stt">STT</span>
                <span className="col-name">Tên sản phẩm / Đơn giá</span>
                <span className="col-qty">SL</span>
                <span className="col-total">Thành tiền</span>
              </div>
              {items.map((item, idx) => (
                <div key={item.product_id} className="cart-row">
                  <span className="col-stt">{idx + 1}</span>
                  <div className="col-name">
                    <p className="cart-item-name">{item.product.name}</p>
                    {(() => {
                      const unitPrice = getTierPrice(item.product, item.quantity);
                      const isTier = unitPrice !== item.product.price;
                      return (
                        <p className="cart-item-price">
                          {formatPrice(unitPrice)}/{item.product.unit}
                          {isTier && <span className="tier-applied-badge">Bậc giá</span>}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="col-qty">
                    <button className="qty-sm" onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      className="qty-input"
                      value={item.quantity}
                      min={1}
                      onChange={(e) => updateQuantity(item.product_id, Number(e.target.value))}
                    />
                    <button className="qty-sm" onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="col-total">
                    <span>{formatPrice(getTierPrice(item.product, item.quantity) * item.quantity)}</span>
                    <button className="delete-btn" onClick={() => removeItem(item.product_id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-footer-info">
              <span>Tổng {totalItems} loại · {items.reduce((s, i) => s + i.quantity, 0)} sản phẩm</span>
              <span className="total-amount">Tổng cộng <strong>{formatPrice(totalAmount)}</strong></span>
            </div>

            <div className="shipping-section">
              <div className="section-header">
                <MapPin size={18} className="section-icon" />
                <strong>Địa chỉ giao hàng</strong>
                <button className="change-btn" onClick={() => setEditingAddress(v => !v)}>
                  {editingAddress ? 'Thu gọn' : 'Thay đổi'}
                </button>
              </div>
              {editingAddress ? (
                <div style={{ padding: '10px 0' }}>
                  <textarea
                    className="note-input"
                    placeholder={user?.address || 'Nhập địa chỉ giao hàng...'}
                    value={customAddress}
                    onChange={e => setCustomAddress(e.target.value)}
                    rows={2}
                    autoFocus
                  />
                  <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Để trống để dùng địa chỉ mặc định</p>
                </div>
              ) : (
                <div className="address-card">
                  <span className="default-badge">{customAddress ? 'Tuỳ chỉnh' : 'Mặc định'}</span>
                  <p>{user?.pharmacy_name}</p>
                  <p>{user?.phone}</p>
                  <p>{customAddress || user?.address}</p>
                </div>
              )}
            </div>

            <div className="note-section">
              <button className="note-toggle" onClick={() => document.getElementById('note-input').focus()}>
                📝 Ghi chú đơn hàng (tùy chọn)
              </button>
              <textarea
                id="note-input"
                className="note-input"
                placeholder="Nhập ghi chú..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>

            <div className="payment-section">
              <div className="section-header">
                <CreditCard size={18} className="section-icon" />
                <strong>Hình thức thanh toán</strong>
              </div>
              <div className="payment-options">
                {[
                  { value: 'cong_no', label: '💳 Công nợ', desc: 'Thanh toán sau' },
                  { value: 'cash',    label: '💵 Tiền mặt', desc: 'Khi nhận hàng' },
                  { value: 'bank_transfer', label: '🏦 Chuyển khoản', desc: 'Trước khi giao' },
                ].map(opt => (
                  <label key={opt.value} className={`payment-option ${paymentMethod === opt.value ? 'selected' : ''}`}>
                    <input type="radio" name="payment" value={opt.value} checked={paymentMethod === opt.value} onChange={() => setPaymentMethod(opt.value)} />
                    <div>
                      <span className="payment-option-label">{opt.label}</span>
                      <span className="payment-option-desc">{opt.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button className="btn-order" onClick={handleOrder} disabled={loading}>
              <CheckCircle size={20} />
              {loading ? 'Đang đặt hàng...' : 'Xác nhận đặt hàng'}
            </button>
          </>
        )}
      </div>
    </Layout>
  );
}
