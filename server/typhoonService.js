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
// 0. HÀM PHÂN TÍCH CSV CHUẨN XỬ LÝ DẤU NGOẶC KÉP VÀ DẤU CÁCH
// ---------------------------------------------------------------------------

export function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(12000)
    });

    if (res.ok) {
      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });

      $('item').each((_, item) => {
        const title = $(item).find('title').text();
        const descHtml = $(item).find('description').text();

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
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        },
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
// 2. PARSE KMZ THÀNH GEOJSON
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
    // Pattern: "19/00Z (TYPHOON 24W (DUJUAN) WARNING NR 15 - 65 knots)" hoặc "19/12Z - 65 knots"
    const fcMatch = name.match(/^(\d{1,2})\/(\d{2})Z\b.*?-\s*(\d+)\s*knots/i);
    if (fcMatch && $(pm).find('Point').length > 0) {
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
      const movMatch = desc.match(/(\d+)\s*DEG(?:REES)?(?:\s*TRUE)?\s*AT\s*([\d.]+)\s*K(?:T|TS|NOTS)?/i);
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
            feature_name_vn: currentFcTau === 0 ? 'Vị trí hiện tại' : `Dự báo +${currentFcTau}h`,
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

    // 3. Best Track Point (vị trí quan trắc quá khứ ví dụ "26091300Z")
    const btkMatch = name.match(/^(\d{8})Z$/i);
    if (btkMatch && $(pm).find('Point').length > 0) {
      const windMatch = desc.match(/(?:Intensity:\s*)?(\d+)\s*knots/i);
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
        const isBestTrack = name.toLowerCase().includes('best track') || name.toLowerCase().includes('observed') || name.toLowerCase().includes('historic');
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
        feature_name_vn: `Dự báo +${tau}h`,
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

export function loadLandfallsDataset() {
  if (cachedLandfalls) return cachedLandfalls;
  if (!fs.existsSync(PATH_LANDFALLS)) return [];

  const raw = fs.readFileSync(PATH_LANDFALLS, 'utf8');
  const lines = raw.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length >= headers.length) {
      const obj = {};
      headers.forEach((h, idx) => {
        let v = (values[idx] || '').trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.substring(1, v.length - 1);
        obj[h] = v;
      });

      const year = parseInt(obj.SID?.substring(0, 4) || '0', 10);
      const windKph = parseFloat(obj.wind_at_landfall_kph || '0');
      const timeOnLand = parseFloat(obj.time_on_land_h || '0');
      const prov = (obj.province_landfall || '').trim();

      const item = {
        SID: obj.SID || '',
        name: obj.NAME || 'UNNAMED',
        NAME: obj.NAME || 'UNNAMED',
        year,
        calc_landfall_time: obj.calc_landfall_time || '',
        landfall_time: obj.calc_landfall_time || '',
        landfall_lat: parseFloat(obj.landfall_lat || '0'),
        landfall_lon: parseFloat(obj.landfall_lon || '0'),
        wind_at_landfall_kph: windKph,
        wind_kph: windKph,
        wind_kmh: windKph,
        wind_kt: Math.round(windKph / 1.852),
        province_landfall: prov,
        province: prov,
        provinces_crossed: obj.provinces_crossed || '',
        time_on_land_h: timeOnLand,
        hours_on_land: timeOnLand,
        avg_wind_on_land_kph: parseFloat(obj.avg_wind_on_land_kph || '0')
      };

      rows.push(item);
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
    return {
      total_historical_landfalls: 0,
      percentile: 0,
      peak_forecast_percentile: 0,
      mean_wind: 0,
      max_wind: 0,
      p90: 0,
      historical_wind_stats: { mean_kph: 0, median_kph: 0, max_kph: 0, p75_kph: 0, p90_kph: 0 },
      similar_intensity_storms: [],
      similar_storms: [],
      note: 'Chưa nạp được dataset lịch sử'
    };
  }

  const currentWindKmh = stormData.current_position?.wind_kmh || 0;
  const peakWindKmh = stormData.peak_forecast?.wind_kmh || currentWindKmh;

  // Tính phân vị: Bão hiện tại mạnh hơn bao nhiêu % bão đổ bộ lịch sử
  const weakerCount = dataset.filter(s => s.wind_at_landfall_kph <= peakWindKmh).length;
  const percentile = Math.round((weakerCount / total) * 1000) / 10;

  // Thống kê sức gió lịch sử
  const winds = dataset.map(s => s.wind_at_landfall_kph).filter(w => w > 0).sort((a, b) => a - b);
  const meanKmh = winds.length > 0 ? Math.round((winds.reduce((a, b) => a + b, 0) / winds.length) * 10) / 10 : 0;
  const maxKmh = winds.length > 0 ? Math.max(...winds) : 0;
  const medianKmh = winds.length > 0 ? (winds[Math.floor(winds.length / 2)] || 0) : 0;
  const p75Kmh = winds.length > 0 ? (winds[Math.floor(winds.length * 0.75)] || 0) : 0;
  const p90Kmh = winds.length > 0 ? (winds[Math.floor(winds.length * 0.90)] || 0) : 0;

  // Tìm 10 cơn bão tương đồng về cường độ (±20 km/h)
  const similar = dataset
    .filter(s => Math.abs(s.wind_at_landfall_kph - peakWindKmh) <= 20)
    .sort((a, b) => b.year - a.year)
    .slice(0, 10)
    .map(s => ({
      name: s.name,
      NAME: s.NAME,
      year: s.year,
      landfall_time: s.calc_landfall_time?.substring(0, 16) || '',
      wind_kmh: s.wind_at_landfall_kph,
      wind_kph: s.wind_at_landfall_kph,
      wind_kt: s.wind_kt,
      province: s.province_landfall,
      province_landfall: s.province_landfall,
      time_on_land_h: s.time_on_land_h,
      hours_on_land: s.time_on_land_h
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
          name: s.name,
          year: s.year,
          wind_kph: s.wind_at_landfall_kph,
          wind_kmh: s.wind_at_landfall_kph,
          time: s.calc_landfall_time?.substring(0, 10)
        }))
      };
    }
  }

  const windStats = {
    mean_kph: meanKmh,
    mean_wind: meanKmh,
    median_kph: medianKmh,
    max_kph: maxKmh,
    max_wind: maxKmh,
    p75_kph: p75Kmh,
    p90_kph: p90Kmh,
    p90: p90Kmh
  };

  return {
    total_historical_landfalls: total,
    year_range: '1950–2025',
    peak_forecast_percentile: percentile,
    percentile,
    mean_wind: meanKmh,
    max_wind: maxKmh,
    p90: p90Kmh,
    historical_wind_stats: windStats,
    similar_intensity_storms: similar,
    similar_storms: similar,
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
      category: current.category || 'Bão',
      category_code: current.category_code || 'TC',
      time_vn: current.time_vn || '',
      movement_deg: current.movement_deg ?? null,
      movement_kmh: current.movement_kmh ?? null
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
    storm_meta: {
      name: stormName,
      fullName: options.fullName || stormName
    },
    current_stats: stormSummary.current_position,
    landfall: landfallEstimate,
    landfall_assessment: landfallEstimate,
    historical: historicalComparison,
    historical_benchmark: historicalComparison,
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
    const parts = parseCsvLine(lines[i]);
    if (parts.length >= 4) {
      const prov = parts[0].trim();
      const directCount = parseInt(parts[1]?.trim() || '0', 10) || 0;
      const avgWind = parseFloat(parts[2]?.trim() || '0') || 0;
      const crossedCount = parseInt(parts[3]?.trim() || '0', 10) || 0;
      const avgDays = parseFloat(parts[4]?.trim() || '0') || 0;

      list.push({
        province: prov,
        direct_landfall_count: directCount,
        landfall_count: directCount,
        avg_wind_kph: avgWind,
        avg_wind_kmh: avgWind,
        max_wind_kmh: avgWind,
        crossed_count: crossedCount,
        swath_count: crossedCount,
        avg_days_between: avgDays
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
      s.name?.toLowerCase().includes(q) || 
      s.province_landfall?.toLowerCase().includes(q) ||
      s.year.toString().includes(q)
    );
  }

  return results.sort((a, b) => b.year - a.year);
}

// ---------------------------------------------------------------------------
// 8. PRESETS CÁC SIÊU BÃO LỊCH SỬ TIÊU BIỂU TẠI VIỆT NAM
// ---------------------------------------------------------------------------

export const HISTORICAL_PRESETS = [
  {
    id: 'PRESET_YAGI_2024',
    name: 'YAGI (Bão số 3 - 2024)',
    year: 2024,
    description: 'Siêu bão lịch sử đổ bộ Quảng Ninh - Hải Phòng (Sức gió cấp 14-16, giật cấp 17)',
    landfall_province: 'tỉnh Quảng Ninh',
    peak_wind_kmh: 213,
    peak_wind_kt: 115,
    track: [
      { tau: 0, lat: 18.8, lon: 118.2, wind_kt: 75, wind_kmh: 138.9, time_vn: 'T5, 05/09 07:00' },
      { tau: 12, lat: 19.3, lon: 115.6, wind_kt: 95, wind_kmh: 175.9, time_vn: 'T5, 05/09 19:00' },
      { tau: 24, lat: 19.8, lon: 112.8, wind_kt: 115, wind_kmh: 213.0, time_vn: 'T6, 06/09 07:00' },
      { tau: 36, lat: 20.2, lon: 110.1, wind_kt: 110, wind_kmh: 203.7, time_vn: 'T6, 06/09 19:00' },
      { tau: 48, lat: 20.8, lon: 107.4, wind_kt: 90, wind_kmh: 166.7, time_vn: 'T7, 07/09 07:00' },
      { tau: 60, lat: 21.3, lon: 105.8, wind_kt: 55, wind_kmh: 101.9, time_vn: 'T7, 07/09 19:00' },
      { tau: 72, lat: 21.8, lon: 103.5, wind_kt: 25, wind_kmh: 46.3, time_vn: 'CN, 08/09 07:00' }
    ]
  },
  {
    id: 'PRESET_MOLAVE_2020',
    name: 'MOLAVE (Bão số 9 - 2020)',
    year: 2020,
    description: 'Bão rất mạnh đổ bộ Quảng Ngãi - Quảng Nam tháng 10/2020',
    landfall_province: 'tỉnh Quảng Ngãi',
    peak_wind_kmh: 175.9,
    peak_wind_kt: 95,
    track: [
      { tau: 0, lat: 13.5, lon: 119.5, wind_kt: 70, wind_kmh: 129.6, time_vn: 'T2, 26/10 07:00' },
      { tau: 12, lat: 13.8, lon: 116.8, wind_kt: 85, wind_kmh: 157.4, time_vn: 'T2, 26/10 19:00' },
      { tau: 24, lat: 14.3, lon: 113.7, wind_kt: 95, wind_kmh: 175.9, time_vn: 'T3, 27/10 07:00' },
      { tau: 36, lat: 14.8, lon: 110.8, wind_kt: 90, wind_kmh: 166.7, time_vn: 'T3, 27/10 19:00' },
      { tau: 48, lat: 15.2, lon: 108.9, wind_kt: 75, wind_kmh: 138.9, time_vn: 'T4, 28/10 07:00' },
      { tau: 60, lat: 15.5, lon: 106.8, wind_kt: 40, wind_kmh: 74.1, time_vn: 'T4, 28/10 19:00' }
    ]
  },
  {
    id: 'PRESET_DAMREY_2017',
    name: 'DAMREY (Bão số 12 - 2017)',
    year: 2017,
    description: 'Bão mạnh đổ bộ trực tiếp Khánh Hòa - Nam Trung Bộ tháng 11/2017',
    landfall_province: 'tỉnh Khánh Hòa',
    peak_wind_kmh: 138.9,
    peak_wind_kt: 75,
    track: [
      { tau: 0, lat: 12.6, lon: 117.8, wind_kt: 45, wind_kmh: 83.3, time_vn: 'T5, 02/11 07:00' },
      { tau: 12, lat: 12.7, lon: 115.4, wind_kt: 60, wind_kmh: 111.1, time_vn: 'T5, 02/11 19:00' },
      { tau: 24, lat: 12.8, lon: 113.1, wind_kt: 75, wind_kmh: 138.9, time_vn: 'T6, 03/11 07:00' },
      { tau: 36, lat: 12.7, lon: 110.9, wind_kt: 75, wind_kmh: 138.9, time_vn: 'T6, 03/11 19:00' },
      { tau: 48, lat: 12.6, lon: 109.1, wind_kt: 65, wind_kmh: 120.4, time_vn: 'T7, 04/11 07:00' },
      { tau: 60, lat: 12.5, lon: 106.7, wind_kt: 30, wind_kmh: 55.6, time_vn: 'T7, 04/11 19:00' }
    ]
  },
  {
    id: 'PRESET_HAIYAN_2013',
    name: 'HAIYAN (Siêu bão Hải Yến - 2013)',
    year: 2013,
    description: 'Một trong những siêu bão mạnh nhất lịch sử nhân loại càn quét Biển Đông',
    landfall_province: 'tỉnh Quảng Ninh',
    peak_wind_kmh: 196.4,
    peak_wind_kt: 106,
    track: [
      { tau: 0, lat: 11.2, lon: 120.5, wind_kt: 120, wind_kmh: 222.2, time_vn: 'T6, 08/11 19:00' },
      { tau: 12, lat: 13.5, lon: 116.8, wind_kt: 105, wind_kmh: 194.5, time_vn: 'T7, 09/11 07:00' },
      { tau: 24, lat: 16.2, lon: 112.5, wind_kt: 95, wind_kmh: 175.9, time_vn: 'T7, 09/11 19:00' },
      { tau: 36, lat: 19.1, lon: 108.9, wind_kt: 80, wind_kmh: 148.2, time_vn: 'CN, 10/11 07:00' },
      { tau: 48, lat: 21.2, lon: 107.6, wind_kt: 65, wind_kmh: 120.4, time_vn: 'T2, 11/11 07:00' }
    ]
  }
];

export function generatePresetGeoJson(presetId) {
  const p = HISTORICAL_PRESETS.find(item => item.id === presetId) || HISTORICAL_PRESETS[0];
  const forecastPoints = [];
  const coords = [];

  p.track.forEach(pt => {
    forecastPoints.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] },
      properties: {
        feature_type: 'forecast_point',
        feature_name_vn: pt.tau === 0 ? 'Vị trí bắt đầu' : `Mốc +${pt.tau}h`,
        storm_name: p.name,
        tau_h: pt.tau,
        time_vn: pt.time_vn,
        wind_kt: pt.wind_kt,
        wind_kmh: pt.wind_kmh,
        category: windCategory(pt.wind_kt),
        category_code: windCategoryCode(pt.wind_kt)
      }
    });
    coords.push([pt.lon, pt.lat]);
  });

  const trackLine = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {
      feature_type: 'forecast_track',
      feature_name_vn: 'Đường đi bão lịch sử',
      name: p.name
    }
  };

  return {
    type: 'FeatureCollection',
    features: [trackLine, ...forecastPoints],
    _meta: {
      source: 'Historical Preset Archive',
      storm_name: p.name,
      doc_name: p.name,
      preset_id: p.id,
      forecast_count: forecastPoints.length,
      best_track_count: 0
    }
  };
}
