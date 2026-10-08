/**
 * Vrain crawler — Hệ thống Đo mưa Chuyên dùng (https://vrain.vn/landing)
 *
 * Trang Vrain là SPA Angular, dữ liệu mưa hiện tại được cung cấp công khai dạng JSON tại
 * https://data.vrain.vn/public/current/{all,summary}.json (cập nhật theo chu kỳ khoảng 1 giờ).
 * Các endpoint này chỉ cho phép CORS từ vrain.vn nên phải cào phía server (không gọi trực tiếp từ trình duyệt).
 *
 *  - all.json     : ~2.600 trạm đo, dạng rút gọn { sn: tên trạm, lt, lg: toạ độ, d: lượng mưa (mm), l: mức mưa, c: màu }
 *  - summary.json : 34 tỉnh/thành, mỗi tỉnh là trạm có lượng mưa lớn nhất (kèm địa chỉ, xã/phường)
 */

const BASE_URL = 'https://data.vrain.vn/public';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://vrain.vn',
  Referer: 'https://vrain.vn/'
};

export const VRAIN_LEVELS = ['Không mưa', 'Mưa nhỏ', 'Mưa vừa', 'Mưa to', 'Mưa rất to'];

async function getJson(url, { timeoutMs = 45000, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} khi tải ${url}`);
      const json = await res.json();
      return { json, lastModified: res.headers.get('last-modified') };
    } catch (err) {
      lastErr = err.name === 'AbortError' ? new Error(`Quá thời gian chờ khi tải ${url}`) : err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

const pad = (n) => String(n).padStart(2, '0');

/** Chuyển 1 mốc thời gian (ms) sang các trường theo giờ Việt Nam (UTC+7). */
function vnParts(ms) {
  const d = new Date(ms + 7 * 3600 * 1000);
  const Y = d.getUTCFullYear();
  const M = pad(d.getUTCMonth() + 1);
  const D = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const m = pad(d.getUTCMinutes());
  return {
    date: `${Y}-${M}-${D}`,
    ymd: `${Y}${M}${D}`,
    hour: `${h}:${m}`,
    hh: h,
    mm: m,
    vnTime: `${h}:${m} ${D}/${M}/${Y}`
  };
}

const round1 = (x) => Math.round(x * 10) / 10;

export async function crawlVrainData() {
  const startedAt = Date.now();
  try {
    const [allRes, sumRes] = await Promise.all([
      getJson(`${BASE_URL}/current/all.json`),
      getJson(`${BASE_URL}/current/summary.json`)
    ]);

    const rawStations = Array.isArray(allRes.json) ? allRes.json : [];
    if (!rawStations.length) throw new Error('Vrain trả về danh sách trạm rỗng');

    // Mốc dữ liệu theo thời điểm file được Vrain cập nhật (Last-Modified), làm tròn xuống giờ
    const lm = Date.parse(allRes.lastModified || sumRes.lastModified || '');
    const dataMs = Number.isFinite(lm) ? lm : Date.now();
    const dt = vnParts(dataMs);
    const crawled = vnParts(Date.now());
    const snapshotId = `${dt.ymd}_${dt.hh}00`;
    const exactTimeId = `${dt.ymd}_${dt.hh}${dt.mm}`;

    // Trạm có mưa (lưu gọn để giảm dung lượng ~70%): các trạm "Không mưa" chỉ đếm số lượng
    const levelCounts = Object.fromEntries(VRAIN_LEVELS.map((l) => [l, 0]));
    const raining = [];
    rawStations.forEach((s) => {
      const level = s.l || 'Không mưa';
      levelCounts[level] = (levelCounts[level] || 0) + 1;
      if (Number(s.d) > 0) {
        raining.push({ n: s.sn, lt: s.lt, lg: s.lg, d: round1(Number(s.d)), l: level, c: s.c });
      }
    });
    raining.sort((a, b) => b.d - a.d);

    // Tỉnh/thành: trạm mưa lớn nhất mỗi tỉnh
    const cities = (Array.isArray(sumRes.json) ? sumRes.json : [])
      .map((it) => {
        const st = it?.stat?.station;
        if (!st) return null;
        return {
          cityId: it.cityId,
          city: st.city?.name || `Tỉnh ${it.cityId}`,
          station: st.name,
          area: st.area?.name || null,
          address: st.address || null,
          lat: st.lat,
          lng: st.lng,
          depth: round1(Number(it.stat.sumDepth) || 0),
          level: it.stat.level,
          color: it.stat.color
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.depth - a.depth);

    const heavy = (levelCounts['Mưa to'] || 0) + (levelCounts['Mưa rất to'] || 0);
    const summary = {
      totalStations: rawStations.length,
      rainingStations: raining.length,
      levelCounts,
      maxDepth: raining[0]?.d || 0,
      maxStation: raining[0] ? { name: raining[0].n, depth: raining[0].d, lat: raining[0].lt, lng: raining[0].lg } : null,
      avgDepthRaining: raining.length ? round1(raining.reduce((s, x) => s + x.d, 0) / raining.length) : 0,
      heavyStations: heavy,
      topStations: raining.slice(0, 10),
      topCities: cities.slice(0, 5).map((c) => ({ city: c.city, station: c.station, depth: c.depth, level: c.level }))
    };
    const counts = {
      stations_total: rawStations.length,
      stations_raining: raining.length,
      heavy_rain_stations: heavy,
      very_heavy_stations: levelCounts['Mưa rất to'] || 0,
      cities: cities.length
    };

    return {
      success: true,
      data: {
        source: 'vrain.vn',
        sourceName: 'Vrain - Hệ thống Đo mưa Chuyên dùng',
        sourceUrl: 'https://vrain.vn/landing',
        snapshotId,
        exactTimeId,
        date: dt.date,
        hour: dt.hour,
        vnTime: dt.vnTime,
        dataTimeLabel: dt.vnTime,
        dataTimeSource: allRes.lastModified ? 'vrain_last_modified' : 'crawl_time',
        crawledAt: new Date().toISOString(),
        crawledVnTime: crawled.vnTime,
        executionTimeMs: Date.now() - startedAt,
        counts,
        summary,
        cities,
        stations: raining
      }
    };
  } catch (err) {
    return { success: false, error: err.message, executionTimeMs: Date.now() - startedAt };
  }
}
