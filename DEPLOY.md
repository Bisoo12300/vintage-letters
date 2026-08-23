# Hướng dẫn Deploy Database & Backend

App này dùng **Neon PostgreSQL** (miễn phí) cho production. Local dev vẫn dùng file JSON nếu không set `DATABASE_URL`.

## Tại sao chọn Neon?

| Tiêu chí | Neon | Supabase |
|----------|------|----------|
| Free storage | 0.5 GB | 500 MB |
| Idle | Tự wake ~0.5s | Pause sau 7 ngày, phải vào dashboard bật lại |
| Phù hợp app 2 người | ✅ Đọc thư thỉnh thoảng | ⚠️ Dễ bị pause |
| Auth/Storage kèm | Không cần | Có (thừa cho project này) |

---

## Bước 1: Tạo database trên Neon (5 phút)

1. Vào [https://neon.tech](https://neon.tech) → **Sign up** (GitHub/Google)
2. **New Project** → đặt tên `vintage-letters`
3. Region: chọn **Singapore** (`ap-southeast-1`) — gần VN nhất
4. Vào tab **Dashboard** → copy **Connection string** (dạng):
   ```
   postgresql://neondb_owner:xxxxx@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
5. (Tuỳ chọn) Vào **SQL Editor** → paste nội dung file `backend/sql/schema.sql` → **Run**  
   *(Backend cũng tự tạo bảng khi khởi động, bước này không bắt buộc)*

---

## Bước 2: Deploy Backend lên Render

1. Push code lên GitHub (nếu chưa)
2. Vào [https://render.com](https://render.com) → **New → Web Service**
3. Connect repo GitHub → chọn project
4. Cấu hình:
   | Field | Value |
   |-------|-------|
   | Root Directory | `backend` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |

5. **Environment Variables** (Add):

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Connection string Neon (bước 1) |
   | `ADMIN_PASSWORD` | Mật khẩu bạn (người viết thư) |
   | `READER_TOKEN` | Mã kho lưu trữ cho bạn đọc |
   | `FRONTEND_URL` | URL Vercel (bước 3, cập nhật sau cũng được) |

6. **Create Web Service** → đợi deploy xong  
   URL backend: `https://vintage-letters-api.onrender.com`

7. Kiểm tra: mở `https://YOUR-API.onrender.com/api/health`  
   Kết quả mong đợi: `{"ok":true,"db":"postgres"}`

> **Lưu ý Render Free:** server sleep sau 15 phút idle, lần request đầu mất ~30–60s để wake. Chấp nhận được cho app cá nhân.

---

## Bước 3: Deploy Frontend lên Vercel

1. Vào [https://vercel.com](https://vercel.com) → **Add New Project**
2. Import repo GitHub
3. Cấu hình:
   | Field | Value |
   |-------|-------|
   | Root Directory | `frontend` |
   | Framework | Next.js (auto) |

4. **Environment Variable**:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://YOUR-API.onrender.com/api` |

5. **Deploy** → copy URL Vercel (vd: `https://vintage-letters.vercel.app`)

6. Quay lại Render → cập nhật `FRONTEND_URL` = URL Vercel → **Manual Deploy**

---

## Bước 4: Kiểm tra end-to-end

1. Mở URL Vercel → đăng nhập viết thư (`ADMIN_PASSWORD`)
2. Tạo 1 lá thư test → mở trang QR
3. Quét QR / mở link thư → đọc vài giây → đóng tab
4. Vào `/admin` → kiểm tra thống kê đọc
5. Vào Neon **Tables** → thấy data trong `letters` và `reading_sessions`

---

## Local dev với Neon (tuỳ chọn)

Thêm vào `backend/.env`:

```env
DATABASE_URL=postgresql://neondb_owner:xxxxx@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

Chạy `npm run dev:backend` → log sẽ hiện `Using PostgreSQL (Neon)`.

---

## Chi phí ước tính

| Dịch vụ | Free tier | Đủ cho app này? |
|---------|-----------|-----------------|
| Neon DB | 0.5 GB, auto-sleep | ✅ Hàng nghìn lá thư |
| Render backend | 750 giờ/tháng | ✅ |
| Vercel frontend | Hobby free | ✅ |

**Tổng: $0/tháng** cho 2 người dùng.

---

## Troubleshooting

**`Exited with status 127` khi build/deploy**  
→ Render đang chạy sai thư mục hoặc lệnh. Trên dashboard kiểm tra:
- **Root Directory** = `backend` (bắt buộc)
- **Build Command** = `npm install`
- **Start Command** = `node src/index.js` (hoặc `npm start`)
- Không dùng lệnh từ root repo (`npm run build` của frontend / `concurrently`)

**`db: "json"` thay vì `"postgres"` trên production**  
→ `DATABASE_URL` chưa set hoặc sai trên Render. Kiểm tra Environment Variables.

**CORS error trên frontend**  
→ `FRONTEND_URL` trên Render phải khớp URL Vercel (không có `/` cuối).

**Neon connection timeout**  
→ Thêm `?sslmode=require` vào cuối connection string.

**Mất data sau redeploy**  
→ Chắc chắn đang dùng Neon (`db: postgres`), không phải JSON file trên Render.
