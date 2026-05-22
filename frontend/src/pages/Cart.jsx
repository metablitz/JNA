import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Minus, Plus, MapPin, CheckCircle, CreditCard, ShoppingCart, BookmarkPlus, BookmarkCheck, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../lib/api';
import { applyTierDiscount } from '../lib/tiers';
import Layout from '../components/Layout';

function formatPrice(price) {
  return price?.toLocaleString('vi-VN') + 'đ';
}

export default function Cart() {
  const { items, updateQuantity, removeItem, clearCart, totalItems, totalAmount, getTierPrice, addItem } = useCart();
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cong_no');
  const [customAddress, setCustomAddress] = useState('');
  const [editingAddress, setEditingAddress] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const fetchTemplates = () => {
    api.get('/orders/templates').then(res => setTemplates(res.data || [])).catch(() => {});
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const templateItems = items.map(i => ({
        product_id: i.product_id,
        name: i.product.name,
        unit: i.product.unit,
        price: i.product.price,
        quantity: i.quantity,
        image_url: i.product.image_url || null,
      }));
      await api.post('/orders/templates', { name: templateName.trim(), items: templateItems });
      setTemplateName('');
      showToast('Đã lưu mẫu đơn hàng', 'success');
      fetchTemplates();
    } catch (err) { showToast(err.response?.data?.error || 'Lỗi lưu mẫu', 'error'); }
    finally { setSavingTemplate(false); }
  };

  const handleLoadTemplate = (tpl) => {
    tpl.items.forEach(item => {
      const product = { id: item.product_id, name: item.name, unit: item.unit, price: item.price, image_url: item.image_url, product_tiers: [] };
      addItem(product, item.quantity);
    });
    setShowTemplates(false);
    showToast(`Đã tải mẫu "${tpl.name}" vào giỏ`, 'success');
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await api.delete(`/orders/templates/${id}`);
      setTemplates(t => t.filter(x => x.id !== id));
    } catch { /* ignore */ }
  };

  const cartIdsKey = items.map(i => i.product_id).join(',');
  useEffect(() => {
    if (items.length === 0) { setSuggestions([]); return; }
    api.get('/products/frequently-bought', { params: { ids: cartIdsKey } })
      .then(res => setSuggestions(res.data || []))
      .catch(() => setSuggestions([]));
  }, [cartIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const d = err.response?.data;
      if (d?.credit_limit) {
        setError(`${d.error}. Công nợ hiện tại: ${d.current_debt?.toLocaleString('vi-VN')}đ / Hạn mức: ${d.credit_limit?.toLocaleString('vi-VN')}đ`);
      } else {
        setError(d?.error || 'Đặt hàng thất bại');
      }
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="icon-btn" title="Mẫu đơn hàng" onClick={() => setShowTemplates(v => !v)}>
                {showTemplates ? <BookmarkCheck size={20} style={{ color: '#16a34a' }} /> : <BookmarkPlus size={20} />}
              </button>
              <button className="clear-btn" onClick={clearCart}>Xóa tất cả</button>
            </div>
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

            {showTemplates && (
              <div className="template-panel">
                <div className="template-save-row">
                  <input
                    className="template-name-input"
                    placeholder="Đặt tên mẫu đơn..."
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                  />
                  <button className="btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}
                    onClick={handleSaveTemplate} disabled={savingTemplate || !templateName.trim()}>
                    {savingTemplate ? '...' : 'Lưu mẫu'}
                  </button>
                </div>
                {templates.length > 0 && (
                  <>
                    <p className="template-load-label">Tải mẫu đơn đã lưu:</p>
                    <div className="template-list">
                      {templates.map(tpl => (
                        <div key={tpl.id} className="template-item">
                          <button className="template-load-btn" onClick={() => handleLoadTemplate(tpl)}>
                            <BookmarkCheck size={14} />
                            <span>{tpl.name}</span>
                            <span className="template-count">{tpl.items?.length} SP</span>
                          </button>
                          <button className="template-delete-btn" onClick={() => handleDeleteTemplate(tpl.id)}>
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

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
                  { value: 'bank',          label: '🏦 Chuyển khoản', desc: 'Trước khi giao' },
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

            {suggestions.length > 0 && (
              <div className="fbt-section">
                <h3 className="fbt-title">🔁 Thường mua kèm</h3>
                <div className="fbt-list">
                  {suggestions.map(p => {
                    const userPrice = applyTierDiscount(p.price, user?.tier);
                    return (
                      <div key={p.id} className="fbt-item">
                        <div className="fbt-item-info">
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} className="fbt-item-img" />
                            : <div className="fbt-item-img fbt-item-img-placeholder">💊</div>
                          }
                          <div>
                            <p className="fbt-item-name">{p.name}</p>
                            <p className="fbt-item-price">{userPrice?.toLocaleString('vi-VN')}đ/{p.unit}</p>
                          </div>
                        </div>
                        <button className="fbt-add-btn" onClick={() => addItem(p, 1)} title="Thêm vào giỏ">
                          <ShoppingCart size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
