import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home, Heart, ShoppingCart, ClipboardList, User } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function BottomNav() {
  const { totalItems } = useCart();
  const { wishlistIds } = useWishlist();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [pendingOrders, setPendingOrders] = useState(0);

  useEffect(() => {
    if (!user || isAdmin) return;
    api.get('/orders/stats')
      .then(res => setPendingOrders(res.data.pending || 0))
      .catch(() => {});
  }, [user, isAdmin]);

  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <Home size={22} />
        <span>Sản phẩm</span>
      </NavLink>
      {!isAdmin && (
        <NavLink to="/wishlist" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <div className="nav-cart-wrap">
            <Heart size={22} />
            {wishlistIds.size > 0 && <span className="cart-badge">{wishlistIds.size > 9 ? '9+' : wishlistIds.size}</span>}
          </div>
          <span>Yêu thích</span>
        </NavLink>
      )}
      <NavLink to="/cart" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <div className="nav-cart-wrap">
          <ShoppingCart size={22} />
          {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
        </div>
        <span>Giỏ hàng</span>
      </NavLink>
      <NavLink to="/orders" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <div className="nav-cart-wrap">
          <ClipboardList size={22} />
          {pendingOrders > 0 && <span className="cart-badge">{pendingOrders > 9 ? '9+' : pendingOrders}</span>}
        </div>
        <span>Đơn hàng</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <User size={22} />
        <span>Cá nhân</span>
      </NavLink>
    </nav>
  );
}
