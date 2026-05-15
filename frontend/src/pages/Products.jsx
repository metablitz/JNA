import { useState, useEffect, useCallback } from 'react';
import { Search, QrCode, Bell, ShoppingCart, Minus, Plus, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useWishlist } from '../context/WishlistContext';
import { applyTierDiscount } from '../lib/tiers';
import Layout from '../components/Layout';
import QrScanModal from '../components/QrScanModal';
import ProductDetailModal from '../components/ProductDetailModal';

function formatPrice(price) {
  return price?.toLocaleString('vi-VN') + 'đ';
}

function getPriceChangePct(price, originalPrice) {
  if (!originalPrice || originalPrice <= 0 || originalPrice === price) return null;
  return Math.round(((price - originalPrice) / originalPrice) * 100);
}

function ProductCard({ product }) {
  const { setItemQty, items } = useCart();
  const { user } = useAuth();
  const { wishlistIds, toggle: toggleWishlist } = useWishlist();
  const isAdmin = user?.role === 'admin';
  const isWishlisted = wishlistIds.has(product.id);
  const [showDetail, setShowDetail] = useState(false);
  const cartItem = items.find((i) => i.product_id === product.id);
  const cartQty = cartItem?.quantity || 0;
  const outOfStock = product.stock === 0;
  const [localQty, setLocalQty] = useState(1);

  const pct = getPriceChangePct(product.price, product.original_price);
  const userPrice = applyTierDiscount(product.price, user?.tier);
  const hasTierDiscount = userPrice !== product.price;

  const handleAddToCart = () => {
    if (outOfStock) return;
    setItemQty(product, localQty);
    setLocalQty(1);
  };

  return (
    <>
    <div className={`product-card ${outOfStock ? 'out-of-stock' : ''}`}>
      <div className="product-card-top" onClick={() => setShowDetail(true)} style={{ cursor: 'pointer' }}>
        <div className="product-image-wrap">
          {product.image_url
            ? <img src={product.image_url} alt={product.name} className="product-image" />
            : <div className="product-image-placeholder">💊</div>
          }
          {pct !== null && (
            <span className={`discount-badge ${pct > 0 ? 'badge-up' : 'badge-down'}`}>
              {pct > 0 ? `↑${pct}%` : `↓${Math.abs(pct)}%`}
            </span>
          )}
          {outOfStock && <span className="stock-badge-img">Hết hàng</span>}
          {cartQty > 0 && <span className="cart-qty-on-image">{cartQty}</span>}
        </div>
        <div className="product-info">
          <h3 className="product-name">{product.name}</h3>

          {isAdmin && (
            <p className="stock-admin-label">
              Kho: <strong>{product.stock.toLocaleString('vi-VN')}</strong> {product.unit}
            </p>
          )}

          {!isAdmin && (
            <span className={`stock-status ${outOfStock ? 'stock-out' : 'stock-in'}`}>
              {outOfStock ? 'Hết hàng' : 'Còn hàng'}
            </span>
          )}

          <div className="product-price-row">
            <span className="product-price">{formatPrice(hasTierDiscount ? userPrice : product.price)}</span>
            <span className="product-unit">{product.unit}</span>
            {hasTierDiscount
              ? <span className="product-original-price">{formatPrice(product.price)}</span>
              : product.original_price && product.original_price !== product.price
                ? <span className="product-original-price">{formatPrice(product.original_price)}</span>
                : null
            }
          </div>
          {product.product_tiers?.length > 0 && (
            <div className="product-tiers">
              {product.product_tiers.map(t => (
                <span key={t.id} className="tier-badge-item">
                  Từ {t.min_qty} {product.unit.toLowerCase()}: <strong>{formatPrice(t.price)}</strong>
                </span>
              ))}
            </div>
          )}
          {product.expiry_date && (
            <div className="product-expiry">
              <span className="expiry-icon">📅</span>
              {product.expiry_date}
            </div>
          )}
        </div>
      </div>

      <div className="product-card-actions">
        <div className="action-icons">
          {!isAdmin && (
            <button
              className={`icon-btn wishlist-btn ${isWishlisted ? 'wishlisted' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
              title={isWishlisted ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}
            >
              <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
        <div className="qty-controls">
          <button
            className="qty-btn qty-minus"
            onClick={() => setLocalQty(q => Math.max(1, q - 1))}
            disabled={outOfStock}
          >
            <Minus size={14} />
          </button>
          <span className="qty-value">{localQty}</span>
          <button
            className="qty-btn qty-plus"
            onClick={() => setLocalQty(q => q + 1)}
            disabled={outOfStock}
          >
            <Plus size={14} />
          </button>
          <button
            className={`btn-add-cart ${outOfStock ? 'btn-add-cart-disabled' : ''} ${cartQty > 0 ? 'btn-in-cart' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleAddToCart(); }}
            disabled={outOfStock}
            title={outOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
          >
            <ShoppingCart size={16} />
          </button>
        </div>
      </div>
    </div>
    {showDetail && <ProductDetailModal product={product} onClose={() => setShowDetail(false)} />}
    </>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const [categories, setCategories] = useState([]);
  const { totalItems } = useCart();
  const { unreadCount } = useNotification();
  const navigate = useNavigate();
  const limit = 20;

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit };
      if (category) params.category = category;
      const res = await api.get('/products', { params });
      setProducts(res.data.products);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, page, category]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  useEffect(() => { setPage(1); }, [search, category]);

  useEffect(() => {
    api.get('/products/categories').then(res => setCategories(res.data || [])).catch(() => {});
  }, []);

  return (
    <Layout>
      <div className="products-page">
        <header className="products-header">
          <div className="search-bar">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Tìm kiếm thuốc, hoạt chất..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="qr-btn" onClick={() => setShowQr(true)}><QrCode size={18} /></button>
          </div>
          <div className="header-actions">
            <button className="icon-action-btn notif-bell-btn" onClick={() => navigate('/notifications')}>
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="cart-badge-header">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>
            <button className="icon-action-btn cart-icon-btn" onClick={() => navigate('/cart')}>
              <ShoppingCart size={22} />
              {totalItems > 0 && <span className="cart-badge-header">{totalItems}</span>}
            </button>
          </div>
        </header>

        <div className="category-tabs">
          <button className={`tab ${category === '' ? 'active' : ''}`} onClick={() => setCategory('')}>🗂 Tất cả</button>
          {categories.map(cat => (
            <button key={cat} className={`tab ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>

        <div className="product-list">
          {loading && products.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="product-card skeleton-card">
                <div className="skeleton skeleton-img" />
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-price" />
              </div>
            ))
          ) : products.length === 0 ? (
            <div className="empty-text">Không tìm thấy sản phẩm</div>
          ) : (
            products.map((p) => <ProductCard key={p.id} product={p} />)
          )}
        </div>

        {total > limit && (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>‹ Trước</button>
            <span>Trang {page} / {Math.ceil(total / limit)}</span>
            <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)}>Tiếp ›</button>
          </div>
        )}
      </div>
      {showQr && <QrScanModal onClose={() => setShowQr(false)} />}
    </Layout>
  );
}
