import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeLinks, scrapeLinksByClicking, scrapeDataBySelectors, previewPageStructure, analyzePageStructure, executeDynamicScrape, executeRecursiveScrape, scrapeSPASidebarContent, testSelector, executeIdLoopScrape, parseSitemap, executeListScrape, getNsoCategories, getNsoCategoryTables, scrapeNsoPxWebTable, scrapeNsoCategoryArticles, scrapeNsoCustomUrl } from './scraper.js';
import { extractMultipleContents } from './contentExtractor.js';
import { uploadToDrive, getDriveStatus, saveDriveConfig } from './driveService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Production: serve static frontend (built by Dockerfile)
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));
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


// SPA fallback: serve index.html for non-API routes (production)
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public');
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
