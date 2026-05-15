export const TIERS = {
  dong:      { label: 'Đồng',      icon: '🥉', color: '#b45309', bg: '#fef3c7', discount: 0 },
  bac:       { label: 'Bạc',       icon: '🥈', color: '#6b7280', bg: '#f3f4f6', discount: 2 },
  vang:      { label: 'Vàng',      icon: '🥇', color: '#d97706', bg: '#fef9c3', discount: 5 },
  kim_cuong: { label: 'Kim cương', icon: '💎', color: '#7c3aed', bg: '#ede9fe', discount: 8 },
};

export function getTier(key) {
  return TIERS[key] || TIERS.dong;
}

export function applyTierDiscount(price, tierKey) {
  const discount = TIERS[tierKey]?.discount || 0;
  if (discount === 0) return price;
  return Math.round(price * (1 - discount / 100));
}
