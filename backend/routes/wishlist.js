const express = require('express');
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('wishlists')
    .select('product_id, created_at, products(id, name, unit, price, original_price, image_url, stock, product_tiers(id, min_qty, price))')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(w => ({ ...w.products, wishlisted_at: w.created_at })));
});

router.get('/ids', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('wishlists')
    .select('product_id')
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(w => w.product_id));
});

router.post('/:productId', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('wishlists')
    .insert({ user_id: req.user.id, product_id: req.params.productId });
  if (error && error.code !== '23505') return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.delete('/:productId', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('wishlists')
    .delete()
    .eq('user_id', req.user.id)
    .eq('product_id', req.params.productId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
