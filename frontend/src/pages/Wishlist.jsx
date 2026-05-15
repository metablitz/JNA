import { useState, useEffect } from 'react';
import { Heart, ShoppingCart, Minus, Plus, ShoppingBag } from 'lucide-react';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { applyTierDiscount } from '../lib/tiers';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

function formatPrice(price) { return price?.toLocaleString('vi-VN') + 'đ'; }

export default function Wishlist() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { wishlistIds, toggle } = useWishlist();
  const { setItemQty } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/wishlist')
      .then(res => setProducts(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Remove product from local list when toggled off
  useEffect(() => {
    setProducts(prev => prev.filter(p => wishlistIds.has(p.id)));
  }, [wishlistIds]);

  const [qtys, setQtys] = useState({});
  const getQty = (id) => qtys[id] || 1;
  const setQty = (id, val) => setQtys(prev => ({ ...prev, [id]: Math.max(1, val) }));

  const addAll = () => {
    const inStock = products.filter(p => p.stock > 0);
    if (inStock.length === 0) return;
    inStock.forEach(p => setItemQty(p, getQty(p.id)));
    showToast(`Đã thêm ${inStock.length} sản phẩm vào giỏ hàng`, 'success');
    navigate('/cart');
  };

  return (
    <Layout>
      <div className="wishlist-page">
        <div className="wishlist-header">
          <Heart size={22} fill="currentColor" className="wishlist-header-icon" />
          <h1>Sản phẩm yêu thích</h1>
          {products.length > 0 && (
            <button className="wishlist-add-all-btn" onClick={addAll} title="Thêm tất cả vào giỏ">
              <ShoppingBag size={16} /> Thêm tất cả
            </button>
          )}
        </div>

        {loading ? (
          <div className="wishlist-list">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="wishlist-item">
                <div className="skeleton" style={{ width: 64, height: 64, borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="wishlist-empty">
            <Heart size={48} className="empty-heart" />
            <p>Chưa có sản phẩm yêu thích</p>
          </div>
        ) : (
          <div className="wishlist-list">
            {products.map(p => {
              const userPrice = applyTierDiscount(p.price, user?.tier);
              const hasTierDiscount = userPrice !== p.price;
              const outOfStock = p.stock === 0;
              return (
                <div key={p.id} className={`wishlist-item ${outOfStock ? 'out-of-stock' : ''}`}>
                  <div className="wishlist-item-image">
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} />
                      : <div className="product-image-placeholder">💊</div>
                    }
                  </div>
                  <div className="wishlist-item-info">
                    <h3>{p.name}</h3>
                    <div className="wishlist-price-row">
                      <span className="product-price">{formatPrice(hasTierDiscount ? userPrice : p.price)}</span>
                      <span className="product-unit">{p.unit}</span>
                      {(hasTierDiscount || (p.original_price && p.original_price !== p.price)) && (
                        <span className="product-original-price">{formatPrice(hasTierDiscount ? p.price : p.original_price)}</span>
                      )}
                    </div>
                    {outOfStock && <span className="stock-status stock-out">Hết hàng</span>}
                  </div>
                  <div className="wishlist-item-actions">
                    <div className="qty-controls">
                      <button className="qty-btn qty-minus" onClick={() => setQty(p.id, getQty(p.id) - 1)} disabled={outOfStock}><Minus size={13} /></button>
                      <span className="qty-value">{getQty(p.id)}</span>
                      <button className="qty-btn qty-plus" onClick={() => setQty(p.id, getQty(p.id) + 1)} disabled={outOfStock}><Plus size={13} /></button>
                      <button
                        className={`btn-add-cart ${outOfStock ? 'btn-add-cart-disabled' : ''}`}
                        onClick={() => { setItemQty(p, getQty(p.id)); setQty(p.id, 1); }}
                        disabled={outOfStock}
                      >
                        <ShoppingCart size={15} />
                      </button>
                    </div>
                    <button
                      className="wishlist-remove-btn"
                      onClick={() => toggle(p.id)}
                      title="Xóa khỏi yêu thích"
                    >
                      <Heart size={18} fill="currentColor" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
