-- ============================================================
-- SCHEMA HOÀN CHỈNH: JNA Pharma B2B Ordering Platform
-- Chạy file này trong Supabase SQL Editor lần đầu thiết lập
-- ============================================================

-- 1. USERS (khách hàng và admin)
CREATE TABLE IF NOT EXISTS users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                TEXT UNIQUE NOT NULL,
  password_hash        TEXT NOT NULL,
  pharmacy_name        TEXT NOT NULL,
  customer_code        TEXT,
  address              TEXT,
  role                 TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  registration_status  TEXT CHECK (registration_status IN ('pending', 'approved', 'rejected')),
  tier                 TEXT NOT NULL DEFAULT 'dong' CHECK (tier IN ('dong', 'bac', 'vang', 'kim_cuong')),
  credit_limit         NUMERIC(15,0) NOT NULL DEFAULT 0,
  business_license_url TEXT,
  pharma_license_url   TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PRODUCTS (sản phẩm)
CREATE TABLE IF NOT EXISTS products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  active_ingredient TEXT,
  unit             TEXT NOT NULL,
  price            NUMERIC(15,0) NOT NULL,
  original_price   NUMERIC(15,0),
  image_url        TEXT,
  expiry_date      TEXT,
  category         TEXT,
  stock            INTEGER DEFAULT 0,
  barcode          TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRODUCT_TIERS (bậc giá theo số lượng)
CREATE TABLE IF NOT EXISTS product_tiers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_qty    INTEGER NOT NULL CHECK (min_qty > 1),
  price      NUMERIC(15,0) NOT NULL CHECK (price > 0)
);

-- 4. ORDERS (đơn hàng)
CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),
  order_code       TEXT UNIQUE NOT NULL,
  total_amount     NUMERIC(15,0) NOT NULL,
  shipping_address TEXT,
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','shipping','delivered','cancelled')),
  payment_method   TEXT NOT NULL DEFAULT 'cong_no'
                   CHECK (payment_method IN ('cong_no','cash','bank')),
  payment_status   TEXT NOT NULL DEFAULT 'unpaid'
                   CHECK (payment_status IN ('unpaid','paid')),
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ORDER_ITEMS (chi tiết đơn hàng)
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(15,0) NOT NULL,
  total_price NUMERIC(15,0) NOT NULL
);

-- 6. PRICE_LIST (bảng báo giá theo danh mục)
CREATE TABLE IF NOT EXISTS price_list (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category   TEXT NOT NULL,
  name       TEXT NOT NULL,
  nhom       TEXT,
  unit       TEXT,
  price      NUMERIC(15,0) DEFAULT 0,
  vi_price   NUMERIC(15,0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. WISHLISTS (sản phẩm yêu thích)
CREATE TABLE IF NOT EXISTS wishlists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

-- 8. NOTIFICATIONS (thông báo)
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  order_id   UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. MESSAGES (chat khách hàng ↔ admin)
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'admin')),
  content     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 10. STOCK_LOGS (lịch sử xuất nhập kho)
CREATE TABLE IF NOT EXISTS stock_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  change_qty INTEGER NOT NULL,
  reason     TEXT NOT NULL CHECK (reason IN ('import','export','adjustment','order')),
  note       TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_phone             ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_reg_status        ON users(registration_status);
CREATE INDEX IF NOT EXISTS idx_products_active         ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_barcode        ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_tiers_product   ON product_tiers(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id          ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status           ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status   ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id    ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id  ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_price_list_category     ON price_list(category);
CREATE INDEX IF NOT EXISTS idx_wishlists_user          ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id    ON wishlists(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user      ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_order_id  ON notifications(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_user           ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_product      ON stock_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_created_by   ON stock_logs(created_by) WHERE created_by IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- All access goes through the Express backend (service_role key).
-- Enabling RLS with no anon policies = deny-by-default for direct
-- Data API access while the backend continues to work unchanged.
-- ============================================================
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list    ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_logs    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STORAGE BUCKET POLICIES
-- (Create buckets manually in Supabase dashboard, then apply)
-- ============================================================
-- Bucket 'licenses' (public) — no listing policy needed;
--   file URLs are accessible directly, upload via backend service_role.
-- Bucket 'products' (public) — no listing policy needed;
--   product image URLs are accessible directly, upload via backend service_role.

-- ============================================================
-- SEED: Tài khoản Admin mặc định
-- Mật khẩu: Admin@123  (bcrypt rounds=10)
-- ĐỔI MẬT KHẨU ngay sau khi đăng nhập lần đầu!
-- ============================================================
INSERT INTO users (phone, password_hash, pharmacy_name, role, is_active, registration_status)
VALUES (
  '0900000000',
  '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36Zl4kJNGpLzLpCxNE7WkHm',
  'Admin System',
  'admin',
  true,
  'approved'
) ON CONFLICT (phone) DO NOTHING;
