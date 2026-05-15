const express = require('express');
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const TIER_DISCOUNT = { dong: 0, bac: 2, vang: 5, kim_cuong: 8 };

const NOTIF_TEMPLATES = {
  order_placed:    (code) => ({ title: 'Đặt hàng thành công', body: `Đơn ${code} đã được tạo, đang chờ xác nhận.` }),
  order_confirmed: (code) => ({ title: 'Đơn hàng đã xác nhận', body: `Đơn ${code} đang được chuẩn bị.` }),
  order_shipping:  (code) => ({ title: 'Đơn hàng đang giao', body: `Đơn ${code} đã bàn giao cho đơn vị vận chuyển.` }),
  order_delivered: (code) => ({ title: 'Đơn hàng đã giao', body: `Đơn ${code} đã giao thành công. Cảm ơn bạn!` }),
  order_cancelled: (code) => ({ title: 'Đơn hàng đã hủy', body: `Đơn ${code} đã bị hủy.` }),
};

async function createNotification(userId, type, orderCode, orderId) {
  const tmpl = NOTIF_TEMPLATES[type];
  if (!tmpl) return;
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    ...tmpl(orderCode),
    order_id: orderId,
  });
}

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { status } = req.query;

  let query = supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id, quantity, unit_price, total_price,
        products (id, name, unit, image_url)
      )
    `)
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/stats', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('total_amount, status, payment_status, payment_method')
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  const total_orders = data.length;
  const total_amount = data.reduce((s, o) => s + (o.total_amount || 0), 0);
  const pending = data.filter(o => o.status === 'pending').length;
  const delivered = data.filter(o => o.status === 'delivered').length;
  const unpaid_amount = data
    .filter(o => o.payment_status === 'unpaid' && o.status !== 'cancelled')
    .reduce((s, o) => s + (o.total_amount || 0), 0);
  res.json({ total_orders, total_amount, pending, delivered, unpaid_amount });
});

router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id, quantity, unit_price, total_price,
        products (id, name, unit, price, image_url, product_tiers(id, min_qty, price))
      )
    `)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  res.json(data);
});

router.post('/', requireAuth, async (req, res) => {
  const { items, shipping_address, note, payment_method } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Giỏ hàng trống' });
  }

  const productIds = items.map((i) => i.product_id);
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('id, name, price, is_active, product_tiers(min_qty, price)')
    .in('id', productIds);

  if (pErr) return res.status(500).json({ error: pErr.message });

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  for (const item of items) {
    const p = productMap[item.product_id];
    if (!p || !p.is_active) {
      return res.status(400).json({ error: `Sản phẩm không tồn tại hoặc đã ngừng kinh doanh` });
    }
  }

  // Lấy tier của user để tính discount
  const { data: userData } = await supabase
    .from('users')
    .select('tier')
    .eq('id', req.user.id)
    .single();
  const discountPct = TIER_DISCOUNT[userData?.tier || 'dong'] || 0;

  const getQtyTierPrice = (product, qty) => {
    const tiers = (product.product_tiers || []).sort((a, b) => b.min_qty - a.min_qty);
    const matched = tiers.find(t => qty >= t.min_qty);
    return matched ? matched.price : product.price;
  };

  const orderItems = items.map((item) => {
    const product = productMap[item.product_id];
    const basePrice = getQtyTierPrice(product, item.quantity);
    const unit_price = Math.round(basePrice * (1 - discountPct / 100));
    return {
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price,
      total_price: unit_price * item.quantity,
    };
  });

  const total_amount = orderItems.reduce((sum, i) => sum + i.total_price, 0);

  const orderCode = `DH${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;

  const { data: order, error: oErr } = await supabase
    .from('orders')
    .insert({
      user_id: req.user.id,
      order_code: orderCode,
      total_amount,
      shipping_address,
      note,
      payment_method: payment_method || 'cong_no',
      status: 'pending',
    })
    .select()
    .single();

  if (oErr) return res.status(500).json({ error: oErr.message });

  const itemsWithOrderId = orderItems.map((i) => ({ ...i, order_id: order.id }));
  const { error: iErr } = await supabase.from('order_items').insert(itemsWithOrderId);
  if (iErr) return res.status(500).json({ error: iErr.message });

  await createNotification(req.user.id, 'order_placed', order.order_code, order.id);

  res.status(201).json(order);
});

// POST /api/orders/pricelist — đặt hàng từ bảng báo giá
router.post('/pricelist', requireAuth, async (req, res) => {
  const { items, shipping_address, note } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Chưa chọn sản phẩm' });
  }

  const total_amount = items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
  const orderCode = `BG${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;

  const noteLines = items.map((i, idx) =>
    `${idx + 1}. ${i.name} [${i.unit}] x${i.quantity} = ${(Number(i.price) * Number(i.quantity)).toLocaleString('vi-VN')}đ`
  );
  const fullNote = `[Đặt từ Báo giá]\n${noteLines.join('\n')}${note ? '\nGhi chú: ' + note : ''}`;

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      user_id: req.user.id,
      order_code: orderCode,
      total_amount,
      shipping_address: shipping_address || '',
      note: fullNote,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(order);
});

// Customer cancel pending order
router.put('/:id/cancel', requireAuth, async (req, res) => {
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id, status, user_id, order_code')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (fetchErr || !order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  if (order.status !== 'pending') return res.status(400).json({ error: 'Chỉ có thể hủy đơn đang chờ xác nhận' });

  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', order.id);

  if (error) return res.status(500).json({ error: error.message });
  await createNotification(req.user.id, 'order_cancelled', order.order_code, order.id);
  res.json({ success: true });
});

module.exports = router;
