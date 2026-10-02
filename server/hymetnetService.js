/**
 * Hymetnet Crawler Service (http://hymetnet.gov.vn/)
 * Cào và chuẩn hóa dữ liệu khí tượng thủy văn từ Trung tâm Kỹ thuật Quan trắc KTTV:
 * 1. Cảnh báo dông sét (/dongset) - Chi tiết theo xã/phường, quận/huyện, tỉnh, tọa độ
 * 2. Số liệu sét quan trắc (/lightningmaps/ và /) - Các điểm sét đánh CC (mây), CG (đất), biên độ, tần suất
 * 3. Mưa và cảnh báo mưa (/rain/) - Điểm mưa lớn, mốc thời gian, ảnh radar mưa QPE
 * 4. Radar và Vệ tinh (/radar/, /satellite/) - Ảnh composite CMAX, ảnh mây vệ tinh hồng ngoại (IR), khả kiến (VSB)
 * 5. Danh mục 10 trạm Radar quan trắc toàn quốc
 */

const HYMETNET_BASE = 'http://hymetnet.gov.vn';

// Danh sách 10 trạm radar KTTV chuẩn của Hymetnet
export const HYMETNET_RADAR_STATIONS = [
  { id: 'PL', name: 'Phù Liễn', province: 'Hải Phòng', lat: 20.809, lng: 106.64, region: 'Bắc Bộ' },
  { id: 'PD', name: 'Pha Đin', province: 'Điện Biên', lat: 21.57139, lng: 103.51694, region: 'Tây Bắc Bộ' },
  { id: 'VT', name: 'Việt Trì', province: 'Phú Thọ', lat: 21.41944, lng: 105.30472, region: 'Bắc Bộ' },
  { id: 'VI', name: 'Vinh', province: 'Nghệ An', lat: 18.656, lng: 105.71083, region: 'Bắc Trung Bộ' },
  { id: 'DH', name: 'Đông Hà', province: 'Quảng Trị', lat: 16.804722, lng: 107.09194, region: 'Bắc Trung Bộ' },
  { id: 'TK', name: 'Tam Kỳ', province: 'Quảng Nam', lat: 15.56752, lng: 108.4624, region: 'Trung Trung Bộ' },
  { id: 'PK', name: 'PleiKu', province: 'Gia Lai', lat: 14.03465, lng: 107.98406, region: 'Tây Nguyên' },
  { id: 'QN', name: 'Quy Nhơn', province: 'Bình Định', lat: 13.74859, lng: 109.19213, region: 'Nam Trung Bộ' },
  { id: 'NT', name: 'Nha Trang', province: 'Khánh Hòa', lat: 12.21152, lng: 109.28056, region: 'Nam Trung Bộ' },
  { id: 'NB', name: 'Nhà Bè', province: 'TP. Hồ Chí Minh', lat: 10.65961, lng: 106.72833, region: 'Nam Bộ' }
];

/**
 * Helper fetch có timeout và User-Agent
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,application/json,*/*;q=0.8',
    'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
    'Referer': `${HYMETNET_BASE}/`
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...defaultHeaders, ...(options.headers || {}) },
      signal: controller.signal
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * 1. Cào Cảnh Báo Dông Sét (/dongset)
 * Endpoint trả về JSON dự báo cảnh báo dông theo bước thời gian (+10m, +20m, ... +60m)
 */
export async function fetchDongSet() {
  const startTime = Date.now();
  const url = `${HYMETNET_BASE}/dongset`;

  try {
    const res = await fetchWithTimeout(url, {}, 12000);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const rawData = await res.json();
    if (!rawData || typeof rawData !== 'object') {
      return { success: false, error: 'Dữ liệu dông sét không hợp lệ', data: null };
    }

    const timeKeys = Object.keys(rawData).sort();
    const formattedSteps = [];
    const allCommunes = [];
    const provincesMap = {};

    let stepIndex = 1;
    for (const timeKey of timeKeys) {
      const rawList = Array.isArray(rawData[timeKey]) ? rawData[timeKey] : [];
      const forecastMinutes = stepIndex * 10;
      stepIndex++;

      // Định dạng mốc thời gian hiển thị
      let displayTime = timeKey;
      if (timeKey.length >= 12) {
        const y = timeKey.substring(0, 4);
        const m = timeKey.substring(4, 6);
        const d = timeKey.substring(6, 8);
        const h = timeKey.substring(8, 10);
        const mi = timeKey.substring(10, 12);
        displayTime = `${h}:${mi} ${d}/${m}/${y}`;
      }

      const parsedItems = [];
      for (const rawItem of rawList) {
        if (typeof rawItem !== 'string') continue;
        const parts = rawItem.split(',').map(s => s.trim());
        const commune = parts[0] || '';
        const province = parts[1] || '';
        const coordRaw = parts[2] || '';

        // Tách tọa độ ví dụ: "20.79777717590332-104.63112640380861" hoặc "10.0105-106.213"
        let lat = null;
        let lng = null;
        const coordMatch = coordRaw.match(/([0-9.]+)[-\s,]+([0-9.]+)/);
        if (coordMatch) {
          lat = parseFloat(coordMatch[1]);
          lng = parseFloat(coordMatch[2]);
        }

        const item = {
          commune,
          province,
          lat,
          lng,
          rawCoord: coordRaw,
          forecastMinutes,
          timeSlot: timeKey,
          displayTime
        };

        parsedItems.push(item);
        allCommunes.push(item);

        // Thống kê theo tỉnh
        if (province) {
          if (!provincesMap[province]) {
            provincesMap[province] = { province, count: 0, communes: new Set() };
          }
          provincesMap[province].count++;
          if (commune) provincesMap[province].communes.add(commune);
        }
      }

      formattedSteps.push({
        timeKey,
        displayTime,
        forecastMinutes,
        count: parsedItems.length,
        items: parsedItems
      });
    }

    const provincesSummary = Object.values(provincesMap).map(p => ({
      province: p.province,
      communeCount: p.communes.size,
      totalAlerts: p.count,
      sampleCommunes: Array.from(p.communes).slice(0, 5)
    })).sort((a, b) => b.communeCount - a.communeCount);

    return {
      success: true,
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
      totalSteps: formattedSteps.length,
      totalAlerts: allCommunes.length,
      summary: {
        totalSteps: formattedSteps.length,
        totalAlerts: allCommunes.length,
        totalProvinces: provincesSummary.length,
        topProvinces: provincesSummary.slice(0, 10),
        latestTimeKey: timeKeys[0] || null,
        furthestTimeKey: timeKeys[timeKeys.length - 1] || null
      },
      steps: formattedSteps,
      provinces: provincesSummary
    };
  } catch (err) {
    console.error('[Hymetnet] fetchDongSet Error:', err.message);
    return {
      success: false,
      sourceUrl: url,
      error: err.message,
      executionTimeMs: Date.now() - startTime,
      data: null
    };
  }
}

/**
 * 2. Cào Số Liệu Sét Quan Trắc (/lightningmaps/ & /)
 * Trích xuất mảng sét `set[...]` chứa danh sách chi tiết các cú sét đánh (CG, CC, lat, lng, biên độ)
 */
export async function fetchLightningData() {
  const startTime = Date.now();
  const url = `${HYMETNET_BASE}/lightningmaps/`;

  try {
    let res = await fetchWithTimeout(url, {}, 15000);
    if (!res.ok) {
      // Fallback về trang chủ nếu trang lightningmaps bận
      res = await fetchWithTimeout(`${HYMETNET_BASE}/`, {}, 15000);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const html = await res.text();

    // Trích xuất các mảng sét: set[0] = [...], set[1] = [...]
    const setRegex = /set\[(\d+)\]\s*=\s*(\[[^;]*?\]);/gs;
    const matches = [...html.matchAll(setRegex)];

    const frames = [];
    let totalCG = 0; // Sét đất (Cloud to Ground)
    let totalCC = 0; // Sét trong mây (Intra-cloud)
    let maxAmplitude = 0;
    const allStrikes = [];

    for (const match of matches) {
      const frameIndex = parseInt(match[1], 10);
      const rawArrayStr = match[2];

      try {
        // Chuẩn hóa JSON:
        // 1. Thêm nháy kép cho các thuộc tính unquoted (nam, thang, ngay, gio, phut, lat, lng,...)
        // 2. Xóa số 0 đứng trước số nguyên (02 -> 2, 05 -> 5) tránh lỗi cú pháp JSON
        // 3. Xóa dấu phẩy thừa trước dấu đóng ngoặc
        const cleanedStr = rawArrayStr
          .replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":')
          .replace(/:\s*0+([1-9]\d*)/g, ': $1')
          .replace(/:\s*00+/g, ': 0')
          .replace(/,\s*([}\]])/g, '$1');

        const rawStrikes = JSON.parse(cleanedStr);

        const parsedStrikes = [];
        for (const s of rawStrikes) {
          if (!s || typeof s !== 'object') continue;

          const isCG = s.loaiset === 0;
          const isCC = s.loaiset === 1;

          if (isCG) totalCG++;
          else totalCC++;

          const amp = Math.abs(s.giatri || 0);
          if (amp > maxAmplitude) maxAmplitude = amp;

          const y = s.nam || 2026;
          const m = String(s.thang || 1).padStart(2, '0');
          const d = String(s.ngay || 1).padStart(2, '0');
          const h = String(s.gio || 0).padStart(2, '0');
          const mi = String(s.phut || 0).padStart(2, '0');
          const sec = String(s.giay || 0).padStart(2, '0');

          parsedStrikes.push({
            time: `${y}-${m}-${d} ${h}:${mi}:${sec}`,
            timestamp: `${y}${m}${d}${h}${mi}${sec}`,
            lat: parseFloat(s.lat) || 0,
            lng: parseFloat(s.lng) || 0,
            type: isCG ? 'CG' : 'CC',
            typeLabel: isCG ? 'Sét mây - đất (CG)' : 'Sét trong mây (CC)',
            loaiset: s.loaiset,
            amplitudeKa: s.giatri !== undefined ? s.giatri : null,
            sensorCount: s.sensor || null,
            dof: s.dof || null,
            style: s.style || 10
          });
        }

        frames.push({
          frameIndex,
          count: parsedStrikes.length,
          strikes: parsedStrikes
        });

        allStrikes.push(...parsedStrikes);
      } catch (err) {
        // bỏ qua frame lỗi cú pháp
      }
    }

    // Trích xuất các nhãn thời gian từ select menu nếu có
    const timeVnMatches = [...html.matchAll(/tentimesettvn\[(\d+)\]\s*=\s*["']([^"']+)["']/g)];
    const timeLabels = timeVnMatches.map(m => m[2]);

    return {
      success: true,
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
      summary: {
        totalStrikes: allStrikes.length,
        totalCG, // Sét đất nguy hiểm
        totalCC, // Sét trong mây
        maxAmplitudeKa: maxAmplitude,
        totalFrames: frames.length,
        ratioCGtoCC: totalCC > 0 ? Math.round((totalCG / totalCC) * 100) / 100 : 0
      },
      timeLabels,
      frames,
      latestStrikes: allStrikes.slice(0, 1000) // 1000 cú sét gần nhất
    };
  } catch (err) {
    console.error('[Hymetnet] fetchLightningData Error:', err.message);
    return {
      success: false,
      sourceUrl: url,
      error: err.message,
      executionTimeMs: Date.now() - startTime,
      data: null
    };
  }
}

/**
 * 3. Cào Dữ Liệu Mưa & Cảnh Báo Mưa (/rain/)
 * Trích xuất:
 * - Điểm mưa lớn trọng điểm (mảng `storm` các huyện/tỉnh có mưa lớn)
 * - Mốc thời gian `tentimesett`
 * - Ảnh Radar mưa tích lũy QPE (/dataout_web/COM/{date}/COM_{time}_QPEJPA.png)
 */
export async function fetchRainData() {
  const startTime = Date.now();
  const url = `${HYMETNET_BASE}/rain/`;

  try {
    const res = await fetchWithTimeout(url, {}, 15000);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const html = await res.text();

    // 1. Trích xuất mốc thời gian tentimesett và tentimesettvn
    const timeMatches = [...html.matchAll(/tentimesett\[(\d+)\]\s*=\s*["']([^"']+)["']/g)];
    const timeVnMatches = [...html.matchAll(/tentimesettvn\[(\d+)\]\s*=\s*["']([^"']+)["']/g)];

    const timeMap = {};
    timeMatches.forEach(m => { timeMap[m[1]] = { timeKey: m[2] }; });
    timeVnMatches.forEach(m => {
      if (timeMap[m[1]]) timeMap[m[1]].timeVn = m[2];
    });

    const timeSlots = Object.values(timeMap);

    // 2. Trích xuất mảng storm (các điểm mưa lớn từng khung giờ)
    const stormRegex = /var\s+(?:aa\d*)\s*=\s*["'](\[.*?\])["']/gs;
    const stormMatches = [...html.matchAll(stormRegex)];

    const stormFrames = [];
    const provinceRainMap = {};

    let frameIdx = 0;
    for (const match of stormMatches) {
      try {
        const decoded = match[1].replace(/&quot;/g, '"');
        const rawPoints = JSON.parse(decoded);

        const normalizedPoints = [];
        for (const pt of rawPoints) {
          const rawLat = parseFloat(pt.lat) || 0;
          const rawLng = parseFloat(pt.lng) || 0;

          // LƯU Ý KỸ THUẬT: Trong mã nguồn của Hymetnet, biến pt.lat là Kinh độ (~105),
          // còn pt.lng là Vĩ độ (~21). Ta hoán đổi và chuẩn hóa để dùng cho mọi bản đồ GIS!
          let latitude = rawLat;
          let longitude = rawLng;
          if (rawLat > 50 && rawLng < 50) {
            latitude = rawLng;
            longitude = rawLat;
          }

          const point = {
            rank: pt.toprain !== undefined ? parseInt(pt.toprain, 10) : 0,
            district: pt.huyen || '',
            province: pt.tinh || '',
            latitude,
            longitude,
            rawLat,
            rawLng
          };

          normalizedPoints.push(point);

          if (point.province) {
            provinceRainMap[point.province] = (provinceRainMap[point.province] || 0) + 1;
          }
        }

        const slot = timeSlots[frameIdx] || null;
        stormFrames.push({
          frameIndex: frameIdx,
          timeKey: slot?.timeKey || null,
          timeVn: slot?.timeVn || null,
          count: normalizedPoints.length,
          points: normalizedPoints
        });

        frameIdx++;
      } catch (err) {
        // bỏ qua frame lỗi cú pháp
      }
    }

    // 3. Tạo danh sách URL ảnh radar mưa QPE
    const radarRainImages = timeSlots.map(slot => {
      const tk = slot.timeKey;
      if (!tk || tk.length < 8) return null;
      const datePart = tk.substring(0, 8);
      return {
        timeKey: tk,
        timeVn: slot.timeVn,
        imageUrl: `${HYMETNET_BASE}/dataout_web/COM/${datePart}/COM_${tk}_QPEJPA.png`,
        relativeUrl: `/dataout_web/COM/${datePart}/COM_${tk}_QPEJPA.png`
      };
    }).filter(Boolean);

    const topRainProvinces = Object.entries(provinceRainMap)
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => b.count - a.count);

    return {
      success: true,
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
      summary: {
        totalFrames: stormFrames.length,
        totalHeavyRainPoints: stormFrames.reduce((sum, f) => sum + f.count, 0),
        topProvinces: topRainProvinces.slice(0, 10),
        latestTimeKey: timeSlots[0]?.timeKey || null,
        latestTimeVn: timeSlots[0]?.timeVn || null
      },
      timeSlots,
      stormFrames,
      radarRainImages
    };
  } catch (err) {
    console.error('[Hymetnet] fetchRainData Error:', err.message);
    return {
      success: false,
      sourceUrl: url,
      error: err.message,
      executionTimeMs: Date.now() - startTime,
      data: null
    };
  }
}

/**
 * 4. Cào Dữ Liệu Radar & Mây Vệ Tinh (/radar/, /satellite/)
 * Trích xuất:
 * - Chuỗi ảnh Radar Composite CMAX (toàn quốc)
 * - Chuỗi ảnh Mây vệ tinh hồng ngoại (IR) và khả kiến (VSB)
 * - Tọa độ 10 trạm radar KTTV
 */
export async function fetchRadarAndSatelliteData() {
  const startTime = Date.now();
  const url = `${HYMETNET_BASE}/radar/`;

  try {
    const res = await fetchWithTimeout(url, {}, 15000);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const html = await res.text();

    const timeMatches = [...html.matchAll(/tentimesett\[(\d+)\]\s*=\s*["']([^"']+)["']/g)];
    const timeVnMatches = [...html.matchAll(/tentimesettvn\[(\d+)\]\s*=\s*["']([^"']+)["']/g)];

    const frames = [];
    const radarTimeline = [];
    const satelliteTimeline = [];

    for (let i = 0; i < timeMatches.length; i++) {
      const timeKey = timeMatches[i][2];
      const timeVn = timeVnMatches[i]?.[2] || '';
      if (!timeKey || timeKey.length < 8) continue;

      const datePart = timeKey.substring(0, 8);

      const radarCmaxUrl = `${HYMETNET_BASE}/dataout_web/COM/${datePart}/COM_${timeKey}_CMAX00.png`;
      const satIrUrl = `${HYMETNET_BASE}/dataout_web/VTI/${datePart}/IRB_${timeKey}.jpg`;
      const satVsbUrl = `${HYMETNET_BASE}/dataout_web/VTI/${datePart}/VSB_${timeKey}.jpg`;

      const frameObj = {
        index: i,
        timeKey,
        timeVn,
        radarCmaxUrl,
        satelliteIrUrl: satIrUrl,
        satelliteVisibleUrl: satVsbUrl
      };

      frames.push(frameObj);
      radarTimeline.push({ timeKey, timeVn, imageUrl: radarCmaxUrl });
      satelliteTimeline.push({ timeKey, timeVn, irUrl: satIrUrl, visibleUrl: satVsbUrl });
    }

    return {
      success: true,
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
      stations: HYMETNET_RADAR_STATIONS,
      totalStations: HYMETNET_RADAR_STATIONS.length,
      bounds: {
        // Tọa độ chuẩn bao phủ radar Việt Nam và Biển Đông theo Leaflet Hymetnet
        north: 24.5,
        south: 6.5,
        west: 99.0,
        east: 114.0
      },
      latestFrame: frames[0] || null,
      timeline: frames,
      radarTimeline,
      satelliteTimeline
    };
  } catch (err) {
    console.error('[Hymetnet] fetchRadarAndSatelliteData Error:', err.message);
    return {
      success: false,
      sourceUrl: url,
      error: err.message,
      executionTimeMs: Date.now() - startTime,
      data: null
    };
  }
}

/**
 * 5. Bộ quét toàn diện Hymetnet (Unified Crawler Orchestrator)
 * Cào đồng thời tất cả các lớp: Dông sét, Sét quan trắc, Mưa lớn, Radar & Vệ tinh
 */
export async function crawlHymetnetData() {
  const crawlStartTime = Date.now();
  const now = new Date();

  // Chuyển sang mốc giờ Việt Nam (UTC+7)
  const vnTimeMs = now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60 * 1000;
  const vnDate = new Date(vnTimeMs);

  const pad = (n) => String(n).padStart(2, '0');
  const year = vnDate.getFullYear();
  const month = pad(vnDate.getMonth() + 1);
  const day = pad(vnDate.getDate());
  const hour = pad(vnDate.getHours());
  const minute = pad(vnDate.getMinutes());

  const snapshotId = `${year}${month}${day}_${hour}00`;
  const exactTimeId = `${year}${month}${day}_${hour}${minute}`;
  const displayTime = `${hour}:${minute} ${day}/${month}/${year}`;

  console.log(`[Hymetnet Crawler] 🛰️ Bắt đầu cào toàn bộ dữ liệu từ http://hymetnet.gov.vn/ [${displayTime}]...`);

  const [dongSetRes, lightningRes, rainRes, radarRes] = await Promise.allSettled([
    fetchDongSet(),
    fetchLightningData(),
    fetchRainData(),
    fetchRadarAndSatelliteData()
  ]);

  const dongSet = dongSetRes.status === 'fulfilled' && dongSetRes.value?.success ? dongSetRes.value : null;
  const lightning = lightningRes.status === 'fulfilled' && lightningRes.value?.success ? lightningRes.value : null;
  const rain = rainRes.status === 'fulfilled' && rainRes.value?.success ? rainRes.value : null;
  const radar = radarRes.status === 'fulfilled' && radarRes.value?.success ? radarRes.value : null;

  const totalAlerts = dongSet?.totalAlerts || 0;
  const totalStrikes = lightning?.summary?.totalStrikes || 0;
  const heavyRainPoints = rain?.summary?.totalHeavyRainPoints || 0;
  const radarFramesCount = radar?.timeline?.length || 0;

  console.log(`[Hymetnet Crawler] ✅ Kết quả cào:`);
  console.log(`  • Cảnh báo dông sét: ${totalAlerts} xã/phường`);
  console.log(`  • Sét quan trắc: ${totalStrikes} cú sét (CG: ${lightning?.summary?.totalCG || 0}, CC: ${lightning?.summary?.totalCC || 0})`);
  console.log(`  • Điểm mưa lớn: ${heavyRainPoints} điểm`);
  console.log(`  • Radar & Vệ tinh: ${radarFramesCount} khung ảnh`);

  const payload = {
    source: 'http://hymetnet.gov.vn/',
    sourceName: 'Trung tâm Kỹ thuật Quan trắc Khí tượng Thủy văn (HYMETNET)',
    crawledAt: now.toISOString(),
    vnTime: displayTime,
    snapshotId,
    exactTimeId,
    date: `${year}-${month}-${day}`,
    hour: `${hour}:00`,
    executionTimeMs: Date.now() - crawlStartTime,
    summary: {
      totalAlertCommunes: totalAlerts,
      totalLightningStrikes: totalStrikes,
      totalLightningCG: lightning?.summary?.totalCG || 0,
      totalLightningCC: lightning?.summary?.totalCC || 0,
      maxLightningAmpKa: lightning?.summary?.maxAmplitudeKa || 0,
      heavyRainPointsCount: heavyRainPoints,
      radarFramesCount,
      topDongSetProvinces: dongSet?.summary?.topProvinces?.slice(0, 5) || [],
      topRainProvinces: rain?.summary?.topProvinces?.slice(0, 5) || []
    },
    counts: {
      dong_set: totalAlerts,
      lightning_strikes: totalStrikes,
      heavy_rain_points: heavyRainPoints,
      radar_frames: radarFramesCount,
      radar_stations: HYMETNET_RADAR_STATIONS.length
    },
    layers: {
      dong_set: dongSet,
      lightning,
      rain,
      radar
    }
  };

  return {
    success: true,
    data: payload
  };
}
