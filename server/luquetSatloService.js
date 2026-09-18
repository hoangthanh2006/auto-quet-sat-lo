/**
 * luquetSatloService.js
 * Service trích xuất dữ liệu từ Hệ thống cảnh báo lũ quét và sạt lở đất (NCHMF)
 * Nguồn: https://luquetsatlo.nchmf.gov.vn/
 */

const BASE_URL = 'https://luquetsatlo.nchmf.gov.vn';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': '*/*'
};

/**
 * Chuyển đổi timestamp dạng /Date(1789704000000)/ sang object { iso, formatted }
 */
function parseNetDate(dateStr) {
  if (!dateStr) return { iso: null, formatted: '' };
  if (typeof dateStr === 'string') {
    const match = dateStr.match(/\/Date\((\d+)\)\//);
    if (match) {
      const ms = parseInt(match[1], 10);
      const d = new Date(ms);
      return {
        iso: d.toISOString(),
        formatted: formatVN(d),
        timestamp: ms
      };
    }
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return {
      iso: d.toISOString(),
      formatted: formatVN(d),
      timestamp: d.getTime()
    };
  }
  return { iso: null, formatted: String(dateStr), timestamp: null };
}

function formatVN(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

function formatHourString(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  return `${year}-${month}-${day} ${hours}:00:00`;
}

/**
 * 1. Lấy danh sách 34 tỉnh có nguy cơ lũ quét, sạt lở
 */
export async function getProvinces() {
  try {
    const res = await fetch(`${BASE_URL}/QuanTri/getDataCbbProvince`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: ''
    });
    if (!res.ok) {
      throw new Error(`Lỗi tải danh mục tỉnh: ${res.statusText}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('getProvinces error:', err);
    throw err;
  }
}

/**
 * 2. Lấy dữ liệu Cảnh báo Nguy cơ Lũ quét & Sạt lở theo Xã/Huyện/Tỉnh
 * @param {Object} options
 * @param {string} [options.date] 'YYYY-MM-DD HH:00:00'
 * @param {number} [options.sogiodubao] 1 | 3 | 6
 * @param {boolean} [options.autoFallback] Tự động lùi giờ nếu giờ hiện tại chưa có dữ liệu
 */
export async function getCanhbaoSLLQ({ date, sogiodubao = 6, autoFallback = true } = {}) {
  let targetDate = date;
  if (!targetDate) {
    targetDate = formatHourString(new Date());
  }

  const queryDate = async (dStr, gio) => {
    const params = new URLSearchParams({
      sogiodubao: String(gio),
      date: dStr
    });
    const res = await fetch(`${BASE_URL}/LayerMapBox/getDSCanhbaoSLLQ`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: params.toString()
    });
    if (!res.ok) {
      throw new Error(`NCHMF API error: ${res.status}`);
    }
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  };

  let list = await queryDate(targetDate, sogiodubao);
  let actualDate = targetDate;

  // Nếu không có dữ liệu và bật autoFallback, thử lùi từng giờ (tối đa 12 giờ)
  if ((!list || list.length === 0) && autoFallback) {
    const baseDate = new Date(targetDate.replace(' ', 'T'));
    for (let i = 1; i <= 12; i++) {
      const fallback = new Date(baseDate.getTime() - i * 60 * 60 * 1000);
      const fbStr = formatHourString(fallback);
      try {
        const fbList = await queryDate(fbStr, sogiodubao);
        if (fbList && fbList.length > 0) {
          list = fbList;
          actualDate = fbStr;
          break;
        }
      } catch {
        // tiếp tục thử giờ trước
      }
    }
  }

  // Chuẩn hóa và làm giàu dữ liệu
  const enriched = (list || []).map((item) => {
    const parsedThoigian = parseNetDate(item.thoigian);
    const parsedNgayCapNhat = parseNetDate(item.ngay_capnhat);

    return {
      id: item.id,
      commune_id: item.commune_id,
      commune_name: item.commune_name || item.commune_name_2cap || '',
      district_name: item.district_name || '',
      province_name: item.provinceName || item.provinceName_2cap || '',
      province_ref: item.province_ref,
      nguyco_satlo: item.nguycosatlo || 'Không xác định',
      nguyco_luquet: item.nguycoluquet || 'Không xác định',
      luongmua_thucdo: typeof item.luongmuatd === 'number' ? Math.round(item.luongmuatd * 10) / 10 : 0,
      luongmua_dubao: typeof item.luongmuadb === 'number' ? Math.round(item.luongmuadb * 10) / 10 : 0,
      luongmua_tong: typeof item.luongmuatd_db === 'number' ? Math.round(item.luongmuatd_db * 10) / 10 : 0,
      lat: item.lat,
      lon: item.lon,
      nguon_dubao: item.nguonmuadubao || 'AMO',
      sogio_dubao: item.sogiodubao || sogiodubao,
      thoigian_str: parsedThoigian.formatted,
      thoigian_iso: parsedThoigian.iso,
      ngay_capnhat_str: parsedNgayCapNhat.formatted,
      nguoi_capnhat: item.nguoi_capnhat || ''
    };
  });

  return {
    success: true,
    data: enriched,
    count: enriched.length,
    requestedDate: date || targetDate,
    actualDate: actualDate,
    sogiodubao: Number(sogiodubao)
  };
}

/**
 * 3. Lấy danh sách 1.053 điểm sạt lở, trượt lở đất điều tra thực địa lịch sử
 */
export async function getDiemSatLo({ provinceId = null } = {}) {
  try {
    const params = new URLSearchParams();
    if (provinceId) {
      params.append('provinceId', String(provinceId));
    }

    const res = await fetch(`${BASE_URL}/QuanTri/getDataDsDiemSLLQ`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: params.toString()
    });

    if (!res.ok) {
      throw new Error(`NCHMF API error: ${res.status}`);
    }

    const rawList = await res.json();
    if (!Array.isArray(rawList)) return { success: true, data: [], count: 0 };

    const formatted = rawList.map((item) => ({
      gid: item.gid,
      fid: item.fid_,
      tt: item.tt,
      tinh: item.tinh || '',
      huyen: item.huyen || '',
      xa: item.xa || '',
      thon: item.thon || '',
      x_lon: item.x,
      y_lat: item.y,
      ngay_bat_dau: item.ngay_bat_d || '',
      ngay_ket_thuc: item.ngay_ket_t || '',
      nguyen_nhan: item.nguyen_nha || '',
      thiet_hai: item.thiet_hai || '',
      song_suoi: item.song__suoi || ''
    }));

    return {
      success: true,
      data: formatted,
      count: formatted.length
    };
  } catch (err) {
    console.error('getDiemSatLo error:', err);
    throw err;
  }
}

/**
 * 4. Lấy dữ liệu 8.400+ trạm đo mưa tự động toàn quốc
 */
export async function getTramMua({ thoigian } = {}) {
  let targetTime = thoigian;
  if (!targetTime) {
    targetTime = formatHourString(new Date());
  }

  const params = new URLSearchParams({ thoigian: targetTime });
  const res = await fetch(`${BASE_URL}/LayerMapBox/InitVectorMua`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: params.toString()
  });

  if (!res.ok) {
    throw new Error(`NCHMF API error: ${res.status}`);
  }

  const list = await res.json();
  if (!Array.isArray(list) || list.length === 0 || !list[0].data) {
    return { success: true, data: [], count: 0, geojson: null };
  }

  // Khắc phục mã hóa XML entity &#x0D; từ GeoJSON response
  const cleanedStr = list[0].data.replace(/&#x0D;/g, '').replace(/\r/g, '');
  const geojson = JSON.parse(cleanedStr);

  const stations = (geojson.features || []).map((f) => {
    const p = f.properties || {};
    const coords = f.geometry?.coordinates || [null, null];
    return {
      station_id: p.station_id,
      station_no: p.station_no,
      ten: p.ten,
      tinh_id: p.tinh_id,
      luongmua_1h: typeof p.luongmua1h === 'number' ? p.luongmua1h : 0,
      luongmua_3h: typeof p.luongmua3h === 'number' ? p.luongmua3h : 0,
      luongmua_6h: typeof p.luongmua6h === 'number' ? p.luongmua6h : 0,
      luongmua_12h: typeof p.luongmua12h === 'number' ? p.luongmua12h : 0,
      lon: coords[0],
      lat: coords[1]
    };
  });

  return {
    success: true,
    data: stations,
    count: stations.length,
    thoigian: targetTime
  };
}

/**
 * 5. Lấy dữ liệu cảnh báo độ ẩm đất theo ngày
 */
export async function getDoAmDat({ thoigian, typeHienThi = 'theotinh', typeCanhBao = 'r0d' } = {}) {
  const d = thoigian ? new Date(thoigian) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 23:59:59`;
  const tableName = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

  const params = new URLSearchParams({
    thoigian: dateStr,
    tableName: tableName,
    _TypeHienThi: typeHienThi,
    _TypeCanhBao: typeCanhBao
  });

  const res = await fetch(`${BASE_URL}/ThongTinTongHop/getDetailDoAmDatCB`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: params.toString()
  });

  if (!res.ok) {
    throw new Error(`NCHMF API error: ${res.status}`);
  }

  const rawList = await res.json();
  if (!Array.isArray(rawList)) return { success: true, data: [], count: 0 };

  const formatted = rawList.map((item) => ({
    loai: item.loai,
    province_name: item.provinceName || '',
    district_name: item.district_name || '',
    commune_name: item.commune_name || '',
    do_am: typeof item.doAm === 'number' ? Math.round(item.doAm * 100) : item.doAm,
    gio_capnhat: item.giocapnhat || '',
    ngay_capnhat: item.ngaycapnhat || ''
  }));

  return {
    success: true,
    data: formatted,
    count: formatted.length,
    date: dateStr
  };
}

// In-memory cache to prevent downloading 10MB on every request
const LAYER_CACHE = {
  satlo: { data: null, time: 0 },
  luquet: { data: null, time: 0 },
  trongdiem: { data: null, time: 0 }
};
const CACHE_TTL = 3600 * 1000; // 1 hour

/**
 * 6. Lấy 12.506 Điểm ĐÃ XẢY RA SẠT LỞ (ht_satlo_point)
 */
export async function getDiemDaXayRaSatLo({ provinceName = '' } = {}) {
  const now = Date.now();
  let features = [];

  if (LAYER_CACHE.satlo.data && (now - LAYER_CACHE.satlo.time < CACHE_TTL)) {
    features = LAYER_CACHE.satlo.data;
  } else {
    const params = new URLSearchParams({
      layerid: 'ht_satlo_point',
      sqlchecktinh: '',
      sqlcheckdaikv: ''
    });

    const res = await fetch(`${BASE_URL}/LayerMapBox/InitLayerVectortitle`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: params.toString()
    });

    if (!res.ok) {
      throw new Error(`NCHMF API error: ${res.status}`);
    }

    let raw = await res.json();
    if (typeof raw === 'string') raw = JSON.parse(raw);
    features = (raw && raw.features) ? raw.features : [];
    LAYER_CACHE.satlo.data = features;
    LAYER_CACHE.satlo.time = now;
  }

  // Format records
  let list = features.map((f) => {
    const p = f.properties || {};
    const coords = f.geometry?.coordinates || [p.x, p.y];
    return {
      gid: p.gid || p.objectid_1,
      site_id: p.site_id || '',
      tinh: p.tinh || '',
      huyen: p.huyen || '',
      xa: p.xa || '',
      thon: p.thon || '',
      lon: coords[0] || p.x,
      lat: coords[1] || p.y,
      ngay_bat_dau: p.ngaybatdau || '',
      ngay_ket_thuc: p.ngayketthuc || '',
      nguyen_nhan: p.nguyennhan || '',
      thiet_hai: p.thiethai || '',
      sohieu_dks: p.sohieu_dks || ''
    };
  });

  if (provinceName && provinceName.trim()) {
    const q = provinceName.trim().toLowerCase();
    list = list.filter((it) => it.tinh?.toLowerCase().includes(q));
  }

  return {
    success: true,
    data: list,
    count: list.length,
    totalOriginal: features.length
  };
}

/**
 * 7. Lấy 1.048 Điểm ĐÃ XẢY RA LŨ QUÉT (ht_luquet_point)
 */
export async function getDiemDaXayRaLuQuet({ provinceName = '' } = {}) {
  const now = Date.now();
  let features = [];

  if (LAYER_CACHE.luquet.data && (now - LAYER_CACHE.luquet.time < CACHE_TTL)) {
    features = LAYER_CACHE.luquet.data;
  } else {
    const params = new URLSearchParams({
      layerid: 'ht_luquet_point',
      sqlchecktinh: '',
      sqlcheckdaikv: ''
    });

    const res = await fetch(`${BASE_URL}/LayerMapBox/InitLayerVectortitle`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: params.toString()
    });

    if (!res.ok) {
      throw new Error(`NCHMF API error: ${res.status}`);
    }

    let raw = await res.json();
    if (typeof raw === 'string') raw = JSON.parse(raw);
    features = (raw && raw.features) ? raw.features : [];
    LAYER_CACHE.luquet.data = features;
    LAYER_CACHE.luquet.time = now;
  }

  let list = features.map((f) => {
    const p = f.properties || {};
    const coords = f.geometry?.coordinates || [p.x, p.y];
    return {
      gid: p.gid || p.fid_,
      tinh: p.tinh || '',
      huyen: p.huyen || '',
      xa: p.xa || '',
      thon: p.thon || '',
      lon: coords[0] || p.x,
      lat: coords[1] || p.y,
      ngay_bat_dau: p.ngay_bat_d || p.ngaybatdau || '',
      ngay_ket_thuc: p.ngay_ket_t || p.ngayketthuc || '',
      nguyen_nhan: p.nguyen_nha || p.nguyennhan || '',
      thiet_hai: p.thiet_hai || p.thiethai || '',
      song_suoi: p.song__suoi || ''
    };
  });

  if (provinceName && provinceName.trim()) {
    const q = provinceName.trim().toLowerCase();
    list = list.filter((it) => it.tinh?.toLowerCase().includes(q));
  }

  return {
    success: true,
    data: list,
    count: list.length,
    totalOriginal: features.length
  };
}

/**
 * 8. Lấy 776 TRỌNG ĐIỂM SẠT LỞ LŨ QUÉT (tbl_diemnguyco)
 */
export async function getTrongDiemSLLQ({ provinceName = '' } = {}) {
  const now = Date.now();
  let features = [];

  if (LAYER_CACHE.trongdiem.data && (now - LAYER_CACHE.trongdiem.time < CACHE_TTL)) {
    features = LAYER_CACHE.trongdiem.data;
  } else {
    // Generate IDs 0..10000 to cover all communes
    const dataxa = '0, ' + Array.from({ length: 10000 }, (_, i) => i + 1).join(', ');
    const params = new URLSearchParams({
      layerid: 'tbl_diemnguyco',
      sqlchecktinh: '',
      sqlcheckdaikv: '',
      xaid: dataxa
    });

    const res = await fetch(`${BASE_URL}/LayerMapBox/InitTrongDiemTheoSLLQ`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: params.toString()
    });

    if (!res.ok) {
      throw new Error(`NCHMF API error: ${res.status}`);
    }

    let raw = await res.json();
    if (typeof raw === 'string') raw = JSON.parse(raw);
    features = (raw && raw.features) ? raw.features : [];
    LAYER_CACHE.trongdiem.data = features;
    LAYER_CACHE.trongdiem.time = now;
  }

  let list = features.map((f) => {
    const p = f.properties || {};
    const coords = f.geometry?.coordinates || [p.kinhdo, p.vido];
    return {
      id: p.id,
      ten: p.ten || '',
      diadiem: p.diadiem || '',
      ten_tinh: p.ten_tinh || '',
      ten_xa: p.ten_xa || '',
      lon: coords[0] || p.kinhdo,
      lat: coords[1] || p.vido,
      soho_satlodat: p.soho_satlodat || 0,
      soho_luquet: p.soho_luquet || 0,
      soho_ngapung: p.soho_ngapung || 0,
      soho_nguyco_ratcao: p.soho_nguyco_ratcao || 0,
      soho_nguyco_cao: p.soho_nguyco_cao || 0,
      soho_nguyco_trungbinh: p.soho_nguyco_trungbinh || 0,
      ghichu: p.ghichu || ''
    };
  });

  if (provinceName && provinceName.trim()) {
    const q = provinceName.trim().toLowerCase();
    list = list.filter((it) => it.ten_tinh?.toLowerCase().includes(q));
  }

  return {
    success: true,
    data: list,
    count: list.length,
    totalOriginal: features.length
  };
}

/**
 * 9. Dữ liệu Radar thời tiết (URLs, Bounding Coordinates, Khung giờ gần nhất)
 */
export async function getRadarData({ date = null } = {}) {
  const targetDate = date ? new Date(date) : new Date();
  const pad = (n) => String(n).padStart(2, '0');

  // Radar images are published in UTC time
  // Generate 12 past 10-minute frames
  const frames = [];
  const baseUtc = new Date(targetDate.getTime());

  for (let i = 0; i < 12; i++) {
    const frameTime = new Date(baseUtc.getTime() - i * 10 * 60 * 1000);
    // Round down to nearest 10 mins
    const m10 = Math.floor(frameTime.getUTCMinutes() / 10) * 10;
    frameTime.setUTCMinutes(m10, 0, 0);

    const year = frameTime.getUTCFullYear();
    const month = pad(frameTime.getUTCMonth() + 1);
    const day = pad(frameTime.getUTCDate());
    const hours = pad(frameTime.getUTCHours());
    const mins = pad(frameTime.getUTCMinutes());

    const datengay = `${year}${month}${day}`;
    const dategio = `${year}${month}${day}${hours}${mins}`;

    // VN time representation
    const vnTime = new Date(frameTime.getTime() + 7 * 60 * 60 * 1000);
    const vnLabel = `${pad(vnTime.getHours())}:${pad(vnTime.getMinutes())} (${pad(vnTime.getDate())}/${pad(vnTime.getMonth() + 1)})`;

    const imageUrl = `https://vndms.dmc.gov.vn/dataout_web/COM/${datengay}/COM_${dategio}_CMAX00.png`;

    frames.push({
      time_utc: frameTime.toISOString(),
      time_vn: vnLabel,
      image_url: imageUrl,
      timestamp: frameTime.getTime()
    });
  }

  return {
    success: true,
    data: {
      type: 'radar_composite',
      name: 'Dữ liệu radar phản hồi vô tuyến (CMAX)',
      provider: 'Tổng cục Khí tượng Thủy văn / VNDMS',
      bounds: {
        north: 25.2,
        south: 7.2,
        west: 97.0,
        east: 115.0
      },
      coordinates: [
        [97.0, 25.2],
        [115.0, 25.2],
        [115.0, 7.2],
        [97.0, 7.2]
      ],
      currentFrame: frames[0],
      timeline: frames
    }
  };
}
