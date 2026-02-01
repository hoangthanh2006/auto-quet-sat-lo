# Deploy lên Render.com

Hướng dẫn đẩy source lên Git và deploy Backend + Frontend lên Render.com.

---

## 1. Cấu hình Git và đẩy code

### 1.1 Khởi tạo Git (nếu chưa có)

```bash
cd /Volumes/Data/vne/Data-crawl
git init
```

### 1.2 Thêm remote (GitHub / GitLab)

Thay `YOUR_USERNAME` và `YOUR_REPO` bằng tên user và tên repo của bạn.

**GitHub:**
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

**GitLab:**
```bash
git remote add origin https://gitlab.com/YOUR_USERNAME/YOUR_REPO.git
```

### 1.3 Commit và push

```bash
git add .
git status
git commit -m "Initial commit: Data Crawl - Backend + Frontend"
git branch -M main
git push -u origin main
```

---

## 2. Deploy lên Render.com

### 2.1 Tạo tài khoản và kết nối repo

1. Vào [render.com](https://render.com) → Đăng ký / Đăng nhập.
2. **Dashboard** → **New** → **Blueprint**.
3. Kết nối GitHub/GitLab, chọn repo **Data-crawl**.
4. Render sẽ đọc file `render.yaml` và tạo 2 service: **data-crawl-api** (Backend) và **data-crawl-web** (Frontend).

### 2.1b Root Directory (quan trọng – tránh lỗi "package.json not found")

Repo có cấu trúc **monorepo**: code Backend nằm trong thư mục `server/`, Frontend trong `client/`.

- **Backend (data-crawl-api):** Bắt buộc đặt **Root Directory** = **`server`**.
  - Nếu để trống, Render chạy build ở thư mục gốc repo → không có `package.json` → lỗi `ENOENT: no such file or directory, open '.../package.json'`.
  - Trong service Backend: **Settings** → **Root Directory** → nhập **`server`** → Save.
- **Frontend (data-crawl-web):** Đặt **Root Directory** = **`client`** (Blueprint đã khai báo `rootDir: client`; nếu tạo service thủ công thì phải set `client`).

### 2.2 Cấu hình Environment cho Frontend

Sau khi Backend deploy xong, Render sẽ cho URL kiểu: `https://data-crawl-api.onrender.com`.

1. Vào service **data-crawl-web** (Static Site).
2. **Environment** → **Add Environment Variable**:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://data-crawl-api.onrender.com` (đúng URL Backend của bạn, **không** có dấu `/` cuối).
3. **Save Changes** → Render sẽ **redeploy** Frontend để build lại với API URL mới.

### 2.3 Lưu ý Backend (Puppeteer trên Render)

- Render **Free** có thể **không** cài sẵn Chrome. Backend đang dùng `executablePath` trỏ Chrome local; trên Render cần dùng Chrome do Puppeteer cài hoặc biến môi trường.
- Nếu lỗi "Could not find Chrome" trên Render:
  - Thêm **Build Command**: `npm install && npx puppeteer browsers install chrome` (nếu Render cho phép).
  - Hoặc dùng Docker image có sẵn Chrome (chuyển sang **Docker** thay vì **Native Environment**).
- Có thể chọn **region** gần VN (ví dụ **Singapore**) trong `render.yaml` hoặc Dashboard.

---

## 3. Cấu trúc deploy (render.yaml)

| Service          | Type        | Root   | Build                    | Start / Publish   |
|------------------|------------|--------|--------------------------|--------------------|
| **data-crawl-api**  | Web Service | `server/` | `npm install`            | `npm start`        |
| **data-crawl-web**  | Static Site | `client/` | `npm install && npm run build` | `publishPath: dist` |

- **Backend:** Render tự gán `PORT`; server đã dùng `process.env.PORT || 3001`.
- **Frontend:** Build Vite ra `client/dist`, Render host static từ thư mục đó. API gọi qua `VITE_API_URL` (env ở bước 2.2).

---

## 4. Kiểm tra sau khi deploy

1. **Backend:** Mở `https://<your-backend>.onrender.com/api/health` → trả về `{"status":"ok",...}`.
2. **Frontend:** Mở URL Static Site → giao diện load, gọi API không lỗi CORS và không 404.

---

## 5. Tóm tắt biến môi trường

| Biến             | Dùng ở     | Mô tả |
|------------------|------------|--------|
| `PORT`           | Backend    | Render gán tự động. |
| `VITE_API_URL`   | Frontend   | URL Backend (vd: `https://data-crawl-api.onrender.com`) để client gọi API. |
| `NODE_ENV`       | Backend    | Tùy chọn, có thể set `production` trên Render. |

Sau khi cấu hình Git và Render theo các bước trên, source sẽ được deploy lên Render.com.
