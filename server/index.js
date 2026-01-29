import express from 'express';
import cors from 'cors';
import { scrapeLinks, scrapeLinksByClicking } from './scraper.js';
import { extractMultipleContents } from './contentExtractor.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
