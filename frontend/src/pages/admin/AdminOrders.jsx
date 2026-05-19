import { useState, useEffect, useCallback } from 'react';
import { Download, Search, Printer, Plus, X, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import AdminLayout from './AdminLayout';
import PrintInvoice from '../../components/PrintInvoice';

function formatPrice(price) { return price?.toLocaleString('vi-VN') + 'đ'; }

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ XN' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'shipping', label: 'Đang giao' },
  { value: 'delivered', label: 'Đã giao' },
  { value: 'cancelled', label: 'Đã hủy' },
];

const STATUS_COLORS = {
  pending: '#f59e0b', confirmed: '#3b82f6', shipping: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [printOrder, setPrintOrder] = useState(null);
  const [createModal, setCreateModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [newOrder, setNewOrder] = useState({ user_id: '', items: [], note: '', payment_method: 'cong_no' });
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productSearching, setProductSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const limit = 20;
  const { showToast } = useToast();

  const buildParams = () => {
    const params = { page, limit };
    if (statusFilter !== 'all') params.status = statusFilter;
    if (paymentFilter !== 'all') params.payment_status = paymentFilter;
    if (from) params.from = from;
    if (to) params.to = to;
    if (search.trim()) params.search = search.trim();
    return params;
  };

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/orders', { params: buildParams() });
      setOrders(res.data.orders);
      setTotal(res.data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [statusFilter, paymentFilter, from, to, page, search]);

  const updateStatus = async (id, status) => {
    await api.put(`/admin/orders/${id}/status`, { status });
    fetch();
  };

  const togglePayment = async (e, id, currentStatus) => {
    e.stopPropagation();
    const next = currentStatus === 'paid' ? 'unpaid' : 'paid';
    await api.put(`/admin/orders/${id}/payment`, { payment_status: next });
    fetch();
  };

  const handlePrint = (e, order) => {
    e.stopPropagation();
    setPrintOrder(order);
    setTimeout(() => { window.print(); setPrintOrder(null); }, 100);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (paymentFilter !== 'all') params.set('payment_status', paymentFilter);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const token = localStorage.getItem('token');
      const url = `${import.meta.env.VITE_API_URL}/admin/orders/export?${params}`;
      const res = await window.fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `don_hang_${Date.now()}.xlsx`;
      a.click();
    } catch (e) { showToast('Xuất thất bại', 'error'); }
    finally { setExporting(false); }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const resetFilters = () => { setFrom(''); setTo(''); setStatusFilter('all'); setPaymentFilter('all'); setSearch(''); setPage(1); };

  const openCreateModal = async () => {
    if (customers.length === 0) {
      const res = await api.get('/admin/users');
      setCustomers(res.data.filter(u => u.role === 'customer' && u.is_active));
    }
    setNewOrder({ user_id: '', items: [], note: '', payment_method: 'cong_no' });
    setProductSearch(''); setProductResults([]);
    setCreateModal(true);
  };

  const searchProducts = useCallback(async (q) => {
    if (!q.trim()) { setProductResults([]); return; }
    setProductSearching(true);
    try {
      const res = await api.get('/admin/products', { params: { search: q, limit: 10 } });
      setProductResults(res.data.products.filter(p => p.is_active));
    } catch { /* ignore */ } finally { setProductSearching(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchProducts(productSearch), 300);
    return () => clearTimeout(t);
  }, [productSearch, searchProducts]);

  const addItemToOrder = (product) => {
    setNewOrder(o => {
      const existing = o.items.find(i => i.product_id === product.id);
      if (existing) return { ...o, items: o.items.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i) };
      return { ...o, items: [...o.items, { product_id: product.id, name: product.name, unit: product.unit, price: product.price, quantity: 1 }] };
    });
    setProductSearch(''); setProductResults([]);
  };

  const updateItemQty = (product_id, qty) => {
    if (qty < 1) return;
    setNewOrder(o => ({ ...o, items: o.items.map(i => i.product_id === product_id ? { ...i, quantity: qty } : i) }));
  };

  const removeItem = (product_id) => {
    setNewOrder(o => ({ ...o, items: o.items.filter(i => i.product_id !== product_id) }));
  };

  const handleCreate = async () => {
    if (!newOrder.user_id || newOrder.items.length === 0) { showToast('Chọn khách hàng và ít nhất 1 sản phẩm', 'error'); return; }
    setCreating(true);
    try {
      await api.post('/admin/orders', {
        user_id: newOrder.user_id,
        items: newOrder.items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        note: newOrder.note,
        payment_method: newOrder.payment_method,
      });
      setCreateModal(false);
      fetch();
      showToast('Tạo đơn hàng thành công', 'success');
    } catch (e) { showToast(e.response?.data?.error || 'Lỗi tạo đơn', 'error'); }
    finally { setCreating(false); }
  };

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Đơn hàng <span className="total-count">({total})</span></h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary btn-icon" onClick={handleExport} disabled={exporting}>
              <Download size={16} /> {exporting ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
            <button className="btn-primary" onClick={openCreateModal}>
              <Plus size={16} /> Tạo đơn
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="order-filters">
          <div className="admin-search" style={{ margin: 0, flex: 1, maxWidth: 260 }}>
            <Search size={15} />
            <input placeholder="Tên nhà thuốc, mã đơn..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="filter-select" value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}>
            <option value="all">TT: Tất cả</option>
            <option value="unpaid">⏳ Chưa thu</option>
            <option value="paid">✓ Đã thu</option>
          </select>
          <input type="date" className="filter-date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} title="Từ ngày" />
          <span style={{ color: '#9ca3af', fontSize: 13 }}>→</span>
          <input type="date" className="filter-date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} title="Đến ngày" />
          {(from || to || statusFilter !== 'all' || paymentFilter !== 'all' || search) && (
            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={resetFilters}>✕ Xóa lọc</button>
          )}
        </div>

        {/* Aggregate stats bar */}
        {!loading && orders.length > 0 && (() => {
          const pageTotal = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
          const pageUnpaid = orders.filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount || 0), 0);
          return (
            <div className="orders-stats-bar">
              <span>Trang này: <strong>{orders.length}</strong> đơn</span>
              <span className="orders-stats-sep">·</span>
              <span>Tổng: <strong style={{ color: '#16a34a' }}>{formatPrice(pageTotal)}</strong></span>
              {pageUnpaid > 0 && (
                <>
                  <span className="orders-stats-sep">·</span>
                  <span>Chưa thu: <strong style={{ color: '#ef4444' }}>{formatPrice(pageUnpaid)}</strong></span>
                </>
              )}
              {total > orders.length && (
                <>
                  <span className="orders-stats-sep">·</span>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>({total} đơn tổng cộng)</span>
                </>
              )}
            </div>
          );
        })()}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày đặt</th><th>Tổng tiền</th><th>Đơn hàng</th><th>Thanh toán</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 4, width: j === 1 ? '80%' : j === 3 ? '60%' : '70%' }} /></td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="text-center">Không có đơn hàng</td></tr>
              ) : orders.map((order) => (
                <>
                  <tr key={order.id} className="clickable" onClick={() => setExpanded(expanded === order.id ? null : order.id)}>
                    <td><strong>{order.order_code}</strong></td>
                    <td>
                      <p>{order.users?.pharmacy_name}</p>
                      <p className="text-sm text-gray">{order.users?.phone}</p>
                    </td>
                    <td>{formatDate(order.created_at)}</td>
                    <td className="price-col">{formatPrice(order.total_amount)}</td>
                    <td>
                      <span className="status-pill" style={{ background: (STATUS_COLORS[order.status] || '#6b7280') + '20', color: STATUS_COLORS[order.status] || '#6b7280' }}>
                        {STATUS_OPTIONS.find((s) => s.value === order.status)?.label || order.status}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className={`payment-toggle-btn ${order.payment_status === 'paid' ? 'is-paid' : 'is-unpaid'}`}
                        onClick={(e) => togglePayment(e, order.id, order.payment_status)}
                      >
                        {order.payment_status === 'paid' ? '✓ Đã thu' : '⏳ Chưa thu'}
                      </button>
                    </td>
                    <td>
                      <select
                        className="status-select"
                        value={order.status}
                        onChange={(e) => { e.stopPropagation(); updateStatus(order.id, e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {STATUS_OPTIONS.filter((s) => s.value !== 'all').map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  {expanded === order.id && (
                    <tr key={`${order.id}-detail`} className="expanded-row">
                      <td colSpan={7}>
                        <div className="order-items-detail">
                          {order.order_items?.map((item) => (
                            <div key={item.id} className="order-item-row">
                              <span style={{ flex: 1 }}>{item.products?.name} ({item.products?.unit})</span>
                              <span style={{ width: 50, textAlign: 'center' }}>×{item.quantity}</span>
                              <span style={{ width: 100, textAlign: 'right' }}>{formatPrice(item.unit_price)}</span>
                              <span style={{ width: 110, textAlign: 'right', fontWeight: 600 }}>{formatPrice(item.total_price)}</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #e5e7eb', fontWeight: 700 }}>
                            Tổng: {formatPrice(order.total_amount)}
                          </div>
                          {order.shipping_address && <p className="text-sm" style={{ marginTop: 6 }}>📍 {order.shipping_address}</p>}
                          {order.note && <p className="text-sm">📝 {order.note}</p>}
                          {order.paid_at && <p className="text-sm">💰 Đã thu: {new Date(order.paid_at).toLocaleDateString('vi-VN')}</p>}
                          <button className="btn-secondary btn-icon" style={{ marginTop: 8 }} onClick={(e) => handlePrint(e, order)}>
                            <Printer size={14} /> In hóa đơn
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {total > limit && (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>‹ Trước</button>
            <span>{page} / {Math.ceil(total / limit)}</span>
            <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)}>Tiếp ›</button>
          </div>
        )}
      </div>
      {printOrder && <PrintInvoice order={printOrder} />}

      {createModal && (
        <div className="modal-overlay" onClick={() => setCreateModal(false)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Tạo đơn hàng mới</h2>
              <button onClick={() => setCreateModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Customer select */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Khách hàng *</label>
                <select value={newOrder.user_id} onChange={e => setNewOrder(o => ({ ...o, user_id: e.target.value }))}>
                  <option value="">-- Chọn khách hàng --</option>
                  {customers.map(u => (
                    <option key={u.id} value={u.id}>{u.pharmacy_name} ({u.phone})</option>
                  ))}
                </select>
              </div>

              {/* Product search */}
              <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
                <label>Thêm sản phẩm</label>
                <div className="admin-search" style={{ margin: 0 }}>
                  <Search size={15} />
                  <input
                    placeholder="Tìm tên, hoạt chất, barcode..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                  {productSearching && <span style={{ fontSize: 11, color: '#9ca3af' }}>...</span>}
                </div>
                {productResults.length > 0 && (
                  <div style={{ position: 'absolute', zIndex: 100, left: 0, right: 0, top: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.1)', maxHeight: 200, overflowY: 'auto' }}>
                    {productResults.map(p => (
                      <button key={p.id} onClick={() => addItemToOrder(p)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', textAlign: 'left', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                        <div>
                          <p style={{ fontWeight: 600 }}>{p.name}</p>
                          <p style={{ color: '#9ca3af', fontSize: 11 }}>{formatPrice(p.price)} / {p.unit} · Kho: {p.stock}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items list */}
              {newOrder.items.length > 0 && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                  {newOrder.items.map(item => (
                    <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600 }}>{item.name}</p>
                        <p style={{ color: '#9ca3af', fontSize: 11 }}>{formatPrice(item.price)} / {item.unit}</p>
                      </div>
                      <input type="number" min={1} value={item.quantity}
                        onChange={e => updateItemQty(item.product_id, Number(e.target.value))}
                        style={{ width: 60, border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', textAlign: 'center' }} />
                      <span style={{ color: '#6b7280', fontSize: 12, minWidth: 80, textAlign: 'right' }}>{formatPrice(item.price * item.quantity)}</span>
                      <button onClick={() => removeItem(item.product_id)} style={{ color: '#ef4444' }}><Trash2 size={15} /></button>
                    </div>
                  ))}
                  <div style={{ padding: '8px 12px', background: '#f9fafb', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                    Tổng: {formatPrice(newOrder.items.reduce((s, i) => s + i.price * i.quantity, 0))}
                  </div>
                </div>
              )}

              {/* Payment method */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Thanh toán</label>
                <select value={newOrder.payment_method} onChange={e => setNewOrder(o => ({ ...o, payment_method: e.target.value }))}>
                  <option value="cong_no">💳 Công nợ</option>
                  <option value="cash">💵 Tiền mặt</option>
                  <option value="bank">🏦 Chuyển khoản</option>
                </select>
              </div>

              {/* Note */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Ghi chú</label>
                <input type="text" placeholder="Ghi chú cho đơn hàng..." value={newOrder.note}
                  onChange={e => setNewOrder(o => ({ ...o, note: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setCreateModal(false)}>Hủy</button>
              <button className="btn-primary" onClick={handleCreate}
                disabled={creating || !newOrder.user_id || newOrder.items.length === 0}>
                {creating ? 'Đang tạo...' : 'Tạo đơn hàng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
