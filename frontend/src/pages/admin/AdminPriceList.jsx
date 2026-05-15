import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Plus, Pencil, Trash2, Upload } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import AdminLayout from './AdminLayout';

const CATEGORIES = [
  { key: 'TPCN',        label: 'TPCN' },
  { key: 'Dụng cụ',    label: 'Dụng cụ' },
  { key: 'Dùng ngoài', label: 'Dùng ngoài' },
  { key: 'Việt Nam',   label: 'Việt Nam' },
  { key: 'Ngoại',      label: 'Ngoại' },
];

function formatPrice(p) {
  if (!p || p === 0) return <span style={{ color: '#9ca3af' }}>—</span>;
  return <span style={{ color: '#f97316', fontWeight: 700 }}>{p.toLocaleString('vi-VN')}đ</span>;
}

const emptyForm = { name: '', nhom: '', unit: '', price: '', vi_price: '' };

export default function AdminPriceList() {
  const [activeTab, setActiveTab] = useState('TPCN');
  const [allItems, setAllItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'add' | 'edit'
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();
  const { showToast } = useToast();

  const loadTab = (tab, force = false) => {
    if (allItems[tab] && !force) return;
    setLoading(true);
    api.get('/pricelist', { params: { category: tab } })
      .then(res => setAllItems(prev => ({ ...prev, [tab]: res.data.items })))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTab(activeTab); }, [activeTab]);
  useEffect(() => { setSearch(''); }, [activeTab]);

  const items = allItems[activeTab] || [];
  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(p => p.name.toLowerCase().includes(q));
  }, [items, search]);

  const openAdd = () => { setForm({ ...emptyForm }); setModal('add'); };
  const openEdit = (p) => { setForm({ ...p, price: p.price || '', vi_price: p.vi_price || '' }); setModal('edit'); };

  const handleSave = async () => {
    if (!form.name.trim()) return showToast('Vui lòng nhập tên sản phẩm', 'error');
    setSaving(true);
    try {
      const payload = { ...form, category: activeTab, price: form.price ? Number(form.price) : null, vi_price: form.vi_price ? Number(form.vi_price) : null };
      if (modal === 'add') await api.post('/pricelist', payload);
      else await api.put(`/pricelist/${form.id}`, payload);
      setModal(null);
      loadTab(activeTab, true);
      showToast(modal === 'add' ? 'Đã thêm sản phẩm' : 'Đã cập nhật', 'success');
    } catch (e) { showToast(e.response?.data?.error || 'Lỗi lưu', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/pricelist/${deleteId}`);
      setDeleteId(null);
      loadTab(activeTab, true);
      showToast('Đã xóa sản phẩm', 'success');
    } catch (e) { showToast(e.response?.data?.error || 'Lỗi xóa', 'error'); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fileRef.current.value = '';
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', activeTab);
      const res = await api.post('/pricelist/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadTab(activeTab, true);
      showToast(`Import thành công ${res.data.count} sản phẩm`, 'success');
    } catch (e) { showToast(e.response?.data?.error || 'Lỗi import', 'error'); }
    finally { setImporting(false); }
  };

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Bảng giá theo danh mục</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary btn-icon" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload size={15} /> {importing ? 'Đang import...' : 'Import Excel'}
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
            <button className="btn-primary" onClick={openAdd}><Plus size={15} /> Thêm</button>
          </div>
        </div>

        <div className="pla-tabs">
          {CATEGORIES.map(c => (
            <button key={c.key} className={`pla-tab ${activeTab === c.key ? 'active' : ''}`} onClick={() => setActiveTab(c.key)}>
              {c.label}
              {allItems[c.key] && <span className="pla-tab-count">{allItems[c.key].length}</span>}
            </button>
          ))}
        </div>

        <div className="admin-search" style={{ marginBottom: 0, borderBottom: '1px solid #e5e7eb' }}>
          <Search size={16} />
          <input placeholder={`Tìm trong ${activeTab}...`} value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} style={{ color: '#9ca3af', padding: '0 4px' }}><X size={15} /></button>}
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center' }}>STT</th>
                <th>Tên sản phẩm</th>
                <th style={{ width: 80 }}>Đơn vị</th>
                <th style={{ width: 110, textAlign: 'right' }}>Giá hộp</th>
                <th style={{ width: 110, textAlign: 'right' }}>Giá vỉ</th>
                <th style={{ width: 80 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center' }}><div className="skeleton" style={{ height: 12, width: 18, borderRadius: 3, margin: '0 auto' }} /></td>
                    <td><div className="skeleton skeleton-title" style={{ width: '75%' }} /></td>
                    <td><div className="skeleton" style={{ height: 12, width: 40, borderRadius: 3 }} /></td>
                    <td style={{ textAlign: 'right' }}><div className="skeleton" style={{ height: 12, width: 70, borderRadius: 3, marginLeft: 'auto' }} /></td>
                    <td style={{ textAlign: 'right' }}><div className="skeleton" style={{ height: 12, width: 60, borderRadius: 3, marginLeft: 'auto' }} /></td>
                    <td />
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center" style={{ padding: 40, color: '#9ca3af' }}>
                  {search ? `Không tìm thấy "${search}"` : 'Chưa có sản phẩm'}
                </td></tr>
              ) : filtered.map((p, idx) => (
                <tr key={p.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{idx + 1}</td>
                  <td>
                    <p style={{ fontWeight: 500, color: '#1f2937', fontSize: 13 }}>{p.name}</p>
                    {p.nhom && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{p.nhom}</p>}
                  </td>
                  <td style={{ fontSize: 13, color: '#6b7280' }}>{p.unit || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{formatPrice(p.price)}</td>
                  <td style={{ textAlign: 'right' }}>{formatPrice(p.vi_price)}</td>
                  <td>
                    <button className="action-btn edit" onClick={() => openEdit(p)} title="Sửa"><Pencil size={14} /></button>
                    <button className="action-btn delete" onClick={() => setDeleteId(p.id)} title="Xóa"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'add' ? 'Thêm sản phẩm' : 'Sửa sản phẩm'} — {activeTab}</h2>
              <button onClick={() => setModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {[
                ['name', 'Tên sản phẩm *', 'text'],
                ['nhom', 'Nhóm', 'text'],
                ['unit', 'Đơn vị (VD: Hộp, Chai)', 'text'],
                ['price', 'Giá hộp (đ)', 'number'],
                ['vi_price', 'Giá vỉ (đ)', 'number'],
              ].map(([key, label, type]) => (
                <div key={key} className="form-group">
                  <label>{label}</label>
                  <input type={type} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Hủy</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Xác nhận xóa</h2><button onClick={() => setDeleteId(null)}><X size={20} /></button></div>
            <div className="modal-body"><p>Bạn chắc chắn muốn xóa sản phẩm này khỏi bảng giá?</p></div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDeleteId(null)}>Hủy</button>
              <button className="btn-danger" onClick={handleDelete}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
