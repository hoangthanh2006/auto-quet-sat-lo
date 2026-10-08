/**
 * Client-Side Service cho Vrain (https://vrain.vn/) - dữ liệu đo mưa.
 * - Ưu tiên đọc từ Firebase Realtime Database
 * - Fallback sang API backend Express (/api/vrain/*)
 */

import {
  getVrainLatest,
  listenToVrainLatest,
  getVrainTimeline,
  getVrainSyncStatus,
  getVrainSnapshot
} from './firebase.js';
import {
  getLatestDataFromSupabase,
  subscribeLatestDataFromSupabase,
  getTimelineFromSupabase,
  getSnapshotFromSupabase,
  getSyncStatusFromSupabase
} from './supabaseClient.js';
import { getApiBaseUrl, isHtmlResponse, BACKEND_REQUIRED_MSG } from './api.js';

export const getVrainApiBase = () => `${getApiBaseUrl()}/vrain`;

async function requestVrain(endpoint, options = {}) {
  const url = `${getVrainApiBase()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const timeoutMs = options.timeout || 60000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'Accept': 'application/json', ...(options.headers || {}) }
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
        error: 'Quá thời gian chờ (Timeout). Vui lòng thử lại sau giây lát.',
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

/** Dữ liệu Vrain mới nhất (Ưu tiên Supabase, fallback Firebase & backend) */
export async function getVrainLatestData() {
  try {
    const sbRes = await getLatestDataFromSupabase('vrain');
    if (sbRes.success && sbRes.data) {
      return { success: true, data: sbRes.data, source: 'supabase' };
    }
  } catch (e) {
    console.warn('[Vrain Client] Supabase read failed:', e);
  }

  try {
    const fbRes = await getVrainLatest();
    if (fbRes.success && fbRes.data) {
      return { success: true, data: fbRes.data, source: 'firebase' };
    }
  } catch (e) {
    console.warn('[Vrain Client] Firebase read failed, fallback to backend API:', e);
  }

  const res = await requestVrain('/all', { timeout: 30000 });
  if (res && res.success) {
    return { success: true, data: res.data || res, source: 'backend_api' };
  }
  return {
    success: false,
    data: null,
    message: res?.error || res?.message || 'Không thể tải dữ liệu Vrain'
  };
}

/** Lắng nghe dữ liệu Vrain thời gian thực (Supabase Realtime + Firebase) */
export function subscribeVrainRealtime(onData) {
  const unsubSb = subscribeLatestDataFromSupabase('vrain', (data) => {
    if (data) onData({ success: true, data });
  });
  const unsubFb = listenToVrainLatest(onData);

  return () => {
    if (typeof unsubSb === 'function') unsubSb();
    if (typeof unsubFb === 'function') unsubFb();
  };
}

/** Timeline lịch sử (mỗi giờ 1 mốc, ưu tiên Supabase) */
export async function getVrainHistoryTimeline(limit = 2000) {
  try {
    const sbRes = await getTimelineFromSupabase('vrain', limit);
    if (sbRes.success && Array.isArray(sbRes.data) && sbRes.data.length > 0) {
      return sbRes;
    }
  } catch (e) {
    console.warn('[Vrain Client] Supabase timeline failed:', e);
  }
  return getVrainTimeline(limit);
}

/** Quét & đồng bộ thủ công (cần backend) */
export async function triggerVrainManualSync() {
  return await requestVrain('/sync-now', { method: 'POST', timeout: 90000 });
}

/** Trạng thái đồng bộ (ưu tiên Supabase) */
export async function fetchVrainStatus() {
  try {
    const sbRes = await getSyncStatusFromSupabase('vrain');
    if (sbRes.success && sbRes.data) return sbRes;
  } catch (e) {
    console.warn('[Vrain Client] Supabase status failed:', e);
  }
  const res = await requestVrain('/sync-status', { timeout: 15000 });
  if (res && res.success) return res;
  return getVrainSyncStatus();
}

/** Chi tiết 1 snapshot lịch sử (ưu tiên Supabase) */
export async function getVrainSnapshotData(snapshotId) {
  if (!snapshotId) return { success: false, data: null, message: 'Thiếu mã snapshot' };

  try {
    const sbRes = await getSnapshotFromSupabase('vrain', snapshotId);
    if (sbRes.success && sbRes.data) {
      return { success: true, data: sbRes.data, source: 'supabase' };
    }
  } catch (e) {
    console.warn('[Vrain Client] Supabase snapshot failed:', e);
  }

  try {
    const fbRes = await getVrainSnapshot(snapshotId);
    if (fbRes.success && fbRes.data) {
      return { success: true, data: fbRes.data, source: 'firebase' };
    }
  } catch (e) {
    console.warn('[Vrain Client] Firebase read snapshot failed:', e);
  }

  const res = await requestVrain(`/snapshot/${snapshotId}`, { timeout: 35000 });
  if (res && res.success && res.data) {
    return { success: true, data: res.data, source: res.source || 'backend_api' };
  }
  return {
    success: false,
    data: null,
    message: res?.error || res?.message || `Không thể tải dữ liệu snapshot ${snapshotId}`
  };
}
