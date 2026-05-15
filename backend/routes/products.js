const express = require('express');
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { search, category, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('products')
    .select('*, product_tiers(id, min_qty, price)', { count: 'exact' })
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (search) query = query.or(`name.ilike.%${search}%,active_ingredient.ilike.%${search}%`);
  if (category) query = query.eq('category', category);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Sort tiers ascending by min_qty
  const products = (data || []).map(p => ({
    ...p,
    product_tiers: (p.product_tiers || []).sort((a, b) => a.min_qty - b.min_qty),
  }));

  res.json({ products, total: count, page: Number(page), limit: Number(limit) });
});

router.get('/categories', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .eq('is_active', true)
    .not('category', 'is', null);
  if (error) return res.status(500).json({ error: error.message });
  const cats = [...new Set((data || []).map(p => p.category).filter(Boolean))].sort();
  res.json(cats);
});

router.get('/scan', requireAuth, async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Thiếu mã barcode' });

  // Try exact barcode match first
  const { data: byBarcode } = await supabase
    .from('products')
    .select('*, product_tiers(id, min_qty, price)')
    .eq('barcode', code)
    .eq('is_active', true)
    .limit(5);

  if (byBarcode && byBarcode.length > 0) {
    const products = byBarcode.map(p => ({
      ...p,
      product_tiers: (p.product_tiers || []).sort((a, b) => a.min_qty - b.min_qty),
    }));
    return res.json({ products, source: 'barcode' });
  }

  // Fallback: name search
  const { data: byName } = await supabase
    .from('products')
    .select('*, product_tiers(id, min_qty, price)')
    .ilike('name', `%${code}%`)
    .eq('is_active', true)
    .limit(10);

  const products = (byName || []).map(p => ({
    ...p,
    product_tiers: (p.product_tiers || []).sort((a, b) => a.min_qty - b.min_qty),
  }));
  res.json({ products, source: 'name' });
});

router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .eq('is_active', true)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  res.json(data);
});

module.exports = router;
