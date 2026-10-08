/**
 * Standalone & Integrated Background Auto-Sync Worker for NCHMF Lũ Quét & Sạt Lở
 * Tự động quét dữ liệu mới nhất mỗi giờ một lần (Hourly Backup) và lưu trữ vào Firebase Realtime Database
 * phục vụ biểu đồ xu hướng và thống kê lịch sử dài hạn.
 * 
 * Cách dùng:
 * 1. Chạy 1 lần:        node server/autoSyncNCHMF.js
 * 2. Chạy ngầm định kỳ: node server/autoSyncNCHMF.js --watch --interval 60
 */

import {
  getCanhbaoSLLQ,
  getRadarData,
  getDiemDaXayRaSatLo,
  getDiemDaXayRaLuQuet,
  getTrongDiemSLLQ,
  getTramMua
} from './luquetSatloService.js';
import { crawlLakeWater, crawlRiverWater } from './environmentalService.js';
import { saveNCHMFToSupabase } from './supabaseService.js';
import { autoUploadDailyBackupToDrive } from './driveService.js';

const FIREBASE_DB_URL = 'https://anh-cao-keu-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_API_KEY = 'AIzaSyBge4vaLT4ADI_wFDtV7h69TeM762w7opk';

let cachedAuthToken = null;
let tokenExpiresAt = 0;

export async function getFirebaseAuthToken() {
  const now = Date.now();
  if (cachedAuthToken && now < tokenExpiresAt - 60000) {
    return cachedAuthToken;
  }

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'spotlight.vnexpress@gmail.com',
        password: 'datajournalism2023',
        returnSecureToken: true
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Firebase Auth] Failed to get token: HTTP ${res.status}: ${errText}`);
      return null;
    }

    const data = await res.json();
    cachedAuthToken = data.idToken;
    tokenExpiresAt = now + (parseInt(data.expiresIn, 10) || 3600) * 1000;
    return cachedAuthToken;
  } catch (err) {
    console.error('[Firebase Auth Error]:', err.message);
    return null;
  }
}

export async function fetchFirebaseRTDB(path, options = {}) {
  const token = await getFirebaseAuthToken();
  const sep = path.includes('?') ? '&' : '?';
  const url = `${FIREBASE_DB_URL}${path}${token ? `${sep}auth=${token}` : ''}`;
  return fetch(url, options);
}

// Trạng thái Scheduler chạy ngầm trên Server
const schedulerState = {
  active: false,
  intervalMinutes: 60,
  timerId: null,
  lastRunAt: null,
  nextRunAt: null,
  totalRuns: 0,
  lastResult: null,
  lastError: null
};

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
 * Thực hiện 1 lượt quét NCHMF và đẩy vào Firebase Realtime Database
 * Quét & Lưu TẤT CẢ các lớp: Cảnh báo, Radar, Điểm sạt lở, Điểm lũ quét, Trọng điểm, Trạm mưa.
 * Đảm bảo ghi nhận mốc giờ chuẩn (Hourly Slot) để biểu đồ xu hướng không bị đứt đoạn.
 */
export async function runAutoSyncOnce(options = {}) {
  const { forceSave = false, source = 'server_hourly_worker' } = options;
  const startTime = Date.now();
  const now = new Date();
  console.log(`\n[${now.toLocaleString('vi-VN')}] 🚀 [Hourly Backup] Bắt đầu quét & sao lưu TẤT CẢ các lớp dữ liệu NCHMF...`);

  try {
    // 1. Cào song song TẤT CẢ các lớp dữ liệu NCHMF
    const [canhBaoRes, radarRes, satLoRes, luQuetRes, trongDiemRes, tramMuaRes] = await Promise.allSettled([
      getCanhbaoSLLQ({ sogiodubao: 6, autoFallback: true }),
      getRadarData(),
      getDiemDaXayRaSatLo(),
      getDiemDaXayRaLuQuet(),
      getTrongDiemSLLQ(),
      getTramMua()
    ]);

    const canhBaoList = canhBaoRes.status === 'fulfilled' && canhBaoRes.value?.success ? canhBaoRes.value.data : [];
    const actualDate = canhBaoRes.status === 'fulfilled' && canhBaoRes.value?.actualDate ? canhBaoRes.value.actualDate : '';
    const radarData = radarRes.status === 'fulfilled' && radarRes.value?.success ? radarRes.value.data : null;
    const satLoList = satLoRes.status === 'fulfilled' && satLoRes.value?.success ? satLoRes.value.data : [];
    const luQuetList = luQuetRes.status === 'fulfilled' && luQuetRes.value?.success ? luQuetRes.value.data : [];
    const trongDiemList = trongDiemRes.status === 'fulfilled' && trongDiemRes.value?.success ? trongDiemRes.value.data : [];
    const tramMuaList = tramMuaRes.status === 'fulfilled' && tramMuaRes.value?.success ? tramMuaRes.value.data : [];

    console.log(`[NCHMF] Kết quả quét TẤT CẢ CÁC LỚP:`);
    console.log(`  • Cảnh báo: ${canhBaoList.length} xã (Thời điểm bản tin: ${actualDate || 'N/A'})`);
    console.log(`  • Radar: ${radarData ? 'OK' : 'N/A'}`);
    console.log(`  • Điểm đã xảy ra sạt lở: ${satLoList.length} điểm`);
    console.log(`  • Điểm đã xảy ra lũ quét: ${luQuetList.length} điểm`);
    console.log(`  • Trọng điểm sạt lở lũ quét: ${trongDiemList.length} điểm`);
    console.log(`  • Trạm đo mưa: ${tramMuaList.length} trạm`);

    if (canhBaoList.length === 0 && satLoList.length === 0) {
      console.warn('[NCHMF] ⚠️ Không có dữ liệu để lưu tại thời điểm này. Bỏ qua ghi snapshot.');
      return { success: false, message: 'Không có dữ liệu để lưu' };
    }

    // 2. Tính toán các chỉ số thống kê tổng hợp
    const summary = computeStatisticsSummary(canhBaoList);
    const timestamp = now.toISOString();
    const pad = (n) => String(n).padStart(2, '0');

    // Chuyển đổi chuẩn xác sang giờ Việt Nam (UTC+7) bất kể môi trường chạy (GitHub Actions UTC hay Local)
    const vnTimeMs = now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60 * 1000;
    const vnDate = new Date(vnTimeMs);

    const year = vnDate.getFullYear();
    const month = pad(vnDate.getMonth() + 1);
    const day = pad(vnDate.getDate());
    const hour = pad(vnDate.getHours());
    const minute = pad(vnDate.getMinutes());

    const counts = {
      canh_bao: canhBaoList.length,
      radar: radarData ? (radarData.timeline?.length || 1) : 0,
      sat_lo: satLoList.length,
      lu_quet: luQuetList.length,
      trong_diem: trongDiemList.length,
      tram_mua: tramMuaList.length
    };

    const cleanActual = (actualDate || '').trim();
    const dataSignature = `${cleanActual}_communes:${summary.totalCommunes}_rc:${summary.ratCao}_c:${summary.cao}_maxR:${summary.maxRain}_sl:${counts.sat_lo}_lq:${counts.lu_quet}_td:${counts.trong_diem}`;

    // Khóa snapshot chuẩn theo mốc giờ Việt Nam (Hourly Slot YYYYMMDD_HH00)
    // Đảm bảo mỗi giờ một snapshot cố định cho biểu đồ xu hướng
    const hourlySnapshotId = `${year}${month}${day}_${hour}00`;
    
    // Mốc snapshot chi tiết theo bản tin thực tế (nếu có)
    let bulletinSnapshotId = '';
    if (actualDate) {
      const digits = actualDate.replace(/[^0-9]/g, '');
      if (digits.length >= 12) {
        bulletinSnapshotId = `${digits.slice(0, 8)}_${digits.slice(8, 12)}`;
      } else if (digits.length >= 10) {
        bulletinSnapshotId = `${digits.slice(0, 8)}_${digits.slice(8, 10)}00`;
      }
    }

    const timeStr = `${hour}:00`;
    const dateStr = `${year}-${month}-${day}`;

    // 3. Chuẩn bị payload hợp nhất theo mốc giờ chuẩn
    const timelinePayload = {
      snapshotId: hourlySnapshotId,
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
      data: canhBaoList, // tương thích các màn hình cũ
      layers: {
        canh_bao: canhBaoList,
        radar: radarData,
        sat_lo: satLoList,
        lu_quet: luQuetList,
        trong_diem: trongDiemList,
        tram_mua: tramMuaList
      },
      radar: radarData ? {
        bounds: radarData.bounds,
        currentFrame: radarData.currentFrame,
        timelineCount: radarData.timeline?.length || 0
      } : null
    };

    // 4. Lưu vào Supabase Database (Chính thức)
    console.log(`[Supabase] Đang lưu dữ liệu NCHMF Lũ quét sạt lở mốc "${hourlySnapshotId}"...`);
    await saveNCHMFToSupabase({
      hourlySnapshotId,
      bulletinSnapshotId,
      timelinePayload,
      snapshotPayload: fullSnapshotPayload,
      summary,
      counts,
      actualDate
    });

    // 5. Đẩy lên Firebase Realtime Database qua REST API (sao lưu phụ)
    console.log(`[Firebase] Đang ghi sao lưu mốc giờ chuẩn "${hourlySnapshotId}" (${hour}:00)...`);
    
    const updatePromises = [
      // 1. Lưu snapshot chi tiết theo mốc giờ
      fetchFirebaseRTDB(`/luquet_satlo/snapshots/${hourlySnapshotId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullSnapshotPayload)
      }),
      // 2. Lưu mốc timeline theo giờ
      fetchFirebaseRTDB(`/luquet_satlo/statistics/timeline/${hourlySnapshotId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timelinePayload)
      }),
      // 3. Cập nhật trạng thái sao lưu toàn hệ thống
      fetchFirebaseRTDB(`/luquet_satlo/auto_sync_status.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastSync: timestamp,
          lastSnapshotId: hourlySnapshotId,
          lastDataSignature: dataSignature,
          lastTotalCommunes: summary.totalCommunes,
          lastMaxRain: summary.maxRain,
          lastActualDate: actualDate || timelinePayload.actualDate,
          counts,
          source,
          hourlySchedulerActive: true,
          updatedAt: now.toLocaleString('vi-VN'),
          lastCheckMessage: `Đã sao lưu mốc ${hour}:00 ngày ${day}/${month} (${summary.totalCommunes} xã) thành công`
        })
      })
    ];

    // Nếu có mốc bản tin cụ thể khác mốc giờ, lưu thêm bản tin gốc
    if (bulletinSnapshotId && bulletinSnapshotId !== hourlySnapshotId) {
      updatePromises.push(
        fetchFirebaseRTDB(`/luquet_satlo/snapshots/${bulletinSnapshotId}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...fullSnapshotPayload, snapshotId: bulletinSnapshotId })
        }),
        fetchFirebaseRTDB(`/luquet_satlo/statistics/timeline/${bulletinSnapshotId}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...timelinePayload, snapshotId: bulletinSnapshotId, time: actualDate.split(' ')[1] || timeStr })
        })
      );
    }

    // Cập nhật node latest/{layer} cho mọi lớp để UI luôn có dữ liệu mới nhất
    if (canhBaoList.length > 0) {
      updatePromises.push(fetchFirebaseRTDB(`/luquet_satlo/latest/canh_bao.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: timestamp, clientTime: now.toLocaleString('vi-VN'), count: canhBaoList.length, actualDate, data: canhBaoList })
      }));
    }
    if (radarData) {
      updatePromises.push(fetchFirebaseRTDB(`/luquet_satlo/latest/radar.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: timestamp, clientTime: now.toLocaleString('vi-VN'), count: 1, data: radarData })
      }));
    }
    if (satLoList.length > 0) {
      updatePromises.push(fetchFirebaseRTDB(`/luquet_satlo/latest/sat_lo.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: timestamp, clientTime: now.toLocaleString('vi-VN'), count: satLoList.length, data: satLoList })
      }));
    }
    if (luQuetList.length > 0) {
      updatePromises.push(fetchFirebaseRTDB(`/luquet_satlo/latest/lu_quet.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: timestamp, clientTime: now.toLocaleString('vi-VN'), count: luQuetList.length, data: luQuetList })
      }));
    }
    if (trongDiemList.length > 0) {
      updatePromises.push(fetchFirebaseRTDB(`/luquet_satlo/latest/trong_diem.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: timestamp, clientTime: now.toLocaleString('vi-VN'), count: trongDiemList.length, data: trongDiemList })
      }));
    }
    if (tramMuaList.length > 0) {
      updatePromises.push(fetchFirebaseRTDB(`/luquet_satlo/latest/tram_mua.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: timestamp, clientTime: now.toLocaleString('vi-VN'), count: tramMuaList.length, data: tramMuaList })
      }));
    }

    // Đồng bộ thêm Nước Hồ Chứa & Mực Nước Sông vào Firebase RTDB phục vụ Web Static
    crawlLakeWater().then((lakeRes) => {
      if (lakeRes?.success && lakeRes.data?.length > 0) {
        fetchFirebaseRTDB(`/environmental/latest/lake_water.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updatedAt: timestamp,
            clientTime: now.toLocaleString('vi-VN'),
            count: lakeRes.data.length,
            data: lakeRes.data
          })
        }).catch(err => console.warn('[Firebase] Lake water sync error:', err.message));
      }
    }).catch(err => console.warn('[Lake Sync] Error:', err.message));

    crawlRiverWater('7').then((riverRes) => {
      if (riverRes?.success && riverRes.data?.length > 0) {
        fetchFirebaseRTDB(`/environmental/latest/river_water.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updatedAt: timestamp,
            clientTime: now.toLocaleString('vi-VN'),
            totalRecords: riverRes.totalRecords,
            stationsCount: riverRes.stationsCount,
            stations: riverRes.stations,
            data: riverRes.data
          })
        }).catch(err => console.warn('[Firebase] River water sync error:', err.message));
      }
    }).catch(err => console.warn('[River Sync] Error:', err.message));

    const results = await Promise.all(updatePromises);
    if (!results[0].ok || !results[1].ok) {
      throw new Error(`Firebase RTDB REST error: ${results[0].status} / ${results[1].status}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Firebase] ✅ Thành công! Đã sao lưu snapshot mốc giờ "${hourlySnapshotId}" (${summary.totalCommunes} xã, Rất cao: ${summary.ratCao}, Cao: ${summary.cao}, Max mưa: ${summary.maxRain}mm) trong ${elapsed}s.`);

    // 6. Tự động sao lưu lên Google Drive theo ngày (folder: 1Az5eQhaIPBfmdef8G3gPKv_O_YqqE4G6)
    try {
      await autoUploadDailyBackupToDrive({
        type: 'luquet_satlo',
        date: dateStr,
        fileName: `luquet_satlo_${hourlySnapshotId}.json`,
        content: fullSnapshotPayload
      });
    } catch (driveErr) {
      console.warn('[Drive Backup] ⚠️ Lỗi khi lưu Google Drive:', driveErr.message);
    }

    schedulerState.lastRunAt = now.toISOString();
    schedulerState.totalRuns++;
    schedulerState.lastResult = {
      snapshotId: hourlySnapshotId,
      totalCommunes: summary.totalCommunes,
      ratCao: summary.ratCao,
      cao: summary.cao,
      maxRain: summary.maxRain,
      elapsed
    };
    schedulerState.lastError = null;

    return {
      success: true,
      snapshotId: hourlySnapshotId,
      summary,
      elapsed
    };
  } catch (error) {
    console.error(`[Firebase Auto-Sync Error]:`, error);
    schedulerState.lastError = error.message;
    return { success: false, error: error.message };
  }
}

/**
 * Khởi tạo tiến trình quét & sao lưu tự động định kỳ mỗi giờ (Hourly Background Worker)
 */
export function startHourlyAutoSync(intervalMinutes = 60) {
  if (schedulerState.active) {
    console.log(`[NCHMF Scheduler] Tiến trình sao lưu mỗi giờ đã đang chạy.`);
    return schedulerState;
  }

  schedulerState.active = true;
  schedulerState.intervalMinutes = intervalMinutes;

  console.log(`\n===============================================================`);
  console.log(`🕒 [NCHMF Scheduler] Khởi động tiến trình Tự Động Sao Lưu Mỗi Giờ 1 Lần`);
  console.log(`   Chu kỳ: Mỗi ${intervalMinutes} phút (24/7 tự động quét & sao lưu vào Firebase)`);
  console.log(`===============================================================\n`);

  // Chạy lần đầu tiên sau 3 giây khi server khởi động
  setTimeout(() => {
    runAutoSyncOnce({ source: 'server_startup' }).catch(console.error);
  }, 3000);

  // Thiết lập interval quét định kỳ mỗi giờ (60 phút)
  schedulerState.timerId = setInterval(() => {
    const nextDate = new Date(Date.now() + intervalMinutes * 60 * 1000);
    schedulerState.nextRunAt = nextDate.toISOString();
    runAutoSyncOnce({ source: 'server_hourly_interval' }).catch(console.error);
  }, intervalMinutes * 60 * 1000);

  schedulerState.nextRunAt = new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();

  const { timerId, ...safeState } = schedulerState;
  return safeState;
}

export function stopHourlyAutoSync() {
  if (schedulerState.timerId) {
    clearInterval(schedulerState.timerId);
    schedulerState.timerId = null;
  }
  schedulerState.active = false;
  console.log(`[NCHMF Scheduler] Đã dừng tiến trình sao lưu.`);
  const { timerId, ...safeState } = schedulerState;
  return safeState;
}

export function getSchedulerStatus() {
  const { timerId, ...safeState } = schedulerState;
  return {
    ...safeState,
    currentTime: new Date().toISOString()
  };
}

// Chạy trực tiếp qua CLI
const isDirectRun = process.argv[1] && process.argv[1].endsWith('autoSyncNCHMF.js');
if (isDirectRun) {
  const args = process.argv.slice(2);
  const isWatch = args.includes('--watch') || args.includes('-w');
  const intervalIdx = args.indexOf('--interval');
  const intervalMinutes = intervalIdx !== -1 && args[intervalIdx + 1] ? parseInt(args[intervalIdx + 1], 10) : 60;

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║        NCHMF AUTO-SYNC WORKER (Lũ Quét & Sạt Lở Đất)             ║');
  console.log('║        Tự động quét & sao lưu CSDL mỗi giờ một lần               ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`Chế độ: ${isWatch ? `Định kỳ mỗi ${intervalMinutes} phút` : 'Quét 1 lần duy nhất'}`);

  if (isWatch) {
    startHourlyAutoSync(intervalMinutes);
  } else {
    runAutoSyncOnce({ forceSave: true }).then(() => process.exit(0)).catch((err) => {
      console.error('Fatal error in runner:', err);
      process.exit(1);
    });
  }
}
