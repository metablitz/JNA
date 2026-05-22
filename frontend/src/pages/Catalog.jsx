import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ChevronRight, ArrowLeft, ShoppingCart } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Layout from '../components/Layout';

const CATEGORIES = [
  { key: 'TPCN',        label: 'TPCN',        desc: 'Thực phẩm chức năng' },
  { key: 'Dụng cụ',    label: 'Dụng cụ',      desc: 'Dụng cụ y tế' },
  { key: 'Dùng ngoài', label: 'Dùng ngoài',    desc: 'Thuốc dùng ngoài da' },
  { key: 'Việt Nam',   label: 'Việt Nam',       desc: 'Thuốc sản xuất tại Việt Nam' },
  { key: 'Ngoại',      label: 'Ngoại',          desc: 'Thuốc nhập khẩu' },
];

function formatPrice(price) {
  if (!price || price === 0) return 'Liên hệ';
  return price.toLocaleString('vi-VN') + 'đ';
}

export default function Catalog() {
  const [selected, setSelected] = useState(null);
  const [counts, setCounts]     = useState([]);
  const [items, setItems]       = useState([]);
  const [loadingList, setLoadingList]   = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [search, setSearch]     = useState('');

  // selections: { [pricelist_id]: { qty, unit, price, name } }
  const [selections, setSelections] = useState({});
  // localQtys/localUnits: pending values per product before adding to selections
  const [localQtys, setLocalQtys] = useState({});
  const [localUnits, setLocalUnits] = useState({});
  const [ordering, setOrdering] = useState(false);

  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const totalSelected    = Object.values(selections).reduce((s, v) => s + v.qty, 0);
  const totalUniqueItems = Object.values(selections).filter(v => v.qty > 0).length;
  const totalPrice       = Object.values(selections).reduce((s, v) => s + v.price * v.qty, 0);

  useEffect(() => {
    api.get('/pricelist/categories')
      .then(res => setCounts(res.data))
      .catch(console.error)
      .finally(() => setLoadingCounts(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setSearch('');
    setItems([]);
    setLoadingList(true);
    api.get('/pricelist', { params: { category: selected } })
      .then(res => setItems(res.data.items))
      .catch(console.error)
      .finally(() => setLoadingList(false));
  }, [selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(p => p.name.toLowerCase().includes(q));
  }, [items, search]);

  const cat = CATEGORIES.find(c => c.key === selected);

  // ── Cart helpers ─────────────────────────────────────────────
  const getSelQty = (id) => selections[id]?.qty || 0;
  const getUnit   = (id, defaultUnit) => selections[id]?.unit || localUnits[id] || defaultUnit;
  const getLocalQty = (id) => localQtys[id] ?? 1;

  const resolvePrice = (product, unit) =>
    unit === 'Vỉ' && product.vi_price ? product.vi_price : product.price;

  const setLocalQtyVal = (id, val) => {
    const qty = Math.max(1, Math.floor(Number(val) || 1));
    setLocalQtys(prev => ({ ...prev, [id]: qty }));
  };

  // Confirm pending localQty into selections (SET, not increment)
  const confirmToOrder = (id, product) => {
    const qty = getLocalQty(id);
    const unit = getUnit(id, product.unit);
    setSelections(prev => ({
      ...prev,
      [id]: { qty, unit, price: resolvePrice(product, unit), name: product.name },
    }));
    setLocalQtys(prev => ({ ...prev, [id]: 1 }));
  };

  // Remove product from selections
  const removeFromOrder = (id) => {
    setSelections(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const changeUnit = (id, unit, product) => {
    if (selections[id]) {
      setSelections(prev => ({
        ...prev,
        [id]: { ...prev[id], unit, price: resolvePrice(product, unit) },
      }));
    } else {
      setLocalUnits(prev => ({ ...prev, [id]: unit }));
    }
  };

  const handleOrder = async () => {
    if (totalSelected === 0) return;
    setOrdering(true);
    try {
      const orderItems = Object.entries(selections).map(([id, sel]) => ({
        pricelist_id: id,
        name: sel.name,
        unit: sel.unit,
        quantity: sel.qty,
        price: sel.price,
      }));
      await api.post('/orders/pricelist', {
        items: orderItems,
        shipping_address: user?.address || '',
      });
      setSelections({});
      navigate('/orders');
    } catch (err) {
      const d = err.response?.data;
      if (d?.credit_limit) {
        showToast(`${d.error}. Công nợ: ${d.current_debt?.toLocaleString('vi-VN')}đ / ${d.credit_limit?.toLocaleString('vi-VN')}đ`, 'error');
      } else {
        showToast(d?.error || 'Đặt hàng thất bại', 'error');
      }
    } finally {
      setOrdering(false);
    }
  };

  // ── Floating cart bar (shared between both views) ────────────
  const CartBar = totalSelected > 0 ? (
    <div className="pl-cart-bar">
      <div className="pl-cart-bar-info">
        <ShoppingCart size={16} />
        <span>{totalUniqueItems} SP · {totalSelected} đơn vị</span>
        <span className="pl-cart-bar-price">{formatPrice(totalPrice)}</span>
      </div>
      <div className="pl-cart-bar-actions">
        <button className="pl-cart-clear-btn" onClick={() => setSelections({})}>Xóa</button>
        <button className="pl-cart-order-btn" onClick={handleOrder} disabled={ordering}>
          {ordering ? 'Đang đặt...' : 'Đặt hàng'}
        </button>
      </div>
    </div>
  ) : null;

  // ── Category menu ─────────────────────────────────────────────
  if (!selected) {
    return (
      <Layout>
        <div className="pl-menu">
          <div className="pl-menu-header">
            <h1>Báo giá theo danh mục</h1>
            <p>Chọn danh mục để xem bảng giá chi tiết</p>
          </div>
          <div className="pl-menu-list">
            {CATEGORIES.map(c => {
              const cnt = counts.find(x => x.category === c.key)?.count ?? '…';
              return (
                <button key={c.key} className="pl-menu-item" onClick={() => setSelected(c.key)}>
                  <div className="pl-menu-item-left">
                    <span className="pl-menu-label">{c.label}</span>
                    <span className="pl-menu-desc">{c.desc}</span>
                  </div>
                  <div className="pl-menu-item-right">
                    <span className="pl-menu-count">
                      {loadingCounts ? '…' : `${cnt} SP`}
                    </span>
                    <ChevronRight size={18} className="pl-menu-arrow" />
                  </div>
                </button>
              );
            })}
          </div>
          <p className="pl-menu-note">
            Giá B2B — chưa bao gồm VAT<br />
            Liên hệ <strong>0966 050 306</strong> để được tư vấn
          </p>
        </div>
        {CartBar}
      </Layout>
    );
  }

  // ── Price list table ──────────────────────────────────────────
  return (
    <Layout>
      <div className="pl-table-page">
        {/* Header */}
        <div className="pl-table-header">
          <button className="pl-back-btn" onClick={() => setSelected(null)}>
            <ArrowLeft size={18} />
            Danh mục
          </button>
          <div className="pl-table-title">
            <span className="pl-cat-badge">{cat?.label}</span>
            <span className="pl-table-count">
              {loadingList ? 'Đang tải...' : `${filtered.length} / ${items.length} SP`}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="pl-search-bar">
          <Search size={16} className="pl-search-icon" />
          <input
            placeholder={`Tìm trong ${cat?.label}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="pl-search-clear" onClick={() => setSearch('')}>
              <X size={15} />
            </button>
          )}
        </div>

        {/* Table */}
        {loadingList ? (
          <div className="pl-loading">Đang tải danh sách...</div>
        ) : filtered.length === 0 ? (
          <div className="pl-empty">
            {search ? `Không tìm thấy "${search}"` : 'Chưa có sản phẩm'}
          </div>
        ) : (
          <div className="pl-table-wrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th className="pl-col-stt">STT</th>
                  <th className="pl-col-name">Tên sản phẩm</th>
                  <th className="pl-col-unit">ĐVT</th>
                  <th className="pl-col-price">Giá</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => {
                  const selQty   = getSelQty(p.id);
                  const localQty = getLocalQty(p.id);
                  const selectedUnit = getUnit(p.id, p.unit);
                  const canToggle = p.unit === 'Hộp';
                  const displayPrice = resolvePrice(p, selectedUnit);
                  return (
                    <tr key={p.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#eef2f6' }}>
                      <td className="pl-col-stt">{idx + 1}</td>

                      <td className="pl-col-name">
                        <span className="pl-prod-name">{p.name}</span>
                        {p.nhom && <span className="pl-prod-group">{p.nhom}</span>}
                        {selQty > 0 && (
                          <div className="pl-in-sel-row">
                            <span className="pl-in-sel-badge">✓ {selQty}</span>
                            <button className="pl-remove-btn" onClick={() => removeFromOrder(p.id)}>✕</button>
                          </div>
                        )}
                        <div className="pl-qty-row">
                          <button className="pl-qty-btn" onClick={() => setLocalQtyVal(p.id, localQty - 1)}>−</button>
                          <input
                            type="number"
                            className="pl-qty-inp"
                            value={localQty}
                            min={1}
                            onChange={e => setLocalQtyVal(p.id, e.target.value)}
                          />
                          <button className="pl-qty-btn" onClick={() => setLocalQtyVal(p.id, localQty + 1)}>+</button>
                        </div>
                      </td>

                      <td className="pl-col-unit">
                        {canToggle ? (
                          <div className="pl-unit-sw">
                            <button
                              className={`pl-usw-btn${selectedUnit === 'Hộp' ? ' act' : ''}`}
                              onClick={() => changeUnit(p.id, 'Hộp', p)}
                            >Hộp</button>
                            <button
                              className={`pl-usw-btn${selectedUnit === 'Vỉ' ? ' act' : ''}`}
                              onClick={() => changeUnit(p.id, 'Vỉ', p)}
                            >Vỉ</button>
                          </div>
                        ) : (
                          <span>{p.unit || '—'}</span>
                        )}
                      </td>

                      <td className="pl-col-price">
                        <div className="pl-price-cell">
                          <span className="pl-price-txt">{formatPrice(displayPrice)}</span>
                          <button
                            className={`pl-add-btn${selQty > 0 ? ' added' : ''}`}
                            onClick={() => confirmToOrder(p.id, p)}
                          >
                            <ShoppingCart size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {CartBar}
      </div>
    </Layout>
  );
}
