/**
 * Standalone & Integrated Background Auto-Sync Worker for Hymetnet (http://hymetnet.gov.vn/)
 * Tự động quét dữ liệu khí tượng Hymetnet (Dông sét, Sét quan trắc, Mưa lớn, Radar, Vệ tinh)
 * định kỳ mỗi 2 giờ một lần (2-Hour Backup) và lưu trữ vào Firebase Realtime Database
 * đồng thời lưu file backup cục bộ để tự động commit lên Git.
 * 
 * Cách dùng:
 * 1. Chạy 1 lần:        node server/autoSyncHymetnet.js
 * 2. Chạy ngầm định kỳ: node server/autoSyncHymetnet.js --watch --interval 120
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { crawlHymetnetData } from './hymetnetService.js';
import { fetchFirebaseRTDB, getFirebaseAuthToken } from './autoSyncNCHMF.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data', 'hymetnet');

// Đảm bảo thư mục lưu cache local tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Trạng thái Scheduler chạy ngầm trên Server
const hymetnetSchedulerState = {
  active: false,
  intervalMinutes: 120, // 2 giờ một lần
  timerId: null,
  lastRunAt: null,
  nextRunAt: null,
  totalRuns: 0,
  lastResult: null,
  lastError: null
};

/**
 * Lưu dữ liệu ra file cục bộ để Git tracking và sao lưu offline
 */
function saveLocalBackup(snapshotId, payload) {
  try {
    const latestFilePath = path.join(DATA_DIR, 'latest.json');
    const summaryFilePath = path.join(DATA_DIR, 'summary.json');
    const snapshotFilePath = path.join(DATA_DIR, `${snapshotId}.json`);

    // 1. File dữ liệu đầy đủ mới nhất
    fs.writeFileSync(latestFilePath, JSON.stringify(payload, null, 2), 'utf8');

    // 2. File tóm tắt gọn nhẹ
    const summaryData = {
      snapshotId: payload.snapshotId,
      exactTimeId: payload.exactTimeId,
      crawledAt: payload.crawledAt,
      vnTime: payload.vnTime,
      summary: payload.summary,
      counts: payload.counts
    };
    fs.writeFileSync(summaryFilePath, JSON.stringify(summaryData, null, 2), 'utf8');

    // 3. File snapshot lịch sử
    fs.writeFileSync(snapshotFilePath, JSON.stringify(payload, null, 2), 'utf8');

    console.log(`[Hymetnet Local Backup] 💾 Đã lưu dữ liệu vào ${latestFilePath} và ${snapshotFilePath}`);
  } catch (err) {
    console.warn(`[Hymetnet Local Backup] ⚠️ Không thể ghi file backup local:`, err.message);
  }
}

/**
 * Thực hiện 1 lượt quét Hymetnet và đẩy lên Firebase Realtime Database
 */
export async function runHymetnetAutoSyncOnce(options = {}) {
  const { forceSave = false, source = 'hymetnet_2h_cron' } = options;
  const startTime = Date.now();
  const now = new Date();

  console.log(`\n============================================================`);
  console.log(`[${now.toLocaleString('vi-VN')}] 🚀 [Hymetnet 2H Sync] Bắt đầu cào & sao lưu dữ liệu Hymetnet lên Firebase...`);
  console.log(`============================================================`);

  try {
    // 1. Cào toàn bộ dữ liệu từ hymetnet.gov.vn
    const crawlRes = await crawlHymetnetData();
    if (!crawlRes || !crawlRes.success || !crawlRes.data) {
      throw new Error(crawlRes?.error || 'Không cào được dữ liệu từ Hymetnet');
    }

    const payload = crawlRes.data;
    const { snapshotId, exactTimeId, summary, counts, layers } = payload;

    // 2. Lưu file backup local (phục vụ Git commit & push)
    saveLocalBackup(snapshotId, payload);

    // 3. Chuẩn bị payload rút gọn cho Timeline (biểu đồ lịch sử)
    const timelinePayload = {
      snapshotId,
      exactTimeId,
      timestamp: payload.crawledAt,
      date: payload.date,
      time: payload.hour,
      vnTime: payload.vnTime,
      summary,
      counts,
      source
    };

    // 4. Đẩy lên Firebase Realtime Database
    console.log(`[Firebase] Đang cập nhật dữ liệu Hymetnet vào Realtime Database...`);
    const authToken = await getFirebaseAuthToken();
    if (!authToken) {
      console.warn(`[Firebase] ⚠️ Cảnh báo: Không lấy được Firebase Auth Token, ghi với quyền mặc định.`);
    }

    const updatePromises = [
      // 1. Lưu snapshot đầy đủ theo mốc 2 giờ
      fetchFirebaseRTDB(`/hymetnet/snapshots/${snapshotId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),

      // 2. Lưu mốc thống kê timeline theo 2 giờ
      fetchFirebaseRTDB(`/hymetnet/statistics/timeline/${snapshotId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timelinePayload)
      }),

      // 3. Cập nhật node latest/all
      fetchFirebaseRTDB(`/hymetnet/latest/all.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),

      // 4. Cập nhật từng lớp chuyên biệt trong latest/
      fetchFirebaseRTDB(`/hymetnet/latest/dong_set.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedAt: payload.crawledAt,
          vnTime: payload.vnTime,
          summary: summary.topDongSetProvinces,
          count: counts.dong_set,
          data: layers.dong_set
        })
      }),

      fetchFirebaseRTDB(`/hymetnet/latest/lightning.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedAt: payload.crawledAt,
          vnTime: payload.vnTime,
          summary: {
            totalStrikes: counts.lightning_strikes,
            totalCG: summary.totalLightningCG,
            totalCC: summary.totalLightningCC,
            maxAmplitudeKa: summary.maxLightningAmpKa
          },
          count: counts.lightning_strikes,
          data: layers.lightning
        })
      }),

      fetchFirebaseRTDB(`/hymetnet/latest/rain.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedAt: payload.crawledAt,
          vnTime: payload.vnTime,
          summary: summary.topRainProvinces,
          count: counts.heavy_rain_points,
          data: layers.rain
        })
      }),

      fetchFirebaseRTDB(`/hymetnet/latest/radar.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedAt: payload.crawledAt,
          vnTime: payload.vnTime,
          count: counts.radar_frames,
          data: layers.radar
        })
      }),

      // 5. Cập nhật trạng thái đồng bộ chung
      fetchFirebaseRTDB(`/hymetnet/sync_status.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastSync: payload.crawledAt,
          vnTime: payload.vnTime,
          lastSnapshotId: snapshotId,
          counts,
          summary,
          source,
          executionTimeMs: Date.now() - startTime,
          status: 'success',
          message: `Đã sao lưu thành công mốc ${payload.vnTime} (${counts.dong_set} cảnh báo dông sét, ${counts.lightning_strikes} cú sét, ${counts.heavy_rain_points} điểm mưa lớn)`
        })
      })
    ];

    const results = await Promise.allSettled(updatePromises);
    const failedWrites = results.filter(r => r.status === 'rejected');

    if (failedWrites.length > 0) {
      console.warn(`[Firebase] ⚠️ Có ${failedWrites.length}/${results.length} bản ghi Firebase thất bại`);
    } else {
      console.log(`[Firebase] ✅ Đã lưu thành công TẤT CẢ các lớp Hymetnet vào Firebase Realtime Database!`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Hymetnet 2H Sync] 🏁 Hoàn thành sao lưu trong ${elapsed}ms.`);
    console.log(`============================================================\n`);

    const runResult = {
      success: true,
      snapshotId,
      crawledAt: payload.crawledAt,
      vnTime: payload.vnTime,
      counts,
      summary,
      executionTimeMs: elapsed
    };

    hymetnetSchedulerState.lastRunAt = payload.crawledAt;
    hymetnetSchedulerState.totalRuns++;
    hymetnetSchedulerState.lastResult = runResult;
    hymetnetSchedulerState.lastError = null;

    return runResult;
  } catch (err) {
    console.error(`[Hymetnet 2H Sync Error]:`, err.message);
    const elapsed = Date.now() - startTime;

    hymetnetSchedulerState.lastRunAt = now.toISOString();
    hymetnetSchedulerState.lastError = err.message;

    // Ghi trạng thái lỗi lên Firebase
    try {
      await fetchFirebaseRTDB(`/hymetnet/sync_status.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastSync: now.toISOString(),
          status: 'error',
          error: err.message,
          executionTimeMs: elapsed
        })
      });
    } catch (_) {}

    return {
      success: false,
      error: err.message,
      executionTimeMs: elapsed
    };
  }
}

/**
 * Khởi động scheduler quét ngầm định kỳ 2 giờ một lần (120 phút)
 */
export function startHymetnetAutoSync(intervalMinutes = 120) {
  if (hymetnetSchedulerState.active) {
    console.log(`[Hymetnet Scheduler] Đang hoạt động mỗi ${hymetnetSchedulerState.intervalMinutes} phút.`);
    return hymetnetSchedulerState;
  }

  hymetnetSchedulerState.intervalMinutes = intervalMinutes;
  hymetnetSchedulerState.active = true;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[Hymetnet Scheduler] ⏱️ Bắt đầu lập lịch quét Hymetnet mỗi ${intervalMinutes} phút (2 giờ)...`);

  // Chạy lượt đầu tiên ngay
  runHymetnetAutoSyncOnce({ source: 'server_scheduler_startup' });

  hymetnetSchedulerState.nextRunAt = new Date(Date.now() + intervalMs).toISOString();

  hymetnetSchedulerState.timerId = setInterval(async () => {
    try {
      await runHymetnetAutoSyncOnce({ source: 'server_scheduler_timer' });
    } catch (err) {
      console.error('[Hymetnet Scheduler Tick Error]:', err.message);
    }
    hymetnetSchedulerState.nextRunAt = new Date(Date.now() + intervalMs).toISOString();
  }, intervalMs);

  return hymetnetSchedulerState;
}

/**
 * Dừng scheduler quét ngầm
 */
export function stopHymetnetAutoSync() {
  if (hymetnetSchedulerState.timerId) {
    clearInterval(hymetnetSchedulerState.timerId);
    hymetnetSchedulerState.timerId = null;
  }
  hymetnetSchedulerState.active = false;
  hymetnetSchedulerState.nextRunAt = null;
  console.log('[Hymetnet Scheduler] 🛑 Đã dừng scheduler.');
  return hymetnetSchedulerState;
}

export function getHymetnetSchedulerStatus() {
  return { ...hymetnetSchedulerState };
}

// Xử lý khi chạy trực tiếp từ Terminal / CLI / GitHub Actions
const isDirectCliExecution = process.argv[1] && (
  process.argv[1].endsWith('autoSyncHymetnet.js') || 
  process.argv[1].includes('autoSyncHymetnet')
);

if (isDirectCliExecution) {
  const args = process.argv.slice(2);
  const isWatch = args.includes('--watch');
  const intervalIdx = args.indexOf('--interval');
  const intervalMin = intervalIdx !== -1 && args[intervalIdx + 1] ? parseInt(args[intervalIdx + 1], 10) : 120;

  if (isWatch) {
    console.log(`[Hymetnet CLI] Chế độ giám sát ngầm: Quét mỗi ${intervalMin} phút (2 giờ)...`);
    startHymetnetAutoSync(intervalMin);
  } else {
    runHymetnetAutoSyncOnce({ source: 'github_action_cron' })
      .then(result => {
        if (result.success) {
          console.log('[Hymetnet CLI] ✅ Hoàn thành lượt quét tự động thành công.');
          process.exit(0);
        } else {
          console.error('[Hymetnet CLI] ❌ Quét thất bại:', result.error);
          process.exit(1);
        }
      })
      .catch(err => {
        console.error('[Hymetnet CLI Fatal]:', err);
        process.exit(1);
      });
  }
}
