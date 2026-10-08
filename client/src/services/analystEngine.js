/**
 * Analyst Engine — phân tích dữ liệu Hymetnet (dông sét, mưa lớn, radar).
 * Toàn bộ là hàm thuần (không phụ thuộc React / D3) để dễ kiểm thử.
 */

export const VN_CITIES = [
  { name: 'Hà Nội', lat: 21.0285, lng: 105.8542 },
  { name: 'Hải Phòng', lat: 20.8449, lng: 106.6881 },
  { name: 'Vinh', lat: 18.6796, lng: 105.6813 },
  { name: 'Huế', lat: 16.4637, lng: 107.5909 },
  { name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022 },
  { name: 'Quy Nhơn', lat: 13.7765, lng: 109.2237 },
  { name: 'Buôn Ma Thuột', lat: 12.6667, lng: 108.05 },
  { name: 'TP. Hồ Chí Minh', lat: 10.8231, lng: 106.6297 },
  { name: 'Cần Thơ', lat: 10.0452, lng: 105.7469 }
];

const COMPASS = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;

/* ---------------------------------------------------------------- helpers */

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

function linreg(xs, ys) {
  const n = xs.length;
  const mx = mean(xs);
  const my = mean(ys);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0) return { slope: 0, r2: 0 };
  return { slope: sxy / sxx, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy) };
}

export function compassName(bearingDeg) {
  const b = ((bearingDeg % 360) + 360) % 360;
  return COMPASS[Math.round(b / 45) % 8];
}

/* ------------------------------------------------------ snapshot ids/times */

export function parseSnapshotId(id) {
  const m = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/.exec(String(id || ''));
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return {
    date: `${y}-${mo}-${d}`,
    hour: Number(h),
    minute: Number(mi),
    ts: Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)),
    label: `${d}/${mo} ${h}:${mi}`
  };
}

function parseStrikeTs(v) {
  if (!v) return 0;
  const s = String(v);
  if (/^\d{14}$/.test(s)) {
    return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14));
  }
  const t = Date.parse(s.replace(' ', 'T') + 'Z');
  return Number.isFinite(t) ? t : 0;
}

/* ------------------------------------------------------------ normalization */

/**
 * Chuẩn hoá 1 mốc timeline (Firebase statistics/timeline) HOẶC 1 snapshot đầy đủ
 * thành bản ghi gọn dùng cho biểu đồ chuỗi thời gian.
 */
export function normalizeEntry(item) {
  if (!item) return null;
  const id = item.snapshotId || item.exactTimeId;
  const p = parseSnapshotId(id);
  if (!p) return null;
  const counts = item.counts || {};
  const sum = item.summary || {};
  const cg = Number(sum.totalLightningCG ?? 0);
  const cc = Number(sum.totalLightningCC ?? 0);
  const strikes = Number(counts.lightning_strikes ?? sum.totalLightningStrikes ?? cg + cc);
  return {
    id,
    ts: p.ts,
    date: p.date,
    hour: p.hour,
    label: p.label,
    vnTime: item.vnTime || p.label,
    dongSet: Number(counts.dong_set ?? sum.totalAlertCommunes ?? 0),
    rain: Number(counts.heavy_rain_points ?? sum.heavyRainPointsCount ?? 0),
    strikes,
    cg: cg || (cc ? Math.max(0, strikes - cc) : 0),
    cc,
    maxAmp: Number(sum.maxLightningAmpKa ?? 0),
    topProvinces: Array.isArray(sum.topDongSetProvinces) ? sum.topDongSetProvinces : [],
    rainProvinces: Array.isArray(sum.topRainProvinces) ? sum.topRainProvinces : []
  };
}

/** Gộp nhiều nguồn (timeline Firebase + file nhập), ưu tiên bản sau; sắp xếp theo thời gian. */
export function mergeSeries(...lists) {
  const map = new Map();
  lists.flat().forEach((e) => {
    if (e && e.id) map.set(e.id, e);
  });
  return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
}

/* ------------------------------------------------------------- spatial data */

/**
 * Rút dữ liệu không gian từ snapshot đầy đủ; tia sét lưu dạng typed-array để tiết kiệm bộ nhớ.
 */
export function extractSpatial(snap) {
  const L = snap?.layers || {};
  const lf = L.lightning?.frames;
  const frames = Array.isArray(lf) && lf.length ? lf : [{ strikes: L.lightning?.latestStrikes || [] }];
  let n = 0;
  frames.forEach((f) => {
    n += (f.strikes || []).length;
  });

  const lat = new Float32Array(n);
  const lng = new Float32Array(n);
  const cc = new Uint8Array(n);
  const frame = new Uint16Array(n);
  const t = new Float64Array(n);
  const frameTimes = [];
  let i = 0;
  frames.forEach((f, fi) => {
    let ft = null;
    (f.strikes || []).forEach((s) => {
      lat[i] = s.lat;
      lng[i] = s.lng;
      cc[i] = s.type === 'CC' || s.loaiset === 1 ? 1 : 0;
      frame[i] = fi;
      const tm = parseStrikeTs(s.timestamp || s.time);
      t[i] = tm;
      if (ft == null && tm) ft = tm;
      i++;
    });
    frameTimes.push(ft);
  });

  const alertMap = new Map();
  (L.dong_set?.steps || []).forEach((step) => {
    (step.items || []).forEach((it) => {
      if (it.lat == null || it.lng == null) return;
      const key = `${it.commune}|${it.province}`;
      const prev = alertMap.get(key);
      if (!prev || (it.forecastMinutes ?? 0) < prev.forecastMinutes) {
        alertMap.set(key, {
          lat: it.lat,
          lng: it.lng,
          commune: it.commune,
          province: it.province,
          forecastMinutes: it.forecastMinutes ?? 0
        });
      }
    });
  });

  const rainMap = new Map();
  (L.rain?.stormFrames || []).forEach((f) => {
    (f.points || []).forEach((pt) => {
      const la = pt.latitude;
      const ln = pt.longitude;
      if (la == null || ln == null) return;
      rainMap.set(`${pt.district}|${pt.province}`, { lat: la, lng: ln, district: pt.district, province: pt.province });
    });
  });

  return {
    id: snap?.snapshotId || null,
    n,
    lat,
    lng,
    cc,
    frame,
    t,
    frameCount: frames.length,
    frameTimes,
    alerts: Array.from(alertMap.values()),
    rain: Array.from(rainMap.values()),
    merged: false
  };
}

/** Cộng dồn nhiều spatial (khung thời gian được nối tiếp nhau). */
export function mergeSpatial(list) {
  const valid = list.filter(Boolean);
  const n = valid.reduce((s, sp) => s + sp.n, 0);
  const lat = new Float32Array(n);
  const lng = new Float32Array(n);
  const cc = new Uint8Array(n);
  const frame = new Uint16Array(n);
  const t = new Float64Array(n);
  const frameTimes = [];
  let o = 0;
  let fo = 0;
  const alertMap = new Map();
  const rainMap = new Map();
  valid.forEach((sp) => {
    lat.set(sp.lat, o);
    lng.set(sp.lng, o);
    cc.set(sp.cc, o);
    t.set(sp.t, o);
    for (let k = 0; k < sp.n; k++) frame[o + k] = Math.min(65535, sp.frame[k] + fo);
    o += sp.n;
    fo += sp.frameCount;
    frameTimes.push(...sp.frameTimes);
    sp.alerts.forEach((a) => alertMap.set(`${a.commune}|${a.province}`, a));
    sp.rain.forEach((r) => rainMap.set(`${r.district}|${r.province}`, r));
  });
  return {
    id: 'merged',
    n,
    lat,
    lng,
    cc,
    frame,
    t,
    frameCount: Math.max(1, fo),
    frameTimes,
    alerts: Array.from(alertMap.values()),
    rain: Array.from(rainMap.values()),
    merged: true,
    mergedCount: valid.length
  };
}

export function nearestPlace(lat, lng, sp) {
  let best = null;
  const consider = (name, province, la, ln) => {
    const d = haversineKm(lat, lng, la, ln);
    if (!best || d < best.distKm) best = { name, province: province || null, distKm: d };
  };
  (sp?.alerts || []).forEach((a) => consider(a.commune, a.province, a.lat, a.lng));
  (sp?.rain || []).forEach((r) => consider(r.district, r.province, r.lat, r.lng));
  VN_CITIES.forEach((c) => consider(c.name, null, c.lat, c.lng));
  return best;
}

/* ---------------------------------------------------------------- hotspots */

export function findHotspots(sp, { cell = 0.25, top = 5 } = {}) {
  if (!sp || sp.n === 0) return [];
  const map = new Map();
  for (let i = 0; i < sp.n; i++) {
    const ci = Math.floor(sp.lat[i] / cell);
    const cj = Math.floor(sp.lng[i] / cell);
    const key = `${ci},${cj}`;
    let c = map.get(key);
    if (!c) {
      c = { ci, cj, n: 0, cc: 0, sLat: 0, sLng: 0 };
      map.set(key, c);
    }
    c.n++;
    c.cc += sp.cc[i];
    c.sLat += sp.lat[i];
    c.sLng += sp.lng[i];
  }
  const cells = Array.from(map.values()).sort((a, b) => b.n - a.n);
  const picked = [];
  for (const c of cells) {
    if (picked.length >= top) break;
    if (picked.some((p) => Math.abs(p.ci - c.ci) <= 2 && Math.abs(p.cj - c.cj) <= 2)) continue;
    picked.push(c);
  }
  return picked.map((c, idx) => {
    const lat = c.sLat / c.n;
    const lng = c.sLng / c.n;
    return {
      rank: idx + 1,
      lat,
      lng,
      count: c.n,
      share: c.n / sp.n,
      cgShare: 1 - c.cc / c.n,
      place: nearestPlace(lat, lng, sp)
    };
  });
}

/* ---------------------------------------------------------------- movement */

export function estimateMovement(sp, hotspots = []) {
  if (!sp || sp.merged || sp.n === 0) return null;
  // Chỉ theo dõi cụm sét chính (quanh điểm nóng #1) để tâm không bị nhảy giữa các cơn dông khác nhau
  const center = hotspots[0] || null;
  const R = 1.6; // độ (~180 km)
  const sums = new Map();
  for (let i = 0; i < sp.n; i++) {
    if (center && (Math.abs(sp.lat[i] - center.lat) > R || Math.abs(sp.lng[i] - center.lng) > R)) continue;
    const f = sp.frame[i];
    let s = sums.get(f);
    if (!s) {
      s = { n: 0, lat: 0, lng: 0 };
      sums.set(f, s);
    }
    s.n++;
    s.lat += sp.lat[i];
    s.lng += sp.lng[i];
  }
  const pts = [];
  sums.forEach((s, f) => {
    const tm = sp.frameTimes[f];
    if (s.n >= 15 && tm) pts.push({ t: tm, lat: s.lat / s.n, lng: s.lng / s.n });
  });
  pts.sort((a, b) => a.t - b.t);
  if (pts.length < 3 || pts[pts.length - 1].t === pts[0].t) return null;

  const t0 = pts[0].t;
  const hours = pts.map((p) => (p.t - t0) / 3600000);
  const rLat = linreg(hours, pts.map((p) => p.lat));
  const rLng = linreg(hours, pts.map((p) => p.lng));
  const meanLat = mean(pts.map((p) => p.lat));
  const northKmH = rLat.slope * 111;
  const eastKmH = rLng.slope * 111 * Math.cos((meanLat * Math.PI) / 180);
  const speed = Math.hypot(northKmH, eastKmH);
  const bearing = ((Math.atan2(eastKmH, northKmH) * 180) / Math.PI + 360) % 360;
  if (speed > 90) return null; // nhảy giữa các cơn dông, không phải 1 cụm đang di chuyển
  const last = pts[pts.length - 1];
  return {
    frames: pts.length,
    speedKmH: speed,
    bearing,
    direction: compassName(bearing),
    confidence: (rLat.r2 + rLng.r2) / 2,
    centroidStart: pts[0],
    centroidEnd: last,
    projected1h: {
      lat: last.lat + rLat.slope * 1,
      lng: last.lng + rLng.slope * 1
    },
    track: pts
  };
}

/* ---------------------------------------------------------------- insights */

const SEV_ORDER = { high: 0, medium: 1, info: 2 };

export function buildSeriesInsights(series) {
  const out = [];
  const n = series.length;
  if (n === 0) return out;
  const latest = series[n - 1];

  out.push({
    id: 'latest',
    severity: 'info',
    category: 'Tổng quan',
    title: `Mốc mới nhất ${latest.label}: ${fmt(latest.strikes)} cú sét, ${fmt(latest.dongSet)} xã/phường cảnh báo dông`,
    detail: `${fmt(latest.rain)} điểm mưa lớn · sét đánh xuống đất ${fmt(latest.cg)} / trong mây ${fmt(latest.cc)}.`,
    suggestion: 'Dùng làm số liệu mở đầu cho bản tin cập nhật nhanh.'
  });

  // 1. Đột biến sét
  if (n >= 5) {
    const base = series.slice(0, -1).map((e) => e.strikes);
    const m = mean(base);
    const s = sd(base);
    const z = s > 0 ? (latest.strikes - m) / s : 0;
    const ratio = m > 0 ? latest.strikes / m : 0;
    if (z >= 1.5 || ratio >= 1.8) {
      out.push({
        id: 'spike',
        severity: z >= 2.5 || ratio >= 3 ? 'high' : 'medium',
        category: 'Đột biến',
        title: `Sét tăng đột biến: gấp ${ratio.toFixed(1)} lần mức trung bình`,
        detail: `Mốc ${latest.label} ghi ${fmt(latest.strikes)} cú, trung bình các mốc trước là ${fmt(Math.round(m))} (z-score ${z.toFixed(1)}).`,
        suggestion: 'Kiểm tra radar/ảnh mây cùng giờ; có thể là đối lưu mạnh — cân nhắc đưa tin cảnh báo.'
      });
    } else if (m > 0 && latest.strikes <= m * 0.3) {
      out.push({
        id: 'calm',
        severity: 'info',
        category: 'Xu hướng',
        title: `Hoạt động sét đang suy giảm (còn ${pct(latest.strikes / m)} so với trung bình)`,
        detail: `Mốc ${latest.label}: ${fmt(latest.strikes)} cú, trung bình trước đó ${fmt(Math.round(m))}.`,
        suggestion: 'Có thể chuyển trọng tâm sang theo dõi mưa lớn / lũ.'
      });
    }
    const peak = series.reduce((a, b) => (b.strikes > a.strikes ? b : a), series[0]);
    if (peak.id !== latest.id) {
      out.push({
        id: 'peak',
        severity: 'info',
        category: 'Đỉnh điểm',
        title: `Đỉnh sét trong kỳ: ${peak.label} với ${fmt(peak.strikes)} cú`,
        detail: `Cao hơn mốc mới nhất ${fmt(peak.strikes - latest.strikes)} cú.`,
        suggestion: 'Đối chiếu thiệt hại/phản ánh của người dân quanh thời điểm này.'
      });
    }
  }

  // 2. Xu hướng 3 mốc gần nhất vs 3 mốc trước đó
  if (n >= 6) {
    const a = series.slice(-3);
    const b = series.slice(-6, -3);
    const cmp = (key, name, unit) => {
      const ma = mean(a.map((e) => e[key]));
      const mb = mean(b.map((e) => e[key]));
      if (mb <= 0) return;
      const change = (ma - mb) / mb;
      if (Math.abs(change) >= 0.3) {
        out.push({
          id: `trend-${key}`,
          severity: change > 0 ? 'medium' : 'info',
          category: 'Xu hướng',
          title: `${name} ${change > 0 ? 'tăng' : 'giảm'} ${pct(Math.abs(change))} so với 3 mốc trước`,
          detail: `Trung bình 3 mốc gần nhất: ${fmt(Math.round(ma))} ${unit} (trước đó ${fmt(Math.round(mb))}).`,
          suggestion: change > 0 ? 'Diễn biến đang leo thang — nên theo dõi sát mỗi giờ.' : 'Diễn biến đang hạ nhiệt.'
        });
      }
    };
    cmp('strikes', 'Số cú sét', 'cú');
    cmp('dongSet', 'Số xã/phường cảnh báo dông', 'xã/phường');
  }

  // 3. Tỷ lệ sét đánh xuống đất
  const total = latest.cg + latest.cc;
  if (total > 200) {
    const share = latest.cg / total;
    if (share >= 0.8) {
      out.push({
        id: 'cg-share',
        severity: 'medium',
        category: 'Rủi ro',
        title: `Sét đánh xuống đất chiếm ${pct(share)} tổng số cú sét`,
        detail: `${fmt(latest.cg)} cú mây–đất so với ${fmt(latest.cc)} cú trong mây (tỷ lệ ${(latest.cg / Math.max(1, latest.cc)).toFixed(1)} : 1).`,
        suggestion: 'Tỷ lệ CG cao làm tăng nguy cơ cho người và công trình ngoài trời — phù hợp cho khuyến cáo an toàn.'
      });
    }
  }

  // 4. Cường độ cực đại
  if (latest.maxAmp >= 150) {
    out.push({
      id: 'amp',
      severity: latest.maxAmp >= 200 ? 'high' : 'medium',
      category: 'Cường độ',
      title: `Dòng sét cực đại ${fmt(latest.maxAmp)} kA`,
      detail: 'Dòng sét thông thường ở mức vài chục kA; trên 150 kA là rất hiếm.',
      suggestion: 'Một chi tiết đáng chú ý để đưa vào bài mô tả sức mạnh của đợt dông.'
    });
  }

  // 5. Tỉnh/thành bị cảnh báo lặp lại
  if (n >= 4) {
    const agg = new Map();
    series.forEach((e) => {
      e.topProvinces.forEach((p) => {
        const a = agg.get(p.province) || { province: p.province, seen: 0, communes: 0, alerts: 0 };
        a.seen++;
        a.communes += p.communeCount || 0;
        a.alerts += p.totalAlerts || 0;
        agg.set(p.province, a);
      });
    });
    const persistent = Array.from(agg.values())
      .filter((a) => a.seen / n >= 0.5)
      .sort((a, b) => b.seen - a.seen || b.alerts - a.alerts)
      .slice(0, 3);
    persistent.forEach((a, idx) => {
      out.push({
        id: `persist-${idx}`,
        severity: idx === 0 ? 'medium' : 'info',
        category: 'Điểm nóng lặp lại',
        title: `${a.province} có cảnh báo dông ở ${pct(a.seen / n)} số mốc (${a.seen}/${n})`,
        detail: `Trung bình ${(a.communes / a.seen).toFixed(1)} xã/phường mỗi lần xuất hiện.`,
        suggestion: 'Khu vực chịu dông kéo dài — gợi ý đề tài theo dõi dài ngày / phản ánh từ địa phương.'
      });
    });
  } else if (latest.topProvinces.length) {
    const tp = latest.topProvinces.slice(0, 3).map((p) => `${p.province} (${fmt(p.communeCount)} xã/phường)`).join(', ');
    out.push({
      id: 'top-provinces',
      severity: 'info',
      category: 'Điểm nóng',
      title: `Cảnh báo dông tập trung tại: ${tp}`,
      detail: 'Chỉ có ít mốc dữ liệu nên chưa đánh giá được mức độ lặp lại theo thời gian.',
      suggestion: 'Nhập thêm các file JSON đã xuất để so sánh nhiều ngày.'
    });
  }

  // 6. Tương quan sét — mưa lớn
  if (n >= 6) {
    const r = pearson(series.map((e) => e.strikes), series.map((e) => e.rain));
    if (r != null && Math.abs(r) >= 0.5) {
      out.push({
        id: 'corr',
        severity: 'info',
        category: 'Tương quan',
        title: `Số cú sét và điểm mưa lớn ${r > 0 ? 'cùng tăng' : 'ngược chiều'} (r = ${r.toFixed(2)})`,
        detail: `Tính trên ${n} mốc dữ liệu.`,
        suggestion: r > 0 ? 'Khi sét dày lên, mưa lớn thường đi kèm — dùng để cảnh báo ngập cục bộ.' : 'Mưa lớn và sét đang tách rời nhau — nên xem riêng từng hiện tượng.'
      });
    }
  }

  // 7. Khung giờ hoạt động mạnh
  if (n >= 12) {
    const byHour = new Map();
    series.forEach((e) => {
      const a = byHour.get(e.hour) || [];
      a.push(e.strikes);
      byHour.set(e.hour, a);
    });
    const overall = mean(series.map((e) => e.strikes));
    let best = null;
    byHour.forEach((vals, h) => {
      const m = mean(vals);
      if (vals.length >= 2 && (!best || m > best.m)) best = { h, m, k: vals.length };
    });
    if (best && overall > 0 && best.m / overall >= 1.5) {
      out.push({
        id: 'diurnal',
        severity: 'info',
        category: 'Quy luật giờ',
        title: `Sét tập trung vào khung ${String(best.h).padStart(2, '0')}:00–${String((best.h + 1) % 24).padStart(2, '0')}:00`,
        detail: `Trung bình ${fmt(Math.round(best.m))} cú/mốc, cao gấp ${(best.m / overall).toFixed(1)} lần mức chung (${best.k} lần quan sát).`,
        suggestion: 'Quy luật theo giờ giúp lên lịch đăng cảnh báo trước khung giờ cao điểm.'
      });
    }
  }

  // 8. Mưa lớn tập trung
  if (latest.rainProvinces.length && latest.rain >= 5) {
    const top = latest.rainProvinces[0];
    const share = top.count / Math.max(1, latest.rain);
    if (share >= 0.4) {
      out.push({
        id: 'rain-focus',
        severity: share >= 0.6 ? 'medium' : 'info',
        category: 'Mưa lớn',
        title: `${top.province} chiếm ${pct(share)} số điểm mưa lớn (${top.count}/${latest.rain})`,
        detail: 'Mưa lớn tập trung ở một địa phương — nguy cơ ngập úng cục bộ.',
        suggestion: 'Gợi ý kiểm tra điểm ngập / ảnh hiện trường tại địa phương này.'
      });
    }
  }

  // 9. Khoảng trống dữ liệu
  for (let i = 1; i < n; i++) {
    const gapH = (series[i].ts - series[i - 1].ts) / 3600000;
    if (gapH > 3) {
      out.push({
        id: `gap-${i}`,
        severity: 'info',
        category: 'Chất lượng dữ liệu',
        title: `Thiếu dữ liệu ${Math.round(gapH)} giờ giữa ${series[i - 1].label} và ${series[i].label}`,
        detail: 'Phân tích xu hướng quanh khoảng này có thể thiếu chính xác.',
        suggestion: 'Kiểm tra cron/GitHub Actions hoặc nhập thêm file JSON đã lưu.'
      });
      if (out.filter((o) => o.id.startsWith('gap-')).length >= 3) break;
    }
  }

  return out;
}

export function buildSpatialInsights(sp, hotspots, movement) {
  const out = [];
  if (!sp || sp.n === 0) return out;

  const place = (h) =>
    h.place
      ? `${h.place.name}${h.place.province ? ` (${h.place.province})` : ''}${h.place.distKm > 3 ? `, cách ~${Math.round(h.place.distKm)} km` : ''}`
      : `${h.lat.toFixed(2)}°N, ${h.lng.toFixed(2)}°E`;

  if (hotspots.length) {
    const h = hotspots[0];
    out.push({
      id: 'hotspot-1',
      severity: h.share >= 0.25 ? 'high' : 'medium',
      category: 'Tâm sét',
      title: `Tâm sét dày nhất quanh ${place(h)}`,
      detail: `${fmt(h.count)} cú (${pct(h.share)} tổng số), ${pct(h.cgShare)} là sét đánh xuống đất. Toạ độ ${h.lat.toFixed(2)}°N, ${h.lng.toFixed(2)}°E.`,
      suggestion: 'Ưu tiên liên hệ địa phương này để lấy phản ánh/hình ảnh thực tế.'
    });
    if (hotspots.length >= 3) {
      const top3 = hotspots.slice(0, 3).reduce((s, x) => s + x.share, 0);
      out.push({
        id: 'concentration',
        severity: 'info',
        category: 'Phân bố',
        title: `3 ổ sét lớn nhất chiếm ${pct(top3)} toàn bộ số cú sét`,
        detail: hotspots.slice(0, 3).map((x, i) => `#${i + 1} ${place(x)}: ${fmt(x.count)} cú`).join(' · '),
        suggestion: top3 >= 0.6 ? 'Dông tập trung cục bộ thành cụm — phù hợp bản đồ điểm nóng.' : 'Dông phân tán trên diện rộng.'
      });
    }
  }

  if (movement && movement.speedKmH >= 2 && movement.confidence >= 0.5) {
    const proj = movement.projected1h;
    const near = nearestPlace(proj.lat, proj.lng, sp);
    out.push({
      id: 'movement',
      severity: 'medium',
      category: 'Di chuyển',
      title: `Cụm sét dịch chuyển hướng ${movement.direction} với tốc độ ~${movement.speedKmH.toFixed(0)} km/h`,
      detail: `Ước lượng từ ${movement.frames} khung thời gian (độ tin cậy ${pct(movement.confidence)}). Sau 1 giờ tâm cụm sét dự kiến ở ${proj.lat.toFixed(2)}°N, ${proj.lng.toFixed(2)}°E${near ? `, gần ${near.name}${near.province ? ` (${near.province})` : ''}` : ''}.`,
      suggestion: 'Có thể dùng làm gợi ý khu vực cần cảnh báo tiếp theo (chỉ mang tính tham khảo, không thay dự báo chính thức).'
    });
  }

  // Độ trúng của cảnh báo: bao nhiêu xã/phường cảnh báo đã có sét thực tế gần đó
  if (sp.alerts.length >= 5) {
    const cell = 0.1;
    const cells = new Set();
    for (let i = 0; i < sp.n; i++) cells.add(`${Math.floor(sp.lat[i] / cell)},${Math.floor(sp.lng[i] / cell)}`);
    let hit = 0;
    sp.alerts.forEach((a) => {
      const ci = Math.floor(a.lat / cell);
      const cj = Math.floor(a.lng / cell);
      let ok = false;
      for (let di = -1; di <= 1 && !ok; di++) for (let dj = -1; dj <= 1 && !ok; dj++) ok = cells.has(`${ci + di},${cj + dj}`);
      if (ok) hit++;
    });
    const rate = hit / sp.alerts.length;
    out.push({
      id: 'alert-hit',
      severity: 'info',
      category: 'Độ trúng cảnh báo',
      title: `${hit}/${sp.alerts.length} xã/phường cảnh báo (${pct(rate)}) đã có sét thực tế trong bán kính ~15 km`,
      detail: 'So khớp vị trí cảnh báo dông (dự báo ngắn hạn) với vị trí các cú sét quan trắc trong cùng snapshot.',
      suggestion: rate >= 0.5 ? 'Cảnh báo đang khá sát thực tế.' : 'Nhiều cảnh báo chưa có sét thực tế — có thể dông chưa tới hoặc cảnh báo dư.'
    });
  }

  return out;
}

export function sortInsights(list) {
  return [...list].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}
