/**
 * Supabase Service cho Server & Background Crawlers
 * Dự án: https://mmmnpsbnwbhracyuhhmd.supabase.co
 */

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mmmnpsbnwbhracyuhhmd.supabase.co';
export const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  'sb_publishable_cLtlP6FRQp0ItsyDJNdwhg_qWexo8Nm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

/**
 * 1. Cập nhật trạng thái đồng bộ
 */
export async function updateSyncStatus(source, statusData) {
  try {
    const { error } = await supabase.from('sync_status').upsert({
      source,
      last_sync: statusData.lastSync || new Date().toISOString(),
      last_snapshot_id: statusData.lastSnapshotId || null,
      status: statusData.status || 'success',
      message: statusData.message || null,
      metadata: statusData.metadata || statusData.counts ? { counts: statusData.counts, summary: statusData.summary } : {},
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.warn(`[Supabase sync_status] ⚠️ Lỗi cập nhật ${source}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 2. Cập nhật cache bản ghi mới nhất
 */
export async function updateLatestData(source, snapshotId, vnTime, data) {
  try {
    const { error } = await supabase.from('latest_data').upsert({
      source,
      snapshot_id: snapshotId,
      vn_time: vnTime,
      data,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.warn(`[Supabase latest_data] ⚠️ Lỗi cập nhật ${source}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 3. Lưu dữ liệu Vrain (Đo mưa)
 */
export async function saveVrainToSupabase({ payload, timelinePayload, source = 'vrain_cron' }) {
  const { snapshotId, date, hour, vnTime, crawledVnTime, counts, summary, cities, stations } = payload;
  const errors = [];

  // Snapshot chi tiết
  const { error: errSnap } = await supabase.from('vrain_snapshots').upsert({
    snapshot_id: snapshotId,
    date: String(date),
    hour: parseInt(String(hour || '0').split(':')[0], 10) || 0,
    vn_time: vnTime,
    crawled_vn_time: crawledVnTime,
    counts: counts || {},
    summary: summary || {},
    cities: cities || [],
    stations: stations || [],
    raw_payload: payload,
    created_at: new Date().toISOString()
  });
  if (errSnap) errors.push(`vrain_snapshots: ${errSnap.message}`);

  // Timeline thống kê theo giờ
  const { error: errTime } = await supabase.from('vrain_timeline').upsert({
    snapshot_id: timelinePayload.snapshotId || snapshotId,
    date: String(timelinePayload.date || date),
    hour: parseInt(String(timelinePayload.time || hour || '0').split(':')[0], 10) || 0,
    vn_time: timelinePayload.vnTime || vnTime,
    crawled_vn_time: timelinePayload.crawledVnTime || crawledVnTime,
    counts: timelinePayload.counts || counts || {},
    summary: timelinePayload.summary || summary || {},
    created_at: new Date().toISOString()
  });
  if (errTime) errors.push(`vrain_timeline: ${errTime.message}`);

  // Cache latest_data
  await updateLatestData('vrain', snapshotId, vnTime, payload);

  // Sync status
  await updateSyncStatus('vrain', {
    lastSync: payload.crawledAt || new Date().toISOString(),
    lastSnapshotId: snapshotId,
    status: errors.length === 0 ? 'success' : 'warning',
    message: `Đã lưu mốc ${vnTime} (${counts?.stations_raining || 0}/${counts?.stations_total || 0} trạm có mưa)`,
    counts,
    summary: { ...summary, topStations: (summary?.topStations || []).slice(0, 5) }
  });

  if (errors.length > 0) {
    console.warn(`[Supabase Vrain] ⚠️ Có lỗi khi lưu:`, errors.join('; '));
    return { success: false, errors };
  }
  console.log(`[Supabase Vrain] ✅ Đã lưu thành công snapshot & timeline mốc ${snapshotId}`);
  return { success: true, snapshotId };
}

/**
 * 4. Lưu dữ liệu Hymetnet (Dông sét & Radar)
 */
export async function saveHymetnetToSupabase({ payload, timelinePayload }) {
  const { snapshotId, date, hour, vnTime, crawledVnTime, counts, summary, layers } = payload;
  const errors = [];

  const { error: errSnap } = await supabase.from('hymetnet_snapshots').upsert({
    snapshot_id: snapshotId,
    date: String(date),
    hour: parseInt(String(hour || '0').split(':')[0], 10) || 0,
    vn_time: vnTime,
    crawled_vn_time: crawledVnTime,
    counts: counts || {},
    summary: summary || {},
    layers: layers || {},
    created_at: new Date().toISOString()
  });
  if (errSnap) errors.push(`hymetnet_snapshots: ${errSnap.message}`);

  const { error: errTime } = await supabase.from('hymetnet_timeline').upsert({
    snapshot_id: timelinePayload.snapshotId || snapshotId,
    date: String(timelinePayload.date || date),
    hour: parseInt(String(timelinePayload.time || hour || '0').split(':')[0], 10) || 0,
    vn_time: timelinePayload.vnTime || vnTime,
    crawled_vn_time: timelinePayload.crawledVnTime || crawledVnTime,
    counts: timelinePayload.counts || counts || {},
    summary: timelinePayload.summary || summary || {},
    created_at: new Date().toISOString()
  });
  if (errTime) errors.push(`hymetnet_timeline: ${errTime.message}`);

  // Cache latest_data
  await updateLatestData('hymetnet_all', snapshotId, vnTime, payload);
  if (layers?.dong_set) {
    await updateLatestData('hymetnet_dong_set', snapshotId, vnTime, {
      updatedAt: payload.crawledAt,
      vnTime,
      summary: summary.topDongSetProvinces,
      count: counts.dong_set,
      data: layers.dong_set
    });
  }
  if (layers?.radar) {
    await updateLatestData('hymetnet_radar', snapshotId, vnTime, {
      updatedAt: payload.crawledAt,
      vnTime,
      count: counts.radar_sites,
      data: layers.radar
    });
  }

  // Sync status
  await updateSyncStatus('hymetnet', {
    lastSync: payload.crawledAt || new Date().toISOString(),
    lastSnapshotId: snapshotId,
    status: errors.length === 0 ? 'success' : 'warning',
    message: `Đã lưu mốc ${vnTime} (${counts?.dong_set || 0} điểm dông sét)`,
    counts,
    summary
  });

  if (errors.length > 0) {
    console.warn(`[Supabase Hymetnet] ⚠️ Có lỗi khi lưu:`, errors.join('; '));
    return { success: false, errors };
  }
  console.log(`[Supabase Hymetnet] ✅ Đã lưu thành công snapshot & timeline mốc ${snapshotId}`);
  return { success: true, snapshotId };
}

/**
 * 5. Lưu dữ liệu NCHMF Lũ quét sạt lở
 */
export async function saveNCHMFToSupabase({
  hourlySnapshotId,
  bulletinSnapshotId,
  timelinePayload,
  snapshotPayload,
  summary,
  counts,
  actualDate
}) {
  const errors = [];

  // Hourly timeline
  if (hourlySnapshotId && timelinePayload) {
    const { error: errTime } = await supabase.from('luquet_satlo_timeline').upsert({
      snapshot_id: hourlySnapshotId,
      bulletin_id: bulletinSnapshotId || null,
      type: 'hourly',
      date: timelinePayload.date,
      time: timelinePayload.time,
      vn_time: timelinePayload.vnTime || timelinePayload.displayTime,
      counts: counts || {},
      summary: summary || {},
      created_at: new Date().toISOString()
    });
    if (errTime) errors.push(`luquet_satlo_timeline: ${errTime.message}`);
  }

  // Hourly snapshot
  if (hourlySnapshotId && snapshotPayload) {
    const { error: errSnap } = await supabase.from('luquet_satlo_snapshots').upsert({
      snapshot_id: hourlySnapshotId,
      bulletin_id: bulletinSnapshotId || null,
      type: 'hourly',
      vn_time: snapshotPayload.vnTime,
      counts: counts || {},
      summary: summary || {},
      layers: snapshotPayload.layers || snapshotPayload,
      created_at: new Date().toISOString()
    });
    if (errSnap) errors.push(`luquet_satlo_snapshots: ${errSnap.message}`);
  }

  // Bulletin snapshot if different
  if (bulletinSnapshotId && bulletinSnapshotId !== hourlySnapshotId && snapshotPayload) {
    await supabase.from('luquet_satlo_snapshots').upsert({
      snapshot_id: bulletinSnapshotId,
      bulletin_id: bulletinSnapshotId,
      type: 'bulletin',
      vn_time: actualDate || snapshotPayload.vnTime,
      counts: counts || {},
      summary: summary || {},
      layers: snapshotPayload.layers || snapshotPayload,
      created_at: new Date().toISOString()
    });
  }

  // Cache latest_data
  await updateLatestData('luquet_satlo', hourlySnapshotId, snapshotPayload?.vnTime || actualDate, snapshotPayload);

  // Sync status
  await updateSyncStatus('luquet_satlo', {
    lastSync: new Date().toISOString(),
    lastSnapshotId: hourlySnapshotId,
    status: errors.length === 0 ? 'success' : 'warning',
    message: `Đã lưu mốc ${hourlySnapshotId} (${summary?.ratCao || 0} xã rất cao, ${summary?.cao || 0} xã cao)`,
    counts,
    summary
  });

  if (errors.length > 0) {
    console.warn(`[Supabase NCHMF] ⚠️ Có lỗi khi lưu:`, errors.join('; '));
    return { success: false, errors };
  }
  console.log(`[Supabase NCHMF] ✅ Đã lưu thành công snapshot & timeline mốc ${hourlySnapshotId}`);
  return { success: true, snapshotId: hourlySnapshotId };
}
