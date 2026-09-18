# Hướng Dẫn Tối Ưu Build & Deploy Lên Firebase (Kèm Chạy Node Server)

Tài liệu hướng dẫn triển khai ứng dụng **Data Crawl** lên **Firebase Hosting** với cấu trúc build siêu nhẹ, đồng thời duy trì và kết nối với **Node.js Express Server**.

---

## 1. Kiến Trúc Triển Khai (Full-Stack Architecture)

Ứng dụng gồm 2 phần chính:
1. **Frontend (Client React + Vite)**: 
   - Đã được **tối ưu hóa kích thước build**, áp dụng **Code-Splitting (Lazy Loading)** và phân tách Vendor Chunks.
   - Triển khai lên **Firebase Hosting** (CDN toàn cầu siêu tốc, miễn phí SSL, bộ nhớ đệm thông minh).
2. **Backend (Node.js Server + Puppeteer + Cheerio)**:
   - Chứa các API cào dữ liệu thời gian thực, đọc ảnh OCR, trích xuất sitemap và bản đồ NCHMF.
   - Chạy trên môi trường Node.js (Local, VPS, Render, Fly.io hoặc Google Cloud Run).

---

## 2. Các Tối Ưu Build Đã Thực Hiện

Trước khi tối ưu, toàn bộ ứng dụng bị đóng gói thành 1 file JS khổng lồ (~436 kB). Sau khi tối ưu:

| Thành phần | Trước tối ưu | Sau tối ưu | Cơ chế |
| :--- | :--- | :--- | :--- |
| **Entry ban đầu (`index.js`)** | 435.89 kB | **7.52 kB** (gzip: 2.95 kB) | Tải trang tức thì trong vài mili-giây |
| **Vendor React (`vendor-react.js`)** | Gộp chung | **164.75 kB** (gzip: 49 kB) | Cache vĩnh viễn trên CDN Firebase |
| **Vendor Axios (`vendor-axios.js`)** | Gộp chung | **36.29 kB** (gzip: 14.6 kB) | Tách riêng thư viện gọi API |
| **Công cụ NCHMF (`ToolLuquetSatlo.js`)** | Gộp chung | **59.12 kB** (gzip: 10.4 kB) | Chỉ tải khi mở menu NCHMF |
| **Dynamic Scraper (`DynamicScraper.js`)** | Gộp chung | **43.32 kB** (gzip: 10.4 kB) | Chỉ tải khi mở Dynamic Scraper |
| **Công cụ OCR (`ToolOCR.js`)** | Gộp chung | **16.65 kB** (gzip: 5.0 kB) | Chỉ tải khi mở OCR |

> [!TIP]
> Nhờ cơ chế `React.lazy` và `manualChunks`, người dùng truy cập trang chủ chỉ tải **chưa đầy 50 kB gzip**, các công cụ còn lại chỉ được tải về khi người dùng nhấp vào mục tương ứng.

---

## 3. Cách Kết Nối Firebase Frontend Với Node Server

Có 3 mô hình triển khai phổ biến:

### Mô hình 1: Frontend trên Firebase + Backend trên Render / VPS / Fly.io (Khuyên dùng nhất)
- **Frontend**: Host trên `https://<ten-du-an>.web.app` (Firebase Hosting).
- **Backend**: Host trên Render / VPS / Fly.io (ví dụ: `https://data-crawl-api.onrender.com`).
- **Cách kết nối**: Trước khi build deploy Firebase, đặt biến môi trường:
  ```bash
  cd client
  echo "VITE_API_URL=https://data-crawl-api.onrender.com" > .env.production
  npm run build
  ```
  Client sẽ tự động gọi API tới Node server từ xa mà không gặp lỗi CORS (Backend đã bật CORS cho mọi origin).

---

### Mô hình 2: Firebase Hosting Rewrite sang Google Cloud Run
Nếu bạn muốn cả Frontend và Backend chạy cùng một domain (ví dụ: `https://<ten-du-an>.web.app` và `https://<ten-du-an>.web.app/api/*`):
1. Đóng gói Node server thành Docker container (đã có sẵn tệp [Dockerfile](file:///Volumes/Data/vne/Data-crawl/Dockerfile)) và deploy lên Google Cloud Run.
2. Thêm rewrite trong [firebase.json](file:///Volumes/Data/vne/Data-crawl/firebase.json):
   ```json
   {
     "hosting": {
       "public": "client/dist",
       "rewrites": [
         {
           "source": "/api/**",
           "run": {
             "serviceId": "data-crawl-server",
             "region": "asia-southeast1"
           }
         },
         {
           "source": "**",
           "destination": "/index.html"
         }
       ]
     }
   }
   ```

---

### Mô hình 3: Chạy Node Server Trực Tiếp (All-In-One Server)
Node server tại [server/index.js](file:///Volumes/Data/vne/Data-crawl/server/index.js) đã được cập nhật để **tự động phục vụ các file build từ `client/dist`**:
```bash
# 1. Build frontend tối ưu
npm run build

# 2. Khởi động Node server
npm run start:server
```
Mở trình duyệt tại `http://localhost:3002` — Node server sẽ vừa xử lý các API `/api/*`, vừa trả về giao diện web từ các file build tối ưu!

---

## 4. Các Bước Triển Khai Lên Firebase Hosting

### Bước 1: Đăng nhập Firebase CLI
```bash
npx firebase-tools login
```
Trình duyệt sẽ mở ra để bạn đăng nhập tài khoản Google có quyền quản lý Firebase.

### Bước 2: Chọn dự án Firebase
Nếu chưa cấu hình file `.firebaserc`, hãy liên kết với dự án Firebase của bạn:
```bash
npx firebase-tools use --add
```
Chọn Project ID dự án của bạn và đặt alias là `default`.

### Bước 3: Build và Deploy
Chạy lệnh trực tiếp từ thư mục gốc của repository:

```bash
# Nếu có URL Backend Node server:
cd client && echo "VITE_API_URL=https://your-backend-url.com" > .env.production && cd ..

# Build và đẩy lên Firebase Hosting:
npm run deploy:firebase
```

Firebase sẽ upload toàn bộ thư mục `client/dist` lên CDN toàn cầu và cung cấp đường dẫn:
```text
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/YOUR_PROJECT/overview
Hosting URL: https://YOUR_PROJECT.web.app
```

---

## 5. Danh Sách Lệnh Tiện Ích Trong Thư Mục Gốc

| Lệnh | Ý nghĩa |
| :--- | :--- |
| `npm run build` | Build tối ưu giao diện Frontend ra thư mục `client/dist` |
| `npm run deploy:firebase` | Tự động build và upload lên Firebase Hosting |
| `npm run start:server` | Chạy Node server backend ở chế độ Production |
| `npm run dev:server` | Chạy Node server với chế độ `--watch` (tự reload khi sửa code) |
| `npm run dev:client` | Chạy Vite dev server cho Frontend (cổng 3000) |
