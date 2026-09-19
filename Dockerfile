# ========== Stage 1: Build Frontend (Vite) ==========
FROM node:20-alpine AS client-builder

WORKDIR /app/client

COPY client/package.json client/package-lock.json* ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ========== Stage 2: Backend + Chromium (Puppeteer) + Python OCR ==========
FROM node:20-bookworm-slim

# Install Chromium, fonts, Python3, and system libraries for OCR (OpenCV, PyMuPDF)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    python3 \
    python3-pip \
    python3-venv \
    libgl1 \
    libglib2.0-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev

COPY server/requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages || true

COPY server/ ./
COPY --from=client-builder /app/client/dist ./public

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
