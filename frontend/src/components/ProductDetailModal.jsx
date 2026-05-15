import { useState } from 'react';
import { X, Heart, ShoppingCart, Minus, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { applyTierDiscount } from '../lib/tiers';

function formatPrice(price) { return price?.toLocaleString('vi-VN') + 'đ'; }

export default function ProductDetailModal({ product, onClose }) {
  const { setItemQty, items, getTierPrice } = useCart();
  const { user } = useAuth();
  const { wishlistIds, toggle } = useWishlist();
  const [qty, setQty] = useState(1);

  const isAdmin = user?.role === 'admin';
  const isWishlisted = wishlistIds.has(product.id);
  const userPrice = applyTierDiscount(product.price, user?.tier);
  const hasTierDiscount = userPrice !== product.price;
  const cartItem = items.find(i => i.product_id === product.id);
  const effectiveUnitPrice = getTierPrice(product, qty);
  const outOfStock = product.stock === 0;

  const displayPrice = hasTierDiscount
    ? applyTierDiscount(effectiveUnitPrice, user?.tier)
    : effectiveUnitPrice;

  const handleAdd = () => {
    setItemQty(product, qty);
    onClose();
  };

  return (
    <div className="modal-overlay product-detail-overlay" onClick={onClose}>
      <div className="product-detail-sheet" onClick={e => e.stopPropagation()}>
        <div className="product-detail-drag-handle" />
        <button className="product-detail-close" onClick={onClose}><X size={20} /></button>

        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="product-detail-image" />
        ) : (
          <div className="product-detail-placeholder">💊</div>
        )}

        <div className="product-detail-body">
          <h2 className="product-detail-name">{product.name}</h2>
          {product.active_ingredient && (
            <p className="product-detail-ingredient">{product.active_ingredient}</p>
          )}

          <div className="product-detail-price-row">
            <span className="product-price product-detail-price">{formatPrice(displayPrice)}</span>
            <span className="product-unit">/{product.unit}</span>
            {hasTierDiscount ? (
              <span className="product-original-price">{formatPrice(product.price)}</span>
            ) : product.original_price && product.original_price !== product.price ? (
              <span className="product-original-price">{formatPrice(product.original_price)}</span>
            ) : null}
          </div>

          {product.product_tiers?.length > 0 && (
            <div className="product-tiers" style={{ marginTop: 10 }}>
              {product.product_tiers.map(t => (
                <span
                  key={t.id}
                  className={`tier-badge-item ${qty >= t.min_qty ? 'tier-active' : ''}`}
                >
                  ≥{t.min_qty} {product.unit.toLowerCase()}: <strong>{formatPrice(t.price)}</strong>
                </span>
              ))}
            </div>
          )}

          <div className="product-detail-chips">
            <span className={`detail-chip ${outOfStock ? 'chip-red' : 'chip-green'}`}>
              {outOfStock ? '❌ Hết hàng' : '✓ Còn hàng'}
            </span>
            {product.expiry_date && (
              <span className="detail-chip">📅 HSD: {product.expiry_date}</span>
            )}
            {product.category && (
              <span className="detail-chip">🏷 {product.category}</span>
            )}
            {product.barcode && (
              <span className="detail-chip">📦 {product.barcode}</span>
            )}
            {isAdmin && (
              <span className="detail-chip">📊 Tồn: {product.stock?.toLocaleString('vi-VN')} {product.unit}</span>
            )}
          </div>

          {cartItem && (
            <p className="in-cart-note">✓ Đang có <strong>{cartItem.quantity}</strong> trong giỏ hàng</p>
          )}
        </div>

        {!isAdmin && (
          <div className="product-detail-actions">
            <button
              className={`wishlist-action-btn ${isWishlisted ? 'wishlisted' : ''}`}
              onClick={() => toggle(product.id)}
              title={isWishlisted ? 'Xóa yêu thích' : 'Thêm yêu thích'}
            >
              <Heart size={22} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
            <div className="qty-controls" style={{ flex: 1, justifyContent: 'center' }}>
              <button className="qty-btn qty-minus" onClick={() => setQty(q => Math.max(1, q - 1))} disabled={outOfStock}>
                <Minus size={14} />
              </button>
              <span className="qty-value">{qty}</span>
              <button className="qty-btn qty-plus" onClick={() => setQty(q => q + 1)} disabled={outOfStock}>
                <Plus size={14} />
              </button>
            </div>
            <button className={`btn-add-to-cart-detail ${outOfStock ? 'btn-add-cart-disabled' : ''}`} onClick={handleAdd} disabled={outOfStock}>
              <ShoppingCart size={16} />
              {outOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
