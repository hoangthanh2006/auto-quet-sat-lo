/**
 * environmentalService.js — Dịch vụ thu thập dữ liệu môi trường & thiên tai
 * Hợp nhất các crawler từ kho lưu trữ lqtue/environmental-data-hub (VnExpress Spotlight):
 * 1. Nước hồ chứa (Thủy Lợi Việt Nam - e15.thuyloivietnam.vn)
 * 2. Mực nước sông (VNDMS - vndms.dmptc.gov.vn / vndms.dmc.gov.vn)
 * 3. Cảnh báo sạt lở & lũ quét (NCHMF - luquetsatlo.nchmf.gov.vn)
 */

import * as cheerio from 'cheerio';

// ── 1. Cấu hình Nước Hồ Chứa (Thủy Lợi Việt Nam) ──────────────────────────────
export const LAKE_API_BASE =
  'http://e15.thuyloivietnam.vn/CanhBaoSoLieu/ATCBDTHo' +
  '?lakename=&lakeref=9CBE33CD-5CFB-4CB9-BAEB-59147A825DF0' +
  '%2Cc9a8c4ca-f1bb-467f-82c4-0999294af8fc' +
  '%2C73bb8be6-bbd6-4042-8360-30abdced336a' +
  '%2C0CE5BB74-C0BB-4C3F-8F2F-2F99485098AD' +
  '%2CFCAEF9CF-E464-41E0-BA6D-9F973FD70931' +
  '%2CE8174520-E0E0-41E0-BA6D-9F973FD70931' +
  '%2C929f34bb-4d88-4364-8882-4099e75bcfd5' +
  '%2C7D5B7DB0-D64A-4A36-BD4E-54A95CA62E9D' +
  '%2CD0C28BB9-FE47-4BC2-B0DB-445038C1D1C5' +
  '%2CDBEBBF2B-EB44-4996-A896-AE93E8257DC4' +
  '%2C062A7CF0-46F3-4E99-8BCD-040CEF304344' +
  '%2C9BFF6E76-94E2-4233-B659-258D74A1C95F' +
  '%2C8DDDF139-D18F-484B-8BE8-832EF79861F6' +
  '%2C4AB3F3C8-D7F4-44AA-8P9C-E93BDCFA1DCC' +
  '&basinref=&provinceref=&capcongtrinh=&ishothuydien=0' +
  '&nghidinh=&cocuavan=&congtacquanly=&sfrom=&sto=' +
  '&dtfrom=&dtto=&ccfrom=&ccto=&cdfrom=&cdto=' +
  '&quytrinhvanhanh=&hoxungyeu=';

export const LAKE_POSITION_MAP = {
  '0CE5BB74-C0BB-4C3F-8F2F-2F99485098AD': { pos: '2269,560', canvas: 'SongSrepok' },
  '4AB3F3C8-D7F4-44AA-897C-E93BDCFA1DCC': { pos: '3791,677', canvas: 'SongBa' },
  '73bb8be6-bbd6-4042-8360-30abdced336a': { pos: '2327,2389', canvas: 'SongBa' },
  '7D5B7DB0-D64A-4A36-BD4E-54A95CA62E9D': { pos: '1974,2889', canvas: 'SongBa' },
  '8DDDF139-D18F-484B-8BE8-832EF79861F6': { pos: '1601,1918', canvas: 'SongSrepok' },
  '929f34bb-4d88-4364-8882-4099e75bcfd5': { pos: '3149,892', canvas: 'SongTraKhuc' },
  '9BFF6E76-94E2-4233-B659-258D74A1295F': { pos: '1548,1170', canvas: 'SongKon' },
  '9CBE33CD-5CFB-4CB9-BAEB-59147A825DF0': { pos: '2077,876', canvas: 'SongBa' },
  'D0C28BB9-FE47-4BC2-B0DB-445038C1D1C5': { pos: '1460,3256', canvas: 'SongBa' },
  'c9a8c4ca-f1bb-467f-82c4-0999294af8fc': { pos: '1709,1640', canvas: 'SongKon' },
  '062A7CF0-46F3-4E99-8BCD-040CEF304344': { pos: '2900,2066', canvas: 'SongKon' },
};

/** Chuyển timestamp Microsoft JSON '/Date(1762483534410)/' sang GMT+7 string */
export const msEpochToGmt7 = (epochStr) => {
  if (!epochStr) return '';
  const match = String(epochStr).match(/(\d+)/);
  if (!match) return String(epochStr);
  const ms = parseInt(match[1], 10);
  const date = new Date(ms);
  // GMT+7
  const gmt7 = new Date(date.getTime() + 7 * 3600 * 1000);
  return gmt7.toISOString().replace('T', ' ').substring(0, 19) + ' (GMT+7)';
};

/**
 * Crawl dữ liệu nước hồ chứa từ Thủy Lợi Việt Nam
 * @param {string} startDate 'YYYY-MM-DD'
 * @param {string} endDate 'YYYY-MM-DD'
 */
export async function crawlLakeWater(startDate, endDate) {
  const start = startDate || new Date().toISOString().split('T')[0];
  const end = endDate || start;

  const startDt = new Date(start);
  const endDt = new Date(end);

  const allRows = [];
  const current = new Date(startDt);

  while (current <= endDt) {
    const ds = current.toISOString().split('T')[0];
    const targetUrl = `${LAKE_API_BASE}&time=${encodeURIComponent(`${ds} 00:00:00,000`)}`;

    try {
      const resp = await fetch(targetUrl, { signal: AbortSignal.timeout(25000) });
      if (resp.ok) {
        const records = await resp.json();
        if (Array.isArray(records)) {
          for (const rec of records) {
            const code = rec.LakeCode || '';
            const posInfo = LAKE_POSITION_MAP[code] || {};
            let left = null;
            let top = null;
            if (posInfo.pos) {
              const parts = posInfo.pos.split(',');
              left = parts[0];
              top = parts[1];
            }

            allRows.push({
              date: ds,
              lakeName: rec.LakeName || '',
              lakeCode: code,
              basinName: rec.BasinName || '',
              provinceName: rec.ProvinceName || '',
              waterLevel_m: rec.TdMucNuoc != null ? Number(rec.TdMucNuoc) : null,
              currentStorage_m3: rec.TdDungTich != null ? Number(rec.TdDungTich) : null,
              designStorage_m3: rec.TkDungTich != null ? Number(rec.TkDungTich) : null,
              storagePercent: rec.TiLeDungTichTdSoTk != null ? Number(rec.TiLeDungTichTdSoTk) : null,
              inflow_qDen: rec.QDen != null ? Number(rec.QDen) : null,
              outflow_qXa: rec.QXa != null ? Number(rec.QXa) : null,
              updatedAt: msEpochToGmt7(rec.ThoiGianCapNhat),
              x: rec.X,
              y: rec.Y,
              left,
              top,
              canvasName: posInfo.canvas || '',
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[LAKE CRAWLER] Lỗi fetch ngày ${ds}:`, err.message);
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    success: true,
    totalRecords: allRows.length,
    startDate: start,
    endDate: end,
    data: allRows,
  };
}

// ── 2. Cấu hình Mực Nước Sông (VNDMS) ─────────────────────────────────────────
export const RIVER_LIST_URL = 'https://vndms.gov.vn/water_level';
export const RIVER_DETAIL_URL = 'https://vndms.gov.vn/home/detailRain';
export const RIVER_ALERT_LEVELS = [0, 1, 2, 3];
export const ALLOWED_STATION_IDS = new Set([
  '69716', '69718', '71540', '71549',
  '71558', '71559', '71708', '71709',
]);

export const RIVER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.9',
  Referer: 'https://vndms.gov.vn/',
  Origin: 'https://vndms.gov.vn',
  'X-Requested-With': 'XMLHttpRequest',
};

const ALERT_NAMES = {
  0: 'Bình thường (Dưới BĐ1)',
  1: 'Trên Báo Động 1',
  2: 'Trên Báo Động 2',
  3: 'Trên Báo Động 3',
  4: 'Trên Lũ Lịch Sử',
};

export const classifyRiverAlert = (level, bd1, bd2, bd3, hist) => {
  if (level == null || isNaN(level)) return 0;
  if (hist != null && !isNaN(hist) && level >= hist) return 4;
  if (bd3 != null && !isNaN(bd3) && level >= bd3) return 3;
  if (bd2 != null && !isNaN(bd2) && level >= bd2) return 2;
  if (bd1 != null && !isNaN(bd1) && level >= bd1) return 1;
  return 0;
};

export const calculateRiverGapCm = (levelM, bd1, bd2, bd3, hist) => {
  if (levelM == null || isNaN(levelM)) return null;
  for (const threshold of [hist, bd3, bd2, bd1]) {
    if (threshold != null && !isNaN(threshold) && levelM >= threshold) {
      return Math.round((levelM - threshold) * 100);
    }
  }
  if (bd1 != null && !isNaN(bd1)) {
    return Math.round((levelM - bd1) * 100);
  }
  return null;
};

/**
 * Crawl dữ liệu mực nước sông từ VNDMS
 * @param {number|string} days Số ngày lịch sử (VD: 7 hoặc 14)
 * @param {Array<string>} specificStationIds Danh sách mã trạm cần lấy
 */
export async function crawlRiverWater(days = '7', specificStationIds = null) {
  const targetIds = specificStationIds && specificStationIds.length > 0
    ? new Set(specificStationIds)
    : ALLOWED_STATION_IDS;

  const seenStations = new Map();

  // 1. Quét danh sách trạm từ 4 cấp báo động
  for (const lv of RIVER_ALERT_LEVELS) {
    try {
      const resp = await fetch(`${RIVER_LIST_URL}?lv=${lv}`, {
        headers: RIVER_HEADERS,
        signal: AbortSignal.timeout(20000),
      });

      if (resp.ok) {
        const json = await resp.json();
        const features = json?.features || [];
        for (const f of features) {
          const props = f.properties || {};
          const geom = f.geometry || {};
          const coords = geom.coordinates || [];
          const [x, y] = coords.length >= 2 ? coords : [null, null];
          const popup = props.popupInfo || '';

          let sid = null;
          const matchId = popup.match(/Mã trạm:\s*<b>(\d{3,})<\/b>/i) ||
                          popup.match(/detailrain\(`?(\d{3,})`?/i) ||
                          popup.match(/data-id=['"](\d{3,})['"]/i);
          if (matchId) sid = matchId[1];

          let province = null;
          if (popup) {
            const $ = cheerio.load(popup);
            $('li').each((_, el) => {
              const txt = $(el).text().trim();
              if (/địa điểm:/i.test(txt)) {
                province = txt.replace(/^Địa điểm:\s*/i, '').trim();
              }
            });
          }

          if (sid) {
            if (!seenStations.has(sid)) {
              seenStations.set(sid, {
                stationId: sid,
                label: props.label || '',
                province: province || '',
                x,
                y,
                maxAlertSeen: lv,
              });
            } else {
              const cur = seenStations.get(sid);
              cur.maxAlertSeen = Math.max(cur.maxAlertSeen, lv);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[RIVER CRAWLER] List level ${lv} error:`, err.message);
    }
  }

  // Đảm bảo tất cả trạm mục tiêu được nạp để fetch chi tiết
  for (const sid of targetIds) {
    if (!seenStations.has(sid)) {
      seenStations.set(sid, {
        stationId: sid,
        label: `Trạm ${sid}`,
        province: '',
        x: null,
        y: null,
        maxAlertSeen: 0,
      });
    }
  }

  // 2. Fetch chi tiết chuỗi dữ liệu từng trạm mục tiêu
  const rows = [];
  const stationsSummary = [];

  for (const [sid, meta] of seenStations.entries()) {
    if (targetIds.size > 0 && !targetIds.has(sid)) continue;

    try {
      const body = new URLSearchParams({
        id: sid,
        timeSelect: String(days),
        source: 'Water',
        fromDate: '',
        toDate: '',
      }).toString();

      const detailResp = await fetch(RIVER_DETAIL_URL, {
        method: 'POST',
        headers: {
          ...RIVER_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(20000),
      });

      if (detailResp.ok) {
        const detail = await detailResp.json();
        if (detail && typeof detail === 'object') {
          const name = detail.name_vn || meta.label || `Trạm ${sid}`;
          const river = detail.river_name || '';
          const province = detail.province_name || meta.province || '';

          const labels = (detail.labels || '').split(',').map((s) => s.trim().replace(/\\n|\n/g, ' '));
          const values = (detail.value || '')
            .split(',')
            .map((s) => {
              const v = parseFloat(s.trim());
              return isNaN(v) ? null : v;
            });

          const parseNum = (v) => {
            if (!v) return null;
            const n = parseFloat(String(v).split(',')[0]);
            return isNaN(n) ? null : n;
          };

          const bd1 = parseNum(detail.bao_dong1);
          const bd2 = parseNum(detail.bao_dong2);
          const bd3 = parseNum(detail.bao_dong3);
          const histVal = parseNum(detail.gia_tri_lu_lich_su);
          const histYear = detail.nam_lu_lich_su || null;

          const currentWaterLevel = values.length > 0 ? values[values.length - 1] : null;
          const currentAlertValue = classifyRiverAlert(currentWaterLevel, bd1, bd2, bd3, histVal);

          stationsSummary.push({
            stationId: sid,
            name,
            river,
            province,
            currentWaterLevel_m: currentWaterLevel,
            currentWaterLevel_cm: currentWaterLevel != null ? Math.round(currentWaterLevel * 100) : null,
            alertValue: currentAlertValue,
            alertName: ALERT_NAMES[currentAlertValue],
            gapCm: calculateRiverGapCm(currentWaterLevel, bd1, bd2, bd3, histVal),
            bd1_m: bd1,
            bd2_m: bd2,
            bd3_m: bd3,
            historyFlood_m: histVal,
            historyFloodYear: histYear,
            x: meta.x,
            y: meta.y,
            dataPointsCount: Math.min(labels.length, values.length),
          });

          const n = Math.min(labels.length, values.length);
          for (let i = 0; i < n; i++) {
            const wl = values[i];
            const alertV = classifyRiverAlert(wl, bd1, bd2, bd3, histVal);
            rows.push({
              stationId: sid,
              stationName: name,
              river,
              province,
              timeLabel: labels[i],
              waterLevel_m: wl,
              waterLevel_cm: wl != null ? Math.round(wl * 100) : null,
              alertValue: alertV,
              alertName: ALERT_NAMES[alertV],
              gapCm: calculateRiverGapCm(wl, bd1, bd2, bd3, histVal),
              bd1_m: bd1,
              bd2_m: bd2,
              bd3_m: bd3,
              historyFlood_m: histVal,
              historyFloodYear: histYear,
              x: meta.x,
              y: meta.y,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[RIVER CRAWLER] Chi tiết trạm ${sid} error:`, err.message);
    }
  }

  return {
    success: true,
    totalRecords: rows.length,
    stationsCount: stationsSummary.length,
    stations: stationsSummary,
    data: rows,
  };
}

// ── 3. Cấu hình Cảnh Báo Sạt Lở & Lũ Quét (NCHMF) ─────────────────────────────
export const LANDSLIDE_ENDPOINT = 'https://luquetsatlo.nchmf.gov.vn/LayerMapBox/getDSCanhbaoSLLQ';
export const LANDSLIDE_SEVERITY_RANK = {
  'Rất cao': 3,
  'Cao': 2,
  'Trung bình': 1,
  'Thấp': 0,
};

export const LANDSLIDE_TARGET_PROVINCES = [
  'TP. Huế', 'TP. Đà Nẵng', 'Quảng Ngãi', 'Gia Lai', 'Đắk Lắk',
  'Quảng Nam', 'Quảng Trị', 'Hà Tĩnh', 'Nghệ An', 'Thanh Hóa',
  'Lào Cai', 'Yên Bái', 'Sơn La', 'Hòa Bình', 'Lai Châu', 'Điện Biên'
];

/**
 * Crawl cảnh báo sạt lở lũ quét từ NCHMF
 * @param {Object} options
 */
export async function crawlLandslideWarnings(options = {}) {
  const {
    mode = 'refresh',
    start = '2025-11-06 00:00',
    end = null,
    targetProvinces = null,
  } = options;

  const filterProvinces = targetProvinces && targetProvinces.length > 0
    ? new Set(targetProvinces)
    : (mode === 'historical' ? new Set(LANDSLIDE_TARGET_PROVINCES) : null);

  const fetchHour = async (dateStr) => {
    try {
      const body = new URLSearchParams({
        sogiodubao: '6',
        date: dateStr,
      }).toString();

      const resp = await fetch(LANDSLIDE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        body,
        signal: AbortSignal.timeout(30000),
      });

      if (resp.ok) {
        const list = await resp.json();
        if (Array.isArray(list)) {
          return list.map((row) => {
            let commune = String(row.commune_name_2cap || '').trim();
            if (commune.startsWith('P. ')) commune = commune.substring(3).trim();

            const satLo = String(row.nguycosatlo || '').trim();
            const luQuet = String(row.nguycoluquet || '').trim();
            const score = Math.max(
              LANDSLIDE_SEVERITY_RANK[satLo] || 0,
              LANDSLIDE_SEVERITY_RANK[luQuet] || 0
            );

            return {
              time: dateStr,
              communeId: row.commune_id_2cap,
              communeName: commune,
              provinceName: String(row.provinceName_2cap || '').trim(),
              districtName: String(row.districtName_2cap || '').trim(),
              nguycosatlo: satLo,
              nguycoluquet: luQuet,
              severityScore: score,
            };
          });
        }
      }
      return [];
    } catch (err) {
      console.warn(`[LANDSLIDE CRAWLER] Error fetching ${dateStr}:`, err.message);
      return [];
    }
  };

  const rawRecords = [];

  if (mode === 'refresh') {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
    const records = await fetchHour(dateStr);
    rawRecords.push(...records);
  } else {
    const startDt = new Date(start);
    const endDt = end ? new Date(end) : new Date();
    const cur = new Date(startDt);
    cur.setMinutes(0, 0, 0);

    while (cur <= endDt) {
      const dateStr = cur.toISOString().replace('T', ' ').substring(0, 19);
      const batch = await fetchHour(dateStr);
      rawRecords.push(...batch);
      cur.setHours(cur.getHours() + 1);
    }
  }

  let filtered = filterProvinces
    ? rawRecords.filter((r) => filterProvinces.has(r.provinceName))
    : rawRecords;

  const dedupMap = new Map();
  for (const item of filtered) {
    const key = `${item.time}__${item.communeId || item.communeName}`;
    if (!dedupMap.has(key)) {
      dedupMap.set(key, item);
    } else {
      const existing = dedupMap.get(key);
      if (item.severityScore > existing.severityScore) {
        dedupMap.set(key, item);
      }
    }
  }

  const finalRecords = Array.from(dedupMap.values());
  finalRecords.sort((a, b) => b.severityScore - a.severityScore || a.provinceName.localeCompare(b.provinceName));

  const stats = {
    totalCommunesAtRisk: finalRecords.length,
    ratCao: finalRecords.filter((r) => r.severityScore === 3).length,
    cao: finalRecords.filter((r) => r.severityScore === 2).length,
    trungBinh: finalRecords.filter((r) => r.severityScore === 1).length,
  };

  return {
    success: true,
    mode,
    stats,
    totalRecords: finalRecords.length,
    data: finalRecords,
  };
}

// ── 4. Tổng Hợp Chỉ Số Toàn Cảnh (Environmental Hub Summary) ──────────────────
export async function getEnvironmentalHubSummary() {
  try {
    const [lakesRes, riversRes, landslideRes] = await Promise.allSettled([
      crawlLakeWater(),
      crawlRiverWater('1'),
      crawlLandslideWarnings({ mode: 'refresh' }),
    ]);

    const lakesData = lakesRes.status === 'fulfilled' && lakesRes.value?.success ? lakesRes.value.data : [];
    const riverData = riversRes.status === 'fulfilled' && riversRes.value?.success ? riversRes.value.stations : [];
    const landslideData = landslideRes.status === 'fulfilled' && landslideRes.value?.success ? landslideRes.value : null;

    const overflowingLakes = lakesData.filter((l) => (l.storagePercent || 0) >= 90 || (l.outflow_qXa || 0) > 0);
    const floodAlertRivers = riverData.filter((r) => (r.alertValue || 0) >= 1);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        monitoredLakesCount: lakesData.length,
        overflowingLakesCount: overflowingLakes.length,
        monitoredRiverStationsCount: riverData.length,
        riversAboveAlertCount: floodAlertRivers.length,
        landslideHighRiskCount: (landslideData?.stats?.ratCao || 0) + (landslideData?.stats?.cao || 0),
        landslideTotalCount: landslideData?.stats?.totalCommunesAtRisk || 0,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}
