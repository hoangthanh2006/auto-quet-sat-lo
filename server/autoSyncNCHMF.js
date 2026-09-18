/**
 * Standalone Background Auto-Sync Worker for NCHMF Lũ Quét & Sạt Lở
 * Tự động cào dữ liệu mới nhất và lưu trữ vào Firebase Realtime Database phục vụ thống kê dài hạn.
 * 
 * Cách dùng:
 * 1. Chạy 1 lần:        node server/autoSyncNCHMF.js
 * 2. Chạy ngầm định kỳ: node server/autoSyncNCHMF.js --watch --interval 15
 */

import {
  getCanhbaoSLLQ,
  getRadarData,
  getTramMua
} from './luquetSatloService.js';

const FIREBASE_DB_URL = 'https://anh-cao-keu-default-rtdb.asia-southeast1.firebasedatabase.app';

function computeStatisticsSummary(canhBaoList = []) {
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
 */
export async function runAutoSyncOnce() {
  const startTime = Date.now();
  console.log(`\n[${new Date().toLocaleString('vi-VN')}] 🚀 Bắt đầu quét dữ liệu NCHMF mới nhất...`);

  try {
    // 1. Cào song song dữ liệu Cảnh báo, Radar và Trạm mưa
    const [canhBaoRes, radarRes, tramMuaRes] = await Promise.allSettled([
      getCanhbaoSLLQ({ sogiodubao: 6, autoFallback: true }),
      getRadarData(),
      getTramMua()
    ]);

    const canhBaoList = canhBaoRes.status === 'fulfilled' && canhBaoRes.value?.success ? canhBaoRes.value.data : [];
    const actualDate = canhBaoRes.status === 'fulfilled' && canhBaoRes.value?.actualDate ? canhBaoRes.value.actualDate : '';
    const radarData = radarRes.status === 'fulfilled' && radarRes.value?.success ? radarRes.value.data : null;
    const tramMuaList = tramMuaRes.status === 'fulfilled' && tramMuaRes.value?.success ? tramMuaRes.value.data : [];

    console.log(`[NCHMF] Đã lấy: ${canhBaoList.length} xã cảnh báo (Thời điểm: ${actualDate || 'N/A'}), Radar: ${radarData ? 'OK' : 'N/A'}, Trạm mưa: ${tramMuaList.length}`);

    if (canhBaoList.length === 0) {
      console.warn('[NCHMF] ⚠️ Không có dữ liệu cảnh báo tại thời điểm này. Bỏ qua ghi snapshot.');
      return { success: false, message: 'Không có dữ liệu cảnh báo để lưu' };
    }

    // 2. Tính toán các chỉ số thống kê tổng hợp
    const summary = computeStatisticsSummary(canhBaoList);
    const now = new Date();
    const timestamp = now.toISOString();
    const pad = (n) => String(n).padStart(2, '0');

    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hour = pad(now.getHours());
    const minute = pad(now.getMinutes());
    const second = pad(now.getSeconds());

    const cleanActual = (actualDate || '').trim();
    const dataSignature = `${cleanActual}_communes:${summary.totalCommunes}_rc:${summary.ratCao}_c:${summary.cao}_maxR:${summary.maxRain}`;

    // Kiểm tra trùng lặp với snapshot mới nhất trong CSDL
    try {
      const statusCheckRes = await fetch(`${FIREBASE_DB_URL}/luquet_satlo/auto_sync_status.json`);
      if (statusCheckRes.ok) {
        const lastStatus = await statusCheckRes.json();
        if (lastStatus && lastStatus.lastDataSignature === dataSignature) {
          console.log(`[Firebase] ⏭️ Dữ liệu NCHMF không đổi (${summary.totalCommunes} xã). Bỏ qua lưu trùng lặp snapshot.`);
          await fetch(`${FIREBASE_DB_URL}/luquet_satlo/auto_sync_status/lastVerifiedAt.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(timestamp)
          });
          return {
            success: true,
            isDuplicate: true,
            snapshotId: lastStatus.lastSnapshotId,
            summary,
            message: 'Dữ liệu không đổi, bỏ qua trùng lặp'
          };
        }
      }
    } catch (checkErr) {
      console.warn('[Firebase] Không thể kiểm tra trùng lặp:', checkErr.message);
    }

    // Tạo ID snapshot theo mốc thời gian chi tiết YYYYMMDD_HHmm
    let snapshotId = '';
    if (actualDate) {
      const digits = actualDate.replace(/[^0-9]/g, '');
      if (digits.length >= 12) {
        snapshotId = `${digits.slice(0, 8)}_${digits.slice(8, 12)}`;
      } else if (digits.length >= 10) {
        snapshotId = `${digits.slice(0, 8)}_${digits.slice(8, 10)}00`;
      }
    }
    if (!snapshotId) {
      snapshotId = `${year}${month}${day}_${hour}${minute}`;
    }

    const timeStr = `${hour}:${minute}`;
    const dateStr = `${year}-${month}-${day}`;

    // 3. Chuẩn bị payload
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
      dataSignature,
      source: 'server_worker'
    };

    const fullSnapshotPayload = {
      ...timelinePayload,
      summary,
      data: canhBaoList,
      radar: radarData ? {
        bounds: radarData.bounds,
        currentFrame: radarData.currentFrame,
        timelineCount: radarData.timeline?.length || 0
      } : null
    };

    // 4. Đẩy lên Firebase Realtime Database qua REST API
    console.log(`[Firebase] Đang ghi snapshot mới "${snapshotId}" và timeline thống kê...`);
    
    const [snapRes, timeRes, statusRes] = await Promise.all([
      fetch(`${FIREBASE_DB_URL}/luquet_satlo/snapshots/${snapshotId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullSnapshotPayload)
      }),
      fetch(`${FIREBASE_DB_URL}/luquet_satlo/statistics/timeline/${snapshotId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timelinePayload)
      }),
      fetch(`${FIREBASE_DB_URL}/luquet_satlo/auto_sync_status.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastSync: timestamp,
          lastSnapshotId: snapshotId,
          lastDataSignature: dataSignature,
          lastTotalCommunes: summary.totalCommunes,
          lastMaxRain: summary.maxRain,
          lastActualDate: actualDate || timelinePayload.actualDate,
          source: 'server_worker',
          updatedAt: now.toLocaleString('vi-VN'),
          lastCheckMessage: `Đã lưu snapshot "${snapshotId}" thành công`
        })
      })
    ]);

    if (!snapRes.ok || !timeRes.ok) {
      throw new Error(`Firebase RTDB REST error: ${snapRes.status} / ${timeRes.status}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Firebase] ✅ Thành công! Đã lưu snapshot "${snapshotId}" (${summary.totalCommunes} xã, Rất cao: ${summary.ratCao}, Cao: ${summary.cao}, Max mưa: ${summary.maxRain}mm) trong ${elapsed}s.`);

    return {
      success: true,
      snapshotId,
      summary,
      elapsed
    };
  } catch (error) {
    console.error(`[Firebase Auto-Sync Error]:`, error);
    return { success: false, error: error.message };
  }
}

// Chạy trực tiếp qua CLI
const isDirectRun = process.argv[1] && process.argv[1].endsWith('autoSyncNCHMF.js');
if (isDirectRun) {
  const args = process.argv.slice(2);
  const isWatch = args.includes('--watch') || args.includes('-w');
  const intervalIdx = args.indexOf('--interval');
  const intervalMinutes = intervalIdx !== -1 && args[intervalIdx + 1] ? parseInt(args[intervalIdx + 1], 10) : 15;

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║        NCHMF AUTO-SYNC WORKER (Lũ Quét & Sạt Lở Đất)             ║');
  console.log('║        Tự động quét & lưu trữ CSDL phục vụ thống kê              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`Chế độ: ${isWatch ? `Định kỳ mỗi ${intervalMinutes} phút` : 'Quét 1 lần duy nhất'}`);

  runAutoSyncOnce().then(() => {
    if (isWatch) {
      console.log(`\n⏳ Đang chờ lần quét tiếp theo sau ${intervalMinutes} phút... (Nhấn Ctrl+C để dừng)`);
      setInterval(() => {
        runAutoSyncOnce().catch(console.error);
      }, intervalMinutes * 60 * 1000);
    }
  }).catch((err) => {
    console.error('Fatal error in runner:', err);
    if (!isWatch) process.exit(1);
  });
}
