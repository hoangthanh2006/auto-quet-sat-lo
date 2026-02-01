# ========== Stage 1: Build Frontend (Vite) ==========
FROM node:20-alpine AS client-builder

WORKDIR /app/client

COPY client/package.json client/package-lock.json* ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ========== Stage 2: Backend + Chromium (Puppeteer) ==========
FROM node:20-bookworm-slim

# Install Chromium and deps for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev

COPY server/ ./
COPY --from=client-builder /app/client/dist ./public

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "index.js"]
