# Hướng dẫn chạy cào dữ liệu NCHMF tự động 24/7

Để dữ liệu được quét liên tục 24/7 và lưu vào Firebase Realtime Database phục vụ thống kê (kể cả khi tắt máy tính, gập laptop, hay không mở trình duyệt), bạn có **3 giải pháp chính**:

---

## 🌟 GIẢI PHÁP 1: GitHub Actions (KHUYÊN DÙNG NHẤT - 100% Miễn Phí, Tiện Lợi Nhất)

> **Trạng thái:** ✅ **Đã được cài đặt và kích hoạt sẵn trong repository của bạn!**
> File cấu hình: `.github/workflows/nchmf_auto_sync.yml`

### Cách hoạt động:
- Máy chủ đám mây của GitHub sẽ tự động đánh thức mỗi **20 phút một lần** (hoặc bạn có thể đổi thành 15 phút, 30 phút).
- Tự động chạy lệnh: `node server/autoSyncNCHMF.js`.
- Cào dữ liệu NCHMF mới nhất, so sánh chống trùng lặp, đẩy lên Firebase Realtime Database.
- **Hoàn toàn miễn phí** (GitHub cấp 2,000 phút chạy miễn phí/tháng, trong khi mỗi lượt quét chỉ mất ~10 giây).
- **Bạn tắt máy tính, đi ngủ hay đi công tác thì GitHub vẫn đều đặn cào và lưu trữ.**

### Cách kiểm tra & quản lý trên GitHub:
1. Truy cập vào GitHub repository của bạn: [https://github.com/hoangthanh2006/auto-quet-sat-lo](https://github.com/hoangthanh2006/auto-quet-sat-lo)
2. Nhấn vào tab **"Actions"** ở trên menu.
3. Ở cột bên trái, chọn workflow **"NCHMF 24/7 Auto Sync"**.
4. Bạn sẽ thấy danh sách các lần chạy tự động.
5. Nếu muốn chạy kiểm tra thủ công ngay lập tức: Bấm nút **"Run workflow"** -> chọn branch `main` -> bấm **"Run workflow"**.

---

## 🖥️ GIẢI PHÁP 2: Chạy trên Cloud VPS / Linux Server (Nếu có máy chủ riêng)

Nếu tòa soạn hoặc bạn có 1 máy chủ VPS (Ubuntu/Debian) chạy 24/7:

### Bước 1: Cài đặt PM2 (Trình quản lý tiến trình nền)
```bash
npm install -g pm2
```

### Bước 2: Khởi chạy Worker ở chế độ quét định kỳ mỗi 15 phút
```bash
cd /path/to/auto-quet-sat-lo
pm2 start server/autoSyncNCHMF.js --name "nchmf-sync-worker" -- --watch --interval 15
```

### Bước 3: Cấu hình tự khởi động lại khi VPS reboot
```bash
pm2 startup
pm2 save
```

### Quản lý tiến trình:
```bash
pm2 status                  # Xem trạng thái đang chạy
pm2 logs nchmf-sync-worker  # Xem log cào dữ liệu thực tế
pm2 restart nchmf-sync-worker # Khởi động lại
pm2 stop nchmf-sync-worker    # Dừng
```

---

## 💻 GIẢI PHÁP 3: Chạy nền trên máy tính cá nhân (Khi máy tính đang mở)

Nếu bạn muốn chạy ngầm ngay trên máy tính của mình:

```bash
# Quét định kỳ mỗi 15 phút một lần:
npm run sync:watch

# Hoặc dùng PM2 ngay trên máy Mac:
npm install -g pm2
pm2 start server/autoSyncNCHMF.js --name "nchmf-sync" -- --watch --interval 15
```
*(Lưu ý: Nếu dùng cách này thì khi gập máy hoặc tắt nguồn, việc cào dữ liệu sẽ tạm dừng cho đến khi bật máy lại).*

---

## 📊 Dữ liệu sau khi cào được lưu ở đâu?
- Toàn bộ dữ liệu được lưu vào Firebase Realtime Database:
  - Timeline thống kê: `/luquet_satlo/statistics/timeline`
  - Chi tiết từng đợt quét: `/luquet_satlo/snapshots/{YYYYMMDD_HHmm}`
  - Trạng thái lần quét gần nhất: `/luquet_satlo/auto_sync_status`
- Web xem trực tiếp & thống kê: [https://anh-cao-keu.web.app](https://anh-cao-keu.web.app)
