/**
 * Supabase Client & Data Access Layer cho Client (React / Vite)
 * Dự án: https://mmmnpsbnwbhracyuhhmd.supabase.co
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://mmmnpsbnwbhracyuhhmd.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_cLtlP6FRQp0ItsyDJNdwhg_qWexo8Nm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

/**
 * 1. Lấy dữ liệu mới nhất (latest_data)
 */
export async function getLatestDataFromSupabase(source) {
  try {
    const { data, error } = await supabase
      .from('latest_data')
      .select('*')
      .eq('source', source)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { success: false, data: null, message: 'Chưa có dữ liệu mới' };

    return {
      success: true,
      data: data.data,
      snapshotId: data.snapshot_id,
      vnTime: data.vn_time,
      updatedAt: data.updated_at
    };
  } catch (err) {
    console.warn(`[Supabase] Lỗi lấy latest_data (${source}):`, err.message);
    return { success: false, data: null, error: err.message };
  }
}

/**
 * 2. Lắng nghe dữ liệu mới nhất thời gian thực (Supabase Realtime)
 */
export function subscribeLatestDataFromSupabase(source, callback) {
  const channelName = `realtime-latest-${source}-${Date.now()}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'latest_data',
        filter: `source=eq.${source}`
      },
      (payload) => {
        if (payload?.new?.data && typeof callback === 'function') {
          callback(payload.new.data, {
            snapshotId: payload.new.snapshot_id,
            vnTime: payload.new.vn_time,
            updatedAt: payload.new.updated_at
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * 3. Lấy timeline lịch sử
 */
export async function getTimelineFromSupabase(source, limit = 500) {
  try {
    let tableName = 'vrain_timeline';
    if (source === 'hymetnet') tableName = 'hymetnet_timeline';
    if (source === 'luquet_satlo') tableName = 'luquet_satlo_timeline';

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('snapshot_id', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Chuyển dữ liệu thành mảng (list) sắp xếp theo thời gian tăng dần và map tra cứu nhanh
    const map = {};
    const list = [];
    (data || []).forEach((row) => {
      const item = {
        snapshotId: row.snapshot_id,
        date: row.date,
        time: row.hour || row.time,
        vnTime: row.vn_time,
        crawledVnTime: row.crawled_vn_time,
        counts: row.counts || {},
        summary: row.summary || {},
        createdAt: row.created_at
      };
      map[row.snapshot_id] = item;
      list.push(item);
    });

    // Sắp xếp tăng dần theo snapshotId (quá khứ -> hiện tại) để vẽ biểu đồ và timeline
    list.sort((a, b) => (a.snapshotId || '').localeCompare(b.snapshotId || ''));

    return { success: true, data: list, list, map };
  } catch (err) {
    console.warn(`[Supabase] Lỗi lấy timeline (${source}):`, err.message);
    return { success: false, data: [], list: [], map: {}, error: err.message };
  }
}

/**
 * 4. Lấy chi tiết snapshot theo mã
 */
export async function getSnapshotFromSupabase(source, snapshotId) {
  if (!snapshotId) return { success: false, data: null, message: 'Thiếu mã snapshot' };

  try {
    let tableName = 'vrain_snapshots';
    if (source === 'hymetnet') tableName = 'hymetnet_snapshots';
    if (source === 'luquet_satlo') tableName = 'luquet_satlo_snapshots';

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('snapshot_id', snapshotId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { success: false, data: null, message: `Không tìm thấy snapshot ${snapshotId}` };

    // Với vrain, trả về raw_payload nếu có hoặc cấu trúc data
    const result = data.raw_payload || data.layers || data;
    return { success: true, data: result };
  } catch (err) {
    console.warn(`[Supabase] Lỗi lấy snapshot (${source}/${snapshotId}):`, err.message);
    return { success: false, data: null, error: err.message };
  }
}

/**
 * 5. Lấy trạng thái đồng bộ
 */
export async function getSyncStatusFromSupabase(source) {
  try {
    const { data, error } = await supabase
      .from('sync_status')
      .select('*')
      .eq('source', source)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { success: false, data: null };

    return {
      success: true,
      data: {
        source: data.source,
        lastSync: data.last_sync,
        lastSnapshotId: data.last_snapshot_id,
        status: data.status,
        message: data.message,
        counts: data.metadata?.counts || {},
        summary: data.metadata?.summary || {}
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
