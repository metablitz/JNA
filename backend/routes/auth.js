const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Thiếu thông tin' });

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();

  if (error || !user) return res.status(401).json({ error: 'Số điện thoại hoặc mật khẩu không đúng' });
  if (user.registration_status === 'pending') return res.status(403).json({ error: 'Tài khoản đang chờ xét duyệt. Chúng tôi sẽ liên hệ trong 1–2 ngày làm việc.' });
  if (user.registration_status === 'rejected') return res.status(403).json({ error: 'Hồ sơ đăng ký đã bị từ chối. Vui lòng liên hệ hotline 0966 050 306.' });
  if (!user.is_active) return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ.' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Số điện thoại hoặc mật khẩu không đúng' });

  const token = jwt.sign(
    { id: user.id, phone: user.phone, role: user.role, name: user.pharmacy_name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      phone: user.phone,
      role: user.role,
      pharmacy_name: user.pharmacy_name,
      customer_code: user.customer_code,
      address: user.address,
      tier: user.tier || 'dong',
      credit_limit: user.credit_limit || 0,
    },
  });
});

router.post('/register', async (req, res) => {
  const { phone, password, pharmacy_name, address, business_license_url, pharma_license_url } = req.body;
  if (!phone || !password || !pharmacy_name || !address || !business_license_url || !pharma_license_url) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin và tải lên 2 giấy phép' });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('users')
    .insert({
      phone, password_hash, pharmacy_name, address,
      business_license_url, pharma_license_url,
      role: 'customer', is_active: false, registration_status: 'pending',
    })
    .select('id, phone, pharmacy_name')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Số điện thoại này đã được đăng ký' });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json({ message: 'Đăng ký thành công! Chờ admin xét duyệt (1-2 ngày làm việc).', user: data });
});

router.get('/me', requireAuth, async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('id, phone, role, pharmacy_name, customer_code, address, is_active, tier, credit_limit')
    .eq('id', req.user.id)
    .single();

  res.json(user);
});

router.put('/profile', requireAuth, async (req, res) => {
  const { pharmacy_name, address } = req.body;
  if (!pharmacy_name?.trim()) return res.status(400).json({ error: 'Tên nhà thuốc không được trống' });

  const { data, error } = await supabase
    .from('users')
    .update({ pharmacy_name: pharmacy_name.trim(), address: address?.trim() || null })
    .eq('id', req.user.id)
    .select('id, phone, role, pharmacy_name, customer_code, address, is_active, tier, credit_limit')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Thiếu thông tin' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Mật khẩu mới tối thiểu 6 ký tự' });

  const { data: user } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', req.user.id)
    .single();

  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng' });

  const password_hash = await bcrypt.hash(new_password, 10);
  const { error } = await supabase
    .from('users')
    .update({ password_hash })
    .eq('id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
