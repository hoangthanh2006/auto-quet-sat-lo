/**
 * Auto-Sync Worker cho Vrain (https://vrain.vn/landing)
 * Cào dữ liệu đo mưa chuyên dùng, lưu vào Firebase Realtime Database (/vrain/...) và file backup local.
 *
 * Cách dùng:
 *  1. Chạy 1 lần:        node server/autoSyncVrain.js
 *  2. Chạy ngầm định kỳ: node server/autoSyncVrain.js --watch --interval 60
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { crawlVrainData } from './vrainService.js';
import { fetchFirebaseRTDB, getFirebaseAuthToken } from './autoSyncNCHMF.js';
import { saveVrainToSupabase } from './supabaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data', 'vrain');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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

function saveLocalBackup(snapshotId, payload) {
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'latest.json'), JSON.stringify(payload), 'utf8');
    fs.writeFileSync(
      path.join(DATA_DIR, 'summary.json'),
      JSON.stringify(
        {
          snapshotId: payload.snapshotId,
          exactTimeId: payload.exactTimeId,
          crawledAt: payload.crawledAt,
          vnTime: payload.vnTime,
          summary: payload.summary,
          counts: payload.counts
        },
        null,
        2
      ),
      'utf8'
    );
    fs.writeFileSync(path.join(DATA_DIR, `${snapshotId}.json`), JSON.stringify(payload), 'utf8');
    console.log(`[Vrain Local Backup] 💾 Đã lưu ${snapshotId}.json`);
  } catch (err) {
    console.warn('[Vrain Local Backup] ⚠️ Không thể ghi file backup local:', err.message);
  }
}

const put = (p, body) =>
  fetchFirebaseRTDB(p, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

export async function runVrainAutoSyncOnce(options = {}) {
  const { source = 'vrain_cron' } = options;
  const startTime = Date.now();
  const now = new Date();

  console.log(`\n============================================================`);
  console.log(`[${now.toLocaleString('vi-VN')}] 🌧️ [Vrain Sync] Bắt đầu cào & lưu dữ liệu đo mưa Vrain...`);
  console.log(`============================================================`);

  try {
    const crawlRes = await crawlVrainData();
    if (!crawlRes?.success || !crawlRes.data) {
      throw new Error(crawlRes?.error || 'Không cào được dữ liệu từ Vrain');
    }
    const payload = { ...crawlRes.data, source };
    const { snapshotId, exactTimeId, summary, counts } = payload;

    saveLocalBackup(snapshotId, payload);

    const timelinePayload = {
      snapshotId,
      exactTimeId,
      timestamp: payload.crawledAt,
      date: payload.date,
      time: payload.hour,
      vnTime: payload.vnTime,
      crawledVnTime: payload.crawledVnTime,
      summary: { ...summary, topStations: summary.topStations.slice(0, 5) },
      counts,
      source
    };

    // 1. Lưu vào Supabase Database (Chính thức)
    console.log(`[Supabase] Đang lưu dữ liệu Vrain mốc ${snapshotId}...`);
    const supabaseRes = await saveVrainToSupabase({ payload, timelinePayload, source });

    // 2. Lưu phụ trợ vào Firebase Realtime Database (đảm bảo tính liên tục)
    const token = await getFirebaseAuthToken();
    if (!token) console.warn('[Firebase] ⚠️ Không lấy được Firebase Auth Token, ghi với quyền mặc định.');

    const results = await Promise.allSettled([
      put(`/vrain/snapshots/${snapshotId}.json`, payload),
      put(`/vrain/statistics/timeline/${snapshotId}.json`, timelinePayload),
      put(`/vrain/latest/all.json`, payload),
      put(`/vrain/sync_status.json`, {
        lastSync: payload.crawledAt,
        vnTime: payload.vnTime,
        lastSnapshotId: snapshotId,
        counts,
        summary: { ...summary, topStations: summary.topStations.slice(0, 5) },
        source,
        executionTimeMs: Date.now() - startTime,
        status: 'success',
        message: `Đã lưu mốc ${payload.vnTime} (${counts.stations_raining}/${counts.stations_total} trạm có mưa, ${counts.heavy_rain_stations} trạm mưa to trở lên)`
      })
    ]);

    const failed = results.filter((r) => r.status === 'rejected' || (r.value && r.value.ok === false));
    if (failed.length) console.warn(`[Firebase] ⚠️ Có ${failed.length}/${results.length} bản ghi Firebase thất bại`);
    else console.log('[Firebase] ✅ Đã cập nhật Firebase Realtime Database!');

    const elapsed = Date.now() - startTime;
    console.log(`[Vrain Sync] 🏁 Hoàn thành trong ${elapsed}ms.\n`);

    const runResult = {
      success: failed.length === 0,
      snapshotId,
      crawledAt: payload.crawledAt,
      vnTime: payload.vnTime,
      counts,
      summary,
      executionTimeMs: elapsed,
      ...(failed.length ? { error: `${failed.length} bản ghi Firebase thất bại (kiểm tra quyền ghi / rules)` } : {})
    };
    schedulerState.lastRunAt = payload.crawledAt;
    schedulerState.totalRuns++;
    schedulerState.lastResult = runResult;
    schedulerState.lastError = runResult.error || null;
    return runResult;
  } catch (err) {
    console.error('[Vrain Sync Error]:', err.message);
    schedulerState.lastRunAt = now.toISOString();
    schedulerState.lastError = err.message;
    try {
      await put('/vrain/sync_status.json', {
        lastSync: now.toISOString(),
        status: 'error',
        error: err.message,
        executionTimeMs: Date.now() - startTime
      });
    } catch (_) {
      /* bỏ qua */
    }
    return { success: false, error: err.message, executionTimeMs: Date.now() - startTime };
  }
}

export function getVrainSchedulerStatus() {
  const { timerId, ...safe } = schedulerState;
  return safe;
}

export function startVrainAutoSync(intervalMinutes = 60) {
  if (schedulerState.active) return getVrainSchedulerStatus();
  schedulerState.intervalMinutes = intervalMinutes;
  schedulerState.active = true;
  const intervalMs = intervalMinutes * 60 * 1000;
  console.log(`[Vrain Scheduler] ⏱️ Lập lịch quét Vrain mỗi ${intervalMinutes} phút...`);
  runVrainAutoSyncOnce({ source: 'server_scheduler_startup' });
  schedulerState.nextRunAt = new Date(Date.now() + intervalMs).toISOString();
  schedulerState.timerId = setInterval(async () => {
    try {
      await runVrainAutoSyncOnce({ source: 'server_scheduler_timer' });
    } catch (err) {
      console.error('[Vrain Scheduler Tick Error]:', err.message);
    }
    schedulerState.nextRunAt = new Date(Date.now() + intervalMs).toISOString();
  }, intervalMs);
  return getVrainSchedulerStatus();
}

export function stopVrainAutoSync() {
  if (schedulerState.timerId) clearInterval(schedulerState.timerId);
  schedulerState.timerId = null;
  schedulerState.active = false;
  schedulerState.nextRunAt = null;
  console.log('[Vrain Scheduler] 🛑 Đã dừng scheduler.');
  return getVrainSchedulerStatus();
}

// Chạy trực tiếp từ Terminal / GitHub Actions
const isDirectCli = process.argv[1] && process.argv[1].includes('autoSyncVrain');
if (isDirectCli) {
  const args = process.argv.slice(2);
  if (args.includes('--watch')) {
    const i = args.indexOf('--interval');
    startVrainAutoSync(i !== -1 && args[i + 1] ? parseInt(args[i + 1], 10) : 60);
  } else {
    runVrainAutoSyncOnce({ source: 'github_action_cron' })
      .then((r) => {
        if (r.success) {
          console.log('[Vrain CLI] ✅ Hoàn thành lượt quét.');
          process.exit(0);
        }
        console.error('[Vrain CLI] ❌ Quét thất bại:', r.error);
        process.exit(1);
      })
      .catch((err) => {
        console.error('[Vrain CLI Fatal]:', err);
        process.exit(1);
      });
  }
}
