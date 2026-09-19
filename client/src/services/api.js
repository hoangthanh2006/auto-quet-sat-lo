import axios from 'axios';

// Production: use VITE_API_URL, localStorage custom backend, or Render backend default. Development: proxy /api or VITE_API_URL
export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('custom_backend_url');
    if (custom && custom.trim()) {
      return `${custom.trim().replace(/\/$/, '')}/api`;
    }
  }
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) {
    return `${import.meta.env.VITE_API_URL.trim().replace(/\/$/, '')}/api`;
  }
  // In development without explicit env, use local Vite proxy
  if (import.meta.env.DEV) {
    return '/api';
  }
  // Production fallback: use deployed Render backend
  return 'https://auto-quet-sat-lo.onrender.com/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Detect if running on static hosting without ANY backend URL configured
export const isStaticHosting = typeof window !== 'undefined' &&
  !import.meta.env.VITE_API_URL &&
  !localStorage.getItem('custom_backend_url') &&
  !API_BASE_URL.startsWith('http') &&
  (window.location.hostname.includes('web.app') ||
   window.location.hostname.includes('firebaseapp.com') ||
   window.location.hostname.includes('github.io') ||
   window.location.hostname.includes('vercel.app') ||
   window.location.hostname.includes('netlify.app'));

export function isHtmlResponse(data) {
  if (typeof data === 'string') {
    const s = data.trim().toLowerCase();
    return s.startsWith('<!doctype') || s.startsWith('<html') || s.includes('<title>');
  }
  return false;
}

export const BACKEND_REQUIRED_MSG = 'Không thể kết nối đến máy chủ Backend (Render/Node.js). Nếu Render đang ở chế độ ngủ (Free tier), vui lòng đợi 30-40 giây để server khởi động lại rồi thử lại.';


// Interceptor to catch HTML response (Firebase rewrite fallback) and provide clear explanation
axios.interceptors.response.use(
  (response) => {
    if (isHtmlResponse(response.data) && response.config?.url?.includes('/api/')) {
      const err = new Error(BACKEND_REQUIRED_MSG);
      err.isStaticHostingError = true;
      return Promise.reject(err);
    }
    return response;
  },
  (error) => {
    if (isStaticHosting && (!error.response || isHtmlResponse(error.response?.data))) {
      return Promise.reject(new Error(BACKEND_REQUIRED_MSG));
    }
    return Promise.reject(error);
  }
);

export const scanLinks = async (clickLink = false, linkSelector = null, linkText = null, khoaNumber = null, customUrl = null) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/scan-links`, {
      clickLink,
      linkSelector,
      linkText,
      khoaNumber,
      customUrl
    });
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.error || 
      error.message || 
      'Failed to connect to server'
    );
  }
};

export const extractContent = async (urls, customSelector = null) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/extract-content`, { 
      urls,
      customSelector 
    });
    return response.data;
  } catch (error) {
    // Better error handling
    if (error.response) {
      // Server responded with error status
      throw new Error(
        error.response?.data?.error || 
        `Server error: ${error.response.status} ${error.response.statusText}`
      );
    } else if (error.request) {
      // Request was made but no response received
      throw new Error(
        'Không thể kết nối đến server. Vui lòng đảm bảo backend server đang chạy trên port 3002.'
      );
    } else {
      // Something else happened
      throw new Error(error.message || 'Failed to extract content');
    }
  }
};

export const scrapeCustom = async (url, selectors) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/scrape-custom`, {
      url,
      selectors
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response?.data?.error || 
        `Server error: ${error.response.status} ${error.response.statusText}`
      );
    } else if (error.request) {
      throw new Error(
        'Không thể kết nối đến server. Vui lòng đảm bảo backend server đang chạy trên port 3002.'
      );
    } else {
      throw new Error(error.message || 'Failed to scrape custom data');
    }
  }
};

export const previewStructure = async (url) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/preview-structure`, {
      url
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response?.data?.error || 
        `Server error: ${error.response.status} ${error.response.statusText}`
      );
    } else if (error.request) {
      throw new Error(
        'Không thể kết nối đến server. Vui lòng đảm bảo backend server đang chạy trên port 3002.'
      );
    } else {
      throw new Error(error.message || 'Failed to preview page structure');
    }
  }
};

export const analyzePage = async (url) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/analyze-page`, {
      url
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response?.data?.error || 
        `Server error: ${error.response.status} ${error.response.statusText}`
      );
    } else if (error.request) {
      throw new Error(
        'Không thể kết nối đến server. Vui lòng đảm bảo backend server đang chạy trên port 3002.'
      );
    } else {
      throw new Error(error.message || 'Failed to analyze page');
    }
  }
};

export const executeScrape = async (url, config, options = {}) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/execute-scrape`, {
      url,
      config,
      ...options
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response?.data?.error || 
        `Server error: ${error.response.status} ${error.response.statusText}`
      );
    } else if (error.request) {
      throw new Error(
        'Không thể kết nối đến server. Vui lòng đảm bảo backend server đang chạy trên port 3002.'
      );
    } else {
      throw new Error(error.message || 'Failed to execute scrape');
    }
  }
};

export const executeScrapeStream = async (url, config, options = {}, onLog) => {
  try {
    const response = await fetch(`${API_BASE_URL}/execute-scrape-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, config, ...options })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = 'Failed to execute streaming scrape';
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error || errMsg;
      } catch (e) {}
      throw new Error(errMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim()) {
          try {
            const payload = JSON.parse(line);
            if (payload.type === 'log') {
              onLog(payload.message);
            } else if (payload.type === 'result') {
              finalResult = payload.data;
            } else if (payload.type === 'error') {
              throw new Error(payload.error);
            }
          } catch (e) {
            console.error('Error parsing stream line:', e);
            if (e.message && (e.message.includes('URL') || e.message.includes('Config') || e.message.includes('Recursive') || e.message.includes('Dynamic'))) {
              throw e;
            }
          }
        }
      }
    }
    return finalResult;
  } catch (error) {
    throw new Error(error.message || 'Lỗi khi kết nối hoặc đọc luồng dữ liệu thời gian thực');
  }
};

export const analyzePageStream = async (url, onLog) => {
  try {
    const response = await fetch(`${API_BASE_URL}/analyze-page-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = 'Failed to analyze page structure';
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error || errMsg;
      } catch (e) {}
      throw new Error(errMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim()) {
          try {
            const payload = JSON.parse(line);
            if (payload.type === 'log') {
              onLog(payload.message);
            } else if (payload.type === 'result') {
              finalResult = payload.data;
            } else if (payload.type === 'error') {
              throw new Error(payload.error);
            }
          } catch (e) {
            console.error('Error parsing stream line:', e);
            if (e.message && (e.message.includes('URL') || e.message.includes('phân tích') || e.message.includes('analysis'))) {
              throw e;
            }
          }
        }
      }
    }
    return finalResult;
  } catch (error) {
    throw new Error(error.message || 'Lỗi khi kết nối hoặc đọc luồng dữ liệu phân tích thời gian thực');
  }
};

export const scrapeSPASidebar = async (params) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/scrape-spa-sidebar`, params);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response?.data?.error || 
        `Server error: ${error.response.status} ${error.response.statusText}`
      );
    } else if (error.request) {
      throw new Error(
        'Không thể kết nối đến server. Vui lòng đảm bảo backend server đang chạy trên port 3002.'
      );
    } else {
      throw new Error(error.message || 'Failed to scrape SPA sidebar');
    }
  }
};

export const testSelector = async (url, selector, type) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/test-selector`, {
      url,
      selector,
      type
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response?.data?.error || 
        `Server error: ${error.response.status} ${error.response.statusText}`
      );
    } else if (error.request) {
      throw new Error(
        'Không thể kết nối đến server. Vui lòng đảm bảo backend server đang chạy trên port 3002.'
      );
    } else {
      throw new Error(error.message || 'Failed to test selector');
    }
  }
};

export const parseSitemap = async (sitemapUrl) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/parse-sitemap`, {
      sitemapUrl
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response?.data?.error || 
        `Server error: ${error.response.status} ${error.response.statusText}`
      );
    } else if (error.request) {
      throw new Error(
        'Không thể kết nối đến server. Vui lòng đảm bảo backend server đang chạy trên port 3002.'
      );
    } else {
      throw new Error(error.message || 'Failed to parse sitemap');
    }
  }
};

export const fetchNsoCategories = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/nso/categories`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Failed to fetch NSO categories');
  }
};

export const fetchNsoPxWebTables = async (categoryUrl, categoryDbid) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/nso/pxweb-tables`, {
      params: { categoryUrl, categoryDbid }
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Failed to fetch PX-Web tables');
  }
};

export const scrapeNsoPxTable = async (pxUrl, maxItemsPerVariable) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/nso/scrape-px-table`, {
      pxUrl,
      maxItemsPerVariable
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Failed to scrape PX-Web table');
  }
};

export const scrapeNsoArticles = async (categoryUrl, maxArticles) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/nso/scrape-articles`, {
      categoryUrl,
      maxArticles
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Failed to scrape category articles');
  }
};

export const scrapeNsoUrl = async (url) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/nso/scrape-url`, { url });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Failed to scrape NSO URL');
  }
};

// Google Drive API Services
export const getDriveStatus = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/drive/status`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Failed to check Drive status');
  }
};

export const uploadToDrive = async ({ fileName, content, mimeType }) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/drive/upload`, {
      fileName,
      content,
      mimeType
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Failed to upload to Google Drive');
  }
};

export const saveDriveConfig = async (config) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/drive/config`, config);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Failed to save Drive config');
  }
};

// OCR Scanner Services
export const checkOcrStatus = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/ocr/status`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Failed to check OCR status');
  }
};

export const scanOcrFile = async (file, options = {}) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (options.langs) formData.append('langs', options.langs);
    if (options.forceOcr) formData.append('forceOcr', options.forceOcr);
    if (options.engine) formData.append('engine', options.engine);
    if (options.isHandwritten) formData.append('isHandwritten', options.isHandwritten);

    const response = await axios.post(`${API_BASE_URL}/ocr/scan`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 180000 // 3 minutes timeout for large PDFs
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Lỗi khi quét OCR file');
  }
};

// ===============================================
// Lu quét & Sạt lở đất (luquetsatlo.nchmf.gov.vn)
// Tự động fallback gọi trực tiếp NCHMF khi deploy static trên Firebase
// ===============================================
import {
  fetchDirectProvinces,
  fetchDirectCanhBao,
  fetchDirectDiemDaXayRaSatLo,
  fetchDirectDiemDaXayRaLuQuet,
  fetchDirectTrongDiemSLLQ,
  fetchDirectRadar,
  fetchDirectTramMua,
  fetchDirectDoAmDat
} from './nchmfClientService.js';


export const fetchLuquetSatloProvinces = async () => {
  if (isStaticHosting) {
    return await fetchDirectProvinces();
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/luquet-satlo/provinces`);
    if (isHtmlResponse(response.data) || !response.data?.success) {
      throw new Error('Backend returned HTML (Firebase static hosting)');
    }
    return response.data;
  } catch (error) {
    console.info('[NCHMF] Fallback gọi trực tiếp NCHMF API cho danh sách tỉnh');
    return await fetchDirectProvinces();
  }
};

export const fetchLuquetSatloCanhBao = async ({ date, sogiodubao = 6, autoFallback = true } = {}) => {
  if (isStaticHosting) {
    return await fetchDirectCanhBao({ date, sogiodubao, autoFallback });
  }
  try {
    const response = await axios.post(`${API_BASE_URL}/luquet-satlo/canh-bao`, {
      date,
      sogiodubao,
      autoFallback
    });
    if (isHtmlResponse(response.data) || !response.data?.success) {
      throw new Error('Backend returned HTML (Firebase static hosting)');
    }
    return response.data;
  } catch (error) {
    console.info('[NCHMF] Fallback gọi trực tiếp NCHMF API cho dữ liệu cảnh báo');
    return await fetchDirectCanhBao({ date, sogiodubao, autoFallback });
  }
};

export const fetchLuquetSatloDiemSatLo = async ({ provinceId } = {}) => {
  if (isStaticHosting) {
    return await fetchDirectDiemDaXayRaSatLo();
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/luquet-satlo/diem-sat-lo`, {
      params: provinceId ? { provinceId } : {}
    });
    if (isHtmlResponse(response.data) || !response.data?.success) {
      throw new Error('Backend returned HTML');
    }
    return response.data;
  } catch (error) {
    return await fetchDirectDiemDaXayRaSatLo();
  }
};

export const fetchLuquetSatloTramMua = async ({ thoigian } = {}) => {
  if (isStaticHosting) {
    return await fetchDirectTramMua({ thoigian });
  }
  try {
    const response = await axios.post(`${API_BASE_URL}/luquet-satlo/tram-mua`, { thoigian });
    if (isHtmlResponse(response.data) || !response.data?.success) {
      throw new Error('Backend returned HTML');
    }
    return response.data;
  } catch (error) {
    console.info('[NCHMF] Fallback gọi trực tiếp NCHMF API cho trạm đo mưa');
    return await fetchDirectTramMua({ thoigian });
  }
};

export const fetchLuquetSatloDoAmDat = async ({ thoigian, typeHienThi, typeCanhBao } = {}) => {
  if (isStaticHosting) {
    return await fetchDirectDoAmDat({ thoigian, typeHienThi, typeCanhBao });
  }
  try {
    const response = await axios.post(`${API_BASE_URL}/luquet-satlo/do-am-dat`, {
      thoigian,
      typeHienThi,
      typeCanhBao
    });
    if (isHtmlResponse(response.data) || !response.data?.success) {
      throw new Error('Backend returned HTML');
    }
    return response.data;
  } catch (error) {
    console.info('[NCHMF] Fallback gọi trực tiếp NCHMF API cho độ ẩm đất');
    return await fetchDirectDoAmDat({ thoigian, typeHienThi, typeCanhBao });
  }
};

export const fetchLuquetSatloDiemDaXayRaSatLo = async ({ provinceName } = {}) => {
  if (isStaticHosting) {
    return await fetchDirectDiemDaXayRaSatLo({ provinceName });
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/luquet-satlo/diem-da-xay-ra-sat-lo`, {
      params: provinceName ? { provinceName } : {}
    });
    if (isHtmlResponse(response.data) || !response.data?.success) {
      throw new Error('Backend returned HTML');
    }
    return response.data;
  } catch (error) {
    console.info('[NCHMF] Fallback gọi trực tiếp NCHMF API cho điểm sạt lở');
    return await fetchDirectDiemDaXayRaSatLo({ provinceName });
  }
};

export const fetchLuquetSatloDiemDaXayRaLuQuet = async ({ provinceName } = {}) => {
  if (isStaticHosting) {
    return await fetchDirectDiemDaXayRaLuQuet({ provinceName });
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/luquet-satlo/diem-da-xay-ra-lu-quet`, {
      params: provinceName ? { provinceName } : {}
    });
    if (isHtmlResponse(response.data) || !response.data?.success) {
      throw new Error('Backend returned HTML');
    }
    return response.data;
  } catch (error) {
    console.info('[NCHMF] Fallback gọi trực tiếp NCHMF API cho điểm lũ quét');
    return await fetchDirectDiemDaXayRaLuQuet({ provinceName });
  }
};

export const fetchLuquetSatloTrongDiemSLLQ = async ({ provinceName } = {}) => {
  if (isStaticHosting) {
    return await fetchDirectTrongDiemSLLQ({ provinceName });
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/luquet-satlo/trong-diem-sllq`, {
      params: provinceName ? { provinceName } : {}
    });
    if (isHtmlResponse(response.data) || !response.data?.success) {
      throw new Error('Backend returned HTML');
    }
    return response.data;
  } catch (error) {
    console.info('[NCHMF] Fallback gọi trực tiếp NCHMF API cho trọng điểm SLLQ');
    return await fetchDirectTrongDiemSLLQ({ provinceName });
  }
};

export const fetchLuquetSatloRadar = async ({ date } = {}) => {
  if (isStaticHosting) {
    return await fetchDirectRadar({ date });
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/luquet-satlo/radar`, {
      params: date ? { date } : {}
    });
    if (isHtmlResponse(response.data) || !response.data?.success) {
      throw new Error('Backend returned HTML');
    }
    return response.data;
  } catch (error) {
    console.info('[NCHMF] Fallback gọi trực tiếp NCHMF API cho dữ liệu radar');
    return await fetchDirectRadar({ date });
  }
};

/**
 * Tạo URL Proxy có CORS cho ảnh Radar nạp vào WebGL canvas của MapLibre
 */
export const getRadarProxyUrl = (originalUrl) => {
  if (!originalUrl) return '';
  if (typeof window === 'undefined') return originalUrl;
  
  // 1. Nếu có backend (Node dev hoặc Render)
  if (API_BASE_URL && (API_BASE_URL.startsWith('http') || API_BASE_URL.startsWith('/api'))) {
    return `${API_BASE_URL}/luquet-satlo/radar-proxy?url=${encodeURIComponent(originalUrl)}`;
  }
  
  // 2. Fallback CORS proxy cho static hosting
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`;
};

export const triggerServerAutoSync = async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}/luquet-satlo/sync-now`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Không thể kích hoạt quét từ server');
  }
};

export const getServerAutoSyncStatus = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/luquet-satlo/sync-status`);
    return response.data;
  } catch (error) {
    return { success: false, data: null };
  }
};

// ============================================================================
// TYPHOON TRACKING & ANALYSIS (THEO DÕI & PHÂN TÍCH BÃO)
// ============================================================================

export const getActiveTyphoons = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/typhoon/active`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Không thể lấy danh sách bão đang hoạt động');
  }
};

export const getStormDetails = async (id, params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/typhoon/storm/${id}`, { params });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || `Không thể tải dữ liệu bão ${id}`);
  }
};

export const uploadTyphoonKmz = async (file, stormName = '') => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (stormName) formData.append('stormName', stormName);

    const response = await axios.post(`${API_BASE_URL}/typhoon/upload-kmz`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Lỗi khi tải lên và phân tích file KMZ');
  }
};

export const getHistoricalLandfalls = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/typhoon/historical`, { params });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Không thể lấy dữ liệu bão lịch sử');
  }
};

export const getTyphoonProvinceMetrics = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/typhoon/province-metrics`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Không thể lấy thống kê bão theo tỉnh');
  }
};

export const getTyphoonPresets = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/typhoon/presets`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Không thể lấy danh sách bão mẫu');
  }
};

