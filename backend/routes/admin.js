const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const XLSX = require('xlsx');
const supabase = require('../lib/supabase');
const { requireAdmin } = require('../middleware/auth');
const { pushToUser } = require('../lib/sseClients');

const xlsxUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

// --- PRODUCTS ---
router.get('/products', requireAdmin, async (req, res) => {
  const { search, page = 1, limit = 20, category, show_hidden } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (!show_hidden) query = query.eq('is_active', true);
  if (search) query = query.or(`name.ilike.%${search}%,active_ingredient.ilike.%${search}%,barcode.ilike.%${search}%`);
  if (category) query = query.eq('category', category);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ products: data, total: count });
});

router.post('/products', requireAdmin, async (req, res) => {
  const { name, active_ingredient, unit, price, original_price, image_url, expiry_date, category, stock, barcode } = req.body;
  if (!name || !price || !unit) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

  const { data, error } = await supabase
    .from('products')
    .insert({ name, active_ingredient, unit, price, original_price, image_url, expiry_date, category, stock: stock || 0, is_active: true, barcode: barcode || null })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/products/:id', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Download Excel template
router.get('/products/template', requireAdmin, (req, res) => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Tên sản phẩm *', 'Hoạt chất', 'Đơn vị tính *', 'Giá bán *', 'Hạn dùng', 'Tồn kho', 'Danh mục', 'Mã barcode'],
    ['Paracetamol 500mg, H/100v', 'Paracetamol', 'Hộp', 15000, '01/2028', 200, 'Thuốc', '8934673190019'],
    ['Vitamin C 1000mg, H/30v, Vat', 'Ascorbic acid', 'Hộp', 93500, '03/2028', 100, 'Thực phẩm chức năng', ''],
  ]);
  ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 24 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sản phẩm');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="template_san_pham.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// Import Excel
router.post('/products/import', requireAdmin, xlsxUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu file' });

  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  } catch {
    return res.status(400).json({ error: 'File không đúng định dạng Excel' });
  }

  if (rows.length < 2) return res.status(400).json({ error: 'File không có dữ liệu' });

  // Map header → index (tìm theo tên cột, bỏ qua header row)
  const header = rows[0].map(h => String(h).trim().toLowerCase());
  const col = (keywords) => header.findIndex(h => keywords.some(k => h.includes(k)));
  const iName = col(['tên', 'name']);
  const iActiveIng = col(['hoạt chất', 'active_ingredient', 'hoat chat', 'thành phần']);
  const iUnit = col(['đơn vị', 'unit']);
  const iPrice = col(['giá bán', 'price', 'giá']);
  const iExpiry = col(['hạn', 'expiry', 'date']);
  const iStock = col(['tồn', 'stock']);
  const iCategory = col(['danh mục', 'category']);
  const iBarcode = col(['barcode', 'mã vạch', 'mã bar']);

  if (iName === -1 || iUnit === -1 || iPrice === -1) {
    return res.status(400).json({ error: 'File thiếu cột bắt buộc: Tên sản phẩm, Đơn vị tính, Giá bán' });
  }

  const products = [];
  const errors = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row[iName] || '').trim();
    const unit = String(row[iUnit] || '').trim();
    const price = Number(row[iPrice]);

    if (!name || !unit || !price || isNaN(price)) {
      if (name || unit || price) errors.push(`Dòng ${i + 1}: thiếu hoặc sai thông tin bắt buộc`);
      continue;
    }

    products.push({
      name,
      active_ingredient: iActiveIng !== -1 ? String(row[iActiveIng] || '').trim() || null : null,
      unit,
      price,
      expiry_date: iExpiry !== -1 ? String(row[iExpiry] || '').trim() || null : null,
      stock: iStock !== -1 ? Number(row[iStock]) || 0 : 0,
      category: iCategory !== -1 ? String(row[iCategory] || '').trim() || null : null,
      barcode: iBarcode !== -1 ? String(row[iBarcode] || '').trim() || null : null,
      is_active: true,
    });
  }

  if (products.length === 0) {
    return res.status(400).json({ error: 'Không có dòng hợp lệ nào để import', row_errors: errors });
  }

  const { data, error } = await supabase.from('products').insert(products).select('id');
  if (error) return res.status(500).json({ error: error.message });

  res.json({ imported: data.length, skipped: errors.length, row_errors: errors });
});

router.delete('/products/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// --- STOCK MANAGEMENT ---
router.post('/products/:id/stock', requireAdmin, async (req, res) => {
  const { change_qty, reason = 'import', note } = req.body;
  if (!change_qty || isNaN(change_qty)) return res.status(400).json({ error: 'Số lượng không hợp lệ' });

  const qty = Number(change_qty);

  // Fetch current stock
  const { data: product, error: pErr } = await supabase
    .from('products').select('id, name, stock').eq('id', req.params.id).single();
  if (pErr || !product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  const wasOutOfStock = product.stock === 0;
  const newStock = product.stock + qty;
  if (newStock < 0) return res.status(400).json({ error: 'Tồn kho không đủ' });

  const [updateRes] = await Promise.all([
    supabase.from('products').update({ stock: newStock }).eq('id', req.params.id).select('id, name, stock').single(),
    supabase.from('stock_logs').insert({ product_id: req.params.id, change_qty: qty, reason, note: note || null, created_by: req.user.id }),
  ]);

  if (updateRes.error) return res.status(500).json({ error: updateRes.error.message });

  if (wasOutOfStock && newStock > 0) {
    const { data: wishlists } = await supabase
      .from('wishlists').select('user_id').eq('product_id', req.params.id);
    if (wishlists && wishlists.length > 0) {
      await supabase.from('notifications').insert(
        wishlists.map(w => ({
          user_id: w.user_id,
          type: 'back_in_stock',
          title: 'Sản phẩm có hàng trở lại',
          body: `"${product.name}" đã có hàng trở lại. Đặt hàng ngay!`,
        }))
      );
    }
  }

  res.json({ product: updateRes.data, new_stock: newStock });
});

// Expiring products — expiry_date stored as "MM/YYYY" text, must parse in Node
router.get('/products/expiring', requireAdmin, async (req, res) => {
  const days = parseInt(req.query.days) || 60;
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);

  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, expiry_date, stock, unit')
    .eq('is_active', true)
    .not('expiry_date', 'is', null);

  if (error) return res.status(500).json({ error: error.message });

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const parsed = (data || [])
    .map(p => {
      const [mm, yyyy] = (p.expiry_date || '').split('/');
      const expiry = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
      const daysLeft = Math.ceil((expiry - today) / 86400000);
      return { ...p, daysLeft, is_expired: daysLeft < 0 };
    })
    .filter(p => !isNaN(p.daysLeft) && p.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 30);

  res.json(parsed);
});

// Low stock products
router.get('/products/low-stock', requireAdmin, async (req, res) => {
  const threshold = Number(req.query.threshold) || 20;
  const { data, error } = await supabase
    .from('products')
    .select('id, name, unit, stock, category')
    .eq('is_active', true)
    .lte('stock', threshold)
    .order('stock', { ascending: true })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.get('/products/:id/stock-log', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('stock_logs')
    .select('*, users(pharmacy_name)')
    .eq('product_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// --- PRODUCT TIERS ---
router.get('/products/:id/tiers', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('product_tiers')
    .select('*')
    .eq('product_id', req.params.id)
    .order('min_qty');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/products/:id/tiers', requireAdmin, async (req, res) => {
  const { tiers } = req.body; // [{ min_qty, price }]
  if (!Array.isArray(tiers)) return res.status(400).json({ error: 'tiers phải là array' });

  // Delete existing tiers then re-insert
  const { error: delErr } = await supabase
    .from('product_tiers')
    .delete()
    .eq('product_id', req.params.id);
  if (delErr) return res.status(500).json({ error: delErr.message });

  if (tiers.length === 0) return res.json([]);

  const rows = tiers.map(t => ({
    product_id: req.params.id,
    min_qty: Number(t.min_qty),
    price: Number(t.price),
  }));

  const { data, error } = await supabase
    .from('product_tiers')
    .insert(rows)
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.sort((a, b) => a.min_qty - b.min_qty));
});

// Admin creates an order on behalf of a customer
router.post('/orders', requireAdmin, async (req, res) => {
  const { user_id, items, shipping_address, note, payment_method = 'cong_no' } = req.body;
  if (!user_id || !items || items.length === 0) {
    return res.status(400).json({ error: 'Thiếu user_id hoặc danh sách sản phẩm' });
  }

  // Fetch customer for address fallback
  const { data: customer } = await supabase.from('users').select('address, pharmacy_name').eq('id', user_id).single();

  // Fetch products to get prices and stock
  const productIds = items.map(i => i.product_id);
  const { data: products } = await supabase.from('products')
    .select('id, name, price, stock, unit, product_tiers(min_qty, price)')
    .in('id', productIds)
    .eq('is_active', true);

  if (!products || products.length === 0) return res.status(400).json({ error: 'Sản phẩm không tồn tại' });

  const productMap = Object.fromEntries(products.map(p => [p.id, p]));

  let totalAmount = 0;
  const orderItems = [];

  for (const item of items) {
    const product = productMap[item.product_id];
    if (!product) continue;
    const qty = Number(item.quantity);
    const tiers = (product.product_tiers || []).sort((a, b) => b.min_qty - a.min_qty);
    const tier = tiers.find(t => qty >= t.min_qty);
    const unitPrice = tier ? tier.price : product.price;
    const totalPrice = unitPrice * qty;
    totalAmount += totalPrice;
    orderItems.push({ product_id: item.product_id, quantity: qty, unit_price: unitPrice, total_price: totalPrice });
  }

  const orderCode = `ADM${Date.now().toString().slice(-8)}`;
  const { data: order, error: oErr } = await supabase.from('orders').insert({
    user_id, order_code: orderCode, status: 'confirmed',
    shipping_address: shipping_address || customer?.address || '',
    note, payment_method, total_amount: totalAmount,
  }).select().single();

  if (oErr) return res.status(500).json({ error: oErr.message });

  const itemsWithOrderId = orderItems.map(i => ({ ...i, order_id: order.id }));
  await supabase.from('order_items').insert(itemsWithOrderId);

  // Notify customer
  const notifBody = `Đơn hàng ${orderCode} đã được tạo và xác nhận bởi JNA.`;
  await supabase.from('notifications').insert({
    user_id, type: 'order_confirmed',
    title: 'Đơn hàng đã được tạo',
    body: notifBody,
    order_id: order.id,
  });
  pushToUser(user_id, { type: 'notification', title: 'Đơn hàng đã được tạo', body: notifBody });

  res.status(201).json(order);
});

// --- ORDERS ---
router.put('/orders/bulk-confirm', requireAdmin, async (req, res) => {
  const { order_ids } = req.body;
  if (!Array.isArray(order_ids) || order_ids.length === 0) {
    return res.status(400).json({ error: 'Thiếu danh sách đơn hàng' });
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'confirmed' })
    .in('id', order_ids)
    .eq('status', 'pending')
    .select('id, user_id, order_code');

  if (error) return res.status(500).json({ error: error.message });

  if (data && data.length > 0) {
    await supabase.from('notifications').insert(
      data.map(o => ({
        user_id: o.user_id, type: 'order_confirmed',
        title: 'Đơn hàng đã xác nhận',
        body: `Đơn ${o.order_code} đang được chuẩn bị.`,
        order_id: o.id,
      }))
    );
    data.forEach(o => pushToUser(o.user_id, { type: 'notification', title: 'Đơn hàng đã xác nhận', body: `Đơn ${o.order_code} đang được chuẩn bị.` }));
  }

  res.json({ confirmed: data?.length || 0 });
});

// Export route MUST be before '/orders' (generic) to avoid route shadowing
router.get('/orders/export', requireAdmin, async (req, res) => {
  const { status, from, to } = req.query;

  let query = supabase
    .from('orders')
    .select(`*, users(pharmacy_name, phone, customer_code), order_items(quantity, unit_price, total_price, products(name, unit))`)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);
  if (req.query.payment_status && req.query.payment_status !== 'all') query = query.eq('payment_status', req.query.payment_status);
  if (from) query = query.gte('created_at', new Date(from).toISOString());
  if (to) {
    const toDate = new Date(to); toDate.setHours(23, 59, 59, 999);
    query = query.lte('created_at', toDate.toISOString());
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const STATUS_VN = { pending: 'Chờ XN', confirmed: 'Đã xác nhận', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy' };
  const PAY_VN = { cong_no: 'Công nợ', cash: 'Tiền mặt', bank: 'Chuyển khoản' };

  const rows = [['Mã đơn', 'Nhà thuốc', 'SĐT', 'Mã KH', 'Ngày đặt', 'Trạng thái', 'Thanh toán', 'TT tiền', 'Sản phẩm', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền', 'Tổng đơn']];
  (data || []).forEach(o => {
    const date = new Date(o.created_at).toLocaleDateString('vi-VN');
    (o.order_items || []).forEach((item, idx) => {
      rows.push([
        idx === 0 ? o.order_code : '',
        idx === 0 ? o.users?.pharmacy_name : '',
        idx === 0 ? o.users?.phone : '',
        idx === 0 ? o.users?.customer_code : '',
        idx === 0 ? date : '',
        idx === 0 ? (STATUS_VN[o.status] || o.status) : '',
        idx === 0 ? (PAY_VN[o.payment_method] || o.payment_method) : '',
        idx === 0 ? (o.payment_status === 'paid' ? 'Đã thu' : 'Chưa thu') : '',
        item.products?.name,
        item.products?.unit,
        item.quantity,
        item.unit_price,
        item.total_price,
        idx === 0 ? o.total_amount : '',
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [12,24,12,10,12,12,12,10,30,8,6,12,14,14].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Đơn hàng');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const label = status && status !== 'all' ? `_${status}` : '';
  res.setHeader('Content-Disposition', `attachment; filename="don_hang${label}_${Date.now()}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

router.get('/orders', requireAdmin, async (req, res) => {
  const { status, page = 1, limit = 20, from, to } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('orders')
    .select(`
      *,
      users (id, pharmacy_name, phone, customer_code),
      order_items (
        id, quantity, unit_price, total_price,
        products (id, name, unit)
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (req.query.user_id) query = query.eq('user_id', req.query.user_id);
  if (status && status !== 'all') query = query.eq('status', status);
  if (req.query.payment_status && req.query.payment_status !== 'all') query = query.eq('payment_status', req.query.payment_status);
  if (from) query = query.gte('created_at', new Date(from).toISOString());
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    query = query.lte('created_at', toDate.toISOString());
  }
  if (req.query.search) {
    const s = req.query.search;
    const { data: matchedUsers } = await supabase
      .from('users').select('id').ilike('pharmacy_name', `%${s}%`);
    const userIds = (matchedUsers || []).map(u => u.id);
    if (userIds.length > 0) {
      query = query.or(`order_code.ilike.%${s}%,user_id.in.(${userIds.join(',')})`);
    } else {
      query = query.ilike('order_code', `%${s}%`);
    }
  }

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ orders: data, total: count });
});

const STATUS_TO_NOTIF = {
  confirmed: 'order_confirmed',
  shipping:  'order_shipping',
  delivered: 'order_delivered',
  cancelled: 'order_cancelled',
};

router.put('/orders/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', req.params.id)
    .select('id, user_id, order_code')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const notifType = STATUS_TO_NOTIF[status];
  if (notifType && data) {
    const TITLES = { order_confirmed: 'Đơn hàng đã xác nhận', order_shipping: 'Đơn hàng đang giao', order_delivered: 'Đơn hàng đã giao', order_cancelled: 'Đơn hàng đã hủy' };
    const BODIES = { order_confirmed: `Đơn ${data.order_code} đang được chuẩn bị.`, order_shipping: `Đơn ${data.order_code} đã bàn giao cho đơn vị vận chuyển.`, order_delivered: `Đơn ${data.order_code} đã giao thành công. Cảm ơn bạn!`, order_cancelled: `Đơn ${data.order_code} đã bị hủy.` };
    await supabase.from('notifications').insert({ user_id: data.user_id, type: notifType, title: TITLES[notifType], body: BODIES[notifType], order_id: data.id });
    pushToUser(data.user_id, { type: 'notification', title: TITLES[notifType], body: BODIES[notifType] });
  }

  res.json(data);
});

router.put('/orders/:id/payment', requireAdmin, async (req, res) => {
  const { payment_status } = req.body;
  if (!['unpaid', 'paid'].includes(payment_status)) {
    return res.status(400).json({ error: 'Trạng thái thanh toán không hợp lệ' });
  }

  const updates = {
    payment_status,
    paid_at: payment_status === 'paid' ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// --- USERS ---
router.get('/users', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, phone, pharmacy_name, customer_code, address, role, is_active, registration_status, tier, credit_limit, business_license_url, pharma_license_url, created_at')
    .eq('registration_status', 'approved')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// --- REGISTRATIONS (pending approval) ---
router.get('/registrations', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, phone, pharmacy_name, address, business_license_url, pharma_license_url, registration_status, created_at')
    .in('registration_status', ['pending', 'rejected'])
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/registrations/:id/approve', requireAdmin, async (req, res) => {
  const { customer_code } = req.body;
  const { data, error } = await supabase
    .from('users')
    .update({ registration_status: 'approved', is_active: true, customer_code: customer_code || null })
    .eq('id', req.params.id)
    .select('id, phone, pharmacy_name')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/registrations/:id/reject', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .update({ registration_status: 'rejected', is_active: false })
    .eq('id', req.params.id)
    .select('id')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/users', requireAdmin, async (req, res) => {
  const { phone, password, pharmacy_name, customer_code, address, role = 'customer' } = req.body;
  if (!phone || !password || !pharmacy_name) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

  const password_hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('users')
    .insert({ phone, password_hash, pharmacy_name, customer_code, address, role, is_active: true, registration_status: 'approved' })
    .select('id, phone, pharmacy_name, customer_code, address, role, is_active')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Số điện thoại đã tồn tại' });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

router.put('/users/:id', requireAdmin, async (req, res) => {
  const updates = { ...req.body };
  if (updates.password) {
    updates.password_hash = await bcrypt.hash(updates.password, 10);
    delete updates.password;
  }
  delete updates.id;

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.params.id)
    .select('id, phone, pharmacy_name, customer_code, address, role, is_active')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// --- DEBT REPORT ---
router.get('/debt-report', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('user_id, total_amount, payment_status, status, users(pharmacy_name, phone, customer_code)')
    .neq('status', 'cancelled');

  if (error) return res.status(500).json({ error: error.message });

  const map = {};
  (data || []).forEach(o => {
    const uid = o.user_id;
    if (!map[uid]) {
      map[uid] = {
        user_id: uid,
        pharmacy_name: o.users?.pharmacy_name,
        phone: o.users?.phone,
        customer_code: o.users?.customer_code,
        total_orders: 0,
        total_amount: 0,
        paid_amount: 0,
        unpaid_amount: 0,
      };
    }
    map[uid].total_orders++;
    map[uid].total_amount += o.total_amount;
    if (o.payment_status === 'paid') {
      map[uid].paid_amount += o.total_amount;
    } else {
      map[uid].unpaid_amount += o.total_amount;
    }
  });

  const report = Object.values(map).sort((a, b) => b.unpaid_amount - a.unpaid_amount);
  res.json(report);
});

// Export debt report to Excel
router.get('/debt-report/export', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('user_id, total_amount, payment_status, status, users(pharmacy_name, phone, customer_code)')
    .neq('status', 'cancelled');

  if (error) return res.status(500).json({ error: error.message });

  const map = {};
  (data || []).forEach(o => {
    const uid = o.user_id;
    if (!map[uid]) map[uid] = { pharmacy_name: o.users?.pharmacy_name, phone: o.users?.phone, customer_code: o.users?.customer_code, total: 0, paid: 0, unpaid: 0, orders: 0 };
    map[uid].orders++;
    map[uid].total += o.total_amount;
    if (o.payment_status === 'paid') map[uid].paid += o.total_amount;
    else map[uid].unpaid += o.total_amount;
  });

  const rows = [['Nhà thuốc', 'SĐT', 'Mã KH', 'Số đơn', 'Tổng đơn', 'Đã thanh toán', 'Công nợ']];
  Object.values(map).sort((a, b) => b.unpaid - a.unpaid).forEach(r => {
    rows.push([r.pharmacy_name, r.phone, r.customer_code || '', r.orders, r.total, r.paid, r.unpaid]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Công nợ');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="cong_no_${Date.now()}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// --- BROADCAST NOTIFICATION ---
router.post('/notifications/broadcast', requireAdmin, async (req, res) => {
  const { title, body, user_ids } = req.body;
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung' });

  let targets;
  if (user_ids && user_ids.length > 0) {
    // Send to specific users
    targets = user_ids;
  } else {
    // Send to all active customers
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'customer')
      .eq('is_active', true);
    targets = (users || []).map(u => u.id);
  }

  if (targets.length === 0) return res.status(400).json({ error: 'Không có khách hàng nào' });

  const rows = targets.map(uid => ({
    user_id: uid,
    type: 'broadcast',
    title: title.trim(),
    body: body.trim(),
    is_read: false,
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ sent: targets.length });
});

// Monthly revenue report
router.get('/stats/revenue-monthly', requireAdmin, async (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months) || 12, 3), 24);
  const now = new Date();
  const result = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data } = await supabase
      .from('orders')
      .select('total_amount, status, payment_status')
      .eq('status', 'delivered')
      .gte('created_at', start)
      .lte('created_at', end);

    const revenue = (data || []).reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const orders  = (data || []).length;
    const paid    = (data || []).filter(o => o.payment_status === 'paid').reduce((s, o) => s + Number(o.total_amount || 0), 0);

    result.push({
      month: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
      revenue,
      orders,
      paid,
      unpaid: revenue - paid,
    });
  }

  res.json(result);
});

// Dashboard stats
router.get('/stats', requireAdmin, async (req, res) => {
  const chartDays = Math.min(Math.max(Number(req.query.chart_days) || 7, 7), 90);
  const now = new Date();
  const day30ago = new Date(now - 30 * 86400000).toISOString();
  const dayNago  = new Date(now - chartDays * 86400000).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [usersRes, ordersRes, productsRes, revenueRes, pendingRes, revenueChartRes, topProductsRes, topUsersRes, todayOrdersRes, todayRevenueRes] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact' }).eq('role', 'customer'),
    supabase.from('orders').select('id', { count: 'exact' }),
    supabase.from('products').select('id', { count: 'exact' }).eq('is_active', true),
    supabase.from('orders').select('total_amount').eq('status', 'delivered'),
    supabase.from('orders').select('id', { count: 'exact' }).eq('status', 'pending'),
    // Revenue per day for chart period (delivered orders)
    supabase.from('orders').select('total_amount, created_at').eq('status', 'delivered').gte('created_at', dayNago),
    // Top products by qty sold (last 30 days)
    supabase.from('order_items').select('quantity, unit_price, products(name, unit), orders(status, created_at)')
      .gte('orders.created_at', day30ago),
    // Top customers by spend (last 30 days)
    supabase.from('orders').select('total_amount, users(pharmacy_name)').eq('status', 'delivered').gte('created_at', day30ago),
    // Today's orders count
    supabase.from('orders').select('id', { count: 'exact' }).gte('created_at', todayStart),
    // Today's revenue (delivered)
    supabase.from('orders').select('total_amount').eq('status', 'delivered').gte('created_at', todayStart),
  ]);

  const totalRevenue = (revenueRes.data || []).reduce((s, o) => s + o.total_amount, 0);
  const todayRevenue = (todayRevenueRes.data || []).reduce((s, o) => s + o.total_amount, 0);

  // Build revenue by day (last chartDays days)
  const revenueByDay = {};
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    revenueByDay[key] = 0;
  }
  (revenueChartRes.data || []).forEach(o => {
    const key = new Date(o.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    if (key in revenueByDay) revenueByDay[key] += o.total_amount;
  });
  const revenueChart = Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue }));

  // Top 5 products
  const productMap = {};
  (topProductsRes.data || []).forEach(item => {
    if (!item.orders || item.orders.status !== 'delivered') return;
    const name = item.products?.name || 'Unknown';
    if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0, unit: item.products?.unit || '' };
    productMap[name].qty += item.quantity;
    productMap[name].revenue += item.quantity * item.unit_price;
  });
  const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Top 5 customers
  const customerMap = {};
  (topUsersRes.data || []).forEach(o => {
    const name = o.users?.pharmacy_name || 'Unknown';
    if (!customerMap[name]) customerMap[name] = { name, total: 0 };
    customerMap[name].total += o.total_amount;
  });
  const topCustomers = Object.values(customerMap).sort((a, b) => b.total - a.total).slice(0, 5);

  res.json({
    total_users: usersRes.count || 0,
    total_orders: ordersRes.count || 0,
    total_products: productsRes.count || 0,
    total_revenue: totalRevenue,
    pending_orders: pendingRes.count || 0,
    today_orders: todayOrdersRes.count || 0,
    today_revenue: todayRevenue,
    revenue_chart: revenueChart,
    top_products: topProducts,
    top_customers: topCustomers,
  });
});

// --- STOCK REPORT ---

// Summary: group by product, totals per reason, chart by day
router.get('/stock/report', requireAdmin, async (req, res) => {
  const { from, to, reason } = req.query;

  let query = supabase
    .from('stock_logs')
    .select('id, change_qty, reason, note, created_at, product_id, products(id, name, unit, category, stock)')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (from) query = query.gte('created_at', new Date(from).toISOString());
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    query = query.lte('created_at', toDate.toISOString());
  }
  if (reason && reason !== 'all') query = query.eq('reason', reason);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Group by product
  const byProduct = {};
  (data || []).forEach(log => {
    const p = log.products;
    if (!p) return;
    if (!byProduct[p.id]) {
      byProduct[p.id] = {
        product_id: p.id, name: p.name, unit: p.unit,
        category: p.category, current_stock: p.stock,
        import_qty: 0, export_qty: 0, adjustment_qty: 0, order_qty: 0,
      };
    }
    const e = byProduct[p.id];
    if (log.reason === 'import')     e.import_qty     += log.change_qty;
    else if (log.reason === 'export') e.export_qty     += Math.abs(log.change_qty);
    else if (log.reason === 'adjustment') e.adjustment_qty += log.change_qty;
    else if (log.reason === 'order')  e.order_qty      += Math.abs(log.change_qty);
  });

  // Chart: daily in/out totals
  const byDay = {};
  (data || []).forEach(log => {
    const day = log.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { date: day, in: 0, out: 0 };
    if (log.change_qty > 0) byDay[day].in  += log.change_qty;
    else                    byDay[day].out += Math.abs(log.change_qty);
  });
  const chart = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

  // Summary: only products that had activity
  const summary = Object.values(byProduct).sort((a, b) => a.name.localeCompare(b.name));

  res.json({ summary, chart, total_logs: (data || []).length });
});

// Export stock report to Excel
router.get('/stock/report/export', requireAdmin, async (req, res) => {
  const { from, to, reason } = req.query;

  let query = supabase
    .from('stock_logs')
    .select('change_qty, reason, note, created_at, products(name, unit, category), users(pharmacy_name)')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (from) query = query.gte('created_at', new Date(from).toISOString());
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    query = query.lte('created_at', toDate.toISOString());
  }
  if (reason && reason !== 'all') query = query.eq('reason', reason);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const REASON_VN = { import: 'Nhập hàng', export: 'Xuất hàng', adjustment: 'Điều chỉnh', order: 'Đơn hàng' };

  const rows = [['Ngày', 'Sản phẩm', 'Danh mục', 'ĐVT', 'Lý do', 'Số lượng', 'Ghi chú', 'Người thực hiện']];
  (data || []).forEach(log => {
    rows.push([
      new Date(log.created_at).toLocaleDateString('vi-VN'),
      log.products?.name || '',
      log.products?.category || '',
      log.products?.unit || '',
      REASON_VN[log.reason] || log.reason,
      log.change_qty,
      log.note || '',
      log.users?.pharmacy_name || 'System',
    ]);
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Xuất nhập kho');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="bao-cao-kho.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

module.exports = router;
