# Hướng dẫn cài đặt Website Đặt Hàng Dược Phẩm

## Cấu trúc project

```
JNA/
├── frontend/          # React + Vite (giao diện người dùng)
├── backend/           # Node.js + Express (API server)
├── supabase_schema.sql  # SQL tạo bảng trong Supabase
└── HUONG_DAN_CAI_DAT.md
```

---

## BƯỚC 1: Tạo project Supabase

1. Truy cập https://supabase.com → Đăng nhập → **New Project**
2. Điền tên project, mật khẩu database → **Create new project**
3. Vào **SQL Editor** → Paste nội dung file `supabase_schema.sql` → **Run**
4. Lấy thông tin kết nối tại **Settings → API**:
   - `Project URL` → dùng cho `SUPABASE_URL` và `VITE_SUPABASE_URL`
   - `anon/public key` → dùng cho `VITE_SUPABASE_ANON_KEY`
   - `service_role key` → dùng cho `SUPABASE_SERVICE_KEY` (giữ bí mật!)

---

## BƯỚC 2: Cấu hình Backend

Mở file `backend/.env` và điền thông tin:

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...  (service_role key)
JWT_SECRET=mot_chuoi_bi_mat_du_dai_va_phuc_tap_123!
PORT=3001
```

---

## BƯỚC 3: Cấu hình Frontend

Mở file `frontend/.env` và điền thông tin:

```env
VITE_API_URL=http://localhost:3001/api
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...  (anon key)
```

---

## BƯỚC 4: Khởi động

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

## Tài khoản mặc định (từ seed data)

| Vai trò | Số điện thoại | Mật khẩu |
|---------|--------------|----------|
| Admin   | 0900000000   | Admin@123 |

> **Lưu ý:** Đổi mật khẩu Admin ngay sau khi đăng nhập lần đầu!

### Tạo tài khoản khách hàng
Đăng nhập Admin → Vào `/admin/users` → Nhấn **Thêm tài khoản**

---

## Tính năng đã có

### Khách hàng (sau khi được cấp tài khoản)
- Đăng nhập bằng số điện thoại + mật khẩu
- Xem danh sách sản phẩm, bảng giá
- Tìm kiếm sản phẩm theo tên / hoạt chất
- Thêm vào giỏ hàng, chỉnh số lượng
- Xác nhận đặt hàng với địa chỉ giao hàng
- Xem lịch sử đơn hàng và trạng thái
- Xem thông tin cá nhân

### Admin
- Dashboard thống kê (khách hàng, sản phẩm, đơn hàng, doanh thu)
- Quản lý sản phẩm: thêm, sửa, ẩn sản phẩm
- Quản lý đơn hàng: xem chi tiết, cập nhật trạng thái
- Quản lý tài khoản: tạo, sửa, khóa tài khoản khách hàng

---

## Deploy lên production (tùy chọn)

- **Frontend**: Deploy lên Vercel hoặc Netlify
  - Đặt `VITE_API_URL` = URL của backend production
- **Backend**: Deploy lên Railway, Render, hoặc VPS
  - Điền đầy đủ biến môi trường
