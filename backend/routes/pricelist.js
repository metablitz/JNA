const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const supabase = require('../lib/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CATEGORIES = ['TPCN', 'Dụng cụ', 'Dùng ngoài', 'Việt Nam', 'Ngoại'];

router.get('/', requireAuth, async (req, res) => {
  const { category, search } = req.query;
  if (!category || !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Danh mục không hợp lệ' });
  }
  let query = supabase
    .from('price_list')
    .select('id, name, nhom, unit, price, vi_price')
    .eq('category', category)
    .order('name', { ascending: true });
  if (search && search.trim()) query = query.ilike('name', `%${search.trim()}%`);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data, total: data.length });
});

router.get('/categories', requireAuth, async (req, res) => {
  const counts = await Promise.all(
    CATEGORIES.map(async (cat) => {
      const { count } = await supabase
        .from('price_list')
        .select('id', { count: 'exact', head: true })
        .eq('category', cat);
      return { category: cat, count: count || 0 };
    })
  );
  res.json(counts);
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, nhom, unit, price, vi_price, category } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Thiếu tên hoặc danh mục' });
  const { data, error } = await supabase
    .from('price_list')
    .insert({ name, nhom, unit, price: price || null, vi_price: vi_price || null, category })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { name, nhom, unit, price, vi_price, category } = req.body;
  const { data, error } = await supabase
    .from('price_list')
    .update({ name, nhom, unit, price: price || null, vi_price: vi_price || null, category })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('price_list').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// POST /pricelist/import — Excel file, sheet columns: Tên, Nhóm, ĐVT, Giá hộp, Giá vỉ
router.post('/import', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu file' });
  const { category } = req.body;
  if (!category || !CATEGORIES.includes(category)) return res.status(400).json({ error: 'Danh mục không hợp lệ' });

  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    const items = rows
      .filter(r => r['Tên'] || r['Ten'] || r['TEN'])
      .map(r => ({
        name: String(r['Tên'] || r['Ten'] || r['TEN'] || '').trim(),
        nhom: String(r['Nhóm'] || r['Nhom'] || r['NHOM'] || '').trim() || null,
        unit: String(r['ĐVT'] || r['DVT'] || r['Đơn vị'] || r['Don vi'] || '').trim() || null,
        price: parseFloat(r['Giá hộp'] || r['Gia hop'] || r['Giá'] || r['Gia'] || 0) || null,
        vi_price: parseFloat(r['Giá vỉ'] || r['Gia vi'] || 0) || null,
        category,
      }))
      .filter(r => r.name);

    if (items.length === 0) return res.status(400).json({ error: 'Không tìm thấy dữ liệu hợp lệ trong file' });

    // Delete existing for this category and re-insert
    await supabase.from('price_list').delete().eq('category', category);
    const { error } = await supabase.from('price_list').insert(items);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, count: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Lỗi đọc file Excel: ' + e.message });
  }
});

module.exports = router;
