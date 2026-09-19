#!/usr/bin/env bash
# Render Build Script for Data-Crawl Backend
set -e

echo "=== 1. Installing Node dependencies ==="
npm install

echo "=== 2. Installing Puppeteer Chrome Binary ==="
npx puppeteer browsers install chrome

echo "=== 3. Checking Python & OCR dependencies ==="
if command -v python3 &>/dev/null; then
  echo "Python3 detected: $(python3 --version)"
  if [ -f "requirements.txt" ]; then
    echo "Installing Python OCR dependencies..."
    pip3 install -r requirements.txt || true
  fi
else
  echo "Python3 not found in current environment, skipping Python OCR packages."
fi

echo "=== Build completed successfully! ==="
