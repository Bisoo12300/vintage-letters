# Thư Vintage — Vintage Letter Web App

Ứng dụng viết và gửi thư qua mã QR, giao diện giấy cổ vintage. Chỉ dành cho 2 người dùng: **người viết** (bạn) và **người đọc** (bạn của bạn).

## Tính năng

- **Viết thư** trên template giấy vintage (cúc họa mi từ thư mục `Template/`)
- **Tạo mã QR** — bạn in/chụp màn hình gửi cho người nhận
- **Theo dõi đọc thư** — số lần đọc, thời gian đọc từng lần
- **Kho lưu trữ** — người đọc xem lại tất cả thư đã nhận

## Cấu trúc

```
├── backend/          # Express API — JSON (local) hoặc PostgreSQL (production)
├── frontend/         # Next.js (giao diện vintage)
├── Template/         # Background giấy thư gốc
└── package.json      # Chạy cả hai cùng lúc
```

## Chạy local

```bash
# Cài dependencies (lần đầu)
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Copy env (đã có sẵn .env mẫu)
# backend/.env — đổi ADMIN_PASSWORD và READER_TOKEN
# frontend/.env.local — NEXT_PUBLIC_API_URL

# Chạy dev
npm run dev
```

- **Người viết:** http://localhost:3000 — mật khẩu: `vintage-admin-2026`
- **Thống kê đọc:** http://localhost:3000/admin
- **Kho lưu trữ (người đọc):** http://localhost:3000/archive — mã: `vintage-reader-2026`
- **Đọc thư qua QR:** http://localhost:3000/letter/[id]

## Thêm template giấy mới

1. Đặt ảnh JPG vào `frontend/public/backgrounds/`
2. Thêm entry vào `TEMPLATES` trong `frontend/lib/api.ts`

## Deploy lên GitHub

```bash
git init
git add .
git commit -m "Initial commit: Vintage Letters app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vintage-letters.git
git push -u origin main
```

### Deploy production

Xem hướng dẫn chi tiết trong **[DEPLOY.md](./DEPLOY.md)**.

| Thành phần | Dịch vụ | Free tier |
|------------|---------|-----------|
| **Database** | [Neon PostgreSQL](https://neon.tech) | 0.5 GB, auto-wake |
| **Backend** | [Render](https://render.com) | 750 giờ/tháng |
| **Frontend** | [Vercel](https://vercel.com) | Hobby |

**Biến môi trường production:**

Backend:
- `DATABASE_URL` — connection string từ Neon
- `ADMIN_PASSWORD` — mật khẩu bạn (người viết)
- `READER_TOKEN` — mã kho lưu trữ cho bạn đọc
- `FRONTEND_URL` — URL Vercel (vd: `https://your-app.vercel.app`)
- `PORT` — Render tự set

Frontend:
- `NEXT_PUBLIC_API_URL` — URL backend + `/api` (vd: `https://your-api.onrender.com/api`)

## Bảo mật 2 người dùng

- **ADMIN_PASSWORD** — chỉ bạn viết thư và xem thống kê
- **READER_TOKEN** — bạn đọc vào kho lưu trữ xem tất cả thư
- Link `/letter/[id]` công khai qua QR (UUID ngẫu nhiên, khó đoán)

> Đổi mật khẩu mặc định trước khi deploy production!

## API

| Method | Route | Auth | Mô tả |
|--------|-------|------|-------|
| POST | `/api/letters` | Admin | Tạo thư mới |
| GET | `/api/letters` | Admin | Danh sách + thống kê |
| GET | `/api/letters/:id` | — | Đọc nội dung thư |
| GET | `/api/letters/:id/stats` | Admin | Chi tiết thống kê đọc |
| POST | `/api/letters/:id/read-start` | — | Bắt đầu theo dõi đọc |
| POST | `/api/letters/:id/read-end` | — | Kết thúc, lưu thời gian |
| GET | `/api/archive` | Reader | Kho lưu trữ thư |
