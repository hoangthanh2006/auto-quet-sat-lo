# Deploy lên Fly.io

Hướng dẫn deploy Backend + Frontend (một app) lên Fly.io bằng Dockerfile.

---

## 1. Cài Fly CLI (nếu chưa có)

**macOS (Homebrew):**
```bash
brew install flyctl
```

**Hoặc script:**
```bash
curl -L https://fly.io/install.sh | sh
```

Đăng nhập:
```bash
flyctl auth login
```

---

## 2. Deploy lần đầu

Trong thư mục gốc repo (có `Dockerfile` và `fly.toml`):

```bash
cd /Volumes/Data/vne/Data-crawl
flyctl launch
```

- **Use existing fly.toml?** → Yes  
- **App name:** giữ `data-crawl` hoặc đổi tên  
- **Region:** chọn gần bạn (vd: `sin` Singapore, `nrt` Tokyo)  
- **Postgres / Redis:** No (không dùng)  
- **Deploy now?** → Yes  

Fly sẽ build Docker image (client build + server + Chromium) và deploy.

---

## 3. Deploy lại sau khi sửa code

```bash
flyctl deploy
```

---

## 4. Lệnh hữu ích

| Lệnh | Mô tả |
|------|--------|
| `flyctl open` | Mở app trong browser |
| `flyctl logs` | Xem log realtime |
| `flyctl status` | Trạng thái app |
| `flyctl ssh console` | SSH vào container |
| `flyctl scale memory 512` | Đổi RAM (MB) |

---

## 5. Cấu trúc deploy

- **Dockerfile:**  
  - Stage 1: build client (Vite) → `client/dist`  
  - Stage 2: Node + Chromium, copy `server/` + `client/dist` → `server/public`  
- **Fly:** chạy `node index.js` trong container, port 8080.  
- **Frontend:** gọi `/api` (cùng origin), không cần `VITE_API_URL`.

---

## 6. Lỗi thường gặp

**"Could not find Chrome" trên Fly**  
- Dockerfile đã cài Chromium và set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.  
- Nếu vẫn lỗi: `flyctl ssh console` rồi chạy `which chromium` để kiểm tra đường dẫn, sau đó set env tương ứng trong `fly.toml`.

**Build lỗi / out of memory**  
- Tăng RAM: trong Fly Dashboard → Settings → VM → Memory (vd: 1GB).  
- Hoặc trong `fly.toml`: `[[vm]]` → `memory = "1gb"`.

**App sleep (Free plan)**  
- Free tier có auto_stop; request đầu có thể chậm vài giây (cold start).  
- Giữ `min_machines_running = 0` để không tốn tiền khi không dùng.
