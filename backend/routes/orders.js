const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const { pushToUser } = require('../lib/sseClients');

// Resolve a Vietnamese-capable font; fall back to Helvetica if not found
const FONT_CANDIDATES = [
  path.join(__dirname, '../fonts/Roboto-Regular.ttf'),
  'C:\\Windows\\Fonts\\segoeui.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
];
const VN_FONT = FONT_CANDIDATES.find(f => fs.existsSync(f)) || null;

const TIER_DISCOUNT = { dong: 0, bac: 2, vang: 5, kim_cuong: 8 };

const NOTIF_TEMPLATES = {
  order_placed:    (code) => ({ title: 'Đặt hàng thành công', body: `Đơn ${code} đã được tạo, đang chờ xác nhận.` }),
  order_confirmed: (code) => ({ title: 'Đơn hàng đã xác nhận', body: `Đơn ${code} đang được chuẩn bị.` }),
  order_shipping:  (code) => ({ title: 'Đơn hàng đang giao', body: `Đơn ${code} đã bàn giao cho đơn vị vận chuyển.` }),
  order_delivered: (code) => ({ title: 'Đơn hàng đã giao', body: `Đơn ${code} đã giao thành công. Cảm ơn bạn!` }),
  order_cancelled: (code) => ({ title: 'Đơn hàng đã hủy', body: `Đơn ${code} đã bị hủy.` }),
};

async function checkCreditLimit(userId, newOrderTotal) {
  const { data: user } = await supabase.from('users').select('credit_limit').eq('id', userId).single();
  const limit = Number(user?.credit_limit || 0);
  if (limit === 0) return null;

  const { data: unpaid } = await supabase
    .from('orders').select('total_amount')
    .eq('user_id', userId).eq('payment_status', 'unpaid').neq('status', 'cancelled');

  const currentDebt = (unpaid || []).reduce((s, o) => s + Number(o.total_amount || 0), 0);
  if (currentDebt + newOrderTotal > limit) {
    return { error: 'Vượt hạn mức công nợ', credit_limit: limit, current_debt: currentDebt, order_total: newOrderTotal };
  }
  return null;
}

async function createNotification(userId, type, orderCode, orderId) {
  const tmpl = NOTIF_TEMPLATES[type];
  if (!tmpl) return;
  const notif = { user_id: userId, type, ...tmpl(orderCode), order_id: orderId };
  await supabase.from('notifications').insert(notif);
  pushToUser(userId, { type: 'notification', title: notif.title, body: notif.body });
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

// Order templates — GET must be BEFORE /:id or Express will match 'templates' as an id
router.get('/templates', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('order_templates')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
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

  const creditErr = await checkCreditLimit(req.user.id, total_amount);
  if (creditErr) return res.status(402).json(creditErr);

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

  const creditErr = await checkCreditLimit(req.user.id, total_amount);
  if (creditErr) return res.status(402).json(creditErr);

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

  await createNotification(req.user.id, 'order_placed', order.order_code, order.id);

  res.status(201).json(order);
});

// PDF invoice download
router.get('/:id/pdf', requireAuth, async (req, res) => {
  const { data: order, error } = await supabase
    .from('orders')
    .select(`*, order_items(id, quantity, unit_price, total_price, products(id, name, unit))`)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (error || !order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

  const { data: customer } = await supabase
    .from('users')
    .select('pharmacy_name, phone, address')
    .eq('id', req.user.id)
    .single();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="hoa-don-${order.order_code}.pdf"`);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  const font = (bold) => {
    if (VN_FONT) { doc.font(VN_FONT); return; }
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
  };

  // Header
  font(true);
  doc.fontSize(20).fillColor('#16a34a').text('JNA PHARMA', { align: 'center' });
  doc.fontSize(13).fillColor('#374151').text('Công ty TNHH Dược phẩm JNA', { align: 'center' });
  doc.fontSize(11).fillColor('#6b7280').text('ĐT: 0966 050 306', { align: 'center' });
  doc.moveDown(0.5);

  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);

  font(true);
  doc.fontSize(16).fillColor('#1f2937').text('HOA DON BAN HANG', { align: 'center' });
  doc.moveDown(0.5);

  // Order info
  const date = new Date(order.created_at);
  const dateStr = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;

  const PAYMENT_LABELS = { cong_no: 'Cong no', cash: 'Tien mat', bank: 'Chuyen khoan' };

  doc.fontSize(11).fillColor('#374151');
  const leftX = 40; const rightX = 300;
  const startY = doc.y;

  font(false);
  doc.text(`Ma don: `, leftX, startY, { continued: true });
  font(true); doc.text(order.order_code);
  font(false);
  doc.text(`Ngay: `, leftX, doc.y, { continued: true });
  font(false); doc.text(dateStr);
  doc.text(`Thanh toan: `, leftX, doc.y, { continued: true });
  doc.text(PAYMENT_LABELS[order.payment_method] || order.payment_method);

  doc.text(`Khach hang: `, rightX, startY, { continued: true });
  font(true); doc.text(customer?.pharmacy_name || '');
  font(false);
  doc.text(`SDT: `, rightX, doc.y < startY + 40 ? startY + 18 : doc.y, { continued: true });
  doc.text(customer?.phone || '');

  doc.moveDown(1);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);

  // Table header
  const cols = { stt: 40, name: 70, qty: 360, price: 400, total: 460 };
  const headerY = doc.y;
  doc.rect(40, headerY, 515, 20).fill('#16a34a');
  font(true);
  doc.fillColor('#fff').fontSize(10)
    .text('STT',          cols.stt,   headerY + 5, { lineBreak: false })
    .text('Ten san pham', cols.name,  headerY + 5, { lineBreak: false })
    .text('SL',           cols.qty,   headerY + 5, { lineBreak: false })
    .text('Don gia',      cols.price, headerY + 5, { lineBreak: false })
    .text('Thanh tien',   cols.total, headerY + 5);

  let rowY = headerY + 22;

  // Table rows
  (order.order_items || []).forEach((item, idx) => {
    const bg = idx % 2 === 0 ? '#f9fafb' : '#ffffff';
    const rowH = 22;
    doc.rect(40, rowY, 515, rowH).fill(bg);
    font(false);
    doc.fillColor('#1f2937').fontSize(9)
      .text(String(idx + 1), cols.stt, rowY + 6)
      .text((item.products?.name || '').slice(0, 40), cols.name, rowY + 6, { width: 280 })
      .text(String(item.quantity), cols.qty, rowY + 6)
      .text(item.unit_price?.toLocaleString('en-US'), cols.price, rowY + 6)
      .text(item.total_price?.toLocaleString('en-US'), cols.total, rowY + 6);
    rowY += rowH;
  });

  // Total row
  doc.rect(40, rowY, 515, 24).fill('#dcfce7');
  font(true);
  doc.fillColor('#15803d').fontSize(11)
    .text('TONG CONG:', cols.name, rowY + 6, { width: 340 })
    .text(order.total_amount?.toLocaleString('en-US') + ' VND', cols.total - 10, rowY + 6, { width: 120, align: 'right' });

  const footerY = rowY + 50;
  doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);

  font(false);
  doc.fontSize(9).fillColor('#9ca3af')
    .text('Cam on quy khach da dat hang tai JNA Pharma!', 40, footerY + 10, { align: 'center', width: 515 })
    .text('Lien he: 0966 050 306 | Email: info@jnapharma.vn', 40, footerY + 22, { align: 'center', width: 515 });

  doc.end();
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

// Order templates (POST and DELETE — GET is defined above before /:id)
router.post('/templates', requireAuth, async (req, res) => {
  const { name, items } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Tên mẫu đơn không được trống' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Mẫu đơn phải có ít nhất 1 sản phẩm' });

  const { data, error } = await supabase
    .from('order_templates')
    .insert({ user_id: req.user.id, name: name.trim(), items })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.delete('/templates/:id', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('order_templates')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
