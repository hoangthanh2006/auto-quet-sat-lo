/**
 * vnredlistClientService.js
 * Client service để giao tiếp với backend API hoặc fallback dữ liệu Danh lục Đỏ Việt Nam (Sách Đỏ)
 */

import axios from 'axios';
import { API_BASE_URL } from './api';
import localFallbackData from '../data/vnredlist_animals.json';

const CACHE_STORAGE_KEY = 'vnredlist_animals_cache_v3';

/**
 * Lấy danh sách 720 loài động vật trong Danh lục Đỏ
 */
export async function fetchVnRedlistAnimals(force = false) {
  // Dọn dẹp cache cũ nếu có
  try {
    sessionStorage.removeItem('vnredlist_animals_cache_v1');
    sessionStorage.removeItem('vnredlist_animals_cache_v2');
  } catch (e) {}

  try {
    const res = await axios.get(`${API_BASE_URL}/vnredlist/animals`, {
      params: { force: force ? 'true' : 'false' },
      timeout: 15000
    });

    if (res.data && res.data.success && res.data.data) {
      // Lưu lại vào sessionStorage để tăng tốc cho các lần render tiếp theo
      try {
        sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(res.data.data));
      } catch (e) {
        // quota exceeded or private mode, ignore
      }
      return {
        success: true,
        source: 'backend',
        fromCache: res.data.fromCache || false,
        data: res.data.data
      };
    }
  } catch (err) {
    console.warn('Backend API /vnredlist/animals chưa phản hồi hoặc đang khởi động, chuyển sang dữ liệu dự phòng cục bộ:', err.message);
  }

  // Fallback 1: Session storage (chỉ dùng nếu có đủ 700+ loài chi tiết)
  try {
    const stored = sessionStorage.getItem(CACHE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.species && (parsed.totalDetailed >= 700 || parsed.species[0]?.populationStatus)) {
        return {
          success: true,
          source: 'session_cache',
          data: parsed
        };
      }
    }
  } catch (e) {}

  // Fallback 2: Bundled JSON data (720 loài)
  if (localFallbackData && localFallbackData.species) {
    return {
      success: true,
      source: 'offline_bundled',
      warning: 'Đang hiển thị dữ liệu lưu trữ ngoại tuyến từ VAST. Nhấn "Quét cập nhật" để đồng bộ trực tiếp khi máy chủ sẵn sàng.',
      data: localFallbackData
    };
  }

  throw new Error('Không thể tải dữ liệu Danh lục Đỏ Động vật.');
}

/**
 * Lấy chi tiết hồ sơ một loài
 */
export async function fetchVnRedlistSpeciesDetail(slug, basicInfo = {}) {
  try {
    const res = await axios.get(`${API_BASE_URL}/vnredlist/species/${slug}`, {
      timeout: 15000
    });
    if (res.data && res.data.success && res.data.data) {
      return res.data.data;
    }
  } catch (err) {
    console.warn(`Lỗi khi lấy chi tiết loài ${slug} qua backend:`, err.message);
  }

  // Fallback: Tìm trong localFallbackData
  if (localFallbackData && localFallbackData.species) {
    const found = localFallbackData.species.find(s => s.id === slug || s.slug === slug);
    if (found && found.hasDetail) {
      return found;
    }
  }

  // Nếu chưa có chi tiết, trả về thông tin cơ bản kèm cờ hasDetail = false
  return {
    ...basicInfo,
    id: slug,
    slug,
    url: basicInfo.url || `http://vnredlist.vast.vn/${slug}/`,
    hasDetail: false,
    offlineNotice: 'Chi tiết hồ sơ loài này đang chờ tải từ máy chủ vnredlist.vast.vn.'
  };
}

/**
 * Kích hoạt cào lại toàn bộ danh mục từ VAST
 */
export async function rescanVnRedlistAnimals() {
  const res = await axios.post(`${API_BASE_URL}/vnredlist/rescan`, {}, { timeout: 30000 });
  return res.data;
}

/**
 * Khởi chạy cào sâu (Deep Crawl) chi tiết toàn bộ hồ sơ
 */
export async function startDeepCrawl(options = {}) {
  const res = await axios.post(`${API_BASE_URL}/vnredlist/deep-crawl`, options, { timeout: 15000 });
  return res.data;
}

/**
 * Lấy tiến độ cào sâu
 */
export async function getDeepCrawlStatus() {
  const res = await axios.get(`${API_BASE_URL}/vnredlist/deep-crawl/status`, { timeout: 5000 });
  return res.data;
}

/**
 * Dừng tiến trình cào sâu
 */
export async function stopDeepCrawl() {
  const res = await axios.post(`${API_BASE_URL}/vnredlist/deep-crawl/stop`, {}, { timeout: 5000 });
  return res.data;
}

/**
 * Chuyển đổi URL ảnh từ HTTP không an toàn của vnredlist.vast.vn sang HTTPS an toàn
 * để tránh lỗi Mixed Content bị trình duyệt chặn khi chạy trên HTTPS hosting (Firebase, Vercel...)
 */
export function getSafeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const cleanUrl = url.trim();
  if (!cleanUrl) return '';

  // Nếu đã là HTTPS hoặc data:image hoặc blob:, giữ nguyên
  if (cleanUrl.startsWith('https://') || cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:') || cleanUrl.startsWith('/')) {
    return cleanUrl;
  }

  // Nếu là ảnh từ vnredlist.vast.vn hoặc vast.vn qua HTTP:
  // Sử dụng wsrv.nl CDN proxy miễn phí (Cloudflare edge caching toàn cầu, tự động chuyển sang HTTPS an toàn)
  if (cleanUrl.includes('vast.vn')) {
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=webp&q=85`;
  }

  return cleanUrl;
}

/**
 * URL proxy dự phòng qua backend Node.js nếu CDN wsrv.nl gặp sự cố mạng
 */
export function getBackendImageProxyUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return `${API_BASE_URL}/vnredlist/image-proxy?url=${encodeURIComponent(url.trim())}`;
}
