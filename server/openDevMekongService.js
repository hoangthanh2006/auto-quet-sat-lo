/**
 * openDevMekongService.js
 * Dịch vụ cào và đồng bộ dữ liệu toàn diện từ Open Development Mekong (Vietnam Organization)
 * Trang mục tiêu: https://data.opendevelopmentmekong.net/vi/organization/vietnam-organization
 * Nền tảng: CKAN Open Data Action API v3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(__dirname, 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'opendev_vietnam_datasets.json');

const BASE_URL = 'https://data.opendevelopmentmekong.net';
const API_BASE = `${BASE_URL}/api/3/action`;
const ORG_NAME = 'vietnam-organization';

// Đảm bảo thư mục cache tồn tại
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

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
        // Postgres array string dạng {"A",B,"C"}
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
 * Kiểm tra trạng thái mới nhất từ CKAN API (1 request siêu nhẹ)
 */
export async function checkLatestStatus() {
  const url = `${API_BASE}/package_search?fq=organization:${ORG_NAME}&rows=1&sort=metadata_modified desc`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`CKAN API error: ${res.status} ${res.statusText}`);
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
 * Đọc dữ liệu cache từ file local
 */
export function getLocalCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading opendev cache:', err);
  }
  return null;
}

/**
 * Làm sạch và chuẩn hóa 1 bản ghi dataset từ CKAN
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
    detailUrl: `${BASE_URL}/vi/${item.type || 'dataset'}/${item.name}`,
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
 * Quét / Cào toàn bộ dữ liệu từ Open Development Mekong
 * Tự động kiểm tra xem có dữ liệu mới không, nếu có hoặc force=true sẽ tải tất cả các trang
 */
export async function syncOpenDevDatasets(options = {}) {
  const { force = false } = options;
  const cached = getLocalCache();

  // Kiểm tra trạng thái mới nhất từ server ODM
  let liveStatus = null;
  try {
    liveStatus = await checkLatestStatus();
  } catch (err) {
    console.warn('Could not check live status from CKAN, falling back to cache if present:', err.message);
  }

  // Nếu cache còn mới và không bị ép buộc quét lại
  if (!force && cached && liveStatus) {
    const isCountMatch = cached.totalDatasets === liveStatus.totalCount;
    const isDateMatch = cached.latestDatasetModified === liveStatus.latestModified;
    if (isCountMatch && isDateMatch) {
      console.log(`OpenDev Mekong cache is up to date: ${cached.totalDatasets} datasets.`);
      return {
        success: true,
        updated: false,
        fromCache: true,
        scannedAt: cached.lastScannedAt,
        message: 'Dữ liệu đã ở phiên bản mới nhất, không có thay đổi từ Open Development Mekong.',
        data: cached
      };
    }
  }

  console.log(`Starting full sync of Open Development Vietnam datasets (force=${force}, liveCount=${liveStatus?.totalCount || 'unknown'})...`);
  const startTime = Date.now();
  const pageSize = 100;
  let allRawResults = [];
  let totalApiCount = 0;

  for (let start = 0; start < 1500; start += pageSize) {
    const pageUrl = `${API_BASE}/package_search?fq=organization:${ORG_NAME}&rows=${pageSize}&start=${start}&sort=metadata_modified desc`;
    const res = await fetch(pageUrl, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      throw new Error(`Failed to fetch page start=${start}: HTTP ${res.status}`);
    }
    const json = await res.json();
    if (!json.success) {
      throw new Error(`CKAN package_search error at start=${start}`);
    }

    totalApiCount = json.result.count;
    const results = json.result.results || [];
    if (results.length === 0) break;

    allRawResults.push(...results);
    console.log(`Fetched page start=${start}, count=${results.length}, progress=${allRawResults.length}/${totalApiCount}`);

    if (allRawResults.length >= totalApiCount) {
      break;
    }
  }

  // Chuẩn hóa và làm sạch toàn bộ danh sách
  const normalized = allRawResults.map(normalizeDataset);

  // Thống kê phân tích (Facets & KPI)
  const formatStats = {};
  const taxonomyStats = {};
  const licenseStats = {};
  const yearStats = {};
  const languageStats = {};
  let totalResources = 0;

  normalized.forEach((ds) => {
    // Tài nguyên & Định dạng
    totalResources += ds.resourcesCount;
    ds.resources.forEach((r) => {
      const fmt = r.format || 'OTHER';
      formatStats[fmt] = (formatStats[fmt] || 0) + 1;
    });

    // Chuyên đề
    ds.taxonomy.forEach((tax) => {
      taxonomyStats[tax] = (taxonomyStats[tax] || 0) + 1;
    });

    // Giấy phép
    const lic = ds.license_title || 'Chưa xác định';
    licenseStats[lic] = (licenseStats[lic] || 0) + 1;

    // Năm
    if (ds.published_year) {
      yearStats[ds.published_year] = (yearStats[ds.published_year] || 0) + 1;
    }

    // Ngôn ngữ
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
      url: `${BASE_URL}/vi/organization/${ORG_NAME}`,
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

  // Lưu file cache
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Saved ${normalized.length} datasets to ${CACHE_FILE} (${Math.round(fs.statSync(CACHE_FILE).size / 1024)} KB) in ${durationMs}ms`);
  } catch (err) {
    console.error('Failed to write opendev cache file:', err);
  }

  return {
    success: true,
    updated: true,
    fromCache: false,
    scannedAt: nowIso,
    message: `Đã quét và cập nhật thành công toàn bộ ${normalized.length} bộ dữ liệu từ Open Development Mekong!`,
    data: payload
  };
}
