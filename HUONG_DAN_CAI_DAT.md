# Hướng dẫn cài đặt Website Đặt Hàng Dược Phẩm JNA

## Cấu trúc project

```
JNA/
├── frontend/            # React + Vite (giao diện người dùng)
├── backend/             # Node.js + Express (API server)
├── supabase_schema.sql  # SQL tạo 11 bảng trong Supabase
└── HUONG_DAN_CAI_DAT.md
```

---

## BƯỚC 1: Tạo project Supabase

1. Truy cập https://supabase.com → Đăng nhập → **New Project**
2. Điền tên project, mật khẩu database → **Create new project**
3. Vào **SQL Editor** → Paste nội dung file `supabase_schema.sql` → **Run**
4. Lấy thông tin kết nối tại **Settings → API**:
   - `Project URL` → dùng cho `SUPABASE_URL`
   - `service_role key` → dùng cho `SUPABASE_SERVICE_KEY` (giữ bí mật!)

---

## BƯỚC 2: Cấu hình Backend

Tạo file `backend/.env` (xem mẫu tại `backend/.env.example`):

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...  (service_role key)
JWT_SECRET=mot_chuoi_bi_mat_du_dai_va_phuc_tap_ky_tu_ngau_nhien
PORT=3001
FRONTEND_URL=https://your-frontend.vercel.app  # Chỉ cần khi deploy production
```

Cài đặt dependencies:
```bash
cd backend
npm install
```

---

## BƯỚC 3: Cấu hình Frontend

Tạo file `frontend/.env` (xem mẫu tại `frontend/.env.example`):

```env
VITE_API_URL=http://localhost:3001/api
```

Cài đặt dependencies:
```bash
cd frontend
npm install
```

---

## BƯỚC 4: Thêm font cho in PDF (tùy chọn — production Linux)

Trên Windows, PDF dùng font Segoe UI có sẵn. Trên Linux/server:

```bash
mkdir -p backend/fonts
# Tải Roboto-Regular.ttf vào thư mục backend/fonts/
```

Nếu không có font file, PDF sẽ fallback sang Helvetica (không hiển thị tiếng Việt có dấu).

---

## BƯỚC 5: Khởi động

### Chạy Backend (Terminal 1)
```bash
cd backend
npm run dev
# Server chạy tại http://localhost:3001
```

### Chạy Frontend (Terminal 2)
```bash
cd frontend
npm run dev
# Website chạy tại http://localhost:5173
```

---

## Tài khoản mặc định

| Vai trò | Số điện thoại | Mật khẩu  |
|---------|--------------|-----------|
| Admin   | 0900000000   | Admin@123 |

> **Lưu ý:** Đổi mật khẩu Admin ngay sau khi đăng nhập lần đầu!

Tạo tài khoản khách hàng: Đăng nhập Admin → `/admin/users` → **Thêm tài khoản**

---

## Tính năng đầy đủ

### Khách hàng (sau khi được admin cấp tài khoản)

| Tính năng | Mô tả |
|-----------|-------|
| Đăng nhập | Số điện thoại + mật khẩu |
| Đăng ký | Gửi yêu cầu chờ admin duyệt |
| Tìm kiếm | Autocomplete theo tên / hoạt chất, scan QR/barcode |
| Sản phẩm | Xem chi tiết, bậc giá theo số lượng |
| Giỏ hàng | Thêm/xóa/chỉnh SL, ghi chú, chọn địa chỉ giao hàng |
| Bậc giá | Giá tự động điều chỉnh theo số lượng (tier pricing) |
| Hình thức TT | Công nợ / Tiền mặt / Chuyển khoản |
| Kiểm soát công nợ | Tự động chặn đặt hàng nếu vượt hạn mức |
| Thường mua kèm | Gợi ý sản phẩm hay mua cùng trong giỏ |
| Mẫu đơn hàng | Lưu / tải / xóa mẫu đặt hàng định kỳ |
| Đơn hàng | Xem lịch sử, theo dõi trạng thái, hủy đơn đang chờ |
| Đặt lại | Đặt lại đơn cũ từ danh sách hoặc chi tiết đơn |
| In / PDF | In hóa đơn trình duyệt hoặc tải PDF |
| Bảng giá | Tìm kiếm và đặt hàng từ catalog sản phẩm |
| Wishlist | Lưu sản phẩm yêu thích |
| Thông báo | Thông báo realtime (SSE) khi đơn hàng cập nhật trạng thái |
| Chat | Nhắn tin với admin |
| Hồ sơ | Xem và cập nhật thông tin cá nhân, đổi mật khẩu |
| PWA | Cài đặt như app trên điện thoại |

### Admin

| Tính năng | Mô tả |
|-----------|-------|
| Dashboard | Biểu đồ doanh thu, top sản phẩm/khách hàng, đơn chờ xác nhận |
| Cảnh báo hàng | Cảnh báo sản phẩm sắp hết hàng (≤20) |
| Cảnh báo hạn | Cảnh báo sản phẩm sắp hết hạn (60 ngày) |
| Đơn hàng | Lọc, tìm kiếm, cập nhật trạng thái, đánh dấu thu tiền |
| Xác nhận hàng loạt | Chọn nhiều đơn pending → xác nhận cùng lúc |
| Export Excel | Xuất danh sách đơn hàng ra file .xlsx |
| In hóa đơn | In hóa đơn trực tiếp từ trang admin |
| Sản phẩm | Thêm/sửa/ẩn sản phẩm, quản lý tồn kho, bậc giá |
| Khách hàng | Tạo/sửa/khóa tài khoản, cài hạn mức công nợ, cấp tier |
| Đăng ký | Duyệt/từ chối yêu cầu đăng ký nhà thuốc |
| Bảng giá | Quản lý price list gửi khách |
| Công nợ | Xem tổng nợ theo khách hàng |
| Doanh thu | Báo cáo theo tháng: biểu đồ stacked bar + bảng chi tiết |
| Chat | Nhắn tin với từng khách hàng |
| Broadcast | Gửi thông báo đến tất cả khách hàng |

---

## Database (11 bảng)

```
users           — khách hàng và admin
products        — sản phẩm (tên, giá, tồn kho, hạn dùng, barcode)
product_tiers   — bậc giá theo số lượng
orders          — đơn hàng
order_items     — chi tiết sản phẩm trong đơn
order_templates — mẫu đơn hàng định kỳ (JSONB)
price_list      — bảng giá gửi khách
wishlists       — sản phẩm yêu thích
notifications   — thông báo khách hàng
messages        — chat
stock_logs      — lịch sử nhập/xuất kho
```

---

## Deploy lên production

### Frontend → Vercel / Netlify
```
VITE_API_URL=https://your-backend.railway.app/api
```

### Backend → Railway / Render / VPS
```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
JWT_SECRET=...
PORT=3001
FRONTEND_URL=https://your-frontend.vercel.app
```

> **PDF trên Linux:** Đặt file `Roboto-Regular.ttf` vào `backend/fonts/` để xuất PDF có tiếng Việt.
