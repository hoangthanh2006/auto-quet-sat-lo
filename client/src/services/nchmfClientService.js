// Direct Client-Side Service for NCHMF (luquetsatlo.nchmf.gov.vn)
// NCHMF API supports Access-Control-Allow-Origin: * allowing direct browser fetch
// Used as automatic fallback when deployed on static Firebase Hosting without backend

const BASE_URL = 'https://luquetsatlo.nchmf.gov.vn';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'Accept': '*/*'
};

// In-memory cache in client session
const CLIENT_CACHE = {
  satlo: { data: null, time: 0 },
  luquet: { data: null, time: 0 },
  trongdiem: { data: null, time: 0 },
  provinces: { data: null, time: 0 }
};
const CACHE_TTL = 3600000; // 1 hour

function parseNetDate(netDateStr) {
  if (!netDateStr) return null;
  const match = netDateStr.match(/\/Date\((-?\d+)\)\//);
  if (match) {
    return new Date(parseInt(match[1], 10));
  }
  const parsed = new Date(netDateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDisplayDate(d) {
  if (!d || isNaN(d.getTime())) return '';
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
 * 1. Lấy danh sách tỉnh thành
 */
export async function fetchDirectProvinces() {
  const now = Date.now();
  if (CLIENT_CACHE.provinces.data && (now - CLIENT_CACHE.provinces.time < CACHE_TTL)) {
    return { success: true, data: CLIENT_CACHE.provinces.data };
  }
  try {
    const res = await fetch(`${BASE_URL}/QuanTri/getDataCbbProvince`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: ''
    });
    if (!res.ok) throw new Error(`NCHMF API error: ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    CLIENT_CACHE.provinces.data = list;
    CLIENT_CACHE.provinces.time = now;
    return { success: true, data: list };
  } catch (err) {
    console.error('fetchDirectProvinces error:', err);
    throw err;
  }
}

/**
 * 2. Lấy dữ liệu Cảnh báo Nguy cơ Lũ quét & Sạt lở theo Xã/Huyện
 */
export async function fetchDirectCanhBao({ date, sogiodubao = 6, autoFallback = true } = {}) {
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
        // continue fallback
      }
    }
  }

  const enriched = (list || []).map((item) => {
    const parsedThoigian = parseNetDate(item.thoigian);
    const parsedNgayCapNhat = parseNetDate(item.ngay_capnhat);
    return {
      id: item.id,
      commune_id: item.commune_id,
      commune_name: item.commune_name || item.commune_name_2cap || '',
      district_name: item.district_name || '',
      province_name: item.province_name || '',
      nguyco_satlo: item.nguyco_satlo || 'Không có',
      nguyco_luquet: item.nguyco_luquet || 'Không có',
      luongmua_thucdo: typeof item.luongmua_thucdo === 'number' ? Math.round(item.luongmua_thucdo * 10) / 10 : 0,
      luongmua_dubao: typeof item.luongmua_dubao === 'number' ? Math.round(item.luongmua_dubao * 10) / 10 : 0,
      luongmua_tong: typeof item.luongmua_tong === 'number' ? Math.round(item.luongmua_tong * 10) / 10 : 0,
      lon: item.x,
      lat: item.y,
      thoigian_raw: item.thoigian,
      thoigian: formatDisplayDate(parsedThoigian),
      ngay_capnhat: formatDisplayDate(parsedNgayCapNhat)
    };
  });

  return {
    success: true,
    data: enriched,
    count: enriched.length,
    actualDate,
    requestedDate: targetDate,
    sogiodubao: Number(sogiodubao)
  };
}

/**
 * 3. 12.506 Điểm ĐÃ XẢY RA SẠT LỞ (ht_satlo_point)
 */
export async function fetchDirectDiemDaXayRaSatLo({ provinceName = '' } = {}) {
  const now = Date.now();
  let features = [];

  if (CLIENT_CACHE.satlo.data && (now - CLIENT_CACHE.satlo.time < CACHE_TTL)) {
    features = CLIENT_CACHE.satlo.data;
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

    if (!res.ok) throw new Error(`NCHMF API error: ${res.status}`);

    let raw = await res.json();
    if (typeof raw === 'string') raw = JSON.parse(raw);
    features = (raw && raw.features) ? raw.features : [];
    CLIENT_CACHE.satlo.data = features;
    CLIENT_CACHE.satlo.time = now;
  }

  let list = features.map((f) => {
    const p = f.properties || {};
    const coords = f.geometry?.coordinates || [p.x, p.y];
    return {
      gid: p.gid || p.fid_,
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
 * 4. 1.048 Điểm ĐÃ XẢY RA LŨ QUÉT (ht_luquet_point)
 */
export async function fetchDirectDiemDaXayRaLuQuet({ provinceName = '' } = {}) {
  const now = Date.now();
  let features = [];

  if (CLIENT_CACHE.luquet.data && (now - CLIENT_CACHE.luquet.time < CACHE_TTL)) {
    features = CLIENT_CACHE.luquet.data;
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

    if (!res.ok) throw new Error(`NCHMF API error: ${res.status}`);

    let raw = await res.json();
    if (typeof raw === 'string') raw = JSON.parse(raw);
    features = (raw && raw.features) ? raw.features : [];
    CLIENT_CACHE.luquet.data = features;
    CLIENT_CACHE.luquet.time = now;
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
 * 5. 776 TRỌNG ĐIỂM SẠT LỞ LŨ QUÉT (tbl_diemnguyco)
 */
export async function fetchDirectTrongDiemSLLQ({ provinceName = '' } = {}) {
  const now = Date.now();
  let features = [];

  if (CLIENT_CACHE.trongdiem.data && (now - CLIENT_CACHE.trongdiem.time < CACHE_TTL)) {
    features = CLIENT_CACHE.trongdiem.data;
  } else {
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

    if (!res.ok) throw new Error(`NCHMF API error: ${res.status}`);

    let raw = await res.json();
    if (typeof raw === 'string') raw = JSON.parse(raw);
    features = (raw && raw.features) ? raw.features : [];
    CLIENT_CACHE.trongdiem.data = features;
    CLIENT_CACHE.trongdiem.time = now;
  }

  let list = features.map((f) => {
    const p = f.properties || {};
    const coords = f.geometry?.coordinates || [p.x, p.y];
    return {
      id: p.id,
      ten: p.ten || '',
      diadiem: p.diadiem || '',
      ten_tinh: p.ten_tinh || '',
      ten_xa: p.ten_xa || '',
      lon: coords[0] || p.x,
      lat: coords[1] || p.y,
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
 * 6. Dữ liệu Radar thời tiết (CMAX Composite)
 */
export async function fetchDirectRadar({ date = null } = {}) {
  const targetDate = date ? new Date(date) : new Date();
  const pad = (n) => String(n).padStart(2, '0');

  const frames = [];
  const baseUtc = new Date(targetDate.getTime());

  for (let i = 0; i < 12; i++) {
    const frameTime = new Date(baseUtc.getTime() - i * 10 * 60 * 1000);
    const m10 = Math.floor(frameTime.getUTCMinutes() / 10) * 10;
    frameTime.setUTCMinutes(m10, 0, 0);

    const year = frameTime.getUTCFullYear();
    const month = pad(frameTime.getUTCMonth() + 1);
    const day = pad(frameTime.getUTCDate());
    const hours = pad(frameTime.getUTCHours());
    const mins = pad(frameTime.getUTCMinutes());

    const datengay = `${year}${month}${day}`;
    const dategio = `${year}${month}${day}${hours}${mins}`;

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
      bounds: { north: 25.2, south: 7.2, west: 97.0, east: 115.0 },
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

/**
 * 7. 8.400+ trạm đo mưa tự động
 */
export async function fetchDirectTramMua({ thoigian } = {}) {
  let targetTime = thoigian;
  if (!targetTime) targetTime = formatHourString(new Date());

  const params = new URLSearchParams({ thoigian: targetTime });
  const res = await fetch(`${BASE_URL}/LayerMapBox/InitVectorMua`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: params.toString()
  });

  if (!res.ok) throw new Error(`NCHMF API error: ${res.status}`);
  const list = await res.json();
  if (!Array.isArray(list) || list.length === 0 || !list[0].data) {
    return { success: true, data: [], count: 0, geojson: null };
  }

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

  return { success: true, data: stations, count: stations.length };
}

/**
 * 8. Độ ẩm đất
 */
export async function fetchDirectDoAmDat({ thoigian, typeHienThi = 'theotinh', typeCanhBao = 'r0d' } = {}) {
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

  if (!res.ok) throw new Error(`NCHMF API error: ${res.status}`);
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

  return { success: true, data: formatted, count: formatted.length };
}
