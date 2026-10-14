/**
 * vnredlistService.js
 * Dịch vụ cào, trích xuất và đồng bộ dữ liệu Danh lục Đỏ Động vật Việt Nam (Sách Đỏ Việt Nam)
 * Nguồn mục tiêu: http://vnredlist.vast.vn/dong-vat/
 * Cơ quan chủ quản: Viện Hàn lâm Khoa học và Công nghệ Việt Nam (VAST) & Viện Sinh thái và Tài nguyên sinh vật (IEBR)
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(__dirname, 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'vnredlist_animals.json');

const BASE_URL = 'http://vnredlist.vast.vn';
const TARGET_URL = `${BASE_URL}/dong-vat/`;

// Đảm bảo thư mục data tồn tại
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 16 Lớp động vật thuộc 5 Ngành chính thức theo cấu trúc vnredlist.vast.vn
export const ANIMAL_TAXONOMY_TREE = [
  {
    phylum: 'Ngành Động vật có dây sống (Chordata)',
    phylumSlug: 'dong-vat-co-day-song',
    classes: [
      { name: 'Lớp Thú (Mammalia)', slug: 'lop-thu', url: `${BASE_URL}/dong-vat/dong-vat-co-day-song/lop-thu/`, maxPage: 8 },
      { name: 'Lớp Chim (Aves)', slug: 'lop-chim', url: `${BASE_URL}/dong-vat/dong-vat-co-day-song/lop-chim/`, maxPage: 7 },
      { name: 'Lớp Bò sát (Reptilia)', slug: 'lop-bo-sat', url: `${BASE_URL}/dong-vat/dong-vat-co-day-song/lop-bo-sat/`, maxPage: 7 },
      { name: 'Lớp Lưỡng cư (Amphibia)', slug: 'lop-luong-cu', url: `${BASE_URL}/dong-vat/dong-vat-co-day-song/lop-luong-cu/`, maxPage: 5 },
      { name: 'Lớp Cá xương (Actinopterygii)', slug: 'lop-ca-xuong', url: `${BASE_URL}/dong-vat/dong-vat-co-day-song/lop-ca-xuong/`, maxPage: 5 },
      { name: 'Lớp Cá mang Tấm (Elasmobranchii)', slug: 'lop-ca-mang-tam', url: `${BASE_URL}/dong-vat/dong-vat-co-day-song/lop-ca-mang-tam/`, maxPage: 4 }
    ]
  },
  {
    phylum: 'Ngành Chân khớp (Arthropoda)',
    phylumSlug: 'nganh-chan-khop',
    classes: [
      { name: 'Lớp Côn trùng (Insecta)', slug: 'lop-con-trung', url: `${BASE_URL}/dong-vat/nganh-chan-khop/lop-con-trung/`, maxPage: 3 },
      { name: 'Lớp Hình nhện (Arachnida)', slug: 'lop-hinh-nhen', url: `${BASE_URL}/dong-vat/nganh-chan-khop/lop-hinh-nhen/`, maxPage: 1 },
      { name: 'Lớp Giáp xác lớn (Malacostraca)', slug: 'lop-giap-xac-lon', url: `${BASE_URL}/dong-vat/nganh-chan-khop/lop-giap-xac-lon/`, maxPage: 1 },
      { name: 'Lớp Miệng đốt (Merostomata)', slug: 'lop-mieng-dot', url: `${BASE_URL}/dong-vat/nganh-chan-khop/lop-mieng-dot/`, maxPage: 1 }
    ]
  },
  {
    phylum: 'Ngành Thân mềm (Mollusca)',
    phylumSlug: 'nganh-than-mem',
    classes: [
      { name: 'Lớp Thân mềm chân bụng (Gastropoda)', slug: 'lop-than-mem-chan-bung', url: `${BASE_URL}/dong-vat/nganh-than-mem/lop-than-mem-chan-bung/`, maxPage: 2 },
      { name: 'Lớp Thân mềm hai mảnh vỏ (Bivalvia)', slug: 'lop-than-mem-hai-manh-vo', url: `${BASE_URL}/dong-vat/nganh-than-mem/lop-than-mem-hai-manh-vo/`, maxPage: 2 },
      { name: 'Lớp Chân đầu (Cephalopoda)', slug: 'lop-chan-dau', url: `${BASE_URL}/dong-vat/nganh-than-mem/lop-chan-dau/`, maxPage: 1 }
    ]
  },
  {
    phylum: 'Ngành Da gai (Echinodermata)',
    phylumSlug: 'nganh-da-gai',
    classes: [
      { name: 'Lớp Cầu gai (Echinoidea)', slug: 'lop-cau-gai', url: `${BASE_URL}/dong-vat/nganh-da-gai/lop-cau-gai/`, maxPage: 1 },
      { name: 'Lớp Hải sâm (Holothuroidea)', slug: 'lop-hai-sam', url: `${BASE_URL}/dong-vat/nganh-da-gai/lop-hai-sam/`, maxPage: 1 }
    ]
  },
  {
    phylum: 'Ngành San hô (Cnidaria)',
    phylumSlug: 'nganh-san-ho',
    classes: [
      { name: 'Lớp San hô sáu tia (Hexacorallia)', slug: 'lop-hexacorallia', url: `${BASE_URL}/dong-vat/nganh-san-ho/lop-hexacorallia/`, maxPage: 5 }
    ]
  }
];

// Flat list các class để dễ duyệt
export const ALL_CLASSES = ANIMAL_TAXONOMY_TREE.flatMap(tree =>
  tree.classes.map(c => ({ ...c, phylum: tree.phylum, phylumSlug: tree.phylumSlug }))
);

// Map phân loại chuẩn IUCN Red List & Sách Đỏ Việt Nam
export const RED_LIST_CATEGORIES = {
  EX: { code: 'EX', label: 'Tuyệt chủng (Extinct)', color: '#000000', badgeClass: 'bg-black text-white' },
  EW: { code: 'EW', label: 'Tuyệt chủng ngoài tự nhiên (Extinct in the Wild)', color: '#542788', badgeClass: 'bg-purple-900 text-purple-100' },
  CR: { code: 'CR', label: 'Rất nguy cấp / Cực kỳ nguy cấp (Critically Endangered)', color: '#d73027', badgeClass: 'bg-rose-600 text-white' },
  EN: { code: 'EN', label: 'Nguy cấp (Endangered)', color: '#fc8d59', badgeClass: 'bg-orange-600 text-white' },
  VU: { code: 'VU', label: 'Sắp nguy cấp (Vulnerable)', color: '#fee08b', badgeClass: 'bg-amber-500 text-slate-900' },
  NT: { code: 'NT', label: 'Sắp bị đe dọa (Near Threatened)', color: '#d9ef8b', badgeClass: 'bg-lime-600 text-white' },
  LC: { code: 'LC', label: 'Ít lo ngại (Least Concern)', color: '#91cf60', badgeClass: 'bg-emerald-600 text-white' },
  DD: { code: 'DD', label: 'Thiếu dữ liệu (Data Deficient)', color: '#999999', badgeClass: 'bg-slate-500 text-white' },
  NE: { code: 'NE', label: 'Không được đánh giá (Not Evaluated)', color: '#cccccc', badgeClass: 'bg-slate-300 text-slate-800' }
};

/**
 * Hàm gọi HTTP GET kèm timeout và custom headers
 */
export function httpGet(url, timeoutMs = 12000) {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, statusCode: res.statusCode, data }));
      });
      req.on('error', (err) => resolve({ ok: false, error: err.message, data: '' }));
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        resolve({ ok: false, error: 'Timeout', data: '' });
      });
    } catch (err) {
      resolve({ ok: false, error: err.message, data: '' });
    }
  });
}

/**
 * Trích xuất danh sách thẻ bài viết (loài) từ HTML trang danh sách Lớp
 */
export function parseCardsFromHtml(html, classInfo) {
  const cards = [];
  const articleMatches = [...html.matchAll(/<article[^>]*class=[\"'][^\"']*card[^\"']*[\"'][^>]*>([\s\S]*?)<\/article>/gi)];

  for (const m of articleMatches) {
    const cardHtml = m[1];
    const nameMatch = cardHtml.match(/<h2[^>]*class=[\"'][^\"']*card__data[^\"']*[\"'][^>]*>\s*<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>([\s\S]*?)<\/a>/i);
    if (!nameMatch) continue;

    const url = nameMatch[1].trim();
    const scientificName = nameMatch[2].replace(/<[^>]+>/g, '').trim();

    let vietnameseName = '';
    const pMatch = cardHtml.match(/<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
    if (pMatch) {
      vietnameseName = pMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    let thumbnail = '';
    const imgMatch = cardHtml.match(/<img[^>]+src=[\"']([^\"']+)[\"']/i);
    if (imgMatch) {
      thumbnail = imgMatch[1].trim();
    }

    // Slug từ URL: http://vnredlist.vast.vn/elephas-maximus/ -> elephas-maximus
    const slugMatch = url.match(/vnredlist\.vast\.vn\/([^/]+)\/?$/);
    const slug = slugMatch ? slugMatch[1] : scientificName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    cards.push({
      id: slug,
      slug,
      scientificName,
      vietnameseName: vietnameseName || scientificName,
      url,
      thumbnail,
      className: classInfo.name,
      classSlug: classInfo.slug,
      phylum: classInfo.phylum,
      phylumSlug: classInfo.phylumSlug
    });
  }

  return cards;
}

/**
 * Trích xuất thông tin hồ sơ chi tiết một loài từ HTML
 */
export function parseSpeciesDetail(html, basicInfo = {}) {
  const detail = { ...basicInfo };

  // Phân hạng bảo tồn (CR, EN, VU, NT, LC, DD...)
  const statusMatch = html.match(/Phân hạng bảo tồn[\s\S]*?font-size:24px;\"?>([^<]+)<\/font>/i)
    || html.match(/Phân hạng bảo tồn[\s\S]*?<p[^>]*class=[\"'][^\"']*card__data[^\"']*[\"'][^>]*>([\s\S]*?)<\/p>/i)
    || html.match(/Phân hạng[\s\S]*?<font[^>]*>([A-Z]{2})<\/font>/i);
  if (statusMatch) {
    const raw = statusMatch[1].replace(/<[^>]+>/g, '').trim();
    // Normalize (e.g. CR, EN, VU)
    detail.redListStatus = raw.toUpperCase();
  } else {
    detail.redListStatus = detail.redListStatus || 'DD';
  }

  // Người đánh giá & Người góp ý & Năm công bố
  const assessorMatch = html.match(/Người đánh giá[\s\S]*?<p[^>]*class=[\"'][^\"']*card__data[^\"']*[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (assessorMatch) {
    detail.assessor = assessorMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  const contribMatch = html.match(/Người góp ý[\s\S]*?<p[^>]*class=[\"'][^\"']*card__data[^\"']*[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (contribMatch) {
    detail.contributors = contribMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  const yearMatch = html.match(/Năm công bố[\s\S]*?<p[^>]*class=[\"'][^\"']*card__data[^\"']*[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (yearMatch) {
    detail.publicationYear = yearMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  // Phân loại học 7 bậc (Taxonomy hierarchy)
  const taxonomyFields = ['Giới', 'Ngành', 'Lớp', 'Bộ', 'Họ', 'Chi/Giống', 'Loài', 'Synonym', 'Tên phổ thông'];
  detail.taxonomy = detail.taxonomy || {};
  taxonomyFields.forEach(field => {
    const rx = new RegExp(field + '[\\s\\S]*?<p[^>]*class=[\"\\\'][^\"\\\']*card__data[^\"\\\']*[\"\\\'][^>]*>([\\s\\S]*?)<\\/p>', 'i');
    const match = html.match(rx);
    if (match) {
      detail.taxonomy[field] = match[1].replace(/<[^>]+>/g, '').trim();
    }
  });

  // Phân bố địa lý (Việt Nam & Thế giới)
  const vnMatch = html.match(/id=[\"']geographic-range[\"'][\s\S]*?Việt nam[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (vnMatch) {
    detail.distributionVietnam = vnMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  const worldMatch = html.match(/id=[\"']geographic-range[\"'][\s\S]*?Thế giới[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (worldMatch) {
    detail.distributionWorld = worldMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  // Bản đồ phân bố (JPG Map từ VAST)
  const mapImgMatch = html.match(/id=[\"']geographic-range[\"'][\s\S]*?<img[^>]+src=[\"']([^\"']+)[\"']/i);
  if (mapImgMatch) {
    detail.distributionMapUrl = mapImgMatch[1].trim();
  }

  // Độ cao ghi nhận
  const eleLowMatch = html.match(/Độ cao ghi nhận thấp nhất[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (eleLowMatch) detail.elevationMin = eleLowMatch[1].replace(/<[^>]+>/g, '').trim();

  const eleHighMatch = html.match(/Độ cao ghi nhận cao nhất[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (eleHighMatch) detail.elevationMax = eleHighMatch[1].replace(/<[^>]+>/g, '').trim();

  // Tiêu chuẩn đánh giá & Diễn giải
  const critMatch = html.match(/Tiêu chuẩn đánh giá[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (critMatch) detail.criteria = critMatch[1].replace(/<[^>]+>/g, '').trim();

  const interpMatch = html.match(/Diễn giải đánh giá theo các tiêu chuẩn[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (interpMatch) detail.criteriaInterpretation = interpMatch[1].replace(/<[^>]+>/g, '').trim();

  // Hiện trạng & Xu hướng quần thể
  const popStatusMatch = html.match(/id=[\"']habitat-ecology[\"'][\s\S]*?Hiện trạng quần thể[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (popStatusMatch) detail.populationStatus = popStatusMatch[1].replace(/<[^>]+>/g, '').trim();

  const popTrendMatch = html.match(/id=[\"']habitat-ecology[\"'][\s\S]*?Xu hướng quần thể[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (popTrendMatch) detail.populationTrend = popTrendMatch[1].replace(/<[^>]+>/g, '').trim();

  // Sinh cảnh, Thức ăn, Sinh sản
  const habitatMatch = html.match(/Đặc điểm sinh cảnh sống[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (habitatMatch) detail.habitat = habitatMatch[1].replace(/<[^>]+>/g, '').trim();

  const habitatTypeMatch = html.match(/Dạng sinh cảnh phân bố[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (habitatTypeMatch) detail.habitatType = habitatTypeMatch[1].replace(/<[^>]+>/g, '').trim();

  const dietMatch = html.match(/Thức ăn[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (dietMatch) detail.diet = dietMatch[1].replace(/<[^>]+>/g, '').trim();

  const reproMatch = html.match(/Đặc điểm sinh sản[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (reproMatch) detail.reproduction = reproMatch[1].replace(/<[^>]+>/g, '').trim();

  // Sử dụng & Buôn bán
  const useTradeMatch = html.match(/id=[\"']use-trade[\"'][\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (useTradeMatch) detail.useAndTrade = useTradeMatch[1].replace(/<[^>]+>/g, '').trim();

  // Mối đe dọa
  const threatsMatch = html.match(/id=[\"']mdd[\"'][\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (threatsMatch) detail.threats = threatsMatch[1].replace(/<[^>]+>/g, '').trim();

  // Biện pháp bảo tồn (Đã có & Đề xuất)
  const existMatch = html.match(/id=[\"']bpbt[\"'][\s\S]*?Đã có[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (existMatch) detail.conservationExisting = existMatch[1].replace(/<[^>]+>/g, '').trim();

  const propMatch = html.match(/id=[\"']bpbt[\"'][\s\S]*?Đề xuất[\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (propMatch) detail.conservationProposed = propMatch[1].replace(/<[^>]+>/g, '').trim();

  // Tài liệu tham khảo
  const biblioMatch = html.match(/id=[\"']bibliography[\"'][\s\S]*?<p[^>]*class=[\"']cust_content[\"'][^>]*>([\s\S]*?)<\/p>/i);
  if (biblioMatch) detail.bibliography = biblioMatch[1].replace(/<[^>]+>/g, '').trim();

  detail.hasDetail = true;
  detail.detailScrapedAt = new Date().toISOString();

  return detail;
}

/**
 * Đọc dữ liệu cache từ file cục bộ
 */
export function getLocalAnimalsCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Lỗi khi đọc vnredlist cache file:', err.message);
  }
  return null;
}

/**
 * Ghi dữ liệu cache ra file
 */
export function saveLocalAnimalsCache(payload) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.error('Lỗi khi ghi vnredlist cache file:', err.message);
  }
}

/**
 * Cào toàn bộ danh mục loài (720 loài qua 54 trang phân lớp)
 */
export async function crawlAllAnimalsList(options = {}) {
  const { onProgress = null, concurrency = 4 } = options;

  const allPageTasks = [];
  for (const cls of ALL_CLASSES) {
    for (let p = 1; p <= cls.maxPage; p++) {
      const pageUrl = p === 1 ? cls.url : `${cls.url}page/${p}/`;
      allPageTasks.push({ pageUrl, cls, page: p });
    }
  }

  const totalPages = allPageTasks.length;
  let completedPages = 0;
  const rawList = [];

  for (let i = 0; i < totalPages; i += concurrency) {
    const chunk = allPageTasks.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(async (task) => {
      const res = await httpGet(task.pageUrl, 10000);
      if (res.ok && res.data) {
        return parseCardsFromHtml(res.data, task.cls);
      }
      return [];
    }));

    chunkResults.forEach(cards => rawList.push(...cards));
    completedPages += chunk.length;

    if (onProgress) {
      onProgress({
        phase: 'list',
        current: completedPages,
        total: totalPages,
        foundSpecies: rawList.length,
        percent: Math.round((completedPages / totalPages) * 100)
      });
    }
  }

  // Khử trùng lặp theo ID/URL
  const speciesMap = new Map();
  rawList.forEach(item => {
    if (!speciesMap.has(item.id)) {
      speciesMap.set(item.id, item);
    }
  });

  const uniqueSpecies = Array.from(speciesMap.values());

  // Lưu trữ hoặc hợp nhất với cache cũ (giữ lại các chi tiết đã cào trước đó nếu có)
  const existingCache = getLocalAnimalsCache();
  const existingDetailsMap = new Map();
  if (existingCache && Array.isArray(existingCache.species)) {
    existingCache.species.forEach(s => {
      if (s.hasDetail) existingDetailsMap.set(s.id, s);
    });
  }

  const mergedSpecies = uniqueSpecies.map(s => {
    const existing = existingDetailsMap.get(s.id);
    if (existing) {
      return { ...s, ...existing };
    }
    return s;
  });

  // Tính thống kê theo Lớp và Phân loại học
  const statsByClass = {};
  const statsByPhylum = {};
  const statsByStatus = {};

  mergedSpecies.forEach(s => {
    statsByClass[s.className] = (statsByClass[s.className] || 0) + 1;
    statsByPhylum[s.phylum] = (statsByPhylum[s.phylum] || 0) + 1;
    const st = s.redListStatus || 'DD';
    statsByStatus[st] = (statsByStatus[st] || 0) + 1;
  });

  const payload = {
    source: 'http://vnredlist.vast.vn/dong-vat/',
    sourceName: 'Danh lục Đỏ Việt Nam - Động vật (VAST / IEBR)',
    lastScannedAt: new Date().toISOString(),
    totalSpecies: mergedSpecies.length,
    totalDetailed: mergedSpecies.filter(s => s.hasDetail).length,
    classes: ALL_CLASSES.map(c => ({ name: c.name, slug: c.slug, phylum: c.phylum, count: statsByClass[c.name] || 0 })),
    statsByClass,
    statsByPhylum,
    statsByStatus,
    species: mergedSpecies
  };

  saveLocalAnimalsCache(payload);
  return payload;
}

/**
 * Cào chi tiết một loài theo URL hoặc slug
 */
export async function crawlSingleSpeciesDetail(slugOrUrl) {
  let targetUrl = slugOrUrl;
  let slug = slugOrUrl;

  if (!slugOrUrl.startsWith('http')) {
    targetUrl = `${BASE_URL}/${slugOrUrl}/`;
    slug = slugOrUrl;
  } else {
    const m = slugOrUrl.match(/vnredlist\.vast\.vn\/([^/]+)\/?$/);
    if (m) slug = m[1];
  }

  const cache = getLocalAnimalsCache();
  const existing = cache?.species?.find(s => s.id === slug || s.slug === slug);
  if (existing && existing.hasDetail) {
    return existing;
  }

  const res = await httpGet(targetUrl, 12000);
  if (!res.ok || !res.data) {
    if (existing) return existing;
    throw new Error(`Không thể tải trang chi tiết loài: ${targetUrl} (${res.error || res.statusCode})`);
  }

  const detail = parseSpeciesDetail(res.data, existing || { id: slug, slug, url: targetUrl });

  // Cập nhật lại vào cache file
  if (cache && Array.isArray(cache.species)) {
    const idx = cache.species.findIndex(s => s.id === slug);
    if (idx !== -1) {
      cache.species[idx] = { ...cache.species[idx], ...detail };
    } else {
      cache.species.push(detail);
    }
    cache.totalDetailed = cache.species.filter(s => s.hasDetail).length;
    saveLocalAnimalsCache(cache);
  }

  return detail;
}

/**
 * Cào sâu chi tiết hàng loạt loài (Deep Crawl) với concurrency và progress
 */
let isDeepCrawlRunning = false;
let deepCrawlProgress = { running: false, current: 0, total: 0, percent: 0, currentSpecies: '' };

export function getDeepCrawlProgress() {
  return deepCrawlProgress;
}

export async function runDeepCrawl(options = {}) {
  if (isDeepCrawlRunning) {
    return { success: false, message: 'Tiến trình quét sâu đang chạy dở dang.', progress: deepCrawlProgress };
  }

  const { concurrency = 5, limit = null } = options;
  let cache = getLocalAnimalsCache();
  if (!cache || !cache.species || cache.species.length === 0) {
    cache = await crawlAllAnimalsList();
  }

  const targetList = cache.species.filter(s => !s.hasDetail);
  const toProcess = limit ? targetList.slice(0, limit) : targetList;

  isDeepCrawlRunning = true;
  deepCrawlProgress = {
    running: true,
    current: 0,
    total: toProcess.length,
    percent: 0,
    currentSpecies: '',
    startedAt: new Date().toISOString()
  };

  (async () => {
    try {
      for (let i = 0; i < toProcess.length; i += concurrency) {
        if (!isDeepCrawlRunning) break;
        const chunk = toProcess.slice(i, i + concurrency);

        await Promise.all(chunk.map(async (item) => {
          deepCrawlProgress.currentSpecies = item.scientificName;
          const res = await httpGet(item.url, 10000);
          if (res.ok && res.data) {
            const detail = parseSpeciesDetail(res.data, item);
            const idx = cache.species.findIndex(s => s.id === item.id);
            if (idx !== -1) {
              cache.species[idx] = { ...cache.species[idx], ...detail };
            }
          }
        }));

        deepCrawlProgress.current = Math.min(i + chunk.length, toProcess.length);
        deepCrawlProgress.percent = Math.round((deepCrawlProgress.current / deepCrawlProgress.total) * 100);

        // Lưu cache trung gian mỗi 10 loài
        if (i % 10 === 0 || deepCrawlProgress.current >= toProcess.length) {
          cache.totalDetailed = cache.species.filter(s => s.hasDetail).length;
          saveLocalAnimalsCache(cache);
        }
      }
    } catch (err) {
      console.error('Lỗi trong runDeepCrawl:', err);
    } finally {
      isDeepCrawlRunning = false;
      deepCrawlProgress.running = false;
      deepCrawlProgress.completedAt = new Date().toISOString();
      cache.totalDetailed = cache.species.filter(s => s.hasDetail).length;
      saveLocalAnimalsCache(cache);
    }
  })();

  return {
    success: true,
    message: `Đã khởi chạy tiến trình cào sâu ${toProcess.length} loài trong nền.`,
    totalToProcess: toProcess.length
  };
}

export function stopDeepCrawl() {
  if (isDeepCrawlRunning) {
    isDeepCrawlRunning = false;
    deepCrawlProgress.running = false;
    return { success: true, message: 'Đã yêu cầu dừng tiến trình quét sâu.' };
  }
  return { success: false, message: 'Không có tiến trình nào đang chạy.' };
}
