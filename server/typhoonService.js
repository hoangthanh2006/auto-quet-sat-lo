import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data/typhoon');
const PATH_LANDFALLS = path.join(DATA_DIR, 'typhoon_landfalls.csv');
const PATH_PROVINCE_METRICS = path.join(DATA_DIR, 'province_metrics.csv');
const PATH_MAINLAND = path.join(DATA_DIR, 'VietnamMainland.geojson');
const PATH_PROVINCES = path.join(DATA_DIR, 'ProvincialMainland.geojson');

const VN_WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function knotsToKmh(kt) {
  return Math.round(Number(kt) * 1.852 * 10) / 10;
}

export function formatVnDateTime(dateInput, includeTime = true) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  
  // GMT+7
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 7 * 3600000);
  
  const wDay = VN_WEEKDAY[vnDate.getDay()];
  const day = vnDate.getDate();
  const month = vnDate.getMonth() + 1;
  const hours = String(vnDate.getHours()).padStart(2, '0');
  const minutes = String(vnDate.getMinutes()).padStart(2, '0');
  
  if (includeTime) {
    return `${wDay}, ${day}/${month} ${hours}:${minutes}`;
  }
  return `${wDay}, ${day}/${month}`;
}

export function windCategory(windKt) {
  const w = Number(windKt);
  if (isNaN(w) || w < 21) return 'Áp thấp';
  if (w < 34) return 'Áp thấp nhiệt đới';
  if (w < 48) return 'Bão (cấp 8-9)';
  if (w < 64) return 'Bão mạnh (cấp 10-11)';
  if (w < 100) return 'Bão rất mạnh (cấp 12-15)';
  return 'Siêu bão (cấp 16+)';
}

export function windCategoryCode(windKt) {
  const w = Number(windKt);
  if (isNaN(w) || w < 21) return 'TD_LOW';
  if (w < 34) return 'TD';
  if (w < 48) return 'TS';
  if (w < 64) return 'STS';
  if (w < 100) return 'TY';
  return 'STY';
}

// ---------------------------------------------------------------------------
// 1. CÀO DANH SÁCH BÃO ĐANG HOẠT ĐỘNG (JTWC RSS + JMA Fallback)
// ---------------------------------------------------------------------------

export async function fetchActiveTyphoons() {
  const storms = [];
  let source = 'JTWC';

  try {
    const rssUrl = 'https://www.metoc.navy.mil/jtwc/rss/jtwc.rss';
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      },
      signal: AbortSignal.timeout(12000)
    });

    if (res.ok) {
      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });

      $('item').each((_, item) => {
        const title = $(item).find('title').text();
        const descHtml = $(item).find('description').text();
        const $desc = cheerio.load(descHtml);

        // Tìm các thẻ bão ví dụ: "Typhoon 24W (Dujuan) Warning #15"
        const stormBlocks = descHtml.split(/(?=<p><b>(?:Typhoon|Tropical Storm|Tropical Cyclone|Super Typhoon|Tropical Depression)\s+[\w\d]+)/i);

        stormBlocks.forEach(block => {
          const $b = cheerio.load(block);
          const headerText = $b('b').first().text().trim();
          if (!headerText) return;

          const matchName = headerText.match(/(?:Typhoon|Tropical Storm|Tropical Cyclone|Super Typhoon|Tropical Depression)\s+([\w\d]+)(?:\s*\(([\w\s]+)\))?/i);
          if (!matchName) return;

          const stormCode = matchName[1].toUpperCase();
          const stormName = (matchName[2] || stormCode).toUpperCase().trim();

          // Lấy các liên kết
          let textUrl = null;
          let kmzUrl = null;
          let gifUrl = null;
          let satImgUrl = null;

          $b('a').each((_, a) => {
            const href = $b(a).attr('href') || '';
            const linkText = $b(a).text().toLowerCase();

            if (href.endsWith('.kmz') || linkText.includes('google earth')) {
              kmzUrl = href.startsWith('http') ? href : `https://www.metoc.navy.mil${href}`;
            } else if (href.endsWith('.txt') && (linkText.includes('warning text') || href.includes('web.txt') || href.includes('prog.txt'))) {
              if (!textUrl || href.includes('web.txt')) {
                textUrl = href.startsWith('http') ? href : `https://www.metoc.navy.mil${href}`;
              }
            } else if (href.endsWith('.gif') || linkText.includes('graphic')) {
              gifUrl = href.startsWith('http') ? href : `https://www.metoc.navy.mil${href}`;
            } else if ((href.endsWith('.jpg') || href.endsWith('.png')) && linkText.includes('satellite')) {
              satImgUrl = href.startsWith('http') ? href : `https://www.metoc.navy.mil${href}`;
            }
          });

          // Trích xuất thông tin phát hành
          let issuedAt = '';
          const issuedMatch = block.match(/Issued at\s*([^<]+)/i);
          if (issuedMatch) issuedAt = issuedMatch[1].trim();

          // Kiểm tra xem bão có thuộc Tây Bắc Thái Bình Dương (WP) hay không
          const isWP = stormCode.endsWith('W') || stormCode.startsWith('WP');

          storms.push({
            id: stormCode,
            name: stormName,
            fullName: headerText,
            issuedAt,
            isNorthwestPacific: isWP,
            kmzUrl,
            textUrl,
            gifUrl,
            satImgUrl,
            status: 'active'
          });
        });
      });
    }
  } catch (err) {
    console.warn('Lỗi lấy JTWC RSS, thử fallback JMA:', err.message);
  }

  // Nếu JTWC rỗng hoặc lỗi, thử JMA
  if (storms.length === 0) {
    try {
      const jmaRes = await fetch('https://www.jma.go.jp/bosai/typhoon/data/targetTc.js', {
        signal: AbortSignal.timeout(6000)
      });
      if (jmaRes.ok) {
        const jmaText = await jmaRes.text();
        const jsonMatch = jmaText.match(/\[.*\]/s);
        if (jsonMatch) {
          const jmaData = JSON.parse(jsonMatch[0]);
          source = 'JMA';
          jmaData.forEach(item => {
            storms.push({
              id: item.tcId || item.id || 'JMA_STORM',
              name: (item.name || item.tcName || 'Bão JMA').toUpperCase(),
              fullName: `Bão ${item.name || ''}`,
              issuedAt: item.dateTime || new Date().toISOString(),
              isNorthwestPacific: true,
              kmzUrl: null,
              textUrl: null,
              status: 'active',
              source: 'JMA'
            });
          });
        }
      }
    } catch (jmaErr) {
      console.warn('Fallback JMA không khả dụng:', jmaErr.message);
    }
  }

  return {
    success: true,
    source,
    fetchedAt: new Date().toISOString(),
    totalActive: storms.length,
    storms
  };
}

// ---------------------------------------------------------------------------
// 2. PARSE KMZ THÀNH GEOJSON (Tương thích kmz_to_geojson.py)
// ---------------------------------------------------------------------------

function parseKmlCoordinates(text) {
  if (!text) return [];
  const coords = [];
  const tokens = text.trim().split(/\s+/);
  for (const token of tokens) {
    const parts = token.split(',');
    if (parts.length >= 2) {
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lon) && !isNaN(lat)) {
        coords.push([lon, lat]);
      }
    }
  }
  return coords;
}

export function parseKmzBuffer(buffer, fallbackName = 'TYPHOON') {
  const zip = new AdmZip(buffer);
  const zipEntries = zip.getEntries();
  const kmlEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.kml'));

  if (!kmlEntry) {
    throw new Error('Không tìm thấy file .kml bên trong file KMZ');
  }

  const kmlText = kmlEntry.getData().toString('utf8');
  const $ = cheerio.load(kmlText, { xmlMode: true });

  const docName = $('Document > name').text().trim();
  let stormName = fallbackName;

  const placemarks = $('Placemark');
  const forecastPoints = [];
  const windRadii = [];
  const bestTrackPoints = [];
  const trackLines = [];

  // Tìm tên bão từ description
  placemarks.each((_, pm) => {
    const desc = $(pm).find('description').text() || '';
    const nameMatch = desc.match(/<B>NAME<\/B>.*?<B>([\w\s]+)<\/B>/i);
    if (nameMatch) {
      stormName = nameMatch[1].trim().toUpperCase();
      return false; // break
    }
  });

  // Reference year/month
  let refYear = new Date().getUTCFullYear();
  let refMonth = new Date().getUTCMonth() + 1;

  placemarks.each((_, pm) => {
    const desc = $(pm).find('description').text() || '';
    const dtgMatch = desc.match(/(\d{4})(\d{2})(\d{2})(\d{2})Z/);
    if (dtgMatch) {
      refYear = parseInt(dtgMatch[1], 10);
      refMonth = parseInt(dtgMatch[2], 10);
      return false;
    }
  });

  function resolveDate(day, hour) {
    try {
      const d = new Date(Date.UTC(refYear, refMonth - 1, day, hour, 0, 0));
      return d;
    } catch {
      return new Date();
    }
  }

  let currentFcDt = null;
  let currentFcTau = 0;

  placemarks.each((_, pm) => {
    const name = $(pm).find('name').text().trim();
    const desc = $(pm).find('description').text() || '';

    // 1. Forecast Point
    // Pattern: "17/00Z ... - 40 knots" hoặc "17/12Z - 50 knots"
    const fcMatch = name.match(/^(\d{1,2})\/(\d{2})Z\b.*?-\s*(\d+)\s*knots/i);
    if (fcMatch) {
      const day = parseInt(fcMatch[1], 10);
      const hour = parseInt(fcMatch[2], 10);
      const windKt = parseInt(fcMatch[3], 10);

      // DTG
      let dtUtc = resolveDate(day, hour);
      const dtgDesc = desc.match(/(\d{4})(\d{2})(\d{2})(\d{2})Z/);
      if (dtgDesc) {
        dtUtc = new Date(Date.UTC(
          parseInt(dtgDesc[1], 10),
          parseInt(dtgDesc[2], 10) - 1,
          parseInt(dtgDesc[3], 10),
          parseInt(dtgDesc[4], 10)
        ));
      }

      currentFcDt = dtUtc;

      // TAU
      const tauMatch = desc.match(/TAU\s+(\d+)/i);
      currentFcTau = tauMatch ? parseInt(tauMatch[1], 10) : (forecastPoints.length === 0 ? 0 : forecastPoints.length * 12);

      // Movement
      let movDeg = null;
      let movKmh = null;
      const movMatch = desc.match(/(\d+)\s*DEG AT\s*([\d.]+)\s*KT/i);
      if (movMatch) {
        movDeg = parseInt(movMatch[1], 10);
        movKmh = knotsToKmh(parseFloat(movMatch[2]));
      }

      const coords = parseKmlCoordinates($(pm).find('coordinates').text());
      if (coords.length > 0) {
        forecastPoints.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coords[0] },
          properties: {
            feature_type: 'forecast_point',
            feature_name_vn: 'Vị trí dự báo',
            storm_name: stormName,
            tau_h: currentFcTau,
            dtg_utc: dtUtc.toISOString(),
            time_vn: formatVnDateTime(dtUtc),
            wind_kt: windKt,
            wind_kmh: knotsToKmh(windKt),
            category: windCategory(windKt),
            category_code: windCategoryCode(windKt),
            movement_deg: movDeg,
            movement_kmh: movKmh
          }
        });
      }
      return;
    }

    // 2. Wind Radii Polygon (RADIUS OF 34/50/64 KT WINDS)
    const radiiMatch = name.match(/RADIUS OF (\d+) KT WINDS/i);
    if (radiiMatch) {
      const radiiKt = parseInt(radiiMatch[1], 10);
      const coords = parseKmlCoordinates($(pm).find('coordinates').text());
      if (coords.length >= 3) {
        // Đảm bảo đóng vòng polygon
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push(coords[0]);
        }
        windRadii.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: {
            feature_type: 'wind_radii',
            feature_name_vn: `Vùng gió mạnh ≥ ${radiiKt} kt`,
            radii_kt: radiiKt,
            radii_kmh: knotsToKmh(radiiKt),
            tau_h: currentFcTau,
            time_vn: currentFcDt ? formatVnDateTime(currentFcDt) : null,
            dtg_utc: currentFcDt ? currentFcDt.toISOString() : null
          }
        });
      }
      return;
    }

    // 3. Best Track Point (vị trí quan trắc quá khứ ví dụ "26031412Z")
    const btkMatch = name.match(/^(\d{8})Z$/i);
    if (btkMatch) {
      const windMatch = desc.match(/(\d+)\s*knots/i);
      const windKt = windMatch ? parseInt(windMatch[1], 10) : 0;
      const yr = 2000 + parseInt(btkMatch[1].substring(0, 2), 10);
      const mo = parseInt(btkMatch[1].substring(2, 4), 10);
      const da = parseInt(btkMatch[1].substring(4, 6), 10);
      const hr = parseInt(btkMatch[1].substring(6, 8), 10);
      const dtUtc = new Date(Date.UTC(yr, mo - 1, da, hr, 0, 0));

      const coords = parseKmlCoordinates($(pm).find('coordinates').text());
      if (coords.length > 0) {
        bestTrackPoints.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coords[0] },
          properties: {
            feature_type: 'best_track_point',
            feature_name_vn: 'Vị trí quan trắc',
            storm_name: stormName,
            dtg_utc: dtUtc.toISOString(),
            time_vn: formatVnDateTime(dtUtc),
            wind_kt: windKt,
            wind_kmh: knotsToKmh(windKt),
            category: windCategory(windKt),
            category_code: windCategoryCode(windKt)
          }
        });
      }
      return;
    }

    // 4. Track lines (LineString) & Danger Swaths (Polygon)
    const lineStringEl = $(pm).find('LineString');
    const polygonEl = $(pm).find('Polygon');

    if (lineStringEl.length > 0) {
      const coords = parseKmlCoordinates(lineStringEl.find('coordinates').text());
      if (coords.length >= 2) {
        const isBestTrack = name.toLowerCase().includes('best track');
        trackLines.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {
            feature_type: isBestTrack ? 'best_track' : 'forecast_track',
            feature_name_vn: isBestTrack ? 'Đường đi thực tế' : 'Đường đi dự báo',
            name
          }
        });
      }
    } else if (polygonEl.length > 0) {
      const coords = parseKmlCoordinates(polygonEl.find('coordinates').text());
      if (coords.length >= 3) {
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push(coords[0]);
        }
        trackLines.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: {
            feature_type: 'danger_swath',
            feature_name_vn: 'Hành lang nguy hiểm',
            name,
            radii_kt: 34,
            radii_kmh: knotsToKmh(34)
          }
        });
      }
    }
  });

  // Gom toàn bộ features
  const allFeatures = [
    ...trackLines,
    ...windRadii,
    ...bestTrackPoints,
    ...forecastPoints
  ];

  return {
    type: 'FeatureCollection',
    features: allFeatures,
    _meta: {
      source: 'JTWC KMZ',
      storm_name: stormName,
      doc_name: docName,
      forecast_count: forecastPoints.length,
      best_track_count: bestTrackPoints.length,
      wind_radii_count: windRadii.length,
      track_lines_count: trackLines.length
    }
  };
}

// ---------------------------------------------------------------------------
// 3. PARSE TEXT WARNING BULLETINS (Nếu không có KMZ)
// ---------------------------------------------------------------------------

export function parseTextWarningToGeoJson(text, stormName = 'TYPHOON') {
  const forecastPoints = [];
  const trackCoords = [];

  // Warning position: "190000Z --- NEAR 26.2N 139.7E"
  const warnPosMatch = text.match(/WARNING POSITION:\s*\n?\s*(\d{6})Z\s*---\s*NEAR\s*([\d.]+)N\s+([\d.]+)E/i);
  const maxWindMatch = text.match(/MAX SUSTAINED WINDS\s*-\s*(\d+)\s*KT/i);

  if (warnPosMatch) {
    const lat = parseFloat(warnPosMatch[2]);
    const lon = parseFloat(warnPosMatch[3]);
    const windKt = maxWindMatch ? parseInt(maxWindMatch[1], 10) : 45;
    const dtg = warnPosMatch[1]; // e.g. 190000
    const now = new Date();
    const day = parseInt(dtg.substring(0, 2), 10);
    const hour = parseInt(dtg.substring(2, 4), 10);
    const dtUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour, 0));

    forecastPoints.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        feature_type: 'forecast_point',
        feature_name_vn: 'Vị trí hiện tại',
        storm_name: stormName,
        tau_h: 0,
        dtg_utc: dtUtc.toISOString(),
        time_vn: formatVnDateTime(dtUtc),
        wind_kt: windKt,
        wind_kmh: knotsToKmh(windKt),
        category: windCategory(windKt),
        category_code: windCategoryCode(windKt)
      }
    });
    trackCoords.push([lon, lat]);
  }

  // Forecasts blocks:
  // 12 HRS, VALID AT: \n 191200Z --- 27.4N 138.3E \n MAX SUSTAINED WINDS - 065 KT
  const fcRegex = /(\d+)\s*HRS,\s*VALID AT:\s*\n?\s*(\d{6})Z\s*---\s*([\d.]+)N\s+([\d.]+)E\s*\n?\s*MAX SUSTAINED WINDS\s*-\s*(\d+)\s*KT/gi;
  let m;
  while ((m = fcRegex.exec(text)) !== null) {
    const tau = parseInt(m[1], 10);
    const dtg = m[2];
    const lat = parseFloat(m[3]);
    const lon = parseFloat(m[4]);
    const windKt = parseInt(m[5], 10);

    const now = new Date();
    const day = parseInt(dtg.substring(0, 2), 10);
    const hour = parseInt(dtg.substring(2, 4), 10);
    const dtUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour, 0));

    forecastPoints.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        feature_type: 'forecast_point',
        feature_name_vn: 'Vị trí dự báo',
        storm_name: stormName,
        tau_h: tau,
        dtg_utc: dtUtc.toISOString(),
        time_vn: formatVnDateTime(dtUtc),
        wind_kt: windKt,
        wind_kmh: knotsToKmh(windKt),
        category: windCategory(windKt),
        category_code: windCategoryCode(windKt)
      }
    });
    trackCoords.push([lon, lat]);
  }

  const features = [...forecastPoints];
  if (trackCoords.length >= 2) {
    features.unshift({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: trackCoords },
      properties: {
        feature_type: 'forecast_track',
        feature_name_vn: 'Đường đi dự báo',
        name: 'Forecast Track'
      }
    });
  }

  return {
    type: 'FeatureCollection',
    features,
    _meta: {
      source: 'JTWC Warning Text',
      storm_name: stormName,
      forecast_count: forecastPoints.length
    }
  };
}

// ---------------------------------------------------------------------------
// 4. HÀM TÍNH TOÁN HÌNH HỌC (GIAO CẮT ĐƯỜNG BỜ BIỂN & ĐỔ BỘ VIỆT NAM)
// ---------------------------------------------------------------------------

function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function lineSegmentsIntersect(p1, p2, p3, p4) {
  function ccw(a, b, c) {
    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  }
  return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
}

export function estimateLandfall(stormGeoJson) {
  const features = stormGeoJson.features || [];
  const forecastPts = features.filter(f => f.properties?.feature_type === 'forecast_point')
    .sort((a, b) => (a.properties?.tau_h || 0) - (b.properties?.tau_h || 0));

  if (forecastPts.length < 2) {
    return { estimated: false, note: 'Không đủ điểm dự báo để ước tính đổ bộ' };
  }

  // Tải GeoJSON bờ biển & các tỉnh
  let mainlandRings = [];
  let provinceFeatures = [];

  try {
    if (fs.existsSync(PATH_MAINLAND)) {
      const mainland = JSON.parse(fs.readFileSync(PATH_MAINLAND, 'utf8'));
      if (mainland.features?.[0]?.geometry) {
        const geom = mainland.features[0].geometry;
        mainlandRings = geom.type === 'Polygon' ? geom.coordinates : (geom.type === 'MultiPolygon' ? geom.coordinates.flat(1) : []);
      }
    }
  } catch (err) {
    console.warn('Lỗi đọc VietnamMainland.geojson:', err.message);
  }

  try {
    if (fs.existsSync(PATH_PROVINCES)) {
      const provData = JSON.parse(fs.readFileSync(PATH_PROVINCES, 'utf8'));
      provinceFeatures = provData.features || [];
    }
  } catch (err) {
    console.warn('Lỗi đọc ProvincialMainland.geojson:', err.message);
  }

  // Kiểm tra từng đoạn thẳng dự báo
  for (let i = 0; i < forecastPts.length - 1; i++) {
    const pt1 = forecastPts[i];
    const pt2 = forecastPts[i + 1];
    const segP1 = pt1.geometry.coordinates;
    const segP2 = pt2.geometry.coordinates;

    // Kiểm tra xem đoạn thẳng có giao cắt với bất kỳ đường viền nào của đất liền không
    let isIntersect = false;
    for (const ring of mainlandRings) {
      for (let j = 0; j < ring.length - 1; j++) {
        if (lineSegmentsIntersect(segP1, segP2, ring[j], ring[j + 1])) {
          isIntersect = true;
          break;
        }
      }
      if (isIntersect) break;
    }

    // Hoặc điểm pt2 đã nằm hẳn trong đất liền
    if (!isIntersect && mainlandRings.length > 0) {
      if (pointInPolygon(segP2, mainlandRings[0])) {
        isIntersect = true;
      }
    }

    if (isIntersect) {
      // Nội suy sức gió
      const w1 = pt1.properties.wind_kmh || 0;
      const w2 = pt2.properties.wind_kmh || 0;
      const landfallWindKmh = Math.round(((w1 + w2) / 2) * 10) / 10;
      const landfallWindKt = Math.round(landfallWindKmh / 1.852);

      // Xác định tỉnh thành
      let provinceName = 'Bờ biển miền Trung / Bắc Bộ';
      for (const pf of provinceFeatures) {
        const pRings = pf.geometry.type === 'Polygon' ? pf.geometry.coordinates : (pf.geometry.type === 'MultiPolygon' ? pf.geometry.coordinates.flat(1) : []);
        let found = false;
        for (const ring of pRings) {
          for (let j = 0; j < ring.length - 1; j++) {
            if (lineSegmentsIntersect(segP1, segP2, ring[j], ring[j + 1])) {
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (found || (pRings[0] && pointInPolygon(segP2, pRings[0]))) {
          provinceName = pf.properties.PROVINCE_NAME || pf.properties.NAME || provinceName;
          break;
        }
      }

      return {
        estimated: true,
        province: provinceName,
        time_window: [pt1.properties.time_vn, pt2.properties.time_vn],
        between_tau: [pt1.properties.tau_h, pt2.properties.tau_h],
        wind_kmh: landfallWindKmh,
        wind_kt: landfallWindKt,
        category: windCategory(landfallWindKt),
        entry_coords: segP2
      };
    }
  }

  return {
    estimated: false,
    note: 'Đường dự báo bão chưa có dấu hiệu đổ bộ trực tiếp vào đất liền Việt Nam'
  };
}

// ---------------------------------------------------------------------------
// 5. PHÂN TÍCH SO SÁNH LỊCH SỬ (HISTORICAL BENCHMARK)
// ---------------------------------------------------------------------------

let cachedLandfalls = null;

function loadLandfallsDataset() {
  if (cachedLandfalls) return cachedLandfalls;
  if (!fs.existsSync(PATH_LANDFALLS)) return [];

  const raw = fs.readFileSync(PATH_LANDFALLS, 'utf8');
  const lines = raw.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    // Regex tách CSV có chứa dấu ngoặc kép
    const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
    if (values.length >= headers.length) {
      const obj = {};
      headers.forEach((h, idx) => {
        let v = (values[idx] || '').trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.substring(1, v.length - 1);
        obj[h] = v;
      });

      obj.year = parseInt(obj.SID?.substring(0, 4) || '0', 10);
      obj.wind_at_landfall_kph = parseFloat(obj.wind_at_landfall_kph || '0');
      obj.time_on_land_h = parseFloat(obj.time_on_land_h || '0');
      rows.push(obj);
    }
  }

  // Lọc từ 1950 trở đi cho độ tin cậy cao
  cachedLandfalls = rows.filter(r => r.year >= 1950);
  return cachedLandfalls;
}

export function compareHistorical(stormData, landfallEst = null) {
  const dataset = loadLandfallsDataset();
  const total = dataset.length;
  if (total === 0) {
    return { total_historical_landfalls: 0, note: 'Chưa nạp được dataset lịch sử' };
  }

  const currentWindKmh = stormData.current_position?.wind_kmh || 0;
  const peakWindKmh = stormData.peak_forecast?.wind_kmh || currentWindKmh;

  // Tính phân vị: Bão hiện tại mạnh hơn bao nhiêu % bão đổ bộ lịch sử
  const weakerCount = dataset.filter(s => s.wind_at_landfall_kph <= peakWindKmh).length;
  const percentile = Math.round((weakerCount / total) * 1000) / 10;

  // Thống kê sức gió lịch sử
  const winds = dataset.map(s => s.wind_at_landfall_kph).filter(w => w > 0).sort((a, b) => a - b);
  const meanKmh = Math.round((winds.reduce((a, b) => a + b, 0) / winds.length) * 10) / 10;
  const maxKmh = Math.max(...winds);
  const medianKmh = winds[Math.floor(winds.length / 2)] || 0;
  const p75Kmh = winds[Math.floor(winds.length * 0.75)] || 0;
  const p90Kmh = winds[Math.floor(winds.length * 0.90)] || 0;

  // Tìm 10 cơn bão tương đồng về cường độ (±20 km/h)
  const similar = dataset
    .filter(s => Math.abs(s.wind_at_landfall_kph - peakWindKmh) <= 20)
    .sort((a, b) => b.year - a.year)
    .slice(0, 10)
    .map(s => ({
      name: s.NAME,
      year: s.year,
      landfall_time: s.calc_landfall_time?.substring(0, 16) || '',
      wind_kph: s.wind_at_landfall_kph,
      wind_kt: Math.round(s.wind_at_landfall_kph / 1.852),
      province: s.province_landfall,
      time_on_land_h: s.time_on_land_h
    }));

  // Lịch sử của tỉnh thành (nếu có ước tính đổ bộ)
  let provinceHistory = null;
  if (landfallEst?.estimated && landfallEst.province) {
    const provName = landfallEst.province;
    const provStorms = dataset.filter(s => s.province_landfall?.toLowerCase().includes(provName.toLowerCase()));
    if (provStorms.length > 0) {
      const provWinds = provStorms.map(s => s.wind_at_landfall_kph);
      provinceHistory = {
        province: provName,
        landfall_count: provStorms.length,
        avg_wind_kph: Math.round((provWinds.reduce((a, b) => a + b, 0) / provWinds.length) * 10) / 10,
        max_wind_kph: Math.max(...provWinds),
        recent_storms: provStorms.slice(-5).map(s => ({
          name: s.NAME,
          year: s.year,
          wind_kph: s.wind_at_landfall_kph,
          time: s.calc_landfall_time?.substring(0, 10)
        }))
      };
    }
  }

  return {
    total_historical_landfalls: total,
    year_range: '1950–2025',
    peak_forecast_percentile: percentile,
    historical_wind_stats: {
      mean_kph: meanKmh,
      median_kph: medianKmh,
      max_kph: maxKmh,
      p75_kph: p75Kmh,
      p90_kph: p90Kmh
    },
    similar_intensity_storms: similar,
    province_history: provinceHistory
  };
}

// ---------------------------------------------------------------------------
// 6. TỔNG HỢP TOÀN DIỆN MỘT CƠN BÃO (ANALYZE FULL)
// ---------------------------------------------------------------------------

export function analyzeStormGeoJson(geojson, options = {}) {
  const features = geojson.features || [];
  const forecastPts = features.filter(f => f.properties?.feature_type === 'forecast_point')
    .sort((a, b) => (a.properties?.tau_h || 0) - (b.properties?.tau_h || 0));
  const bestTrackPts = features.filter(f => f.properties?.feature_type === 'best_track_point');

  let stormName = options.name || geojson._meta?.storm_name || forecastPts[0]?.properties?.storm_name || 'TYPHOON';

  // Vị trí hiện tại (TAU 0 hoặc điểm đầu tiên)
  const current = forecastPts[0]?.properties || {};
  const currentCoords = forecastPts[0]?.geometry?.coordinates || [0, 0];

  // Dự báo cực đại
  let peakForecast = null;
  if (forecastPts.length > 0) {
    const maxPt = forecastPts.reduce((prev, curr) => 
      (curr.properties?.wind_kt || 0) > (prev.properties?.wind_kt || 0) ? curr : prev
    , forecastPts[0]);

    peakForecast = {
      wind_kt: maxPt.properties?.wind_kt || 0,
      wind_kmh: maxPt.properties?.wind_kmh || 0,
      category: maxPt.properties?.category || '',
      tau_h: maxPt.properties?.tau_h || 0,
      time_vn: maxPt.properties?.time_vn || ''
    };
  }

  const stormSummary = {
    storm_name: stormName,
    current_position: {
      lon: currentCoords[0],
      lat: currentCoords[1],
      wind_kt: current.wind_kt || 0,
      wind_kmh: current.wind_kmh || 0,
      category: current.category || '',
      category_code: current.category_code || '',
      time_vn: current.time_vn || '',
      movement_deg: current.movement_deg,
      movement_kmh: current.movement_kmh
    },
    peak_forecast: peakForecast,
    forecast_points_count: forecastPts.length,
    best_track_count: bestTrackPts.length
  };

  // Ước lượng đổ bộ
  const landfallEstimate = estimateLandfall(geojson);

  // So sánh lịch sử
  const historicalComparison = compareHistorical(stormSummary, landfallEstimate);

  return {
    summary: stormSummary,
    landfall: landfallEstimate,
    historical: historicalComparison,
    geojson
  };
}

// ---------------------------------------------------------------------------
// 7. LẤY SỐ LIỆU TỈNH THÀNH & LỊCH SỬ CHO FRONTEND
// ---------------------------------------------------------------------------

export function getProvinceMetrics() {
  if (!fs.existsSync(PATH_PROVINCE_METRICS)) return [];
  const raw = fs.readFileSync(PATH_PROVINCE_METRICS, 'utf8');
  const lines = raw.trim().split('\n');
  if (lines.length < 2) return [];

  const list = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 5) {
      list.push({
        province: parts[0].trim(),
        direct_landfall_count: parseInt(parts[1].trim(), 10) || 0,
        avg_wind_kph: parseFloat(parts[2].trim()) || 0,
        crossed_count: parseInt(parts[3].trim(), 10) || 0,
        avg_days_between: parseFloat(parts[4].trim()) || 0
      });
    }
  }

  return list.sort((a, b) => b.direct_landfall_count - a.direct_landfall_count);
}

export function getHistoricalLandfalls(query = {}) {
  const dataset = loadLandfallsDataset();
  let results = [...dataset];

  if (query.year) {
    results = results.filter(s => s.year === parseInt(query.year, 10));
  }
  if (query.province) {
    const p = query.province.toLowerCase();
    results = results.filter(s => s.province_landfall?.toLowerCase().includes(p));
  }
  if (query.minWind) {
    const mw = parseFloat(query.minWind);
    results = results.filter(s => s.wind_at_landfall_kph >= mw);
  }
  if (query.search) {
    const q = query.search.toLowerCase();
    results = results.filter(s => 
      s.NAME?.toLowerCase().includes(q) || 
      s.province_landfall?.toLowerCase().includes(q)
    );
  }

  return results.sort((a, b) => b.year - a.year);
}
