import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState(new Set());

  const fetchIds = useCallback(async () => {
    if (!user || user.role === 'admin') return;
    try {
      const res = await api.get('/wishlist/ids');
      setWishlistIds(new Set(res.data));
    } catch {}
  }, [user]);

  useEffect(() => { fetchIds(); }, [fetchIds]);

  const toggle = async (productId) => {
    const isWishlisted = wishlistIds.has(productId);
    // Optimistic update
    setWishlistIds(prev => {
      const next = new Set(prev);
      isWishlisted ? next.delete(productId) : next.add(productId);
      return next;
    });
    try {
      if (isWishlisted) await api.delete(`/wishlist/${productId}`);
      else await api.post(`/wishlist/${productId}`);
    } catch {
      // Revert on error
      setWishlistIds(prev => {
        const next = new Set(prev);
        isWishlisted ? next.add(productId) : next.delete(productId);
        return next;
      });
    }
  };

  return (
    <WishlistContext.Provider value={{ wishlistIds, toggle, refetch: fetchIds }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
