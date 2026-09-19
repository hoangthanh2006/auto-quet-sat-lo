import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { scrapeLinks, scrapeLinksByClicking, scrapeDataBySelectors, previewPageStructure, analyzePageStructure, executeDynamicScrape, executeRecursiveScrape, scrapeSPASidebarContent, testSelector, executeIdLoopScrape, parseSitemap, executeListScrape, getNsoCategories, getNsoCategoryTables, scrapeNsoPxWebTable, scrapeNsoCategoryArticles, scrapeNsoCustomUrl } from './scraper.js';
import { extractMultipleContents } from './contentExtractor.js';
import { uploadToDrive, getDriveStatus, saveDriveConfig } from './driveService.js';
import { executeOcrScan, getOcrStatus } from './ocrService.js';
import { getProvinces, getCanhbaoSLLQ, getDiemSatLo, getTramMua, getDoAmDat, getDiemDaXayRaSatLo, getDiemDaXayRaLuQuet, getTrongDiemSLLQ, getRadarData } from './luquetSatloService.js';
import { runAutoSyncOnce, startHourlyAutoSync, getSchedulerStatus, stopHourlyAutoSync } from './autoSyncNCHMF.js';
import { 
  fetchActiveTyphoons, 
  parseKmzBuffer, 
  parseTextWarningToGeoJson, 
  analyzeStormGeoJson, 
  getProvinceMetrics, 
  getHistoricalLandfalls,
  HISTORICAL_PRESETS,
  generatePresetGeoJson
} from './typhoonService.js';
import {
  crawlLakeWater,
  crawlRiverWater,
  crawlLandslideWarnings,
  getEnvironmentalHubSummary
} from './environmentalService.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend (checks client/dist when running locally, or public folder when in Docker)
const clientDistPath = path.resolve(__dirname, '../client/dist');
const serverPublicPath = path.resolve(__dirname, 'public');
const staticPath = fs.existsSync(clientDistPath) ? clientDistPath : serverPublicPath;

if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Main scraping endpoint
app.post('/api/scan-links', async (req, res) => {
  try {
    const { clickLink, linkSelector, linkText, khoaNumber, customUrl } = req.body;
    
    let links;
    
    // If custom URL is provided, use it directly (no clicking)
    if (customUrl && customUrl.trim()) {
      const targetUrl = customUrl.trim();
      console.log(`Scraping links from custom URL: ${targetUrl}`);
      links = await scrapeLinks(targetUrl);
    } else if (clickLink && khoaNumber && khoaNumber !== 14) {
      // Scrape by clicking on a navigation link for specific khóa
      const baseUrl = 'https://daihoidang.vn/uy-vien-trung-uong.html';
      const selector = linkSelector || '.dhd-prev.directioncontrol, .dhd-next.directioncontrol';
      const text = linkText || `Đại hội Đảng lần thứ ${khoaNumber === 13 ? 'XIII' : 'XII'}`;
      
      console.log(`Scraping links by clicking for khóa ${khoaNumber}: ${text}`);
      links = await scrapeLinksByClicking(baseUrl, selector, text);
    } else {
      // Regular scraping from current page (Khóa XIV - default)
      const targetUrl = 'https://daihoidang.vn/uy-vien-trung-uong.html';
      links = await scrapeLinks(targetUrl);
    }
    
    res.json({
      success: true,
      data: links,
      count: links.length
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to scrape links'
    });
  }
});

// Parse sitemap XML to extract URLs
app.post('/api/parse-sitemap', async (req, res) => {
  try {
    const { sitemapUrl } = req.body;
    if (!sitemapUrl || typeof sitemapUrl !== 'string' || sitemapUrl.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Sitemap URL is required'
      });
    }
    
    console.log(`Parsing sitemap: ${sitemapUrl}`);
    const urls = await parseSitemap(sitemapUrl.trim());
    res.json({
      success: true,
      urls,
      count: urls.length
    });
  } catch (error) {
    console.error('Sitemap parsing error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse sitemap'
    });
  }
});

// Extract content from profile pages
app.post('/api/extract-content', async (req, res) => {
  try {
    console.log('Received extract-content request:', req.body);
    const { urls, customSelector } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      console.log('Invalid request: URLs array is required');
      return res.status(400).json({
        success: false,
        error: 'URLs array is required'
      });
    }

    console.log(`Extracting content from ${urls.length} URLs${customSelector ? ` with custom selector: ${customSelector}` : ''}...`);
    const results = await extractMultipleContents(urls, customSelector);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    res.json({
      success: true,
      data: results,
      stats: {
        total: results.length,
        successful: successful.length,
        failed: failed.length
      }
    });
  } catch (error) {
    console.error('Content extraction error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract content'
    });
  }
});

// Custom scraping endpoint with dynamic selectors
app.post('/api/scrape-custom', async (req, res) => {
  try {
    console.log('Received scrape-custom request:', req.body);
    const { url, selectors } = req.body;
    
    // Validate URL
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'URL is required and must be a valid string'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    // Validate selectors
    if (!selectors || !Array.isArray(selectors) || selectors.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Selectors array is required and must not be empty'
      });
    }

    // Validate selector format
    for (const selector of selectors) {
      if (!selector.label || !selector.selector) {
        return res.status(400).json({
          success: false,
          error: 'Each selector must have both "label" and "selector" properties'
        });
      }
    }

    console.log(`Scraping data from ${url} with ${selectors.length} selectors...`);
    const data = await scrapeDataBySelectors(url, selectors);
    
    res.json({
      success: true,
      data: data,
      url: url,
      selectorsCount: selectors.length
    });
  } catch (error) {
    console.error('Custom scraping error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to scrape data'
    });
  }
});

// Preview page structure endpoint
app.post('/api/preview-structure', async (req, res) => {
  try {
    console.log('Received preview-structure request:', req.body);
    const { url } = req.body;
    
    // Validate URL
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'URL is required and must be a valid string'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    console.log(`Analyzing page structure at ${url}...`);
    const suggestions = await previewPageStructure(url);
    
    res.json({
      success: true,
      data: suggestions,
      url: url,
      count: suggestions.length
    });
  } catch (error) {
    console.error('Page structure analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze page structure'
    });
  }
});

// Analyze page structure endpoint (Bước 1)
app.post('/api/analyze-page', async (req, res) => {
  try {
    console.log('Received analyze-page request:', req.body);
    const { url } = req.body;
    
    // Validate URL
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'URL is required and must be a valid string'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    console.log(`Analyzing page structure at ${url}...`);
    const analysis = await analyzePageStructure(url);
    
    res.json({
      success: true,
      data: analysis,
      url: url
    });
  } catch (error) {
    console.error('Page analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze page'
    });
  }
});

// Analyze page structure streaming endpoint (Real-time logs for Step 1)
app.post('/api/analyze-page-stream', async (req, res) => {
  // Set headers for streaming chunked response
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Cache-Control', 'no-cache');

  const sendLog = (message) => {
    res.write(JSON.stringify({ type: 'log', message }) + '\n');
  };

  try {
    const { url } = req.body;

    // Validate URL
    if (!url || typeof url !== 'string' || url.trim() === '') {
      res.write(JSON.stringify({ type: 'log', message: '❌ Lỗi: URL không hợp lệ.' }) + '\n');
      res.write(JSON.stringify({ type: 'error', error: 'URL is required' }) + '\n');
      return res.end();
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      res.write(JSON.stringify({ type: 'log', message: '❌ Lỗi: Định dạng URL sai.' }) + '\n');
      res.write(JSON.stringify({ type: 'error', error: 'Invalid URL format' }) + '\n');
      return res.end();
    }

    console.log(`Streaming page structure analysis at ${url}...`);
    const analysis = await analyzePageStructure(url, sendLog);

    res.write(JSON.stringify({ type: 'result', data: analysis }) + '\n');
    res.end();
  } catch (error) {
    console.error('Streaming page analysis error:', error);
    res.write(JSON.stringify({ type: 'log', message: `❌ Lỗi phân tích: ${error.message}` }) + '\n');
    res.write(JSON.stringify({ type: 'error', error: error.message || 'Failed to analyze page structure' }) + '\n');
    res.end();
  }
});

// Execute dynamic scrape endpoint (Bước 3)
app.post('/api/execute-scrape', async (req, res) => {
  try {
    console.log('Received execute-scrape request:', req.body);
    const { url, config, crawlMode = 'single', maxDepth = 1, maxLinks = 20, urlFilter = '' } = req.body;
    
    // Validate URL/URLs based on mode
    if (crawlMode !== 'list') {
      if (!url || typeof url !== 'string' || url.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'URL is required and must be a valid string'
        });
      }
      try {
        new URL(url);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL format'
        });
      }
    } else {
      const { urls } = req.body;
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'urls array is required for list mode and must not be empty'
        });
      }
    }

    // Validate config
    if (!config || !Array.isArray(config) || config.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Config must be a non-empty array'
      });
    }

    // Validate each config item
    for (let i = 0; i < config.length; i++) {
      const item = config[i];
      if (!item.label || !item.selector || !item.type) {
        return res.status(400).json({
          success: false,
          error: `Config item ${i + 1} must have label, selector, and type`
        });
      }
      if (!['text', 'link', 'image', 'api', 'click_content'].includes(item.type.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: `Config item ${i + 1}: Invalid type "${item.type}". Must be 'text', 'link', 'image', 'api', or 'click_content'`
        });
      }
    }

    let results;
    if (crawlMode === 'id_loop') {
      const { startId, endId, concurrency, scrapeMethod, delayMs } = req.body;
      console.log(`Executing ID loop scrape at ${url} from ${startId} to ${endId} (method: ${scrapeMethod}, concurrency: ${concurrency})...`);
      results = await executeIdLoopScrape(url, startId, endId, config, null, { concurrency, scrapeMethod, delayMs });
    } else if (crawlMode === 'multi' && maxDepth > 1) {
      console.log(`Executing recursive scrape at ${url} with depth ${maxDepth}, maxLinks ${maxLinks}, filter "${urlFilter}"...`);
      results = await executeRecursiveScrape(url, config, { maxDepth, maxLinks, urlFilter });
    } else if (crawlMode === 'list') {
      const { urls, concurrency, delayMs } = req.body;
      console.log(`Executing list scrape for ${urls.length} URLs (concurrency: ${concurrency})...`);
      results = await executeListScrape(urls, config, null, { concurrency, delayMs });
    } else {
      console.log(`Executing dynamic scrape at ${url} with ${config.length} fields...`);
      results = await executeDynamicScrape(url, config);
    }
    
    res.json({
      success: true,
      data: results,
      url: url || '',
      rowCount: results.length,
      fieldCount: config.length
    });
  } catch (error) {
    console.error('Dynamic scrape execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute dynamic scrape'
    });
  }
});

// Execute dynamic scrape streaming endpoint (Real-time logs)
app.post('/api/execute-scrape-stream', async (req, res) => {
  // Set headers for streaming chunked response
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Cache-Control', 'no-cache');

  const sendLog = (message) => {
    res.write(JSON.stringify({ type: 'log', message }) + '\n');
  };

  try {
    const { url, config, crawlMode = 'single', maxDepth = 1, maxLinks = 20, urlFilter = '' } = req.body;

    // Validate URL/URLs based on mode
    if (crawlMode !== 'list') {
      if (!url || typeof url !== 'string' || url.trim() === '') {
        res.write(JSON.stringify({ type: 'log', message: '❌ Lỗi: URL không hợp lệ.' }) + '\n');
        res.write(JSON.stringify({ type: 'error', error: 'URL is required' }) + '\n');
        return res.end();
      }
    } else {
      const { urls } = req.body;
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        res.write(JSON.stringify({ type: 'log', message: '❌ Lỗi: Danh sách URLs trống.' }) + '\n');
        res.write(JSON.stringify({ type: 'error', error: 'urls array is empty' }) + '\n');
        return res.end();
      }
    }

    // Validate config
    if (!config || !Array.isArray(config) || config.length === 0) {
      res.write(JSON.stringify({ type: 'log', message: '❌ Lỗi: Cấu hình Selector trống.' }) + '\n');
      res.write(JSON.stringify({ type: 'error', error: 'Config must be a non-empty array' }) + '\n');
      return res.end();
    }

    let results;
    if (crawlMode === 'id_loop') {
      const { startId, endId, concurrency, scrapeMethod, delayMs } = req.body;
      results = await executeIdLoopScrape(url, startId, endId, config, sendLog, { concurrency, scrapeMethod, delayMs });
    } else if (crawlMode === 'multi' && maxDepth > 1) {
      results = await executeRecursiveScrape(url, config, { maxDepth, maxLinks, urlFilter }, sendLog);
    } else if (crawlMode === 'list') {
      const { urls, concurrency, delayMs } = req.body;
      results = await executeListScrape(urls, config, sendLog, { concurrency, delayMs });
    } else {
      results = await executeDynamicScrape(url, config, sendLog);
    }

    res.write(JSON.stringify({ type: 'result', data: results }) + '\n');
    res.end();
  } catch (error) {
    console.error('Streaming scrape error:', error);
    res.write(JSON.stringify({ type: 'log', message: `❌ Lỗi nghiêm trọng: ${error.message}` }) + '\n');
    res.write(JSON.stringify({ type: 'error', error: error.message || 'Failed to execute streaming scrape' }) + '\n');
    res.end();
  }
});

// SPA Sidebar: click từng list item, đợi sidebar cập nhật, lấy nội dung theo data-id
app.post('/api/scrape-spa-sidebar', async (req, res) => {
  try {
    const { url, listSelector, idAttribute, sidebarSelector, detailSelector, waitAfterClick } = req.body;

    if (!url || typeof url !== 'string' || url.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    const options = {};
    if (listSelector && typeof listSelector === 'string') options.listSelector = listSelector.trim();
    if (idAttribute && typeof idAttribute === 'string') options.idAttribute = idAttribute.trim();
    if (sidebarSelector && typeof sidebarSelector === 'string') options.sidebarSelector = sidebarSelector.trim();
    if (detailSelector && typeof detailSelector === 'string') options.detailSelector = detailSelector.trim();
    if (typeof waitAfterClick === 'number' && waitAfterClick > 0) options.waitAfterClick = waitAfterClick;

    const results = await scrapeSPASidebarContent(url, options);

    res.json({
      success: true,
      data: results,
      url,
      count: results.length
    });
  } catch (error) {
    console.error('SPA sidebar scrape error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'SPA sidebar scrape failed'
    });
  }
});

// Test selector endpoint
app.post('/api/test-selector', async (req, res) => {
  try {
    const { url, selector, type } = req.body;
    if (!url || !selector || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: url, selector, type'
      });
    }
    console.log(`Testing selector "${selector}" of type "${type}" on URL: ${url}`);
    const result = await testSelector(url, selector, type);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Selector test error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test selector'
    });
  }
});

// NSO.GOV.VN Scraping Endpoints
app.get('/api/nso/categories', (req, res) => {
  try {
    const categories = getNsoCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/nso/pxweb-tables', async (req, res) => {
  try {
    const { categoryUrl, categoryDbid } = req.query;
    const urlToFetch = categoryUrl || 'https://www.nso.gov.vn/dan-so/';
    const tables = await getNsoCategoryTables(urlToFetch);
    res.json({ success: true, data: tables, count: tables.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/nso/scrape-px-table', async (req, res) => {
  try {
    const { pxUrl, maxItemsPerVariable } = req.body;
    if (!pxUrl) {
      return res.status(400).json({ success: false, error: 'pxUrl is required' });
    }
    const tableData = await scrapeNsoPxWebTable(pxUrl, { maxItemsPerVariable });
    res.json({ success: true, data: tableData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/nso/scrape-articles', async (req, res) => {
  try {
    const { categoryUrl, maxArticles } = req.body;
    if (!categoryUrl) {
      return res.status(400).json({ success: false, error: 'categoryUrl is required' });
    }
    const articles = await scrapeNsoCategoryArticles(categoryUrl, maxArticles || 20);
    res.json({ success: true, data: articles, count: articles.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/nso/scrape-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'url is required' });
    }
    const data = await scrapeNsoCustomUrl(url);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Google Drive API Integration Endpoints
app.get('/api/drive/status', (req, res) => {
  try {
    const status = getDriveStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/drive/upload', async (req, res) => {
  try {
    const { fileName, content, mimeType } = req.body;
    if (!fileName || content === undefined) {
      return res.status(400).json({ success: false, error: 'fileName and content are required' });
    }
    const result = await uploadToDrive({ fileName, content, mimeType: mimeType || 'text/csv' });
    res.json(result);
  } catch (error) {
    console.error('Drive upload endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/drive/config', (req, res) => {
  try {
    const { credentials, rootFolderId } = req.body;
    const result = saveDriveConfig({ credentials, rootFolderId });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Configure Multer for OCR File Uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'ocr-' + uniqueSuffix + ext);
  }
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// OCR API Endpoints
app.get('/api/ocr/status', async (req, res) => {
  try {
    const status = await getOcrStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ocr/scan', uploadMiddleware.single('file'), async (req, res) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'File is required' });
    }

    tempFilePath = req.file.path;
    const { langs, forceOcr, engine, isHandwritten } = req.body;

    console.log(`Received OCR file scan request: ${req.file.originalname} (${req.file.size} bytes)`);

    const result = await executeOcrScan(tempFilePath, {
      langs: langs || 'vi,en',
      forceOcr: forceOcr === 'true' || forceOcr === true,
      engine: engine || 'auto',
      isHandwritten: isHandwritten === 'true' || isHandwritten === true
    });

    res.json(result);
  } catch (error) {
    console.error('OCR scan endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlink(tempFilePath, () => {});
    }
  }
});

// ==========================================
// Lu quét & Sạt lở đất (NCHMF) API Endpoints
// ==========================================

// 1. Danh sách 34 tỉnh trọng điểm
app.get('/api/luquet-satlo/provinces', async (req, res) => {
  try {
    const provinces = await getProvinces();
    res.json({ success: true, data: provinces, count: provinces.length });
  } catch (error) {
    console.error('API /api/luquet-satlo/provinces error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Cảnh báo Lũ quét & Sạt lở đất theo Xã/Huyện
app.post('/api/luquet-satlo/canh-bao', async (req, res) => {
  try {
    const { date, sogiodubao, autoFallback } = req.body;
    const result = await getCanhbaoSLLQ({
      date,
      sogiodubao: sogiodubao ? Number(sogiodubao) : 6,
      autoFallback: autoFallback !== false
    });
    res.json(result);
  } catch (error) {
    console.error('API /api/luquet-satlo/canh-bao error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Cơ sở dữ liệu 1.053 điểm sạt lở thực địa
app.get('/api/luquet-satlo/diem-sat-lo', async (req, res) => {
  try {
    const { provinceId } = req.query;
    const result = await getDiemSatLo({ provinceId });
    res.json(result);
  } catch (error) {
    console.error('API /api/luquet-satlo/diem-sat-lo error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Trạm đo mưa tự động toàn quốc
app.post('/api/luquet-satlo/tram-mua', async (req, res) => {
  try {
    const { thoigian } = req.body;
    const result = await getTramMua({ thoigian });
    res.json(result);
  } catch (error) {
    console.error('API /api/luquet-satlo/tram-mua error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Cảnh báo độ ẩm đất
app.post('/api/luquet-satlo/do-am-dat', async (req, res) => {
  try {
    const { thoigian, typeHienThi, typeCanhBao } = req.body;
    const result = await getDoAmDat({ thoigian, typeHienThi, typeCanhBao });
    res.json(result);
  } catch (error) {
    console.error('API /api/luquet-satlo/do-am-dat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Điểm ĐÃ XẢY RA SẠT LỞ (ht_satlo_point - 12.506 điểm)
app.get('/api/luquet-satlo/diem-da-xay-ra-sat-lo', async (req, res) => {
  try {
    const provinceName = req.query.provinceName || req.query.province || '';
    const result = await getDiemDaXayRaSatLo({ provinceName });
    res.json(result);
  } catch (error) {
    console.error('API /api/luquet-satlo/diem-da-xay-ra-sat-lo error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Điểm ĐÃ XẢY RA LŨ QUÉT (ht_luquet_point - 1.048 điểm)
app.get('/api/luquet-satlo/diem-da-xay-ra-lu-quet', async (req, res) => {
  try {
    const provinceName = req.query.provinceName || req.query.province || '';
    const result = await getDiemDaXayRaLuQuet({ provinceName });
    res.json(result);
  } catch (error) {
    console.error('API /api/luquet-satlo/diem-da-xay-ra-lu-quet error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. TRỌNG ĐIỂM SẠT LỞ LŨ QUÉT (tbl_diemnguyco - 776 trọng điểm)
app.get('/api/luquet-satlo/trong-diem-sllq', async (req, res) => {
  try {
    const provinceName = req.query.provinceName || req.query.province || '';
    const result = await getTrongDiemSLLQ({ provinceName });
    res.json(result);
  } catch (error) {
    console.error('API /api/luquet-satlo/trong-diem-sllq error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. DỮ LIỆU RADAR THỜI TIẾT
app.get('/api/luquet-satlo/radar', async (req, res) => {
  try {
    const { date } = req.query;
    const result = await getRadarData({ date });
    res.json(result);
  } catch (error) {
    console.error('API /api/luquet-satlo/radar error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. TỰ ĐỘNG QUÉT & LƯU CSDL PHỤC VỤ THỐNG KÊ (AUTO-SYNC & HOURLY SCHEDULER)
app.post('/api/luquet-satlo/sync-now', async (req, res) => {
  try {
    const { forceSave } = req.body || {};
    const result = await runAutoSyncOnce({ forceSave: forceSave !== false, source: 'manual_api_trigger' });
    res.json(result);
  } catch (error) {
    console.error('API /api/luquet-satlo/sync-now error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/luquet-satlo/scheduler-status', (req, res) => {
  try {
    const status = getSchedulerStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('API /api/luquet-satlo/scheduler-status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/luquet-satlo/scheduler-toggle', (req, res) => {
  try {
    const { enable, intervalMinutes = 60 } = req.body || {};
    let status;
    if (enable) {
      status = startHourlyAutoSync(Number(intervalMinutes) || 60);
    } else {
      status = stopHourlyAutoSync();
    }
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('API /api/luquet-satlo/scheduler-toggle error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/luquet-satlo/sync-status', async (req, res) => {
  try {
    const response = await fetch('https://anh-cao-keu-default-rtdb.asia-southeast1.firebasedatabase.app/luquet_satlo/auto_sync_status.json');
    const data = await response.json();
    const scheduler = getSchedulerStatus();
    res.json({ success: true, data, scheduler });
  } catch (error) {
    console.error('API /api/luquet-satlo/sync-status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// TYPHOON TRACKING & ANALYSIS (THEO DÕI & PHÂN TÍCH BÃO)
// ============================================================================

// 1. Danh sách bão đang hoạt động
app.get('/api/typhoon/active', async (req, res) => {
  try {
    const data = await fetchActiveTyphoons();
    res.json(data);
  } catch (error) {
    console.error('API /api/typhoon/active error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1b. Danh sách bão lịch sử mẫu tiêu biểu (Presets)
app.get('/api/typhoon/presets', (req, res) => {
  try {
    res.json({ success: true, presets: HISTORICAL_PRESETS });
  } catch (error) {
    console.error('API /api/typhoon/presets error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Chi tiết bão (theo ID, URL hoặc Preset)
app.get('/api/typhoon/storm/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { kmzUrl, textUrl, name } = req.query;

    // Kiểm tra nếu là Preset bão lịch sử
    if (id && id.startsWith('PRESET_')) {
      const preset = HISTORICAL_PRESETS.find(p => p.id === id);
      if (preset) {
        const geojson = generatePresetGeoJson(id);
        const analysis = analyzeStormGeoJson(geojson, { name: preset.name });
        return res.json({ success: true, ...analysis, isPreset: true });
      }
    }

    let targetKmz = kmzUrl;
    let targetText = textUrl;
    let stormName = name;

    // Nếu không truyền URL, tìm trong danh sách bão đang hoạt động
    if (!targetKmz && !targetText) {
      const active = await fetchActiveTyphoons();
      const matched = active.storms.find(s => s.id.toLowerCase() === id.toLowerCase() || s.name.toLowerCase() === id.toLowerCase());
      if (matched) {
        targetKmz = matched.kmzUrl;
        targetText = matched.textUrl;
        stormName = stormName || matched.name;
      }
    }

    let geojson = null;

    if (targetKmz) {
      try {
        const kmzRes = await fetch(targetKmz, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          signal: AbortSignal.timeout(15000)
        });
        if (kmzRes.ok) {
          const buffer = Buffer.from(await kmzRes.arrayBuffer());
          geojson = parseKmzBuffer(buffer, stormName);
        }
      } catch (kmzErr) {
        console.warn(`Lỗi tải KMZ bão ${id}, thử fallback sang warning text:`, kmzErr.message);
      }
    }

    if (!geojson && targetText) {
      const textRes = await fetch(targetText, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(10000)
      });
      if (textRes.ok) {
        const textContent = await textRes.text();
        geojson = parseTextWarningToGeoJson(textContent, stormName);
      }
    }

    if (!geojson) {
      return res.status(404).json({ success: false, error: `Không thể tải dữ liệu KMZ hoặc Warning Text của cơn bão ${id}` });
    }

    const analysis = analyzeStormGeoJson(geojson, { name: stormName });
    res.json({ success: true, ...analysis });
  } catch (error) {
    console.error(`API /api/typhoon/storm/${req.params.id} error:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Tải lên file KMZ/KML để phân tích
app.post('/api/typhoon/upload-kmz', uploadMiddleware.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn file KMZ để tải lên' });
    }

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    const customName = req.body.stormName || req.file.originalname.replace(/\.(kmz|kml)$/i, '').toUpperCase();

    const geojson = parseKmzBuffer(fileBuffer, customName);
    const analysis = analyzeStormGeoJson(geojson, { name: customName });

    // Dọn dẹp file tạm
    try { fs.unlinkSync(filePath); } catch {}

    res.json({ success: true, ...analysis });
  } catch (error) {
    console.error('API /api/typhoon/upload-kmz error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Danh sách bão lịch sử (1950 - nay)
app.get('/api/typhoon/historical', (req, res) => {
  try {
    const data = getHistoricalLandfalls(req.query);
    res.json({ success: true, total: data.length, data });
  } catch (error) {
    console.error('API /api/typhoon/historical error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Thống kê mức độ tổn thương theo tỉnh thành
app.get('/api/typhoon/province-metrics', (req, res) => {
  try {
    const data = getProvinceMetrics();
    res.json({ success: true, data });
  } catch (error) {
    console.error('API /api/typhoon/province-metrics error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 🌊 ENVIRONMENTAL DATA CRAWLERS APIS
// (Lake Water, River Levels, Landslide Warnings)
// ==========================================

// 1. Crawl Mực Nước Hồ Chứa (Thủy Lợi Việt Nam)
app.post('/api/environmental/lake-water', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const result = await crawlLakeWater(startDate, endDate);
    res.json(result);
  } catch (error) {
    console.error('API /api/environmental/lake-water error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Crawl Mực Nước Sông & Cảnh Báo Lũ (VNDMS)
app.post('/api/environmental/river-water', async (req, res) => {
  try {
    const { days = '7', stationIds } = req.body;
    const result = await crawlRiverWater(days, stationIds);
    res.json(result);
  } catch (error) {
    console.error('API /api/environmental/river-water error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Crawl Cảnh Báo Sạt Lở & Lũ Quét (NCHMF)
app.post('/api/environmental/landslide', async (req, res) => {
  try {
    const { mode = 'refresh', start, end, targetProvinces } = req.body;
    const result = await crawlLandslideWarnings({ mode, start, end, targetProvinces });
    res.json(result);
  } catch (error) {
    console.error('API /api/environmental/landslide error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Tổng Hợp Số Liệu Chỉ Huy Môi Trường Toàn Diện
app.get('/api/environmental/summary', async (req, res) => {
  try {
    const result = await getEnvironmentalHubSummary();
    res.json(result);
  } catch (error) {
    console.error('API /api/environmental/summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



// SPA fallback: serve index.html for non-API routes
if (fs.existsSync(path.join(staticPath, 'index.html'))) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (0.0.0.0)`);
  // Khởi động tiến trình tự động sao lưu dữ liệu NCHMF mỗi giờ 1 lần
  startHourlyAutoSync(60);
});

export default app;
export { app };
