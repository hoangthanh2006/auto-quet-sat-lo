import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeLinks, scrapeLinksByClicking, scrapeDataBySelectors, previewPageStructure, analyzePageStructure, executeDynamicScrape } from './scraper.js';
import { extractMultipleContents } from './contentExtractor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

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

// Execute dynamic scrape endpoint (Bước 3)
app.post('/api/execute-scrape', async (req, res) => {
  try {
    console.log('Received execute-scrape request:', req.body);
    const { url, config } = req.body;
    
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
      if (!['text', 'link', 'image', 'api'].includes(item.type.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: `Config item ${i + 1}: Invalid type "${item.type}". Must be 'text', 'link', 'image', or 'api'`
        });
      }
    }

    console.log(`Executing dynamic scrape at ${url} with ${config.length} fields...`);
    const results = await executeDynamicScrape(url, config);
    
    res.json({
      success: true,
      data: results,
      url: url,
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
