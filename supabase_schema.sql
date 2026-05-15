-- ============================================================
-- SCHEMA: Pharma B2B Ordering Platform
-- Chạy file này trong Supabase SQL Editor (supabase.com/dashboard)
-- ============================================================

-- 1. USERS (khách hàng và admin)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  pharmacy_name TEXT NOT NULL,
  customer_code TEXT,
  address TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PRODUCTS (sản phẩm / bảng giá)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active_ingredient TEXT,
  unit TEXT NOT NULL,
  price NUMERIC(15,0) NOT NULL,
  original_price NUMERIC(15,0),
  image_url TEXT,
  expiry_date TEXT,
  category TEXT,
  stock INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ORDERS (đơn hàng)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  order_code TEXT UNIQUE NOT NULL,
  total_amount NUMERIC(15,0) NOT NULL,
  shipping_address TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','shipping','delivered','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORDER_ITEMS (chi tiết đơn hàng)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(15,0) NOT NULL,
  total_price NUMERIC(15,0) NOT NULL
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ============================================================
-- SEED: Tài khoản Admin mặc định
-- Mật khẩu: Admin@123  (hash bcrypt rounds=10)
-- ĐỔI MẬT KHẨU ngay sau khi đăng nhập lần đầu!
-- ============================================================
INSERT INTO users (phone, password_hash, pharmacy_name, role, is_active)
VALUES (
  '0900000000',
  '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36Zl4kJNGpLzLpCxNE7WkHm',
  'Admin System',
  'admin',
  true
) ON CONFLICT (phone) DO NOTHING;

-- ============================================================
-- SEED: Một số sản phẩm mẫu
-- ============================================================
INSERT INTO products (name, active_ingredient, unit, price, original_price, expiry_date, category) VALUES
  ('Drosperin 0,03mg, Abbott, H/28v, Vat', 'Drospirenone', 'Hộp', 158000, 150000, '06/2028', 'Thuốc'),
  ('Protoloc Gel, Tube 20g, Vat', 'Pantoprazole', 'Tuýp', 58000, 45900, '10/2028', 'Thuốc'),
  ('Coversyl 10mg, Servier, C/30v, Date 2028', 'Perindopril', 'Chai', 269000, 251000, '12/2028', 'Thuốc'),
  ('Bisacodyl 5mg, Thành Nam, H/50v', 'Bisacodyl', 'Hộp', 24970, 20000, '08/2027', 'Thuốc'),
  ('Paracetamol 500mg, H/100v', 'Paracetamol', 'Hộp', 15000, 12000, '01/2028', 'Thuốc'),
  ('Vitamin C 1000mg, H/30v', 'Ascorbic Acid', 'Hộp', 85000, 75000, '03/2028', 'Thực phẩm chức năng')
ON CONFLICT DO NOTHING;
