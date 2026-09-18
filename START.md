# Hướng dẫn khởi động ứng dụng

## Bước 1: Cài đặt dependencies

### Backend:
```bash
cd server
npm install
```

### Frontend:
```bash
cd client
npm install
```

## Bước 2: Khởi động Backend Server

Mở terminal thứ nhất:
```bash
cd server
npm start
```

Bạn sẽ thấy:
```
Server running on http://localhost:3001
```

**QUAN TRỌNG:** Backend phải chạy trước khi start frontend!

## Bước 3: Khởi động Frontend

Mở terminal thứ hai (giữ terminal backend đang chạy):
```bash
cd client
npm run dev
```

Bạn sẽ thấy:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
```

## Bước 4: Sử dụng ứng dụng

1. Mở browser và truy cập: `http://localhost:3000`
2. Click "Scan Links" để tìm các profile links
3. Chọn các links muốn extract (checkbox)
4. Click "Extract Content" để extract nội dung
5. Xem kết quả trong tab "Data Table"

## Kiểm tra nếu gặp lỗi 404

### Test Backend:
Mở browser và truy cập: `http://localhost:3001/api/health`

Nếu thấy `{"status":"ok","message":"Server is running"}` → Backend OK ✅

Nếu không thấy → Backend chưa chạy, cần start lại backend.

### Test API endpoint:
```bash
# Sử dụng curl (nếu có) hoặc Postman
curl http://localhost:3001/api/health
```

## Cào dữ liệu NCHMF tự động 24/7

Để cào dữ liệu tự động 24/7 lưu vào Firebase mà không cần mở trình duyệt hay giữ máy tính cá nhân bật:
- **Xem chi tiết:** [`CRAWL_24_7.md`](file:///Volumes/Data/vne/Data-crawl/CRAWL_24_7.md)
- **Đã kích hoạt sẵn:** GitHub Actions định kỳ mỗi 20 phút chạy tự động trên Cloud của GitHub tại repo `hoangthanh2006/auto-quet-sat-lo`.
- **Chạy thử 1 lần từ máy:** `npm run sync:nchmf` (hoặc `node server/autoSyncNCHMF.js`)
- **Chạy lặp định kỳ từ máy:** `npm run sync:watch`

## Lưu ý

- **Luôn start backend trước frontend**
- Nếu thay đổi code backend, cần restart backend
- Nếu thay đổi code frontend, Vite sẽ tự động reload
- Port 3001 (backend) và 3000 (frontend) phải available

## Troubleshooting

Xem file `TROUBLESHOOTING.md` để biết thêm chi tiết.

