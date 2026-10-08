/**
 * Bộ máy phân tích dữ liệu TỔNG QUÁT (không gắn với riêng Hymetnet hay Vrain).
 * - Đọc JSON / CSV bất kỳ (tự tìm mảng bản ghi lồng nhau, làm phẳng object).
 * - Nhận diện kiểu cột: số, thời gian, nhóm, văn bản, id, toạ độ.
 * - Thống kê mô tả, ngoại lai, tương quan, xu hướng thời gian, so sánh nhóm, điểm nóng không gian.
 * Toàn bộ chạy trên trình duyệt (hoặc Node để test), không phụ thuộc React/D3.
 */
import { haversineKm, VN_CITIES } from './analystEngine.js';

export const MAX_ROWS = 200000;
const VN_OFFSET = 7 * 3600000;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export const fmtNum = (n) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  const x = Number(n);
  return x.toLocaleString('vi-VN', { maximumFractionDigits: Math.abs(x) >= 1000 ? 0 : Math.abs(x) >= 10 ? 1 : 2 });
};
const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;

/* ============================================================== parsing */

export function parseCSV(text) {
  const src = String(text).replace(/^\uFEFF/, '');
  const nl = src.indexOf('\n');
  const firstLine = src.slice(0, nl > 0 ? nl : src.length);
  const delim = [',', ';', '\t', '|'].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];

  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  const pushRow = () => {
    row.push(cur);
    cur = '';
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      pushRow();
    } else cur += ch;
  }
  if (cur !== '' || row.length) pushRow();
  if (rows.length < 2) return [];

  const seen = new Map();
  const keys = rows[0].map((h, i) => {
    const base = (h || '').trim() || `cột_${i + 1}`;
    const c = (seen.get(base) || 0) + 1;
    seen.set(base, c);
    return c > 1 ? `${base}_${c}` : base;
  });
  return rows.slice(1).map((r) => {
    const o = {};
    keys.forEach((k, i) => {
      const v = r[i];
      o[k] = v === undefined || v === '' ? null : v;
    });
    return o;
  });
}

/** Làm phẳng object lồng nhau thành khoá "a.b.c"; mảng object → số phần tử. */
export function flattenRow(obj, prefix = '', depth = 0, out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) out[key] = null;
    else if (Array.isArray(v)) {
      if (v.length && v.every((x) => x === null || typeof x !== 'object')) {
        if (v.length <= 3) v.forEach((x, i) => { out[`${key}[${i}]`] = x; });
        else out[`${key}.length`] = v.length;
      } else out[`${key}.length`] = v.length;
    } else if (isObj(v)) {
      if (depth < 2) flattenRow(v, key, depth + 1, out);
      else out[key] = JSON.stringify(v).slice(0, 80);
    } else out[key] = v;
  }
  return out;
}

/** Tìm các tập bản ghi (mảng object) trong JSON bất kỳ; trả về danh sách ứng viên, lớn nhất trước. */
export function findRecordSets(root) {
  const sets = [];
  const add = (path, rows) => {
    if (rows.length) sets.push({ path, rows, count: rows.length });
  };
  const isRecArray = (a) => Array.isArray(a) && a.length > 0 && a.slice(0, 20).every(isObj);

  const walk = (node, path, depth) => {
    if (isRecArray(node)) {
      add(path || '(gốc)', node);
      if (depth < 3) {
        const childKeys = new Set();
        node.slice(0, 50).forEach((r) => Object.keys(r).forEach((k) => { if (isRecArray(r[k])) childKeys.add(k); }));
        childKeys.forEach((k) => {
          const rows = [];
          node.forEach((parent) => {
            if (!isRecArray(parent[k])) return;
            const ctx = {};
            Object.entries(parent).slice(0, 40).forEach(([pk, pv]) => {
              if (pv === null || typeof pv !== 'object') ctx[`parent.${pk}`] = pv;
            });
            parent[k].forEach((ch) => rows.push({ ...ctx, ...ch }));
          });
          add(`${path || '(gốc)'}[*].${k}`, rows);
        });
      }
      return;
    }
    if (isObj(node) && depth < 3) {
      const vals = Object.values(node);
      if (vals.length >= 3 && vals.every(isObj)) {
        add(`${path || '(gốc)'} (theo khoá)`, Object.entries(node).map(([k, v]) => ({ _key: k, ...v })));
      }
      Object.entries(node).forEach(([k, v]) => walk(v, path ? `${path}.${k}` : k, depth + 1));
    }
  };
  walk(root, '', 0);
  if (!sets.length && isObj(root)) add('(1 bản ghi)', [root]);
  return sets.sort((a, b) => b.count - a.count);
}

/** Đọc nội dung file (tên + text) → danh sách tập bản ghi ứng viên. */
export function parseFileContent(fileName, text) {
  if (/\.(csv|tsv|txt)$/i.test(fileName)) {
    const rows = parseCSV(text);
    return rows.length ? [{ path: '(bảng CSV)', rows, count: rows.length }] : [];
  }
  const trimmed = text.trim();
  // NDJSON
  if (/\.ndjson$/i.test(fileName) || (trimmed.startsWith('{') && trimmed.includes('}\n{'))) {
    const rows = trimmed.split(/\r?\n/).filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(isObj);
    if (rows.length) return [{ path: '(NDJSON)', rows, count: rows.length }];
  }
  return findRecordSets(JSON.parse(trimmed));
}

/* ======================================================== kiểu dữ liệu */

function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  const s = v.trim();
  if (!s || !/^[-+]?(\d+([.,]\d+)?|[.,]\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  return Number(s.replace(',', '.'));
}

/** Chuỗi thời gian → epoch ms (không có múi giờ thì coi là giờ Việt Nam). NaN nếu không phải ngày. */
export function parseDateAny(v) {
  if (typeof v !== 'string') return NaN;
  const s = v.trim();
  let m;
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})$/))) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - VN_OFFSET;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/))) {
    const [, y, mo, d, h = 0, mi = 0, se = 0, tz] = m;
    const base = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
    if (!tz) return base - VN_OFFSET;
    if (tz === 'Z') return base;
    const sign = tz[0] === '-' ? -1 : 1;
    const hh = +tz.slice(1, 3);
    const mm = +tz.slice(-2);
    return base - sign * (hh * 60 + mm) * 60000;
  }
  if ((m = s.match(/^(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return Date.UTC(+m[5], +m[4] - 1, +m[3], +m[1], +m[2]) - VN_OFFSET;
  if ((m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/))) {
    if (+m[2] > 12 || +m[1] > 31) return NaN;
    return Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) - VN_OFFSET;
  }
  return NaN;
}

const normEpoch = (n) => (n > 1e11 ? n : n * 1000);

function quantile(sorted, p) {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function numericStats(values) {
  const v = values.filter((x) => x !== null && x !== undefined && Number.isFinite(x));
  const n = v.length;
  if (!n) return null;
  const sorted = [...v].sort((a, b) => a - b);
  let sum = 0;
  for (const x of v) sum += x;
  const mean = sum / n;
  let ss = 0;
  for (const x of v) ss += (x - mean) ** 2;
  const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  let outliers = 0;
  let outHigh = 0;
  if (iqr > 0) {
    for (const x of v) {
      if (x < lo || x > hi) {
        outliers++;
        if (x > hi) outHigh++;
      }
    }
  }
  return {
    n, min: sorted[0], max: sorted[n - 1], mean, median: quantile(sorted, 0.5), sd, q1, q3,
    p95: quantile(sorted, 0.95), sum, outliers, outHigh, fenceLo: lo, fenceHi: hi
  };
}

const NAME_RE = {
  lat: /(^|[._])(lat|latitude|lt|vi_?do|vĩ_?độ)(\[\d\])?$/i,
  lng: /(^|[._])(lng|lon|long|longitude|lg|kinh_?do|kinh_?độ)(\[\d\])?$/i,
  id: /(^|[._])(id|uuid|stt|ma|code)$/i,
  epoch: /(^|[._])(ts|time|timestamp|epoch|created|updated|date)/i,
  label: /(name|ten|tên|station|trạm|tram|label|title|city|province|tinh|tỉnh|district|huyen|commune|xa)/i
};

function profileColumn(name, raw) {
  let n = 0;
  const sample = [];
  const step = raw.length > 5000 ? Math.ceil(raw.length / 5000) : 1;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (v === null || v === undefined || v === '') continue;
    n++;
    if (i % step === 0) sample.push(v);
  }
  const meta = { name, type: 'text', nonNull: n, missing: raw.length - n, missingPct: raw.length ? (raw.length - n) / raw.length : 0, distinct: 0 };
  if (n === 0) {
    meta.type = 'empty';
    return { meta, values: raw.map(() => null) };
  }

  let nb = 0;
  let nn = 0;
  let nd = 0;
  sample.forEach((v) => {
    if (typeof v === 'boolean') nb++;
    else {
      if (Number.isFinite(toNumber(v))) nn++;
      if (typeof v === 'string' && Number.isFinite(parseDateAny(v))) nd++;
    }
  });
  const S = sample.length || 1;

  // số lượng giá trị khác nhau (giới hạn đếm)
  const set = new Set();
  for (let i = 0; i < raw.length && set.size <= 50000; i++) {
    const v = raw[i];
    if (v !== null && v !== undefined && v !== '') set.add(String(v));
  }
  meta.distinct = set.size;

  let type;
  if (nb / S >= 0.95) type = 'boolean';
  else if (nd / S >= 0.9 && nn / S < 0.9) type = 'date';
  else if (nn / S >= 0.9) {
    type = 'number';
    const nums = sample.map(toNumber).filter(Number.isFinite);
    const inEpoch = nums.length && nums.every((x) => (x >= 1e9 && x < 1e10) || (x >= 1e12 && x < 1e13));
    if (inEpoch && NAME_RE.epoch.test(name)) type = 'date-epoch';
    else if (NAME_RE.id.test(name) && set.size / n > 0.9) type = 'id';
  } else if (set.size <= 50 || set.size / n <= 0.2 || (n < 30 && set.size <= n / 2)) type = 'category';
  else type = 'text';

  let values;
  if (type === 'number' || type === 'id') values = raw.map((v) => { const x = toNumber(v); return Number.isFinite(x) ? x : null; });
  else if (type === 'date') values = raw.map((v) => { const x = parseDateAny(v); return Number.isFinite(x) ? x : null; });
  else if (type === 'date-epoch') values = raw.map((v) => { const x = toNumber(v); return Number.isFinite(x) ? normEpoch(x) : null; });
  else values = raw.map((v) => (v === null || v === undefined || v === '' ? null : String(v)));

  if (type === 'date-epoch') meta.type = 'date';
  else meta.type = type === 'boolean' ? 'category' : type;

  if (meta.type === 'number') meta.stats = numericStats(values);
  else if (meta.type === 'date') {
    let mn = Infinity;
    let mx = -Infinity;
    values.forEach((x) => { if (x !== null) { if (x < mn) mn = x; if (x > mx) mx = x; } });
    meta.min = mn;
    meta.max = mx;
  } else if (meta.type === 'category' || meta.type === 'text') {
    const cnt = new Map();
    values.forEach((x) => { if (x !== null) cnt.set(x, (cnt.get(x) || 0) + 1); });
    meta.top = [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([value, count]) => ({ value, count }));
    meta.isColor = meta.top.length > 0 && meta.top.every((t) => /^#[0-9a-f]{3,8}$/i.test(t.value));
  }
  return { meta, values };
}

/** Dựng dataset đã phân tích từ danh sách bản ghi thô. */
export function buildDataset(name, rawRows) {
  let rows = rawRows;
  let truncated = false;
  if (rows.length > MAX_ROWS) {
    rows = rows.slice(0, MAX_ROWS);
    truncated = true;
  }
  const flat = rows.map((r) => (isObj(r) ? flattenRow(r) : { value: r }));

  const freq = new Map();
  const probeStep = flat.length > 3000 ? Math.ceil(flat.length / 3000) : 1;
  for (let i = 0; i < flat.length; i += probeStep) Object.keys(flat[i]).forEach((k) => freq.set(k, (freq.get(k) || 0) + 1));
  const names = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 120);

  const columns = [];
  const cols = {};
  names.forEach((nm) => {
    const { meta, values } = profileColumn(nm, flat.map((r) => r[nm]));
    columns.push(meta);
    cols[nm] = values;
  });

  const byType = (t) => columns.filter((c) => c.type === t).map((c) => c.name);

  // Toạ độ
  let geo = null;
  const numNames = byType('number');
  const latCol = numNames.find((c) => NAME_RE.lat.test(c));
  const lngCol = numNames.find((c) => NAME_RE.lng.test(c));
  if (latCol && lngCol) {
    const okLat = cols[latCol].filter((x) => x !== null && Math.abs(x) <= 90).length;
    const okLng = cols[lngCol].filter((x) => x !== null && Math.abs(x) <= 180).length;
    const nonNull = cols[latCol].filter((x) => x !== null).length || 1;
    if (okLat / nonNull > 0.95 && okLng / nonNull > 0.95) geo = { latCol, lngCol };
  }
  const geoSet = new Set(geo ? [geo.latCol, geo.lngCol] : []);

  const labelCandidates = columns.filter((c) => (c.type === 'text' || c.type === 'category') && NAME_RE.label.test(c.name));
  const labelCol = (labelCandidates[0] || columns.find((c) => c.type === 'text') || {}).name || null;

  return {
    name,
    nRows: flat.length,
    truncated,
    rows: flat,
    columns,
    cols,
    geo,
    labelCol,
    numCols: numNames.filter((c) => !geoSet.has(c)),
    catCols: byType('category'),
    dateCols: byType('date'),
    textCols: byType('text'),
    idCols: byType('id')
  };
}

/* ============================================================ tổng hợp */

export function histogramBins(values, bins = 30) {
  const v = values.filter((x) => x !== null && Number.isFinite(x));
  if (!v.length) return [];
  let mn = Infinity;
  let mx = -Infinity;
  v.forEach((x) => { if (x < mn) mn = x; if (x > mx) mx = x; });
  if (mn === mx) return [{ x0: mn, x1: mx + 1, count: v.length }];
  const w = (mx - mn) / bins;
  const out = Array.from({ length: bins }, (_, i) => ({ x0: mn + i * w, x1: mn + (i + 1) * w, count: 0 }));
  v.forEach((x) => { out[Math.min(bins - 1, Math.floor((x - mn) / w))].count++; });
  return out;
}

export function groupAggregate(ds, catCol, metricCol = null, agg = 'count', top = 15) {
  const cat = ds.cols[catCol];
  const met = metricCol ? ds.cols[metricCol] : null;
  if (!cat) return [];
  const m = new Map();
  for (let i = 0; i < cat.length; i++) {
    const k = cat[i];
    if (k === null) continue;
    let g = m.get(k);
    if (!g) {
      g = { key: k, n: 0, sum: 0, max: -Infinity, cnt: 0 };
      m.set(k, g);
    }
    g.n++;
    if (met) {
      const v = met[i];
      if (v !== null && Number.isFinite(v)) {
        g.sum += v;
        g.cnt++;
        if (v > g.max) g.max = v;
      }
    }
  }
  return [...m.values()]
    .map((g) => ({
      key: g.key,
      n: g.n,
      value: !met || agg === 'count' ? g.n : agg === 'sum' ? g.sum : agg === 'max' ? (g.cnt ? g.max : 0) : g.cnt ? g.sum / g.cnt : 0
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

const pad2 = (n) => String(n).padStart(2, '0');

export function bucketGranularity(min, max) {
  const span = max - min;
  if (span <= 2 * 86400000) return 'hour';
  if (span <= 100 * 86400000) return 'day';
  return 'month';
}

function bucketStart(ts, gran) {
  const s = ts + VN_OFFSET;
  if (gran === 'hour') return Math.floor(s / 3600000) * 3600000 - VN_OFFSET;
  if (gran === 'day') return Math.floor(s / 86400000) * 86400000 - VN_OFFSET;
  const d = new Date(s);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - VN_OFFSET;
}

export function formatBucket(t, gran) {
  const d = new Date(t + VN_OFFSET);
  const dd = `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}`;
  if (gran === 'hour') return `${dd} ${pad2(d.getUTCHours())}:00`;
  if (gran === 'day') return `${dd}/${d.getUTCFullYear()}`;
  return `${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function formatDateTime(ts) {
  const d = new Date(ts + VN_OFFSET);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} ${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function timeBuckets(ds, dateCol, metricCol = null, agg = 'count') {
  const dt = ds.cols[dateCol];
  const met = metricCol ? ds.cols[metricCol] : null;
  if (!dt) return { gran: 'day', rows: [] };
  const meta = ds.columns.find((c) => c.name === dateCol);
  const gran = bucketGranularity(meta.min, meta.max);
  const m = new Map();
  for (let i = 0; i < dt.length; i++) {
    if (dt[i] === null) continue;
    const t = bucketStart(dt[i], gran);
    let g = m.get(t);
    if (!g) {
      g = { t, n: 0, sum: 0, cnt: 0, max: -Infinity };
      m.set(t, g);
    }
    g.n++;
    if (met) {
      const v = met[i];
      if (v !== null && Number.isFinite(v)) {
        g.sum += v;
        g.cnt++;
        if (v > g.max) g.max = v;
      }
    }
  }
  const rows = [...m.values()]
    .sort((a, b) => a.t - b.t)
    .map((g) => ({
      t: g.t,
      date: new Date(g.t),
      label: formatBucket(g.t, gran),
      n: g.n,
      value: !met || agg === 'count' ? g.n : agg === 'sum' ? g.sum : agg === 'max' ? (g.cnt ? g.max : 0) : g.cnt ? g.sum / g.cnt : 0
    }));
  return { gran, rows };
}

function pearsonPair(a, b) {
  let n = 0;
  let sa = 0;
  let sb = 0;
  const step = a.length > 20000 ? Math.ceil(a.length / 20000) : 1;
  for (let i = 0; i < a.length; i += step) {
    if (a[i] === null || b[i] === null) continue;
    n++;
    sa += a[i];
    sb += b[i];
  }
  if (n < 5) return null;
  const ma = sa / n;
  const mb = sb / n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < a.length; i += step) {
    if (a[i] === null || b[i] === null) continue;
    const da = a[i] - ma;
    const db = b[i] - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  if (saa === 0 || sbb === 0) return null;
  return sab / Math.sqrt(saa * sbb);
}

export function correlationMatrix(ds, names) {
  const list = names || ds.numCols.slice(0, 12);
  const matrix = list.map((x, i) => list.map((y, j) => (i === j ? 1 : null)));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const r = pearsonPair(ds.cols[list[i]], ds.cols[list[j]]);
      matrix[i][j] = r;
      matrix[j][i] = r;
    }
  }
  return { names: list, matrix };
}

export function geoPoints(ds, { sizeCol = null, labelCol = ds.labelCol, maxPoints = 20000 } = {}) {
  if (!ds.geo) return [];
  const la = ds.cols[ds.geo.latCol];
  const ln = ds.cols[ds.geo.lngCol];
  const sz = sizeCol ? ds.cols[sizeCol] : null;
  const lb = labelCol ? ds.cols[labelCol] : null;
  const step = la.length > maxPoints ? Math.ceil(la.length / maxPoints) : 1;
  const out = [];
  for (let i = 0; i < la.length; i += step) {
    if (la[i] === null || ln[i] === null) continue;
    out.push({ lt: la[i], lg: ln[i], v: sz ? sz[i] : null, label: lb ? lb[i] : null, i });
  }
  return out;
}

/* ============================================================== insights */

const SEV_RANK = { high: 0, medium: 1, info: 2 };
const q = (s) => `“${s}”`;

function nearestCity(lat, lng) {
  let best = null;
  (VN_CITIES || []).forEach((c) => {
    const d = haversineKm(lat, lng, c.lat, c.lng);
    if (!best || d < best.d) best = { name: c.name, d };
  });
  return best;
}

function rowLabel(ds, i) {
  if (ds.labelCol && ds.cols[ds.labelCol][i] !== null) return ds.cols[ds.labelCol][i];
  return `dòng ${i + 1}`;
}

export function buildInsights(ds) {
  const out = [];
  let seq = 0;
  const push = (severity, category, title, detail, suggestion) => out.push({ id: `g${seq++}`, severity, category, title, detail, suggestion });
  if (!ds || !ds.nRows) return out;

  /* 1. tổng quan */
  push(
    'info',
    'TỔNG QUAN',
    `${fmtNum(ds.nRows)} dòng × ${ds.columns.length} cột${ds.truncated ? ` (đã cắt còn ${fmtNum(MAX_ROWS)} dòng đầu)` : ''}`,
    `${ds.numCols.length} cột số, ${ds.catCols.length} cột nhóm, ${ds.dateCols.length} cột thời gian, ${ds.textCols.length} cột văn bản${ds.geo ? ', có toạ độ (bản đồ khả dụng)' : ''}.`,
    ds.dateCols.length
      ? 'Có cột thời gian — xem tab “Theo thời gian” để tìm xu hướng và đỉnh.'
      : 'Chưa có cột thời gian — thêm cột ngày/giờ nếu muốn phân tích xu hướng.'
  );

  /* 2. chất lượng dữ liệu */
  const sparse = ds.columns.filter((c) => c.type !== 'empty' && c.missingPct >= 0.3).sort((a, b) => b.missingPct - a.missingPct);
  if (sparse.length) {
    push(
      'medium',
      'CHẤT LƯỢNG',
      `${sparse.length} cột thiếu từ 30% giá trị`,
      sparse.slice(0, 4).map((c) => `${q(c.name)} thiếu ${pct(c.missingPct)}`).join(' · '),
      'Cân nhắc loại các cột này khỏi phân tích hoặc bổ sung dữ liệu trước khi kết luận.'
    );
  }
  const empties = ds.columns.filter((c) => c.type === 'empty');
  if (empties.length) push('info', 'CHẤT LƯỢNG', `${empties.length} cột hoàn toàn rỗng`, empties.slice(0, 5).map((c) => q(c.name)).join(', '), 'Có thể bỏ các cột rỗng khi xuất báo cáo.');
  if (ds.nRows <= 50000) {
    const seen = new Set();
    let dup = 0;
    ds.rows.forEach((r) => {
      const k = JSON.stringify(r);
      if (seen.has(k)) dup++;
      else seen.add(k);
    });
    if (dup / ds.nRows >= 0.02) {
      push('medium', 'CHẤT LƯỢNG', `${fmtNum(dup)} dòng trùng lặp (${pct(dup / ds.nRows, 1)})`, 'Nhiều dòng giống hệt nhau — có thể do nhập/xuất trùng.', 'Loại dòng trùng trước khi tính tổng hay trung bình để tránh đếm lặp.');
    }
  }

  /* 3. ngoại lai + lệch phân phối */
  const numMetas = ds.columns.filter((c) => c.type === 'number' && c.stats && c.stats.n >= 8 && !(ds.geo && [ds.geo.latCol, ds.geo.lngCol].includes(c.name)));
  const bigNum = numMetas.filter((c) => c.stats.n >= 20);
  bigNum
    .filter((c) => c.stats.outliers > 0)
    .sort((a, b) => b.stats.outliers / b.stats.n - a.stats.outliers / a.stats.n)
    .slice(0, 3)
    .forEach((c) => {
      const s = c.stats;
      const vals = ds.cols[c.name];
      let mi = -1;
      vals.forEach((x, i) => { if (x !== null && (mi < 0 || x > vals[mi])) mi = i; });
      const extreme = s.sd > 0 && (s.max - s.mean) / s.sd >= 5;
      push(
        extreme ? 'high' : 'medium',
        'NGOẠI LAI',
        `Cột ${q(c.name)} có ${fmtNum(s.outliers)} giá trị bất thường (${pct(s.outliers / s.n, 1)})`,
        `Lớn nhất ${fmtNum(s.max)} tại ${q(rowLabel(ds, mi))}; trung bình ${fmtNum(s.mean)}, trung vị ${fmtNum(s.median)}, ngưỡng thường ≤ ${fmtNum(s.fenceHi)}.`,
        extreme ? 'Giá trị cực lớn — kiểm tra lỗi nhập hay hiện tượng thực sự đáng đưa tin.' : 'Xem các dòng ngoại lai để tìm điểm nóng/đề tài; kiểm tra thêm đơn vị đo.'
      );
    });
  bigNum
    .filter((c) => c.stats.median > 0 && c.stats.mean > 1.8 * c.stats.median)
    .slice(0, 2)
    .forEach((c) => {
      push(
        'info',
        'PHÂN PHỐI',
        `Cột ${q(c.name)} lệch phải mạnh`,
        `Trung bình ${fmtNum(c.stats.mean)} cao gấp ${(c.stats.mean / c.stats.median).toFixed(1)} lần trung vị ${fmtNum(c.stats.median)} — một số ít giá trị lớn kéo trung bình lên.`,
        'Dùng trung vị hoặc phân vị 95% (' + fmtNum(c.stats.p95) + ') thay cho trung bình khi mô tả cho độc giả.'
      );
    });

  /* 4. tập trung theo nhóm */
  ds.columns
    .filter((c) => c.type === 'category' && !c.isColor && c.top && c.distinct >= 4 && c.nonNull >= 20)
    .forEach((c) => {
      const t1 = c.top[0].count / c.nonNull;
      const t3 = c.top.slice(0, 3).reduce((s, x) => s + x.count, 0) / c.nonNull;
      if (t1 >= 0.4) push('medium', 'TẬP TRUNG', `${q(c.top[0].value)} chiếm ${pct(t1)} cột ${q(c.name)}`, `Trong ${c.distinct} giá trị, “${c.top[0].value}” có ${fmtNum(c.top[0].count)} dòng.`, 'Dữ liệu bị chi phối bởi một nhóm — cân nhắc tách riêng khi so sánh.');
      else if (t3 >= 0.75) push('info', 'TẬP TRUNG', `3 nhóm đầu chiếm ${pct(t3)} cột ${q(c.name)}`, c.top.slice(0, 3).map((x) => `${x.value} (${fmtNum(x.count)})`).join(' · '), 'Tập trung vào các nhóm dẫn đầu khi viết bài, nhóm còn lại gộp “khác”.');
    });

  /* 5. tương quan */
  const corrCols = [...numMetas].sort((a, b) => b.stats.sd / (Math.abs(b.stats.mean) || 1) - a.stats.sd / (Math.abs(a.stats.mean) || 1)).slice(0, 12).map((c) => c.name);
  if (corrCols.length >= 2) {
    const { names, matrix } = correlationMatrix(ds, corrCols);
    const pairs = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const r = matrix[i][j];
        if (r !== null && Math.abs(r) >= 0.5) pairs.push({ a: names[i], b: names[j], r });
      }
    }
    pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, 4).forEach((p) => {
      if (Math.abs(p.r) >= 0.999) {
        push('info', 'TƯƠNG QUAN', `${q(p.a)} và ${q(p.b)} gần như trùng nhau`, `Hệ số tương quan r = ${p.r.toFixed(3)}.`, 'Có thể bỏ một trong hai cột để gọn dữ liệu.');
      } else {
        push(
          Math.abs(p.r) >= 0.7 ? 'medium' : 'info',
          'TƯƠNG QUAN',
          `${q(p.a)} ${p.r > 0 ? 'tăng cùng' : 'ngược chiều với'} ${q(p.b)} (r = ${p.r.toFixed(2)})`,
          `Mức tương quan ${Math.abs(p.r) >= 0.7 ? 'mạnh' : 'vừa'}.`,
          'Tương quan không đồng nghĩa nhân quả — hãy kiểm chứng bằng chuyên gia hoặc dữ liệu bổ sung.'
        );
      }
    });
  }

  /* 6. thời gian */
  ds.dateCols.slice(0, 2).forEach((dc) => {
    const metas = [null, ...numMetas.filter((c) => !c.name.toLowerCase().includes('id')).slice(0, 2).map((c) => c.name)];
    metas.forEach((mc) => {
      const agg = mc ? 'mean' : 'count';
      const { gran, rows } = timeBuckets(ds, dc, mc, agg);
      if (rows.length < 4) return;
      const vals = rows.map((r) => r.value);
      const st = numericStats(vals);
      if (!st || st.mean === 0) return;
      const peak = rows.reduce((a, b) => (b.value > a.value ? b : a), rows[0]);
      const z = st.sd > 0 ? (peak.value - st.mean) / st.sd : 0;
      const unit = gran === 'hour' ? 'giờ' : gran === 'day' ? 'ngày' : 'tháng';
      const what = mc ? `${q(mc)} trung bình` : 'số dòng';
      if (peak.value >= 2 * st.mean && z >= 2) {
        push('medium', 'THỜI GIAN', `Đỉnh ${what} vào ${peak.label}`, `Đạt ${fmtNum(peak.value)}, gấp ${(peak.value / st.mean).toFixed(1)} lần mức trung bình theo ${unit} (${fmtNum(st.mean)}).`, 'Đối chiếu sự kiện (thời tiết, chính sách, tin nóng) xảy ra quanh thời điểm này.');
      }
      const third = Math.max(1, Math.floor(rows.length / 3));
      const first = vals.slice(0, third).reduce((s, x) => s + x, 0) / third;
      const last = vals.slice(-third).reduce((s, x) => s + x, 0) / third;
      if (first > 0 && Math.abs(last / first - 1) >= 0.3) {
        const up = last > first;
        push(
          up ? 'medium' : 'info',
          'XU HƯỚNG',
          `${mc ? `Cột ${q(mc)}` : 'Số dòng'} ${up ? 'tăng' : 'giảm'} ${pct(Math.abs(last / first - 1))} theo ${unit}`,
          `Trung bình ${third} ${unit} đầu: ${fmtNum(first)} → ${third} ${unit} cuối: ${fmtNum(last)}.`,
          up ? 'Tăng liên tục — gợi ý theo dõi tiếp hoặc tìm nguyên nhân.' : 'Giảm dần — có thể là dấu hiệu hạ nhiệt hoặc dữ liệu thu thập thiếu.'
        );
      }
    });
  });

  /* 7. so sánh nhóm */
  const catMetas = ds.columns.filter((c) => c.type === 'category' && !c.isColor && c.distinct >= 3 && c.distinct <= 40);
  const comps = [];
  catMetas.slice(0, 4).forEach((cm) => {
    numMetas.slice(0, 4).forEach((nm) => {
      const overall = nm.stats.mean;
      if (!(overall > 0)) return;
      const agg = groupAggregate(ds, cm.name, nm.name, 'mean', 40).filter((g) => g.n >= 3);
      if (agg.length < 2) return;
      const best = agg[0];
      const ratio = best.value / overall;
      if (ratio >= 1.5) comps.push({ cm, nm, best, ratio, overall });
    });
  });
  comps.sort((a, b) => b.ratio - a.ratio).slice(0, 3).forEach((c) => {
    push('medium', 'SO SÁNH NHÓM', `${q(c.best.key)} có ${q(c.nm.name)} cao gấp ${c.ratio.toFixed(1)} lần trung bình`, `Nhóm theo ${q(c.cm.name)}: trung bình ${fmtNum(c.best.value)} (${fmtNum(c.best.n)} dòng) so với ${fmtNum(c.overall)} chung.`, 'Nhóm nổi bật này là ứng viên cho một câu chuyện riêng hoặc điểm nóng cần theo dõi.');
  });

  /* 8. không gian */
  if (ds.geo) {
    const pts = geoPoints(ds, { maxPoints: 50000 });
    if (pts.length >= 20) {
      const cell = 0.25;
      const m = new Map();
      pts.forEach((p) => {
        const key = `${Math.floor(p.lt / cell)}_${Math.floor(p.lg / cell)}`;
        let g = m.get(key);
        if (!g) { g = { n: 0, sl: 0, sg: 0 }; m.set(key, g); }
        g.n++;
        g.sl += p.lt;
        g.sg += p.lg;
      });
      const top = [...m.values()].sort((a, b) => b.n - a.n)[0];
      const share = top.n / pts.length;
      const lat = top.sl / top.n;
      const lng = top.sg / top.n;
      const city = nearestCity(lat, lng);
      if (share >= 0.1 && m.size > 3) {
        push(
          share >= 0.25 ? 'medium' : 'info',
          'KHÔNG GIAN',
          `${pct(share)} điểm tập trung quanh ${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E`,
          `Một ô lưới ~28 km chứa ${fmtNum(top.n)}/${fmtNum(pts.length)} điểm${city ? `, gần ${city.name} (~${Math.round(city.d)} km)` : ''}.`,
          'Mở tab “Bản đồ” để xem phân bố; khu vực này là điểm nóng đáng đào sâu.'
        );
      } else {
        push('info', 'KHÔNG GIAN', `${fmtNum(pts.length)} điểm có toạ độ, phân tán trên ${fmtNum(m.size)} ô lưới`, 'Không có khu vực nào vượt trội về mật độ.', 'Tô màu theo một cột số trên bản đồ để thấy khu vực giá trị cao.');
      }
    }
  }

  return out.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
}
