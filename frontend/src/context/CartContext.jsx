import { createContext, useContext, useState, useEffect } from 'react';
import { applyTierDiscount } from '../lib/tiers';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const addItem = (product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { product_id: product.id, product, quantity }];
    });
  };

  const setItemQty = (product, quantity) => {
    if (quantity <= 0) return removeItem(product.id);
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) return prev.map((i) => i.product_id === product.id ? { ...i, quantity } : i);
      return [...prev, { product_id: product.id, product, quantity }];
    });
  };

  const updateQuantity = (product_id, quantity) => {
    if (quantity <= 0) return removeItem(product_id);
    setItems((prev) => prev.map((i) => (i.product_id === product_id ? { ...i, quantity } : i)));
  };

  const removeItem = (product_id) => {
    setItems((prev) => prev.filter((i) => i.product_id !== product_id));
  };

  const clearCart = () => setItems([]);

  const getQtyTierPrice = (product, qty) => {
    const tiers = (product.product_tiers || []).slice().sort((a, b) => b.min_qty - a.min_qty);
    const matched = tiers.find(t => qty >= t.min_qty);
    return matched ? matched.price : product.price;
  };

  const getTierPrice = (product, qty) => {
    const qtyPrice = getQtyTierPrice(product, qty);
    return applyTierDiscount(qtyPrice, user?.tier);
  };

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = items.reduce((s, i) => s + getTierPrice(i.product, i.quantity) * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, setItemQty, updateQuantity, removeItem, clearCart, totalItems, totalAmount, getTierPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
