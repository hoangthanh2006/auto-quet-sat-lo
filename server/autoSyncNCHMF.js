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
  getDiemDaXayRaSatLo,
  getDiemDaXayRaLuQuet,
  getTrongDiemSLLQ,
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
 * Quét & Lưu TẤT CẢ các lớp: Cảnh báo, Radar, Điểm sạt lở, Điểm lũ quét, Trọng điểm, Trạm mưa
 */
export async function runAutoSyncOnce() {
  const startTime = Date.now();
  console.log(`\n[${new Date().toLocaleString('vi-VN')}] 🚀 Bắt đầu quét TẤT CẢ các lớp dữ liệu NCHMF mới nhất...`);

  try {
    // 1. Cào song song TẤT CẢ các lớp dữ liệu
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
    console.log(`  • Cảnh báo: ${canhBaoList.length} xã (Thời điểm: ${actualDate || 'N/A'})`);
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
    const now = new Date();
    const timestamp = now.toISOString();
    const pad = (n) => String(n).padStart(2, '0');

    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hour = pad(now.getHours());
    const minute = pad(now.getMinutes());
    const second = pad(now.getSeconds());

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

    // Kiểm tra trùng lặp với snapshot mới nhất trong CSDL
    try {
      const statusCheckRes = await fetch(`${FIREBASE_DB_URL}/luquet_satlo/auto_sync_status.json`);
      if (statusCheckRes.ok) {
        const lastStatus = await statusCheckRes.json();
        if (lastStatus && lastStatus.lastDataSignature === dataSignature) {
          console.log(`[Firebase] ⏭️ Dữ liệu NCHMF (tất cả các lớp) không đổi. Bỏ qua lưu trùng lặp snapshot.`);
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
            counts,
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

    // 3. Chuẩn bị payload hợp nhất TẤT CẢ các lớp
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
      source: 'server_worker'
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

    // 4. Đẩy lên Firebase Realtime Database qua REST API
    console.log(`[Firebase] Đang ghi snapshot hợp nhất TẤT CẢ CÁC LỚP "${snapshotId}"...`);
    
    const updatePromises = [
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
          counts,
          source: 'server_worker',
          updatedAt: now.toLocaleString('vi-VN'),
          lastCheckMessage: `Đã lưu snapshot "${snapshotId}" (tất cả các lớp) thành công`
        })
      })
    ];

    // Cập nhật node latest/{layer} cho mọi lớp để UI luôn có dữ liệu mới nhất
    if (canhBaoList.length > 0) {
      updatePromises.push(fetch(`${FIREBASE_DB_URL}/luquet_satlo/latest/canh_bao.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: timestamp, clientTime: now.toLocaleString('vi-VN'), count: canhBaoList.length, actualDate, data: canhBaoList })
      }));
    }
    if (radarData) {
      updatePromises.push(fetch(`${FIREBASE_DB_URL}/luquet_satlo/latest/radar.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: timestamp, clientTime: now.toLocaleString('vi-VN'), count: 1, data: radarData })
      }));
    }
    if (satLoList.length > 0) {
      updatePromises.push(fetch(`${FIREBASE_DB_URL}/luquet_satlo/latest/sat_lo.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: timestamp, clientTime: now.toLocaleString('vi-VN'), count: satLoList.length, data: satLoList })
      }));
    }
    if (luQuetList.length > 0) {
      updatePromises.push(fetch(`${FIREBASE_DB_URL}/luquet_satlo/latest/lu_quet.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: timestamp, clientTime: now.toLocaleString('vi-VN'), count: luQuetList.length, data: luQuetList })
      }));
    }
    if (trongDiemList.length > 0) {
      updatePromises.push(fetch(`${FIREBASE_DB_URL}/luquet_satlo/latest/trong_diem.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: timestamp, clientTime: now.toLocaleString('vi-VN'), count: trongDiemList.length, data: trongDiemList })
      }));
    }
    if (tramMuaList.length > 0) {
      updatePromises.push(fetch(`${FIREBASE_DB_URL}/luquet_satlo/latest/tram_mua.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: timestamp, clientTime: now.toLocaleString('vi-VN'), count: tramMuaList.length, data: tramMuaList })
      }));
    }

    const results = await Promise.all(updatePromises);
    if (!results[0].ok || !results[1].ok) {
      throw new Error(`Firebase RTDB REST error: ${results[0].status} / ${results[1].status}`);
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
