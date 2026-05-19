import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Pencil, Trash2, X, Upload, Download, CheckCircle, AlertCircle, PackagePlus, History, ImagePlus } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import AdminLayout from './AdminLayout';

function formatPrice(price) {
  return price?.toLocaleString('vi-VN') + 'đ';
}

const empty = { name: '', active_ingredient: '', unit: '', price: '', original_price: '', expiry_date: '', category: '', stock: '', image_url: '', barcode: '' };

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [tiers, setTiers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const importRef = useRef();
  const limit = 20;
  const [stockModal, setStockModal] = useState(null); // product object
  const [stockQty, setStockQty] = useState('');
  const [stockNote, setStockNote] = useState('');
  const [stockReason, setStockReason] = useState('import');
  const [stockSaving, setStockSaving] = useState(false);
  const [lowStock, setLowStock] = useState([]);
  const [logModal, setLogModal] = useState(null); // product
  const [deleteId, setDeleteId] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageRef = useRef();
  const { showToast } = useToast();
  const [stockLogs, setStockLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [showHidden, setShowHidden] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = { search, page, limit };
      if (categoryFilter) params.category = categoryFilter;
      if (showHidden) params.show_hidden = '1';
      const res = await api.get('/admin/products', { params });
      setProducts(res.data.products);
      setTotal(res.data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, page, categoryFilter, showHidden]);

  useEffect(() => {
    api.get('/admin/products/low-stock').then(r => setLowStock(r.data || [])).catch(() => {});
    api.get('/products/categories').then(r => setCategories(r.data || [])).catch(() => {});
  }, []);

  const openStock = (p) => { setStockModal(p); setStockQty(''); setStockNote(''); setStockReason('import'); };

  const openLog = async (p) => {
    setLogModal(p); setStockLogs([]); setLogsLoading(true);
    try {
      const res = await api.get(`/admin/products/${p.id}/stock-log`);
      setStockLogs(res.data);
    } catch (e) { console.error(e); }
    finally { setLogsLoading(false); }
  };

  const handleStockSave = async () => {
    const qty = Number(stockQty);
    if (!qty || isNaN(qty)) return;
    setStockSaving(true);
    try {
      await api.post(`/admin/products/${stockModal.id}/stock`, { change_qty: qty, reason: stockReason, note: stockNote });
      setStockModal(null);
      load();
      api.get('/admin/products/low-stock').then(r => setLowStock(r.data || [])).catch(() => {});
      showToast('Cập nhật tồn kho thành công', 'success');
    } catch (e) { showToast(e.response?.data?.error || 'Lỗi', 'error'); }
    finally { setStockSaving(false); }
  };

  const openAdd = () => { setForm(empty); setTiers([]); setModal('add'); setError(''); };
  const openEdit = (p) => {
    setForm({ ...p, price: p.price, original_price: p.original_price ?? '', stock: p.stock ?? '', active_ingredient: p.active_ingredient ?? '' });
    setTiers([]);
    setModal('edit');
    setError('');
    // Load existing tiers
    api.get(`/admin/products/${p.id}/tiers`).then(r => setTiers(r.data || [])).catch(() => {});
  };

  const addTierRow = () => setTiers(t => [...t, { min_qty: '', price: '' }]);
  const removeTierRow = (idx) => setTiers(t => t.filter((_, i) => i !== idx));
  const updateTier = (idx, field, val) => setTiers(t => t.map((row, i) => i === idx ? { ...row, [field]: val } : row));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        original_price: form.original_price ? Number(form.original_price) : null,
        stock: Number(form.stock || 0),
      };
      let productId = form.id;
      if (modal === 'add') {
        const res = await api.post('/admin/products', payload);
        productId = res.data.id;
      } else {
        await api.put(`/admin/products/${form.id}`, payload);
      }
      // Save tiers
      const validTiers = tiers.filter(t => t.min_qty && t.price);
      await api.put(`/admin/products/${productId}/tiers`, { tiers: validTiers });
      setModal(null); load();
    } catch (e) { setError(e.response?.data?.error || 'Lỗi lưu sản phẩm'); }
    finally { setSaving(false); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload/product', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(f => ({ ...f, image_url: res.data.url }));
    } catch (err) {
      showToast(err.response?.data?.error || 'Upload ảnh thất bại', 'error');
    } finally {
      setImageUploading(false);
    }
  };

  const handleDelete = async () => {
    await api.delete(`/admin/products/${deleteId}`);
    setDeleteId(null);
    load();
    showToast('Đã ẩn sản phẩm', 'success');
  };

  const downloadTemplate = () => {
    window.open(`${import.meta.env.VITE_API_URL}/admin/products/template`, '_blank');
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/admin/products/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult({ success: true, ...res.data });
      load();
    } catch (err) {
      setImportResult({ success: false, error: err.response?.data?.error || 'Import thất bại' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Sản phẩm <span className="total-count">({total})</span></h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary btn-icon" onClick={downloadTemplate} title="Tải file mẫu Excel">
              <Download size={16} /> Template
            </button>
            <button
              className="btn-secondary btn-icon"
              onClick={() => importRef.current.click()}
              disabled={importing}
              title="Import từ Excel"
            >
              <Upload size={16} /> {importing ? 'Đang nhập...' : 'Import Excel'}
            </button>
            <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
            <button className="btn-primary" onClick={openAdd}><Plus size={16} /> Thêm</button>
          </div>
        </div>

        {importResult && (
          <div className={`import-result ${importResult.success ? 'import-ok' : 'import-err'}`}>
            {importResult.success ? (
              <>
                <CheckCircle size={18} />
                <span>Đã nhập <strong>{importResult.imported}</strong> sản phẩm{importResult.skipped > 0 && `, bỏ qua ${importResult.skipped} dòng lỗi`}.</span>
              </>
            ) : (
              <>
                <AlertCircle size={18} />
                <span>{importResult.error}</span>
              </>
            )}
            <button onClick={() => setImportResult(null)} style={{ marginLeft: 'auto' }}><X size={16} /></button>
          </div>
        )}

        {lowStock.length > 0 && (
          <div className="low-stock-alert">
            <span>⚠️ <strong>{lowStock.length} sản phẩm</strong> sắp hết hàng (≤20):</span>
            <span className="low-stock-names">{lowStock.slice(0,5).map(p => `${p.name} (${p.stock})`).join(' · ')}{lowStock.length > 5 ? '...' : ''}</span>
          </div>
        )}

        <div className="order-filters" style={{ marginBottom: 0 }}>
          <div className="admin-search" style={{ margin: 0, flex: 1 }}>
            <Search size={16} />
            <input placeholder="Tìm tên, hoạt chất, barcode..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="filter-select" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">Tất cả danh mục</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', color: '#374151' }}>
            <input type="checkbox" checked={showHidden} onChange={e => { setShowHidden(e.target.checked); setPage(1); }} />
            Hiện sản phẩm ẩn
          </label>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th style={{ width: 44 }}></th><th>Tên sản phẩm</th><th>Đơn vị</th><th>Giá bán</th><th>Hạn dùng</th><th>Tồn kho</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center">Đang tải...</td></tr>
              ) : products.map((p) => (
                <tr key={p.id} style={!p.is_active ? { opacity: 0.5, background: '#fafafa' } : {}}>
                  <td style={{ padding: '6px 8px' }}>
                    {p.image_url
                      ? <img src={p.image_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb', display: 'block' }} />
                      : <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💊</div>
                    }
                  </td>
                  <td>
                    <p className="font-medium">{p.name}{!p.is_active && <span style={{ marginLeft: 6, fontSize: 11, color: '#ef4444', fontWeight: 600 }}>[ẨN]</span>}</p>
                    {p.active_ingredient && <p className="text-sm text-gray">{p.active_ingredient}</p>}
                    {p.category && <p className="text-sm text-gray">{p.category}</p>}
                  </td>
                  <td>{p.unit}</td>
                  <td className="price-col">{formatPrice(p.price)}</td>
                  <td>{p.expiry_date || '-'}</td>
                  <td>
                    <span className={`stock-pill ${p.stock === 0 ? 'stock-pill-out' : p.stock <= 20 ? 'stock-pill-low' : 'stock-pill-ok'}`}>
                      {p.stock.toLocaleString('vi-VN')}
                    </span>
                  </td>
                  <td>
                    {p.is_active ? (
                      <>
                        <button className="action-btn" style={{ background: '#f5f3ff', color: '#7c3aed' }} onClick={() => openLog(p)} title="Lịch sử kho"><History size={15} /></button>
                        <button className="action-btn" style={{ background: '#eff6ff', color: '#2563eb' }} onClick={() => openStock(p)} title="Nhập kho"><PackagePlus size={15} /></button>
                        <button className="action-btn edit" onClick={() => openEdit(p)} title="Sửa"><Pencil size={15} /></button>
                        <button className="action-btn del" onClick={() => setDeleteId(p.id)} title="Ẩn"><Trash2 size={15} /></button>
                      </>
                    ) : (
                      <button
                        className="action-btn"
                        style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 12, padding: '4px 10px', borderRadius: 6 }}
                        onClick={async () => { await api.put(`/admin/products/${p.id}`, { is_active: true }); load(); showToast('Đã bật lại sản phẩm', 'success'); }}
                        title="Bật lại sản phẩm"
                      >
                        Bật lại
                      </button>
                    )}
                  </td>
                </tr>
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

        {logModal && (
          <div className="modal-overlay" onClick={() => setLogModal(null)}>
            <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Lịch sử tồn kho</h2>
                <button onClick={() => setLogModal(null)}><X size={20} /></button>
              </div>
              <div className="modal-body" style={{ padding: 0 }}>
                <div style={{ padding: '12px 20px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 13 }}>
                  <strong>{logModal.name}</strong> — Tồn kho hiện tại: <strong>{logModal.stock?.toLocaleString('vi-VN')} {logModal.unit}</strong>
                </div>
                {logsLoading ? (
                  <p style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</p>
                ) : stockLogs.length === 0 ? (
                  <p style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Chưa có lịch sử</p>
                ) : (
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {stockLogs.map(log => {
                      const REASON = { import: '📦 Nhập kho', export: '📤 Xuất/Hao hụt', adjustment: '🔧 Điều chỉnh', order: '🛒 Đơn hàng' };
                      return (
                        <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                          <span style={{ width: 110, flexShrink: 0, color: '#6b7280' }}>
                            {new Date(log.created_at).toLocaleDateString('vi-VN')}
                          </span>
                          <span style={{ flex: 1 }}>{REASON[log.reason] || log.reason}</span>
                          {log.note && <span style={{ color: '#6b7280', fontSize: 12, flex: 1 }}>{log.note}</span>}
                          <span style={{ fontWeight: 700, color: log.change_qty > 0 ? '#16a34a' : '#ef4444', flexShrink: 0 }}>
                            {log.change_qty > 0 ? '+' : ''}{log.change_qty.toLocaleString('vi-VN')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setLogModal(null)}>Đóng</button>
                <button className="btn-primary" style={{ background: '#2563eb' }} onClick={() => { setLogModal(null); openStock(logModal); }}>
                  <PackagePlus size={15} /> Nhập kho
                </button>
              </div>
            </div>
          </div>
        )}

        {stockModal && (
          <div className="modal-overlay" onClick={() => setStockModal(null)}>
            <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Nhập / Điều chỉnh kho</h2>
                <button onClick={() => setStockModal(null)}><X size={20} /></button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: 14, color: '#374151' }}>
                  <strong>{stockModal.name}</strong> — Tồn kho hiện tại: <strong>{stockModal.stock?.toLocaleString('vi-VN')} {stockModal.unit}</strong>
                </p>
                <div className="form-group">
                  <label>Loại</label>
                  <select value={stockReason} onChange={e => setStockReason(e.target.value)}>
                    <option value="import">➕ Nhập kho</option>
                    <option value="adjustment">🔧 Điều chỉnh (nhập số âm để giảm)</option>
                    <option value="export">➖ Xuất / Hao hụt</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Số lượng {stockReason === 'export' ? '(nhập số dương, sẽ tự trừ)' : ''}</label>
                  <input
                    type="number"
                    placeholder={stockReason === 'adjustment' ? 'VD: 50 hoặc -10' : 'VD: 100'}
                    value={stockQty}
                    onChange={e => setStockQty(e.target.value)}
                    autoFocus
                  />
                  {stockQty && !isNaN(Number(stockQty)) && (
                    <p style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>
                      Tồn kho sau: <strong>
                        {(stockModal.stock + (stockReason === 'export' ? -Math.abs(Number(stockQty)) : Number(stockQty))).toLocaleString('vi-VN')}
                      </strong> {stockModal.unit}
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label>Ghi chú</label>
                  <input type="text" placeholder="VD: Nhập từ NCC ABC" value={stockNote} onChange={e => setStockNote(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setStockModal(null)}>Hủy</button>
                <button className="btn-primary" onClick={handleStockSave} disabled={stockSaving || !stockQty}>
                  {stockSaving ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </div>
            </div>
          </div>
        )}

        {modal && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{modal === 'add' ? 'Thêm sản phẩm' : 'Sửa sản phẩm'}</h2>
                <button onClick={() => setModal(null)}><X size={20} /></button>
              </div>
              <div className="modal-body">
                {[
                  ['name', 'Tên sản phẩm *', 'text'],
                  ['active_ingredient', 'Hoạt chất / Thành phần', 'text'],
                  ['unit', 'Đơn vị tính *', 'text'],
                  ['price', 'Giá bán *', 'number'],
                  ['original_price', 'Giá kỳ trước (để tính % biến động)', 'number'],
                  ['stock', 'Tồn kho', 'number'],
                  ['expiry_date', 'Hạn dùng (VD: 12/2028)', 'text'],
                  ['category', 'Danh mục', 'text'],
                  ['barcode', 'Mã barcode (EAN/QR)', 'text'],
                ].map(([key, label, type]) => (
                  <div key={key} className="form-group">
                    <label>{label}</label>
                    <input
                      type={type}
                      value={form[key] ?? ''}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </div>
                ))}

                <div className="form-group">
                  <label>Ảnh sản phẩm</label>
                  <div className="image-upload-widget">
                    {form.image_url && (
                      <div className="image-preview-wrap">
                        <img src={form.image_url} alt="preview" className="image-preview-thumb" />
                        <button type="button" className="image-remove-btn" onClick={() => setForm(f => ({ ...f, image_url: '' }))} title="Xóa ảnh"><X size={14} /></button>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: form.image_url ? 8 : 0 }}>
                      <input
                        type="text"
                        placeholder="Nhập URL ảnh hoặc upload"
                        value={form.image_url ?? ''}
                        onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn-secondary btn-icon"
                        onClick={() => imageRef.current.click()}
                        disabled={imageUploading}
                        title="Upload ảnh"
                        style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        <ImagePlus size={15} /> {imageUploading ? 'Đang tải...' : 'Upload'}
                      </button>
                      <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Bậc giá theo số lượng</span>
                    <button type="button" onClick={addTierRow} style={{ color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
                      + Thêm bậc
                    </button>
                  </label>
                  {tiers.length === 0 && (
                    <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Chưa có bậc giá nào</p>
                  )}
                  {tiers.map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                      <div style={{ flex: 1 }}>
                        <input
                          type="number"
                          placeholder="Từ số lượng"
                          value={t.min_qty}
                          onChange={(e) => updateTier(idx, 'min_qty', e.target.value)}
                          style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <input
                          type="number"
                          placeholder="Giá (đ)"
                          value={t.price}
                          onChange={(e) => updateTier(idx, 'price', e.target.value)}
                          style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}
                        />
                      </div>
                      <button type="button" onClick={() => removeTierRow(idx)} style={{ color: '#ef4444', flexShrink: 0 }}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {error && <div className="error-msg">{error}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setModal(null)}>Hủy</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Xác nhận ẩn sản phẩm</h2><button onClick={() => setDeleteId(null)}><X size={20} /></button></div>
            <div className="modal-body"><p style={{ color: '#6b7280' }}>Sản phẩm sẽ bị ẩn khỏi danh sách (không xóa dữ liệu). Bạn có thể bật lại sau.</p></div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDeleteId(null)}>Hủy</button>
              <button className="btn-danger" onClick={handleDelete}>Ẩn sản phẩm</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
