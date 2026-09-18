// Firebase configuration & Realtime Database Service for NCHMF Lũ Quét & Sạt Lở
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  push,
  get,
  child,
  onValue,
  query,
  limitToLast,
  serverTimestamp
} from 'firebase/database';
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyBge4vaLT4ADI_wFDtV7h69TeM762w7opk",
  authDomain: "anh-cao-keu.firebaseapp.com",
  databaseURL: "https://anh-cao-keu-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "anh-cao-keu",
  storageBucket: "anh-cao-keu.firebasestorage.app",
  messagingSenderId: "41653851803",
  appId: "1:41653851803:web:da20e36646a8a9d9f0983e",
  measurementId: "G-7N05K492P4"
};

// Initialize Firebase App (singleton)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Realtime Database
export const rtdb = getDatabase(app);

// Initialize Firebase Auth
export const auth = getAuth(app);

export function ensureAuth() {
  return Promise.resolve(auth.currentUser || null);
}

/**
 * 1. Lưu dữ liệu Lũ Quét & Sạt Lở lên Firebase Realtime Database
 * @param {string} layer - 'canh_bao' | 'radar' | 'sat_lo' | 'lu_quet' | 'trong_diem' | 'tram_mua' | 'do_am_dat'
 * @param {any} data - Dữ liệu danh sách hoặc object
 * @param {object} metadata - Thông tin bổ sung (thời gian, tổng số, tỉnh lọc,...)
 * @param {boolean} saveHistory - Có lưu thêm 1 bản ghi lịch sử snapshot không
 */
export async function saveLuquetSatloToRTDB({ layer, data, metadata = {}, saveHistory = false }) {
  if (!layer) throw new Error('Cần chỉ định tên layer để lưu vào Firebase');

  const now = new Date();
  const timestamp = now.toISOString();

  const payload = {
    layer,
    updatedAt: timestamp,
    clientTime: now.toLocaleString('vi-VN'),
    count: Array.isArray(data) ? data.length : 1,
    metadata,
    data
  };

  try {
    await ensureAuth();
    // 1. Lưu bản ghi mới nhất (Latest) tại /luquet_satlo/latest/{layer}
    const latestRef = ref(rtdb, `luquet_satlo/latest/${layer}`);
    await set(latestRef, payload);

    // 2. Nếu cần lưu lịch sử / snapshot
    if (saveHistory) {
      const historyRef = ref(rtdb, `luquet_satlo/history/${layer}`);
      const newHistoryEntry = push(historyRef);
      await set(newHistoryEntry, {
        id: newHistoryEntry.key,
        savedAt: timestamp,
        clientTime: now.toLocaleString('vi-VN'),
        count: payload.count,
        metadata,
        // Với history, nếu dữ liệu quá lớn ta lưu tóm tắt hoặc toàn bộ
        data: Array.isArray(data) && data.length > 2000 ? data.slice(0, 2000) : data
      });
    }

    return {
      success: true,
      message: `Đã lưu thành công dữ liệu "${layer}" lên Firebase Realtime Database`,
      timestamp,
      count: payload.count
    };
  } catch (error) {
    console.error(`Firebase Realtime Database Error (${layer}):`, error);
    throw new Error(error.message || 'Lỗi khi lưu lên Firebase Realtime Database');
  }
}

/**
 * 2. Lấy dữ liệu mới nhất đã lưu từ Firebase Realtime Database
 * @param {string} layer - Tên lớp dữ liệu
 */
export async function fetchLuquetSatloFromRTDB(layer) {
  try {
    await ensureAuth();
    const dbRef = ref(rtdb);
    const snapshot = await get(child(dbRef, `luquet_satlo/latest/${layer}`));

    if (snapshot.exists()) {
      return {
        success: true,
        data: snapshot.val()
      };
    } else {
      return {
        success: false,
        message: `Chưa có dữ liệu "${layer}" được lưu trên Firebase Realtime Database`
      };
    }
  } catch (error) {
    console.error(`Fetch Firebase RTDB Error (${layer}):`, error);
    throw new Error(error.message || 'Lỗi khi tải từ Firebase Realtime Database');
  }
}

/**
 * 3. Lấy danh sách lịch sử snapshot gần nhất của một layer
 * @param {string} layer
 * @param {number} limitCount
 */
export async function fetchLuquetSatloHistory(layer, limitCount = 10) {
  try {
    const historyQuery = query(
      ref(rtdb, `luquet_satlo/history/${layer}`),
      limitToLast(limitCount)
    );
    const snapshot = await get(historyQuery);

    if (snapshot.exists()) {
      const val = snapshot.val();
      const list = Object.keys(val).map((k) => ({
        id: k,
        ...val[k]
      })).reverse(); // Mới nhất lên đầu
      return { success: true, data: list };
    }
    return { success: true, data: [] };
  } catch (error) {
    console.error(`Fetch Firebase History Error (${layer}):`, error);
    throw new Error(error.message || 'Lỗi khi tải lịch sử từ Firebase');
  }
}

/**
 * 4. Lắng nghe thay đổi Realtime (Subcribe)
 * @param {string} layer
 * @param {function} callback
 */
export function subscribeToLuquetSatlo(layer, callback) {
  const targetRef = ref(rtdb, `luquet_satlo/latest/${layer}`);
  const unsubscribe = onValue(
    targetRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback({ success: true, data: snapshot.val() });
      } else {
        callback({ success: false, data: null });
      }
    },
    (error) => {
      callback({ success: false, error: error.message });
    }
  );
  return unsubscribe;
}

/**
 * Helper: Tính toán các chỉ số thống kê tổng hợp từ danh sách cảnh báo
 */
export function computeStatisticsSummary(canhBaoList = []) {
  if (!Array.isArray(canhBaoList) || canhBaoList.length === 0) {
    return {
      totalCommunes: 0,
      ratCao: 0,
      cao: 0,
      trungBinh: 0,
      khongCo: 0,
      maxRain: 0,
      avgRain: 0,
      topProvinces: []
    };
  }

  let ratCao = 0;
  let cao = 0;
  let trungBinh = 0;
  let khongCo = 0;
  let maxRain = 0;
  let totalRain = 0;
  const provMap = {};

  for (const item of canhBaoList) {
    const sl = (item.nguyco_satlo || '').toLowerCase();
    const lq = (item.nguyco_luquet || '').toLowerCase();

    if (sl.includes('rất cao') || lq.includes('rất cao') || sl.includes('rat cao') || lq.includes('rat cao')) {
      ratCao++;
    } else if (sl.includes('cao') || lq.includes('cao')) {
      cao++;
    } else if (sl.includes('trung') || lq.includes('trung')) {
      trungBinh++;
    } else {
      khongCo++;
    }

    const rain = item.luongmua_tong || item.luongmua_thucdo || 0;
    if (rain > maxRain) maxRain = rain;
    totalRain += rain;

    const prov = item.province_name || 'Khác';
    if (!provMap[prov]) {
      provMap[prov] = { province: prov, count: 0, maxRain: 0, ratCao: 0, cao: 0 };
    }
    provMap[prov].count++;
    if (rain > provMap[prov].maxRain) provMap[prov].maxRain = rain;
    if (sl.includes('rất cao') || lq.includes('rất cao')) provMap[prov].ratCao++;
    else if (sl.includes('cao') || lq.includes('cao')) provMap[prov].cao++;
  }

  const topProvinces = Object.values(provMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalCommunes: canhBaoList.length,
    ratCao,
    cao,
    trungBinh,
    khongCo,
    maxRain: Math.round(maxRain * 10) / 10,
    avgRain: Math.round((totalRain / canhBaoList.length) * 10) / 10,
    topProvinces
  };
}

/**
 * 5. Tự động lưu Snapshot đầy đủ & Chỉ số Thống kê nhẹ (phục vụ biểu đồ)
 * Lưu trữ phân tầng với cơ chế Chống trùng lặp (Deduplication) & Không ghi đè theo thời gian:
 * - /luquet_satlo/snapshots/{snapshot_id} (Dữ liệu chi tiết các xã)
 * - /luquet_satlo/statistics/timeline/{snapshot_id} (Dữ liệu thống kê nhẹ)
 */
export async function saveAutoSyncSnapshot({
  canhBaoData = [],
  radarData = null,
  satLoData = [],
  luQuetData = [],
  trongDiemData = [],
  tramMuaData = [],
  actualDate = '',
  source = 'client',
  forceSave = false
}) {
  const now = new Date();
  const timestamp = now.toISOString();
  const pad = (n) => String(n).padStart(2, '0');

  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());

  const summary = computeStatisticsSummary(canhBaoData);

  // Tạo chữ ký dữ liệu để phát hiện trùng lặp
  const cleanActual = (actualDate || '').trim();
  const dataSignature = `${cleanActual}_communes:${summary.totalCommunes}_rc:${summary.ratCao}_c:${summary.cao}_maxR:${summary.maxRain}_sl:${satLoData?.length || 0}_lq:${luQuetData?.length || 0}_td:${trongDiemData?.length || 0}`;

  // Kiểm tra chống trùng lặp nếu không phải ép buộc lưu (forceSave)
  try {
    if (!forceSave) {
      const statusRef = ref(rtdb, 'luquet_satlo/auto_sync_status');
      const statusSnap = await get(statusRef);
      if (statusSnap.exists()) {
        const lastStatus = statusSnap.val();
        if (lastStatus && lastStatus.lastDataSignature === dataSignature) {
          // Dữ liệu NCHMF không thay đổi, cập nhật thời gian xác thực mà không tạo snapshot trùng lặp
          await set(ref(rtdb, 'luquet_satlo/auto_sync_status/lastVerifiedAt'), timestamp);
          await set(ref(rtdb, 'luquet_satlo/auto_sync_status/lastCheckMessage'), `Dữ liệu NCHMF không đổi (${summary.totalCommunes} xã) lúc ${now.toLocaleTimeString('vi-VN')}`);
          
          return {
            success: true,
            isDuplicate: true,
            snapshotId: lastStatus.lastSnapshotId,
            summary,
            message: `Dữ liệu NCHMF (${summary.totalCommunes} xã) chưa có cập nhật mới so với mốc gần nhất. Bỏ qua ghi trùng lặp.`
          };
        }
      }
    }
  } catch (dupCheckErr) {
    console.warn('[Firebase] Bỏ qua kiểm tra trùng lặp:', dupCheckErr.message);
  }

  // Tạo snapshotId theo thời gian chi tiết (YYYYMMDD_HHmm hoặc thêm giây nếu forceSave)
  let snapshotId = '';
  if (actualDate) {
    const digits = actualDate.replace(/[^0-9]/g, '');
    if (digits.length >= 12) {
      snapshotId = `${digits.slice(0, 8)}_${digits.slice(8, 12)}`;
    } else if (digits.length >= 10) {
      snapshotId = `${digits.slice(0, 8)}_${digits.slice(8, 10)}00`;
    }
  }

  if (!snapshotId || forceSave) {
    snapshotId = forceSave
      ? `${year}${month}${day}_${hour}${minute}_${second}`
      : `${year}${month}${day}_${hour}${minute}`;
  }

  const timeStr = `${hour}:${minute}`;
  const dateStr = `${year}-${month}-${day}`;

  const counts = {
    canh_bao: Array.isArray(canhBaoData) ? canhBaoData.length : 0,
    radar: radarData ? (radarData.timeline?.length || 1) : 0,
    sat_lo: Array.isArray(satLoData) ? satLoData.length : 0,
    lu_quet: Array.isArray(luQuetData) ? luQuetData.length : 0,
    trong_diem: Array.isArray(trongDiemData) ? trongDiemData.length : 0,
    tram_mua: Array.isArray(tramMuaData) ? tramMuaData.length : 0
  };

  const timelinePayload = {
    snapshotId,
    timestamp,
    date: dateStr,
    time: timeStr,
    hour: `${hour}:00`,
    displayTime: `${timeStr} ${day}/${month}/${year}`,
    actualDate: actualDate || `${dateStr} ${timeStr}:00`,
    totalCommunes: summary.totalCommunes,
    ratCao: summary.ratCao,
    cao: summary.cao,
    trungBinh: summary.trungBinh,
    maxRain: summary.maxRain,
    avgRain: summary.avgRain,
    topProvinces: summary.topProvinces.slice(0, 5),
    radarCurrentFrame: radarData?.currentFrame?.time_vn || null,
    counts,
    dataSignature,
    source
  };

  const fullSnapshotPayload = {
    ...timelinePayload,
    summary,
    counts,
    data: canhBaoData, // tương thích các màn hình cũ
    layers: {
      canh_bao: canhBaoData,
      radar: radarData,
      sat_lo: satLoData,
      lu_quet: luQuetData,
      trong_diem: trongDiemData,
      tram_mua: tramMuaData
    },
    radar: radarData ? {
      bounds: radarData.bounds,
      currentFrame: radarData.currentFrame,
      timelineCount: radarData.timeline?.length || 0
    } : null
  };

  try {
    // Ghi đồng thời vào Snapshot chi tiết, Timeline thống kê và cập nhật latest cho TẤT CẢ các lớp
    const snapshotRef = ref(rtdb, `luquet_satlo/snapshots/${snapshotId}`);
    const timelineRef = ref(rtdb, `luquet_satlo/statistics/timeline/${snapshotId}`);
    const statusRef = ref(rtdb, `luquet_satlo/auto_sync_status`);

    const updatePromises = [
      set(snapshotRef, fullSnapshotPayload),
      set(timelineRef, timelinePayload),
      set(statusRef, {
        lastSync: timestamp,
        lastSnapshotId: snapshotId,
        lastDataSignature: dataSignature,
        lastTotalCommunes: summary.totalCommunes,
        lastMaxRain: summary.maxRain,
        lastActualDate: actualDate || timelinePayload.actualDate,
        counts,
        source,
        updatedAt: now.toLocaleString('vi-VN'),
        lastCheckMessage: `Đã lưu snapshot "${snapshotId}" (tất cả các lớp) thành công`
      })
    ];

    if (canhBaoData && canhBaoData.length > 0) {
      updatePromises.push(set(ref(rtdb, 'luquet_satlo/latest/canh_bao'), {
        updatedAt: timestamp,
        clientTime: now.toLocaleString('vi-VN'),
        count: canhBaoData.length,
        actualDate,
        data: canhBaoData
      }));
    }
    if (radarData) {
      updatePromises.push(set(ref(rtdb, 'luquet_satlo/latest/radar'), {
        updatedAt: timestamp,
        clientTime: now.toLocaleString('vi-VN'),
        count: 1,
        data: radarData
      }));
    }
    if (satLoData && satLoData.length > 0) {
      updatePromises.push(set(ref(rtdb, 'luquet_satlo/latest/sat_lo'), {
        updatedAt: timestamp,
        clientTime: now.toLocaleString('vi-VN'),
        count: satLoData.length,
        data: satLoData
      }));
    }
    if (luQuetData && luQuetData.length > 0) {
      updatePromises.push(set(ref(rtdb, 'luquet_satlo/latest/lu_quet'), {
        updatedAt: timestamp,
        clientTime: now.toLocaleString('vi-VN'),
        count: luQuetData.length,
        data: luQuetData
      }));
    }
    if (trongDiemData && trongDiemData.length > 0) {
      updatePromises.push(set(ref(rtdb, 'luquet_satlo/latest/trong_diem'), {
        updatedAt: timestamp,
        clientTime: now.toLocaleString('vi-VN'),
        count: trongDiemData.length,
        data: trongDiemData
      }));
    }
    if (tramMuaData && tramMuaData.length > 0) {
      updatePromises.push(set(ref(rtdb, 'luquet_satlo/latest/tram_mua'), {
        updatedAt: timestamp,
        clientTime: now.toLocaleString('vi-VN'),
        count: tramMuaData.length,
        data: tramMuaData
      }));
    }

    await Promise.all(updatePromises);

    return {
      success: true,
      isDuplicate: false,
      snapshotId,
      summary,
      counts,
      message: `Đã lưu thành công snapshot "${snapshotId}" (tất cả các lớp: ${counts.canh_bao} xã, ${counts.sat_lo} điểm sạt lở, ${counts.lu_quet} lũ quét, ${counts.trong_diem} trọng điểm) vào CSDL`
    };
  } catch (error) {
    console.error('saveAutoSyncSnapshot error:', error);
    throw new Error(error.message || 'Lỗi khi lưu snapshot tự động vào Firebase');
  }
}

/**
 * 6. Lấy toàn bộ chuỗi thời gian thống kê (Timeline) để vẽ biểu đồ và phân tích
 */
export async function fetchStatisticsTimeline(limitCount = 100) {
  try {
    await ensureAuth();
    const timelineQuery = query(
      ref(rtdb, 'luquet_satlo/statistics/timeline'),
      limitToLast(limitCount)
    );
    const snapshot = await get(timelineQuery);

    if (snapshot.exists()) {
      const val = snapshot.val();
      const list = Object.keys(val).map((k) => ({
        id: k,
        ...val[k]
      }));
      // Sắp xếp theo thời gian tăng dần để vẽ biểu đồ từ quá khứ đến hiện tại
      list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return { success: true, data: list };
    }
    return { success: true, data: [] };
  } catch (error) {
    console.error('fetchStatisticsTimeline error:', error);
    throw new Error(error.message || 'Lỗi khi lấy dữ liệu thống kê chuỗi thời gian');
  }
}

/**
 * 7. Lấy chi tiết toàn bộ các xã của một Snapshot lịch sử
 */
export async function fetchSnapshotDetail(snapshotId) {
  try {
    const snapshotRef = ref(rtdb, `luquet_satlo/snapshots/${snapshotId}`);
    const res = await get(snapshotRef);
    if (res.exists()) {
      return { success: true, data: res.val() };
    }
    return { success: false, message: 'Không tìm thấy snapshot này' };
  } catch (error) {
    console.error('fetchSnapshotDetail error:', error);
    throw new Error(error.message || 'Lỗi khi tải chi tiết snapshot');
  }
}

/**
 * 8. Xóa một snapshot khỏi CSDL
 */
export async function deleteSnapshot(snapshotId) {
  try {
    const snapshotRef = ref(rtdb, `luquet_satlo/snapshots/${snapshotId}`);
    const timelineRef = ref(rtdb, `luquet_satlo/statistics/timeline/${snapshotId}`);
    await Promise.all([
      set(snapshotRef, null),
      set(timelineRef, null)
    ]);
    return { success: true, message: `Đã xóa thành công snapshot "${snapshotId}"` };
  } catch (error) {
    console.error('deleteSnapshot error:', error);
    throw new Error(error.message || 'Lỗi khi xóa snapshot');
  }
}

/**
 * 9. Lấy trạng thái tự động quét từ CSDL
 */
export async function fetchAutoSyncStatus() {
  try {
    const statusRef = ref(rtdb, 'luquet_satlo/auto_sync_status');
    const res = await get(statusRef);
    if (res.exists()) {
      return { success: true, data: res.val() };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error('fetchAutoSyncStatus error:', error);
    return { success: false, data: null };
  }
}

/**
 * 10. Quản lý Đăng nhập & Phân quyền ứng dụng (Spotlight VnExpress)
 */
export const SPOTLIGHT_AUTH_KEY = 'data_crawler_auth_user';
export const ALLOWED_USER = {
  email: 'spotlight.vnexpress@gmail.com',
  name: 'Ban Spotlight',
  agency: 'VnExpress Data Journalism'
};

export function getStoredAuthUser() {
  try {
    const raw = localStorage.getItem(SPOTLIGHT_AUTH_KEY) || sessionStorage.getItem(SPOTLIGHT_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email && parsed.email.toLowerCase() === ALLOWED_USER.email.toLowerCase()) {
      return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function loginWithSpotlightCredentials(email, password, rememberMe = true) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const trimmedPassword = (password || '').trim();

  if (normalizedEmail !== ALLOWED_USER.email || trimmedPassword !== 'datajournalism2023') {
    throw new Error('Email hoặc mật khẩu không chính xác. Hệ thống chỉ cho phép tài khoản được ủy quyền.');
  }

  const userSession = {
    email: ALLOWED_USER.email,
    displayName: ALLOWED_USER.name,
    agency: ALLOWED_USER.agency,
    loggedInAt: new Date().toISOString()
  };

  if (rememberMe) {
    localStorage.setItem(SPOTLIGHT_AUTH_KEY, JSON.stringify(userSession));
  } else {
    sessionStorage.setItem(SPOTLIGHT_AUTH_KEY, JSON.stringify(userSession));
  }

  return userSession;
}

export async function logoutSpotlightUser() {
  try {
    localStorage.removeItem(SPOTLIGHT_AUTH_KEY);
    sessionStorage.removeItem(SPOTLIGHT_AUTH_KEY);
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch (e) {
    console.warn('Logout error:', e);
  }
}

