/**
 * openDevClientService.js
 * Dịch vụ cào trực tiếp từ Client-side (Trình duyệt) đến Open Development Mekong
 * Open Development Mekong CKAN API hỗ trợ Access-Control-Allow-Origin: *
 * Cho phép trình duyệt gọi trực tiếp mà không bị chặn CORS, hoạt động độc lập
 * ngay cả khi Backend trên Render chưa được deploy bản mới hoặc đang ở chế độ ngủ (Sleep).
 */

const ODM_BASE_URL = 'https://data.opendevelopmentmekong.net';
const ODM_API_BASE = `${ODM_BASE_URL}/api/3/action`;
const ORG_NAME = 'vietnam-organization';

// In-memory cache cho phiên làm việc
let MEMORY_CACHE = null;
const CACHE_STORAGE_KEY = 'odm_vietnam_datasets_cache_v1';

/**
 * Phân tích và làm sạch danh sách chuyên đề (Taxonomy) từ mảng, chuỗi Postgres hay object
 */
export function cleanTaxonomies(rawList) {
  if (!rawList) return [];
  const list = Array.isArray(rawList) ? rawList : [rawList];
  const cleaned = [];

  for (const item of list) {
    if (!item) continue;
    if (typeof item === 'object') {
      const vals = Object.values(item).filter(v => typeof v === 'string' && v.trim());
      cleaned.push(...vals);
    } else if (typeof item === 'string') {
      const s = item.trim();
      if (s.startsWith('{') && s.endsWith('}')) {
        const inner = s.slice(1, -1);
        const matches = inner.match(/"([^"]+)"|([^,]+)/g);
        if (matches) {
          matches.forEach(m => {
            const val = m.replace(/^"|"$/g, '').trim();
            if (val && val !== '{}') cleaned.push(val);
          });
        }
      } else if (s && s !== '{}') {
        cleaned.push(s);
      }
    }
  }
  return Array.from(new Set(cleaned));
}

/**
 * Đọc cache từ sessionStorage / memory
 */
function getClientCache() {
  if (MEMORY_CACHE) return MEMORY_CACHE;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = sessionStorage.getItem(CACHE_STORAGE_KEY);
      if (raw) {
        MEMORY_CACHE = JSON.parse(raw);
        return MEMORY_CACHE;
      }
    }
  } catch (e) {
    console.warn('Cannot read sessionStorage cache:', e);
  }
  return null;
}

/**
 * Lưu cache vào sessionStorage / memory
 */
function setClientCache(payload) {
  MEMORY_CACHE = payload;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch (e) {
    console.warn('Cannot write sessionStorage cache (quota exceeded or disabled):', e);
  }
}

/**
 * Kiểm tra trạng thái mới nhất từ CKAN API (1 request siêu nhẹ)
 */
export async function checkDirectLatestStatus() {
  const url = `${ODM_API_BASE}/package_search?fq=organization:${ORG_NAME}&rows=1&sort=metadata_modified desc`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`CKAN API error: ${res.status}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error('CKAN API returned success: false');
  }

  const count = data.result.count;
  const first = data.result.results?.[0];

  return {
    totalCount: count,
    latestModified: first?.metadata_modified || null,
    latestId: first?.id || null,
    latestTitle: first?.title_translated?.vi || first?.title || first?.title_translated?.en || 'N/A'
  };
}

/**
 * Chuẩn hóa một bản ghi dataset
 */
function normalizeDataset(item) {
  const titleVi = item.title_translated?.vi || item.title || '';
  const titleEn = item.title_translated?.en || '';
  const notesVi = item.notes_translated?.vi || item.notes || '';
  const notesEn = item.notes_translated?.en || '';

  const resources = (item.resources || []).map((r) => {
    let rawFormat = (r.format || '').trim().toUpperCase();
    if ((!rawFormat || rawFormat === 'OTHER') && r.url) {
      const ext = r.url.split('.').pop().split('?')[0].toUpperCase();
      if (ext && ext.length <= 6 && !ext.includes('/')) rawFormat = ext;
    }
    return {
      id: r.id,
      name: r.name_translated?.vi || r.name || r.name_translated?.en || `${rawFormat || 'File'} tài liệu`,
      name_en: r.name_translated?.en || '',
      format: rawFormat || 'OTHER',
      url: r.url,
      size: typeof r.size === 'number' ? r.size : (parseInt(r.size, 10) || 0),
      mimetype: r.mimetype || '',
      description: r.description_translated?.vi || r.description || r.description_translated?.en || '',
      created: r.created || '',
      modified: r.metadata_modified || r.last_modified || ''
    };
  });

  const taxonomy = cleanTaxonomies(item.taxonomy);

  const tags = Array.isArray(item.tags)
    ? item.tags.map((t) => t.display_name || t.name).filter(Boolean)
    : [];

  const rawYear = item.marc21_260c 
    ? String(item.marc21_260c).replace(/\.0$/, '') 
    : (item.metadata_created ? item.metadata_created.substring(0, 4) : '');

  const author = item.author 
    || item.maintainer 
    || item.marc21_710?.vi 
    || item.marc21_710?.en 
    || item.CI_ResponsibleParty?.title 
    || 'Open Development Vietnam';

  return {
    id: item.id,
    name: item.name,
    type: item.type || 'dataset',
    detailUrl: `${ODM_BASE_URL}/vi/${item.type || 'dataset'}/${item.name}`,
    title: titleVi || titleEn || item.name,
    title_vi: titleVi,
    title_en: titleEn,
    notes: notesVi || notesEn || '',
    notes_vi: notesVi,
    notes_en: notesEn,
    taxonomy,
    tags,
    license_id: item.license_id || 'unspecified',
    license_title: item.license_title || item.license_id || 'Chưa xác định',
    published_year: rawYear || '',
    author,
    spatial: Array.isArray(item.odm_spatial_range) ? item.odm_spatial_range : ['vn'],
    languages: Array.isArray(item.odm_language) ? item.odm_language : ['vi'],
    created: item.metadata_created || '',
    modified: item.metadata_modified || item.odm_date_modified || '',
    resources,
    resourcesCount: resources.length
  };
}

/**
 * Cào trực tiếp toàn bộ dữ liệu từ browser qua CKAN Action API
 */
export async function fetchDirectOpenDevDatasets(options = {}) {
  const { force = false, onProgress = null } = options;
  const cached = getClientCache();

  let liveStatus = null;
  try {
    liveStatus = await checkDirectLatestStatus();
  } catch (err) {
    console.warn('Could not check latest status directly from CKAN:', err);
  }

  // Nếu đã có cache và dữ liệu site không đổi
  if (!force && cached && liveStatus) {
    const isCountMatch = cached.totalDatasets === liveStatus.totalCount;
    const isDateMatch = cached.latestDatasetModified === liveStatus.latestModified;
    if (isCountMatch && isDateMatch) {
      return {
        success: true,
        updated: false,
        fromCache: true,
        fromDirectCkan: true,
        scannedAt: cached.lastScannedAt,
        message: 'Dữ liệu đã ở phiên bản mới nhất từ Open Development Mekong (Client Cache).',
        data: cached
      };
    }
  }

  const startTime = Date.now();
  const pageSize = 100;
  const allRawResults = [];
  let totalApiCount = liveStatus?.totalCount || 717;

  // Tính số trang cần fetch
  const totalPages = Math.ceil(totalApiCount / pageSize);
  const pageOffsets = [];
  for (let s = 0; s < totalApiCount; s += pageSize) {
    pageOffsets.push(s);
  }

  // Tải đồng thời hoặc theo đợt để tốc độ cực nhanh
  for (let i = 0; i < pageOffsets.length; i++) {
    const start = pageOffsets[i];
    if (onProgress) {
      onProgress({ current: allRawResults.length, total: totalApiCount, page: i + 1, totalPages });
    }

    const pageUrl = `${ODM_API_BASE}/package_search?fq=organization:${ORG_NAME}&rows=${pageSize}&start=${start}&sort=metadata_modified desc`;
    const res = await fetch(pageUrl, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      throw new Error(`Lỗi tải trang dữ liệu (start=${start}): HTTP ${res.status}`);
    }
    const json = await res.json();
    if (!json.success) {
      throw new Error(`CKAN package_search thất bại tại start=${start}`);
    }

    totalApiCount = json.result.count;
    const results = json.result.results || [];
    if (results.length === 0) break;

    allRawResults.push(...results);
    if (allRawResults.length >= totalApiCount) break;
  }

  // Chuẩn hóa danh sách
  const normalized = allRawResults.map(normalizeDataset);

  // Thống kê phân bổ
  const formatStats = {};
  const taxonomyStats = {};
  const licenseStats = {};
  const yearStats = {};
  const languageStats = {};
  let totalResources = 0;

  normalized.forEach((ds) => {
    totalResources += ds.resourcesCount;
    ds.resources.forEach((r) => {
      const fmt = r.format || 'OTHER';
      formatStats[fmt] = (formatStats[fmt] || 0) + 1;
    });

    ds.taxonomy.forEach((tax) => {
      taxonomyStats[tax] = (taxonomyStats[tax] || 0) + 1;
    });

    const lic = ds.license_title || 'Chưa xác định';
    licenseStats[lic] = (licenseStats[lic] || 0) + 1;

    if (ds.published_year) {
      yearStats[ds.published_year] = (yearStats[ds.published_year] || 0) + 1;
    }

    ds.languages.forEach((lang) => {
      languageStats[lang] = (languageStats[lang] || 0) + 1;
    });
  });

  const durationMs = Date.now() - startTime;
  const nowIso = new Date().toISOString();

  const payload = {
    organization: {
      name: 'Open Development Vietnam',
      slug: ORG_NAME,
      url: `${ODM_BASE_URL}/vi/organization/${ORG_NAME}`,
      description: 'Vietnam-based organizations and partners',
      sourcePlatform: 'CKAN Open Data Portal v3',
      provider: 'Open Development Mekong (ODM)'
    },
    lastScannedAt: nowIso,
    scanDurationMs: durationMs,
    totalDatasets: normalized.length,
    totalResources,
    latestDatasetModified: liveStatus?.latestModified || normalized[0]?.modified || null,
    statistics: {
      formats: formatStats,
      taxonomies: taxonomyStats,
      licenses: licenseStats,
      years: yearStats,
      languages: languageStats
    },
    datasets: normalized
  };

  setClientCache(payload);

  return {
    success: true,
    updated: true,
    fromCache: false,
    fromDirectCkan: true,
    scannedAt: nowIso,
    message: `Đã quét và đồng bộ thành công ${normalized.length} bộ dữ liệu từ Open Development Mekong!`,
    data: payload
  };
}
