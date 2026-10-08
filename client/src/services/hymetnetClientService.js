/**
 * Client-Side Service for Hymetnet (http://hymetnet.gov.vn/)
 * Cung cấp API tương tác với dữ liệu Khí tượng Thủy văn:
 * - Ưu tiên đọc từ Firebase Realtime Database (siêu nhanh, có cache và real-time update)
 * - Tự động fallback sang API backend Express (hỗ trợ Render production & local dev)
 */

import {
  getHymetnetLatest,
  listenToHymetnetLatest,
  getHymetnetTimeline,
  getHymetnetSyncStatus,
  getHymetnetSnapshot
} from './firebase.js';
import {
  getLatestDataFromSupabase,
  subscribeLatestDataFromSupabase,
  getTimelineFromSupabase,
  getSnapshotFromSupabase,
  getSyncStatusFromSupabase
} from './supabaseClient.js';
import { getApiBaseUrl, isHtmlResponse, BACKEND_REQUIRED_MSG } from './api.js';

export const getHymetnetApiBase = () => `${getApiBaseUrl()}/hymetnet`;

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
 * Helper gọi API backend an toàn:
 * - Tự động phát hiện phản hồi HTML (lỗi Firebase Hosting rewrite static)
 * - Tự động xử lý Render cold start timeout
 * - Trả về format đồng nhất { success, data, error, message }
 */
async function requestHymetnet(endpoint, options = {}) {
  const base = getHymetnetApiBase();
  const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const timeoutMs = options.timeout || 60000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (isHtmlResponse(text) || contentType.includes('text/html')) {
      return {
        success: false,
        error: BACKEND_REQUIRED_MSG,
        message: BACKEND_REQUIRED_MSG,
        isStaticHostingError: true
      };
    }

    try {
      const json = JSON.parse(text);
      if (!res.ok && !json.error && !json.message) {
        json.error = `Máy chủ trả về mã lỗi HTTP ${res.status}`;
      }
      return json;
    } catch (_) {
      return {
        success: false,
        error: `Phản hồi không hợp lệ từ máy chủ (${res.status}): ${text.slice(0, 100)}...`,
        message: `Phản hồi không hợp lệ từ máy chủ (${res.status})`
      };
    }
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'Quá thời gian chờ (Timeout). Máy chủ Render đang khởi động lại hoặc dữ liệu quá lớn, vui lòng thử lại sau giây lát.',
        message: 'Quá thời gian chờ (Timeout)'
      };
    }
    return {
      success: false,
      error: err.message || 'Không thể kết nối đến máy chủ Backend',
      message: err.message
    };
  }
}

/**
 * 1. Lấy toàn bộ dữ liệu mới nhất (Tổng hợp tất cả các lớp)
 */
export async function getHymetnetLatestData() {
  try {
    const sbRes = await getLatestDataFromSupabase('hymetnet_all');
    if (sbRes.success && sbRes.data) {
      return { success: true, data: sbRes.data, source: 'supabase' };
    }
  } catch (e) {
    console.warn('[Hymetnet Client] Supabase read failed:', e);
  }

  // Thử đọc từ Firebase RTDB
  try {
    const fbRes = await getHymetnetLatest('all');
    if (fbRes.success && fbRes.data) {
      return { success: true, data: fbRes.data, source: 'firebase' };
    }
  } catch (e) {
    console.warn('[Hymetnet Client] Firebase read failed, fallback to backend API:', e);
  }

  // Fallback sang API backend
  const res = await requestHymetnet('/all', { timeout: 30000 });
  if (res && res.success) {
    return { success: true, data: res.data || res, source: 'backend_api' };
  }

  return {
    success: false,
    data: null,
    message: res?.error || res?.message || 'Không thể tải dữ liệu Hymetnet'
  };
}

/**
 * 2. Lấy danh sách cảnh báo dông sét
 */
export async function getHymetnetDongSet() {
  try {
    const sbRes = await getLatestDataFromSupabase('hymetnet_dong_set');
    if (sbRes.success && sbRes.data) {
      return { success: true, data: sbRes.data, source: 'supabase' };
    }
  } catch (_) {}

  try {
    const fbRes = await getHymetnetLatest('dong_set');
    if (fbRes.success && fbRes.data) {
      return { success: true, data: fbRes.data, source: 'firebase' };
    }
  } catch (_) {}

  const res = await requestHymetnet('/dongset', { timeout: 20000 });
  if (res && (res.success || res.status === 'success' || res.records)) {
    return { success: true, data: res, source: 'backend_api' };
  }

  return { success: false, data: null };
}

/**
 * 3. Lấy số liệu sét quan trắc thực tế
 */
export async function getHymetnetLightning() {
  try {
    const sbRes = await getLatestDataFromSupabase('hymetnet_lightning');
    if (sbRes.success && sbRes.data) {
      return { success: true, data: sbRes.data, source: 'supabase' };
    }
  } catch (_) {}

  try {
    const fbRes = await getHymetnetLatest('lightning');
    if (fbRes.success && fbRes.data) {
      return { success: true, data: fbRes.data, source: 'firebase' };
    }
  } catch (_) {}

  const res = await requestHymetnet('/lightning', { timeout: 25000 });
  if (res && (res.success || res.data || res.items)) {
    return { success: true, data: res, source: 'backend_api' };
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

  const res = await requestHymetnet('/rain', { timeout: 20000 });
  if (res && (res.success || res.items)) {
    return { success: true, data: res, source: 'backend_api' };
  }

  return { success: false, data: null };
}

/**
 * 5. Lấy chuỗi ảnh Radar & Mây Vệ Tinh
 */
export async function getHymetnetRadar() {
  try {
    const sbRes = await getLatestDataFromSupabase('hymetnet_radar');
    if (sbRes.success && sbRes.data) {
      return { success: true, data: sbRes.data, source: 'supabase' };
    }
  } catch (_) {}

  try {
    const fbRes = await getHymetnetLatest('radar');
    if (fbRes.success && fbRes.data) {
      return { success: true, data: fbRes.data, source: 'firebase' };
    }
  } catch (_) {}

  const res = await requestHymetnet('/radar', { timeout: 20000 });
  if (res && (res.success || res.stations || res.timeline)) {
    return { success: true, data: res, source: 'backend_api' };
  }

  return { success: false, data: null };
}

/**
 * 6. Lắng nghe dữ liệu Hymetnet thời gian thực
 */
export function subscribeHymetnetRealtime(layer = 'all', onData) {
  const sourceName = layer === 'all' ? 'hymetnet_all' : `hymetnet_${layer}`;
  const unsubSb = subscribeLatestDataFromSupabase(sourceName, (data) => {
    onData(data);
  });
  const unsubFb = listenToHymetnetLatest(layer, onData);

  return () => {
    if (typeof unsubSb === 'function') unsubSb();
    if (typeof unsubFb === 'function') unsubFb();
  };
}

/**
 * 7. Lấy chuỗi lịch sử timeline (mỗi giờ 1 mốc, ưu tiên Supabase)
 */
export async function getHymetnetHistoryTimeline(limit = 96) {
  try {
    const sbRes = await getTimelineFromSupabase('hymetnet', limit);
    if (sbRes.success && sbRes.data && Object.keys(sbRes.data).length > 0) {
      return sbRes;
    }
  } catch (e) {
    console.warn('[Hymetnet Client] Supabase timeline failed:', e);
  }
  return getHymetnetTimeline(limit);
}

/**
 * 8. Kích hoạt quét và đồng bộ thủ công ngay lập tức
 */
export async function triggerHymetnetManualSync() {
  return await requestHymetnet('/sync-now', {
    method: 'POST',
    timeout: 90000 // Cào toàn bộ 56k tia sét + trạm mưa + radar tốn khoảng 25-35 giây
  });
}

/**
 * 9. Lấy trạng thái đồng bộ và scheduler (ưu tiên Supabase)
 */
export async function fetchHymetnetStatus() {
  try {
    const sbRes = await getSyncStatusFromSupabase('hymetnet');
    if (sbRes.success && sbRes.data) return sbRes;
  } catch (e) {
    console.warn('[Hymetnet Client] Supabase status failed:', e);
  }

  const res = await requestHymetnet('/sync-status', { timeout: 15000 });
  if (res && res.success) {
    return res;
  }

  return getHymetnetSyncStatus();
}

/**
 * 10. Lấy dữ liệu chi tiết của 1 snapshot lịch sử theo snapshotId
 * Ưu tiên đọc từ Supabase (hymetnet_snapshots), fallback Firebase RTDB và backend API
 */
export async function getHymetnetSnapshotData(snapshotId) {
  if (!snapshotId) return { success: false, data: null, message: 'Thiếu mã snapshot' };

  try {
    const sbRes = await getSnapshotFromSupabase('hymetnet', snapshotId);
    if (sbRes.success && sbRes.data) {
      return { success: true, data: sbRes.data, source: 'supabase' };
    }
  } catch (e) {
    console.warn('[Hymetnet Client] Supabase read snapshot failed:', e);
  }

  // 1. Thử đọc từ Firebase RTDB trước (nhanh và trực tiếp)
  try {
    const fbRes = await getHymetnetSnapshot(snapshotId);
    if (fbRes.success && fbRes.data) {
      return { success: true, data: fbRes.data, source: 'firebase' };
    }
  } catch (e) {
    console.warn('[Hymetnet Client] Firebase read snapshot failed:', e);
  }

  // 2. Fallback sang API backend
  const res = await requestHymetnet(`/snapshot/${snapshotId}`, { timeout: 35000 });
  if (res && res.success && res.data) {
    return { success: true, data: res.data, source: res.source || 'backend_api' };
  }

  return {
    success: false,
    data: null,
    message: res?.error || res?.message || `Không thể tải dữ liệu snapshot ${snapshotId}`
  };
}

