/**
 * Client-Side Service for Hymetnet (http://hymetnet.gov.vn/)
 * Cung cấp API tương tác với dữ liệu Khí tượng Thủy văn:
 * - Ưu tiên đọc từ Firebase Realtime Database (siêu nhanh, có cache và real-time update)
 * - Tự động fallback sang API backend Express (/api/hymetnet/*)
 */

import {
  getHymetnetLatest,
  listenToHymetnetLatest,
  getHymetnetTimeline,
  getHymetnetSyncStatus
} from './firebase.js';

const API_BASE = '/api/hymetnet';

export const HYMETNET_RADAR_STATIONS = [
  { id: 'PL', name: 'Phù Liễn', province: 'Hải Phòng', lat: 20.809, lng: 106.64, region: 'Bắc Bộ' },
  { id: 'PD', name: 'Pha Đin', province: 'Điện Biên', lat: 21.57139, lng: 103.51694, region: 'Tây Bắc Bộ' },
  { id: 'VT', name: 'Việt Trì', province: 'Phú Thọ', lat: 21.41944, lng: 105.30472, region: 'Bắc Bộ' },
  { id: 'VI', name: 'Vinh', province: 'Nghệ An', lat: 18.656, lng: 105.71083, region: 'Bắc Trung Bộ' },
  { id: 'DH', name: 'Đông Hà', province: 'Quảng Trị', lat: 16.804722, lng: 107.09194, region: 'Bắc Trung Bộ' },
  { id: 'TK', name: 'Tam Kỳ', province: 'Quảng Nam', lat: 15.56752, lng: 108.4624, region: 'Trung Trung Bộ' },
  { id: 'PK', name: 'PleiKu', province: 'Gia Lai', lat: 14.03465, lng: 107.98406, region: 'Tây Nguyên' },
  { id: 'QN', name: 'Quy Nhơn', province: 'Bình Định', lat: 13.74859, lng: 109.19213, region: 'Nam Trung Bộ' },
  { id: 'NT', name: 'Nha Trang', province: 'Khánh Hòa', lat: 12.21152, lng: 109.28056, region: 'Nam Trung Bộ' },
  { id: 'NB', name: 'Nhà Bè', province: 'TP. Hồ Chí Minh', lat: 10.65961, lng: 106.72833, region: 'Nam Bộ' }
];

/**
 * 1. Lấy toàn bộ dữ liệu mới nhất (Tổng hợp tất cả các lớp)
 */
export async function getHymetnetLatestData() {
  // Thử đọc từ Firebase RTDB trước
  try {
    const fbRes = await getHymetnetLatest('all');
    if (fbRes.success && fbRes.data) {
      return { success: true, data: fbRes.data, source: 'firebase' };
    }
  } catch (e) {
    console.warn('[Hymetnet Client] Firebase read failed, fallback to backend API:', e);
  }

  // Fallback sang API backend
  try {
    const res = await fetch(`${API_BASE}/all`);
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || json, source: 'backend_api' };
    }
  } catch (err) {
    console.error('[Hymetnet Client] Backend API fetch error:', err);
  }

  return { success: false, data: null, message: 'Không thể tải dữ liệu Hymetnet' };
}

/**
 * 2. Lấy danh sách cảnh báo dông sét
 */
export async function getHymetnetDongSet() {
  try {
    const fbRes = await getHymetnetLatest('dong_set');
    if (fbRes.success && fbRes.data) {
      return { success: true, data: fbRes.data, source: 'firebase' };
    }
  } catch (_) {}

  try {
    const res = await fetch(`${API_BASE}/dongset`);
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json, source: 'backend_api' };
    }
  } catch (err) {
    console.error('[Hymetnet Client] getHymetnetDongSet error:', err);
  }

  return { success: false, data: null };
}

/**
 * 3. Lấy số liệu sét quan trắc thực tế
 */
export async function getHymetnetLightning() {
  try {
    const fbRes = await getHymetnetLatest('lightning');
    if (fbRes.success && fbRes.data) {
      return { success: true, data: fbRes.data, source: 'firebase' };
    }
  } catch (_) {}

  try {
    const res = await fetch(`${API_BASE}/lightning`);
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json, source: 'backend_api' };
    }
  } catch (err) {
    console.error('[Hymetnet Client] getHymetnetLightning error:', err);
  }

  return { success: false, data: null };
}

/**
 * 4. Lấy dữ liệu mưa và cảnh báo mưa
 */
export async function getHymetnetRain() {
  try {
    const fbRes = await getHymetnetLatest('rain');
    if (fbRes.success && fbRes.data) {
      return { success: true, data: fbRes.data, source: 'firebase' };
    }
  } catch (_) {}

  try {
    const res = await fetch(`${API_BASE}/rain`);
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json, source: 'backend_api' };
    }
  } catch (err) {
    console.error('[Hymetnet Client] getHymetnetRain error:', err);
  }

  return { success: false, data: null };
}

/**
 * 5. Lấy chuỗi ảnh Radar & Mây Vệ Tinh
 */
export async function getHymetnetRadar() {
  try {
    const fbRes = await getHymetnetLatest('radar');
    if (fbRes.success && fbRes.data) {
      return { success: true, data: fbRes.data, source: 'firebase' };
    }
  } catch (_) {}

  try {
    const res = await fetch(`${API_BASE}/radar`);
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json, source: 'backend_api' };
    }
  } catch (err) {
    console.error('[Hymetnet Client] getHymetnetRadar error:', err);
  }

  return { success: false, data: null };
}

/**
 * 6. Lắng nghe dữ liệu Hymetnet thời gian thực
 */
export function subscribeHymetnetRealtime(layer = 'all', onData) {
  return listenToHymetnetLatest(layer, onData);
}

/**
 * 7. Lấy chuỗi lịch sử timeline (mỗi 2 giờ 1 mốc)
 */
export async function getHymetnetHistoryTimeline(limit = 24) {
  return getHymetnetTimeline(limit);
}

/**
 * 8. Kích hoạt quét và đồng bộ thủ công ngay lập tức
 */
export async function triggerHymetnetManualSync() {
  try {
    const res = await fetch(`${API_BASE}/sync-now`, { method: 'POST' });
    if (res.ok) {
      return await res.json();
    }
    return { success: false, message: `HTTP ${res.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 9. Lấy trạng thái đồng bộ và scheduler
 */
export async function fetchHymetnetStatus() {
  try {
    const res = await fetch(`${API_BASE}/sync-status`);
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}

  return getHymetnetSyncStatus();
}
