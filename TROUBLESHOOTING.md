# Troubleshooting Guide

## Lỗi 404 khi gọi API `/api/extract-content`

### Nguyên nhân có thể:
1. **Backend server chưa chạy** - Server phải chạy trên port 3001
2. **Proxy không hoạt động** - Vite proxy có thể cần restart
3. **Port conflict** - Port 3001 có thể đang được sử dụng

### Cách khắc phục:

#### 1. Kiểm tra Backend Server đang chạy:
```bash
cd server
npm install
npm start
```

Bạn sẽ thấy message: `Server running on http://localhost:3001`

#### 2. Kiểm tra Frontend đang chạy:
```bash
cd client
npm install
npm run dev
```

Bạn sẽ thấy message: `Local: http://localhost:3000`

#### 3. Test API trực tiếp:
Mở browser và truy cập: `http://localhost:3001/api/health`

Nếu thấy `{"status":"ok","message":"Server is running"}` thì backend đang chạy đúng.

#### 4. Test API endpoint:
Sử dụng Postman hoặc curl:
```bash
curl -X POST http://localhost:3001/api/extract-content \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://daihoidang.vn/nhan-su/test.html"]}'
```

#### 5. Restart cả hai servers:
- Dừng cả frontend và backend (Ctrl+C)
- Khởi động lại backend trước: `cd server && npm start`
- Sau đó khởi động frontend: `cd client && npm run dev`

#### 6. Kiểm tra firewall/antivirus:
Đảm bảo không có firewall nào block port 3001.

#### 7. Kiểm tra console logs:
- Xem browser console (F12) để xem lỗi chi tiết
- Xem server console để xem request có đến server không

### Nếu vẫn không được:
1. Thử thay đổi port backend trong `server/index.js`: `const PORT = 3002;`
2. Cập nhật proxy trong `client/vite.config.js`: `target: 'http://localhost:3002'`
3. Restart cả hai servers
