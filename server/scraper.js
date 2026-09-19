import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

/**
 * Scrapes profile links from daihoidang.vn
 * @param {string} url - The target URL to scrape
 * @returns {Promise<Array<{name: string, url: string}>>} Array of profile links with names
 */
export async function scrapeLinks(url) {
  let browser;
  
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      // Docker/Fly: use PUPPETEER_EXECUTABLE_PATH (Chromium). Local Mac: let Puppeteer use its own revision to avoid conflicts.
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set a reasonable viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the target URL
    console.log(`Navigating to ${url}...`);
    await page.goto(url, {
      waitUntil: ['networkidle2', 'domcontentloaded'],
      timeout: 30000
    });

    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(2000);

    // Extract all links matching the pattern
    const links = await page.evaluate(() => {
      const linkPattern = /\/nhan-su\/.*\.html$/;
      const foundLinks = [];
      const seenUrls = new Set();

      // Get all anchor tags
      const anchorTags = document.querySelectorAll('a[href]');

      anchorTags.forEach((anchor) => {
        const href = anchor.getAttribute('href');
        if (!href) return;

        // Convert relative URLs to absolute URLs
        let fullUrl;
        try {
          fullUrl = new URL(href, window.location.origin).href;
        } catch (e) {
          // If URL construction fails, skip this link
          return;
        }

        // Check if the URL matches the pattern
        if (linkPattern.test(fullUrl)) {
          // Deduplicate
          if (!seenUrls.has(fullUrl)) {
            seenUrls.add(fullUrl);
            
            // Extract name from link text (trim whitespace)
            const name = anchor.textContent?.trim() || 'Unknown';
            
            foundLinks.push({
              name: name,
              url: fullUrl
            });
          }
        }
      });

      return foundLinks;
    });

    console.log(`Found ${links.length} profile links`);
    return links;

  } catch (error) {
    console.error('Error during scraping:', error);
    throw new Error(`Scraping failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Scrapes profile links from a specific Congress session by clicking navigation link
 * @param {string} baseUrl - The base URL (e.g., https://daihoidang.vn/uy-vien-trung-uong.html)
 * @param {string} linkSelector - Selector for the link to click (e.g., '.dhd-prev.directioncontrol')
 * @param {string} linkText - Text content to match (e.g., 'Đại hội Đảng lần thứ XIII')
 * @returns {Promise<Array<{name: string, url: string}>>} Array of profile links with names
 */
export async function scrapeLinksByClicking(baseUrl, linkSelector = '.dhd-prev.directioncontrol, .dhd-next.directioncontrol', linkText = 'Đại hội Đảng lần thứ XIII') {
  let browser;
  
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      // Docker/Fly: use PUPPETEER_EXECUTABLE_PATH (Chromium). Local Mac: let Puppeteer use its own revision to avoid conflicts.
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set a reasonable viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the base URL
    console.log(`Navigating to ${baseUrl}...`);
    await page.goto(baseUrl, {
      waitUntil: ['networkidle2', 'domcontentloaded'],
      timeout: 30000
    });

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Find and click the link
    console.log(`Looking for link with selector: ${linkSelector} and text: ${linkText}...`);
    
    // Extract khóa number from linkText (e.g., "Đại hội Đảng lần thứ XIII" -> "XIII")
    const khoaMatch = linkText.match(/([IVX]+)$/);
    const khoaRoman = khoaMatch ? khoaMatch[1] : '';
    
    let linkFound = false;
    
    // Try to find all direction control links (prev/next)
    const directionLinks = await page.$$('.dhd-prev.directioncontrol, .dhd-next.directioncontrol');
    
    for (const linkHandle of directionLinks) {
      const linkInfo = await linkHandle.evaluate(el => {
        const mainText = el.textContent?.trim() || '';
        const spanText = el.querySelector('span')?.textContent?.trim() || '';
        const fullText = (mainText + ' ' + spanText).trim();
        const href = el.getAttribute('href') || '';
        return { text: fullText, href };
      });
      
      // Check if link text contains the target khóa
      if (linkInfo.text.includes(linkText) || 
          linkInfo.text.includes(`lần thứ ${khoaRoman}`) ||
          linkInfo.text.includes(`khóa ${khoaRoman}`) ||
          (khoaRoman && linkInfo.text.includes(khoaRoman))) {
        try {
          // Click the link
          await linkHandle.click();
          linkFound = true;
          console.log(`Clicked link: ${linkInfo.text}`);
          break;
        } catch (e) {
          // Try evaluating javascript if it's a javascript link
          if (linkInfo.href && linkInfo.href.startsWith('javascript:')) {
            await page.evaluate((jsCode) => {
              eval(jsCode.replace('javascript:', ''));
            }, linkInfo.href);
            linkFound = true;
            console.log('Executed javascript link');
            break;
          }
        }
      }
    }
    
    // If not found by direction controls, try finding by text in all links
    if (!linkFound) {
      const allLinks = await page.$$('a');
      for (const linkHandle of allLinks) {
        const linkInfo = await linkHandle.evaluate(el => {
          const mainText = el.textContent?.trim() || '';
          const spanText = el.querySelector('span')?.textContent?.trim() || '';
          const fullText = (mainText + ' ' + spanText).trim();
          const href = el.getAttribute('href') || '';
          return { text: fullText, href };
        });
        
        if (linkInfo.text.includes(linkText) || 
            (khoaRoman && linkInfo.text.includes(khoaRoman))) {
          try {
            await linkHandle.click();
            linkFound = true;
            console.log(`Clicked link by text: ${linkInfo.text}`);
            break;
          } catch (e) {
            if (linkInfo.href && linkInfo.href.startsWith('javascript:')) {
              await page.evaluate((jsCode) => {
                eval(jsCode.replace('javascript:', ''));
              }, linkInfo.href);
              linkFound = true;
              console.log('Executed javascript link');
              break;
            }
          }
        }
      }
    }
    
    if (!linkFound) {
      throw new Error(`Could not find link with text: ${linkText}`);
    }

    // Wait for navigation and content to load
    console.log('Waiting for page to load after click...');
    await page.waitForNavigation({ waitUntil: ['networkidle2', 'domcontentloaded'], timeout: 30000 }).catch(() => {
      console.log('Navigation might have completed, waiting a bit more...');
    });
    await page.waitForTimeout(3000);

    // Get current URL after click
    const currentUrl = page.url();
    console.log(`Current URL after click: ${currentUrl}`);

    // Extract all links matching the pattern from the new page
    const links = await page.evaluate(() => {
      const linkPattern = /\/nhan-su\/.*\.html$/;
      const foundLinks = [];
      const seenUrls = new Set();

      // Get all anchor tags
      const anchorTags = document.querySelectorAll('a[href]');

      anchorTags.forEach((anchor) => {
        const href = anchor.getAttribute('href');
        if (!href) return;

        // Convert relative URLs to absolute URLs
        let fullUrl;
        try {
          fullUrl = new URL(href, window.location.origin).href;
        } catch (e) {
          // If URL construction fails, skip this link
          return;
        }

        // Check if the URL matches the pattern
        if (linkPattern.test(fullUrl)) {
          // Deduplicate
          if (!seenUrls.has(fullUrl)) {
            seenUrls.add(fullUrl);
            
            // Extract name from link text (trim whitespace)
            const name = anchor.textContent?.trim() || 'Unknown';
            
            foundLinks.push({
              name: name,
              url: fullUrl
            });
          }
        }
      });

      return foundLinks;
    });

    console.log(`Found ${links.length} profile links from Congress session`);
    return links;

  } catch (error) {
    console.error('Error during scraping by clicking:', error);
    throw new Error(`Scraping failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Scrapes data from a URL using dynamic CSS selectors
 * @param {string} url - The target URL to scrape
 * @param {Array<{label: string, selector: string}>} config - Array of selector configs
 * @returns {Promise<Object>} Object containing scraped data with labels as keys
 */
export async function scrapeDataBySelectors(url, config) {
  let browser;
  
  try {
    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      throw new Error(`Invalid URL: ${url}`);
    }

    // Validate config
    if (!Array.isArray(config) || config.length === 0) {
      throw new Error('Config must be a non-empty array');
    }

    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set a reasonable viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the target URL
    console.log(`Navigating to ${url}...`);
    await page.goto(url, {
      waitUntil: ['networkidle2', 'domcontentloaded'],
      timeout: 30000
    });

    // Wait for dynamic content to load (using Promise instead of deprecated waitForTimeout)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Wait for selectors to appear (with timeout for each)
    const selectors = config.map(c => c.selector);
    console.log(`Waiting for selectors: ${selectors.join(', ')}`);
    
    // Wait for all selectors with individual timeouts
    await Promise.allSettled(
      selectors.map(selector => 
        page.waitForSelector(selector, { timeout: 5000 }).catch(() => {
          console.log(`Selector "${selector}" not found, will return N/A`);
        })
      )
    );

    // Extract data using all selectors
    const result = await page.evaluate((selectorConfigs) => {
      const data = {};
      
      selectorConfigs.forEach(({ label, selector }) => {
        try {
          const element = document.querySelector(selector);
          if (element) {
            // Get text content, removing extra whitespace
            const text = element.textContent?.trim() || '';
            // Also get HTML if it's useful
            const html = element.innerHTML?.trim() || '';
            
            data[label] = text || html || 'N/A';
          } else {
            data[label] = 'N/A';
          }
        } catch (error) {
          console.error(`Error extracting data for selector "${selector}":`, error);
          data[label] = 'N/A';
        }
      });
      
      return data;
    }, config);

    console.log(`Successfully scraped data from ${url}`);
    return result;

  } catch (error) {
    console.error('Error during scraping:', error);
    throw new Error(`Scraping failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Analyzes page structure and returns top 10 classes with most text content
 * @param {string} url - The target URL to analyze
 * @returns {Promise<Array<{class: string, textLength: number, sampleText: string}>>} Array of class suggestions
 */
export async function previewPageStructure(url) {
  let browser;
  
  try {
    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      throw new Error(`Invalid URL: ${url}`);
    }

    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set a reasonable viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the target URL
    console.log(`Analyzing page structure at ${url}...`);
    await page.goto(url, {
      waitUntil: ['networkidle2', 'domcontentloaded'],
      timeout: 30000
    });

    // Wait for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Analyze page structure
    const suggestions = await page.evaluate(() => {
      const classStats = new Map();
      
      // Get all elements with class attributes
      const allElements = document.querySelectorAll('[class]');
      
      allElements.forEach((element) => {
        const classes = element.className.split(/\s+/).filter(c => c.trim());
        const text = element.textContent?.trim() || '';
        const textLength = text.length;
        
        // Skip if text is too short or looks like navigation/menu
        if (textLength < 50) return;
        
        // Skip navigation elements
        const navKeywords = ['nav', 'menu', 'header', 'footer', 'sidebar', 'search'];
        const isNav = navKeywords.some(keyword => 
          element.closest('nav, header, footer') || 
          classes.some(c => c.toLowerCase().includes(keyword))
        );
        if (isNav) return;
        
        classes.forEach((className) => {
          if (!className || className.length < 2) return;
          
          if (!classStats.has(className)) {
            classStats.set(className, {
              class: className,
              textLength: 0,
              count: 0,
              sampleText: ''
            });
          }
          
          const stat = classStats.get(className);
          stat.textLength += textLength;
          stat.count += 1;
          
          // Keep longest sample text
          if (textLength > stat.sampleText.length) {
            stat.sampleText = text.substring(0, 200); // Limit sample length
          }
        });
      });
      
      // Convert to array and sort by text length
      const sorted = Array.from(classStats.values())
        .filter(item => item.textLength > 100) // Only meaningful content
        .sort((a, b) => b.textLength - a.textLength)
        .slice(0, 10) // Top 10
        .map(item => ({
          class: item.class,
          textLength: item.textLength,
          count: item.count,
          sampleText: item.sampleText.substring(0, 150) + (item.sampleText.length > 150 ? '...' : '')
        }));
      
      return sorted;
    });

    console.log(`Found ${suggestions.length} suggested classes`);
    return suggestions;

  } catch (error) {
    console.error('Error during page structure analysis:', error);
    throw new Error(`Page analysis failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Analyzes page structure to determine page type (List/Article/Table)
 * @param {string} url - The target URL to analyze
 * @param {Function} onLog - Optional callback for streaming logs
 * @returns {Promise<Object>} Analysis result with page type and potential data regions
 */
export async function analyzePageStructure(url, onLog) {
  let browser;
  
  try {
    if (onLog) onLog(`[Khởi tạo] Bắt đầu phân tích cấu trúc trang web...`);
    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      if (onLog) onLog(`❌ URL không hợp lệ: ${url}`);
      throw new Error(`Invalid URL: ${url}`);
    }

    // Launch browser
    if (onLog) onLog(`[Trình duyệt] Khởi chạy Chrome Headless...`);
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set a reasonable viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the target URL
    if (onLog) onLog(`[Tải trang] Đang điều hướng tới URL: ${url}...`);
    await page.goto(url, {
      waitUntil: ['networkidle2', 'domcontentloaded'],
      timeout: 30000
    });

    // Wait for dynamic content to load
    if (onLog) onLog(`[Chờ đợi] Đợi 2 giây để các tập lệnh động hoàn thành tải dữ liệu...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (onLog) onLog(`[Phân tích DOM] Đang thực thi mã đánh giá cấu trúc trang...`);
    // Analyze page structure
    const analysis = await page.evaluate(() => {
      const result = {
        pageType: 'unknown',
        confidence: 0,
        dataRegions: [],
        statistics: {
          headings: 0,
          articles: 0,
          tables: 0,
          lists: 0,
          contentDivs: 0,
          items: 0,
          profiles: 0
        }
      };

      // Count important elements
      const h1s = document.querySelectorAll('h1').length;
      const h2s = document.querySelectorAll('h2').length;
      const articlesCount = document.querySelectorAll('article').length;
      const tablesCount = document.querySelectorAll('table').length;
      const lists = document.querySelectorAll('ul, ol').length;
      
      // Find content divs (common patterns)
      const contentSelectorsForCount = [
        '.content', '.main-content', '.article-content',
        '.post-content', '.entry-content', '.body-content',
        '[class*="content"]', '[class*="article"]'
      ];
      
      let contentDivs = 0;
      contentSelectorsForCount.forEach(selector => {
        try {
          contentDivs += document.querySelectorAll(selector).length;
        } catch (e) {}
      });

      // Find item/profile patterns
      const itemSelectorsForCount = [
        '[class*="item"]', '[class*="card"]', '[class*="entry"]',
        '[class*="post"]', '[class*="profile"]', '[class*="list-item"]'
      ];
      
      let items = 0;
      let profiles = 0;
      itemSelectorsForCount.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const className = el.className?.toLowerCase() || '';
            if (className.includes('item') || className.includes('card') || className.includes('entry')) {
              items++;
            }
            if (className.includes('profile')) {
              profiles++;
            }
          });
        } catch (e) {}
      });

      result.statistics = {
        headings: h1s + h2s,
        articles: articlesCount,
        tables: tablesCount,
        lists: lists,
        contentDivs: contentDivs,
        items: items,
        profiles: profiles
      };

      // Determine page type based on statistics
      const totalItems = items + profiles;
      const hasTables = tablesCount > 0;
      const hasLists = lists > 0;
      const hasArticles = articlesCount > 0;
      const hasContentDivs = contentDivs > 0;
      const hasManyHeadings = (h1s + h2s) > 3;

      // Table type: Has tables and relatively few other structures
      if (hasTables && tablesCount >= 1) {
        if (tablesCount >= 2 || (tablesCount === 1 && totalItems < 5)) {
          result.pageType = 'table';
          result.confidence = Math.min(90, 60 + (tablesCount * 10));
        }
      }

      // List type: Many repeated items/cards
      if (totalItems >= 3 || hasLists) {
        if (totalItems >= 5 || (hasLists && lists >= 2)) {
          result.pageType = 'list';
          result.confidence = Math.min(95, 70 + Math.min(totalItems * 5, 25));
        }
      }

      // Article type: Has article tags, content divs, many headings, but few repeated items
      if (hasArticles || (hasContentDivs && hasManyHeadings && totalItems < 3)) {
        result.pageType = 'article';
        result.confidence = Math.min(90, 60 + (hasArticles ? 20 : 0) + (hasContentDivs ? 10 : 0));
      }

      // If still unknown, make best guess
      if (result.pageType === 'unknown') {
        if (hasTables) {
          result.pageType = 'table';
          result.confidence = 50;
        } else if (totalItems > 0) {
          result.pageType = 'list';
          result.confidence = 50;
        } else {
          result.pageType = 'article';
          result.confidence = 40;
        }
      }

      // Find potential data regions
      const regions = [];
      
      // Look for headings (h1, h2, h3)
      const headings = document.querySelectorAll('h1, h2, h3');
      headings.forEach((el) => {
        const text = el.textContent?.trim() || '';
        if (text.length > 10) {
          const className = el.className || '';
          const id = el.id || '';
          const tagName = el.tagName.toLowerCase();
          
          regions.push({
            selector: id ? `#${id}` : (className ? `.${className.split(' ')[0]}` : tagName),
            type: tagName,
            category: 'headings',
            textLength: text.length,
            sampleText: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            className: className.substring(0, 50),
            id: id,
            el: el
          });
        }
      });

      // Look for articles
      const articleElements = document.querySelectorAll('article');
      articleElements.forEach((el) => {
        const text = el.textContent?.trim() || '';
        if (text.length > 50) {
          const className = el.className || '';
          const id = el.id || '';
          
          regions.push({
            selector: id ? `#${id}` : (className ? `.${className.split(' ')[0]}` : 'article'),
            type: 'article',
            category: 'articles',
            textLength: text.length,
            sampleText: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            className: className.substring(0, 50),
            id: id,
            el: el
          });
        }
      });

      // Look for tables
      const tableElements = document.querySelectorAll('table');
      tableElements.forEach((el) => {
        const text = el.textContent?.trim() || '';
        if (text.length > 50) {
          const className = el.className || '';
          const id = el.id || '';
          
          regions.push({
            selector: id ? `#${id}` : (className ? `.${className.split(' ')[0]}` : 'table'),
            type: 'table',
            category: 'tables',
            textLength: text.length,
            sampleText: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            className: className.substring(0, 50),
            id: id,
            el: el
          });
        }
      });

      // Look for items/profiles (divs with item/card/profile classes)
      const itemSelectorListForRegions = [
        '[class*="item"]', '[class*="card"]', '[class*="entry"]',
        '[class*="post"]', '[class*="profile"]', '[class*="list-item"]'
      ];
      
      itemSelectorListForRegions.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            const text = el.textContent?.trim() || '';
            if (text.length > 50) {
              const className = el.className || '';
              const id = el.id || '';
              const tagName = el.tagName.toLowerCase();
              
              const classLower = className.toLowerCase();
              const isProfile = classLower.includes('profile');
              const category = isProfile ? 'items' : 'items';
              
              regions.push({
                selector: id ? `#${id}` : (className ? `.${className.split(' ')[0]}` : tagName),
                type: tagName,
                category: category,
                textLength: text.length,
                sampleText: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                className: className.substring(0, 50),
                id: id,
                el: el
              });
            }
          });
        } catch (e) {}
      });

      // Look for other content containers
      const contentSelectorList = [
        'main', '.content', '.main-content',
        '.article-content', '[class*="content"]'
      ];

      contentSelectorList.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            const text = el.textContent?.trim() || '';
            if (text.length > 50) {
              const className = el.className || '';
              const id = el.id || '';
              const tagName = el.tagName.toLowerCase();
              
              const alreadyAdded = regions.some(r => 
                r.id === id || (r.className === className && r.type === tagName)
              );
              
              if (!alreadyAdded) {
                let category = 'articles';
                const classLower = className.toLowerCase();
                if (classLower.includes('item') || classLower.includes('card')) {
                  category = 'items';
                }
                
                regions.push({
                  selector: id ? `#${id}` : (className ? `.${className.split(' ')[0]}` : tagName),
                  type: tagName,
                  category: category,
                  textLength: text.length,
                  sampleText: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                  className: className.substring(0, 50),
                  id: id,
                  el: el
                });
              }
            }
          });
        } catch (e) {}
      });

      // Sort by text length and take top 50 (frontend will show top 10 by default with an option to expand)
      const topRegions = regions
        .sort((a, b) => b.textLength - a.textLength)
        .slice(0, 50);

      // Assign unique index first so bestParent can reference it
      topRegions.forEach((r, idx) => {
        r.index = idx + 1;
      });

      // Determine parent-child nesting
      topRegions.forEach(nodeA => {
        let bestParent = null;
        topRegions.forEach(nodeB => {
          if (nodeA === nodeB) return;
          if (nodeB.el && nodeA.el && nodeB.el.contains(nodeA.el)) {
            if (!bestParent || (bestParent.el && bestParent.el.contains(nodeB.el))) {
              bestParent = nodeB;
            }
          }
        });
        if (bestParent) {
          nodeA.parentId = bestParent.selector;
          nodeA.parentIndex = bestParent.index;
        }
      });

      // Delete element references before serializing
      topRegions.forEach(r => {
        delete r.el;
      });

      result.dataRegions = topRegions;

      return result;
    });

    if (onLog) onLog(`[Hoàn thành] Phân tích cấu trúc hoàn tất! Phân loại trang: "${analysis.pageType}" (độ tin cậy ${analysis.confidence}%), Tìm thấy ${analysis.dataRegions.length} vùng dữ liệu triển vọng.`);
    if (onLog) onLog(`✅ Phân tích hoàn tất! Xác định loại trang: ${analysis.pageType.toUpperCase()} (Độ tin cậy: ${analysis.confidence}%)`);
    return analysis;

  } catch (error) {
    console.error('Error during page analysis with Puppeteer:', error.message);
    if (onLog) onLog(`⚠️ Trình duyệt Puppeteer gặp sự cố (${error.message}). Đang tự động chuyển sang bộ phân tích HTML Cheerio siêu tốc...`);
    try {
      return await analyzePageStructureWithCheerio(url, onLog);
    } catch (fallbackError) {
      console.error('Error during fallback page analysis:', fallbackError);
      if (onLog) onLog(`❌ Lỗi phân tích: ${fallbackError.message}`);
      throw new Error(`Page analysis failed: ${fallbackError.message}`);
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Fallback static HTML analyzer using Cheerio (zero browser/Chrome dependency)
 */
export async function analyzePageStructureWithCheerio(url, onLog) {
  if (onLog) onLog(`[HTTP Fetch] Đang tải mã nguồn HTML trực tiếp từ ${url}...`);
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    signal: AbortSignal.timeout(20000)
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  }

  const html = await resp.text();
  const $ = cheerio.load(html);

  if (onLog) onLog(`[Phân tích Cheerio] Đang bóc tách cây DOM và thống kê thẻ...`);

  const h1s = $('h1').length;
  const h2s = $('h2').length;
  const articlesCount = $('article').length;
  const tablesCount = $('table').length;
  const lists = $('ul, ol').length;

  const contentSelectors = [
    '.content', '.main-content', '.article-content',
    '.post-content', '.entry-content', '.body-content',
    '[class*="content"]', '[class*="article"]'
  ];
  let contentDivs = 0;
  contentSelectors.forEach((sel) => {
    try { contentDivs += $(sel).length; } catch (e) {}
  });

  const itemSelectors = [
    '[class*="item"]', '[class*="card"]', '[class*="entry"]',
    '[class*="post"]', '[class*="profile"]', '[class*="list-item"]'
  ];
  let items = 0;
  let profiles = 0;
  itemSelectors.forEach((sel) => {
    try {
      $(sel).each((_, el) => {
        const c = $(el).attr('class') || '';
        if (/item|card|entry/i.test(c)) items++;
        if (/profile/i.test(c)) profiles++;
      });
    } catch (e) {}
  });

  const regions = [];

  // 1. Tables
  $('table').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 50) {
      const className = $(el).attr('class') || '';
      const id = $(el).attr('id') || '';
      const rows = $(el).find('tr').length;
      regions.push({
        selector: id ? `#${id}` : (className ? `table.${className.split(' ')[0]}` : 'table'),
        type: 'table',
        category: 'tables',
        textLength: text.length,
        sampleText: text.substring(0, 100) + '...',
        className,
        id,
        rowCount: rows
      });
    }
  });

  // 2. Articles & Posts
  $('article, [class*="post"], [class*="article"], main').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 100) {
      const className = $(el).attr('class') || '';
      const id = $(el).attr('id') || '';
      const tag = el.name || 'div';
      regions.push({
        selector: id ? `#${id}` : (className ? `.${className.split(' ')[0]}` : tag),
        type: tag,
        category: 'articles',
        textLength: text.length,
        sampleText: text.substring(0, 100) + '...',
        className,
        id
      });
    }
  });

  // 3. List items
  $('ul, ol, [class*="list"]').each((_, el) => {
    const liCount = $(el).find('li').length;
    if (liCount >= 3) {
      const className = $(el).attr('class') || '';
      const id = $(el).attr('id') || '';
      const tag = el.name || 'ul';
      regions.push({
        selector: id ? `#${id}` : (className ? `.${className.split(' ')[0]}` : tag),
        type: tag,
        category: 'lists',
        textLength: $(el).text().trim().length,
        sampleText: `${liCount} phần tử danh sách`,
        className,
        id
      });
    }
  });

  const totalItems = items + profiles;
  let pageType = 'article';
  let confidence = 75;

  if (tablesCount >= 1) {
    pageType = 'table';
    confidence = 85;
  } else if (totalItems >= 3 || lists >= 2) {
    pageType = 'list';
    confidence = 85;
  } else if (articlesCount > 0 || contentDivs > 0) {
    pageType = 'article';
    confidence = 80;
  }

  const result = {
    pageType,
    confidence,
    dataRegions: regions.slice(0, 15),
    statistics: {
      headings: h1s + h2s,
      articles: articlesCount,
      tables: tablesCount,
      lists,
      contentDivs,
      items,
      profiles
    },
    engine: 'cheerio_static_html'
  };

  if (onLog) onLog(`✅ [Cheerio Fallback] Phân tích hoàn tất! Loại trang: ${pageType.toUpperCase()} (Độ tin cậy: ${confidence}%)`);
  return result;
}

/**
 * Executes dynamic scraping based on user configuration
 * @param {string} url - The target URL to scrape
 * @param {Array<{label: string, selector: string, type: string}>} config - Array of field configs
 * @returns {Promise<Array<Object>>} Array of scraped data rows (table format)
 */
export async function executeDynamicScrape(url, config, onLog) {
  let browser;
  
  try {
    if (onLog) onLog(`[Khởi tạo] Bắt đầu cào trang (Chế độ 1 cấp)...`);
    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      throw new Error(`Invalid URL: ${url}`);
    }

    // Validate config
    if (!Array.isArray(config) || config.length === 0) {
      throw new Error('Config must be a non-empty array');
    }

    // Validate each config item
    for (const item of config) {
      if (!item.label || !item.selector || !item.type) {
        throw new Error('Each config item must have label, selector, and type');
      }
      if (!['text', 'link', 'image', 'api', 'click_content'].includes(item.type.toLowerCase())) {
        throw new Error(`Invalid type: ${item.type}. Must be 'text', 'link', 'image', 'api', or 'click_content'`);
      }
    }

    // Launch browser
    if (onLog) onLog(`[Trình duyệt] Đang khởi chạy trình duyệt Puppeteer...`);
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set a reasonable viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the target URL
    const navTimeout = Number(process.env.SCRAPE_NAV_TIMEOUT) || 60000;
    if (onLog) onLog(`[Kết nối] Đang mở trang web: ${url}`);
    console.log(`Executing dynamic scrape at ${url}...`);
    try {
      await page.goto(url, {
        waitUntil: 'load',
        timeout: navTimeout
      });
    } catch (navErr) {
      // Fallback: try with domcontentloaded only (faster, less strict)
      if (navErr.message && navErr.message.includes('timeout')) {
        console.log('Load timeout, retrying with domcontentloaded...');
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: navTimeout
        });
      } else {
        throw navErr;
      }
    }

    // Wait for dynamic content (SPA, lazy load)
    if (onLog) onLog(`[Phân tích] Trang đã mở. Đang chờ 3 giây để nội dung động tải hoàn tất...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Auto-show chords on thophuong.vn or similar chord sites
    try {
      const chordBtn = await page.$('button[data-action="hidden-chord"]');
      if (chordBtn) {
        if (onLog) onLog(`[Hợp âm] Phát hiện nút hiển thị hợp âm, đang click hiển thị hợp âm...`);
        await chordBtn.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (chordErr) {
      console.log('No chords button found or click failed in executeDynamicScrape:', chordErr.message);
    }

    // Normalize selector: "thumb-art" -> ".thumb-art" (class), "myId" -> "#myId" only if looks like id
    const normalizeSelector = (sel) => {
      const s = (sel || '').trim();
      if (!s) return s;
      // Already has . # [ or contains space (compound selector) - use as-is
      if (s.startsWith('.') || s.startsWith('#') || s.startsWith('[') || s.includes(' ') || s.includes('>') || s.includes('+') || s.includes('~')) {
        return s;
      }
      // Single word: treat as class (most common for "thumb-art", "box-content", etc.)
      return '.' + s;
    };

    const normalizedConfig = config.map(c => ({ ...c, selector: normalizeSelector(c.selector) }));
    const hasClickContent = normalizedConfig.some(c => c.type.toLowerCase() === 'click_content');
    const selectors = normalizedConfig.map(c => c.selector);
    if (onLog) onLog(`[Kiểm tra] Đang kiểm tra sự tồn tại của các CSS Selector: ${selectors.join(', ')}`);
    console.log(`Waiting for selectors: ${selectors.join(', ')}`);

    await Promise.allSettled(
      selectors.map(selector =>
        page.waitForSelector(selector, { timeout: 5000 }).catch(() => {
          if (onLog) onLog(`  ⚠️ Không tìm thấy Selector: ${selector} (sẽ trả về N/A)`);
          console.log(`Selector "${selector}" not found, will return N/A`);
        })
      )
    );

    let results;

    if (hasClickContent) {
      // --- Click link → lấy nội dung trang ---
      const maxLinks = Math.min(Number(process.env.SCRAPE_MAX_CLICK_LINKS) || 30, 50);
      const navTimeout = 20000;

      const listPageData = await page.evaluate((fieldConfigs) => {
        const normalizeSelector = (sel) => {
          const s = (sel || '').trim();
          if (!s) return s;
          if (s.startsWith('.') || s.startsWith('#') || s.startsWith('[') || s.includes(' ') || s.includes('>') || s.includes('+') || s.includes('~')) return s;
          return '.' + s;
        };
        const toAbsoluteUrl = (url, base) => {
          if (!url || !base) return null;
          const cleanUrl = String(url).trim();
          if (['undefined', 'null', '', '#', 'javascript:void(0)', 'javascript:;'].includes(cleanUrl.toLowerCase())) {
            return null;
          }
          try { return new URL(cleanUrl, base).href; } catch (e) { return cleanUrl; }
        };
        const getLinkFromElement = (el, base) => {
          let href = el.getAttribute('href');
          if (href) {
            const abs = toAbsoluteUrl(href, base);
            if (abs) return abs;
          }
          const a = el.querySelector('a');
          if (a && a.getAttribute('href')) {
            const abs = toAbsoluteUrl(a.getAttribute('href'), base);
            if (abs) return abs;
          }
          const dataHref = el.getAttribute('data-href') || el.getAttribute('data-url') || el.getAttribute('data-link');
          if (dataHref) {
            const abs = toAbsoluteUrl(dataHref, base);
            if (abs) return abs;
          }
          return null;
        };
        const base = window.location.origin;
        const linkUrls = [];
        const otherFields = {};

        const clickContentConfig = fieldConfigs.find(c => c.type.toLowerCase() === 'click_content');
        if (!clickContentConfig) return { linkUrls: [], otherFields: {}, labels: [] };

        const linkSel = normalizeSelector(clickContentConfig.selector);
        const linkEls = document.querySelectorAll(linkSel);
        linkEls.forEach((el) => {
          const url = getLinkFromElement(el, base);
          if (url && !url.startsWith('javascript:')) linkUrls.push(url);
        });

        fieldConfigs.forEach(({ label, selector, type }) => {
          if (type.toLowerCase() === 'click_content') {
            otherFields[label] = []; // filled by Node after goto
            return;
          }
          const sel = normalizeSelector(selector);
          const values = [];
          try {
            const elements = document.querySelectorAll(sel);
            elements.forEach((el) => {
              const typeLower = type.toLowerCase();
              if (typeLower === 'text') values.push(el.textContent?.trim() || 'N/A');
              else if (typeLower === 'link') values.push(getLinkFromElement(el, base) || 'N/A');
              else if (typeLower === 'image') {
                const img = el.querySelector('img') || (el.tagName === 'IMG' ? el : null);
                const src = img ? (img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-url') || '') : '';
                values.push(src ? toAbsoluteUrl(src.split(',')[0].trim().split(/\s+/)[0], base) : 'N/A');
              } else values.push('N/A');
            });
          } catch (e) {}
          otherFields[label] = values;
        });

        return { linkUrls, otherFields, labels: fieldConfigs.map(c => c.label), contentSelector: clickContentConfig.contentSelector || null };
      }, normalizedConfig);

      const { linkUrls, otherFields, labels, contentSelector } = listPageData;
      const urlsToFetch = linkUrls.slice(0, maxLinks);
      const contents = [];
      if (onLog) onLog(`[Phân tích] Tìm thấy ${linkUrls.length} liên kết chi tiết. Sẽ cào tối đa ${urlsToFetch.length} liên kết...`);

      for (let i = 0; i < urlsToFetch.length; i++) {
        const u = urlsToFetch[i];
        try {
          if (onLog) onLog(`[Cào Chi Tiết ${i + 1}/${urlsToFetch.length}] Đang mở liên kết: ${u}`);
          await page.goto(u, { waitUntil: 'domcontentloaded', timeout: navTimeout });
          await new Promise(resolve => setTimeout(resolve, 1500));
          const text = await page.evaluate((contentSel) => {
            const el = contentSel ? document.querySelector(contentSel) : document.body;
            return el ? (el.innerText || el.textContent || '').trim() : '';
          }, contentSelector || null);
          contents.push(text || 'N/A');
        } catch (err) {
          if (onLog) onLog(`  ⚠️ Lỗi tải trang chi tiết: ${err.message}`);
          console.log(`Failed to fetch content from ${u}:`, err.message);
          contents.push('N/A');
        }
      }

      const clickContentLabel = normalizedConfig.find(c => c.type.toLowerCase() === 'click_content').label;
      results = urlsToFetch.map((url, i) => {
        const row = { URL: url };
        labels.forEach((label) => {
          if (label === clickContentLabel) row[label] = contents[i] != null ? contents[i] : 'N/A';
          else row[label] = (otherFields[label] && otherFields[label][i]) != null ? otherFields[label][i] : 'N/A';
        });
        return row;
      });

      if (results.length === 0) {
        const row = {};
        normalizedConfig.forEach(({ label }) => { row[label] = 'N/A'; });
        results = [row];
      }
    } else {
      // --- Extract data based on config (no click_content) ---
      if (onLog) onLog(`[Trích xuất] Đang phân tích dữ liệu trực tiếp trên trang hiện tại...`);
      results = await page.evaluate((fieldConfigs) => {
      const rows = [];

      const normalizeSelector = (sel) => {
        const s = (sel || '').trim();
        if (!s) return s;
        if (s.startsWith('.') || s.startsWith('#') || s.startsWith('[') || s.includes(' ') || s.includes('>') || s.includes('+') || s.includes('~')) {
          return s;
        }
        return '.' + s;
      };

      // Find the maximum number of matching elements across all selectors
      let maxCount = 0;
      const elementCounts = {};

      fieldConfigs.forEach(({ selector }) => {
        const sel = normalizeSelector(selector);
        try {
          const elements = document.querySelectorAll(sel);
          const count = elements.length;
          elementCounts[selector] = count;
          maxCount = Math.max(maxCount, count);
        } catch (e) {
          elementCounts[selector] = 0;
        }
      });

      // If no elements found, return single row with N/A
      if (maxCount === 0) {
        const row = {};
        fieldConfigs.forEach(({ label }) => {
          row[label] = 'N/A';
        });
        rows.push(row);
        return rows;
      }

      const toAbsoluteUrl = (url, base) => {
        if (!url || !base) return null;
        const cleanUrl = String(url).trim();
        if (['undefined', 'null', '', '#', 'javascript:void(0)', 'javascript:;'].includes(cleanUrl.toLowerCase())) {
          return null;
        }
        try {
          return new URL(cleanUrl, base).href;
        } catch (e) {
          return cleanUrl;
        }
      };

      const getLinkFromElement = (el, base) => {
        // Element is <a>
        let href = el.getAttribute('href');
        if (href) {
          const abs = toAbsoluteUrl(href, base);
          if (abs) return abs;
        }
        // Descendant <a>
        const a = el.querySelector('a');
        if (a) {
          href = a.getAttribute('href');
          if (href) {
            const abs = toAbsoluteUrl(href, base);
            if (abs) return abs;
          }
        }
        // Data attributes often used by SPAs
        const dataHref = el.getAttribute('data-href') || el.getAttribute('data-url') || el.getAttribute('data-link');
        if (dataHref) {
          const abs = toAbsoluteUrl(dataHref, base);
          if (abs) return abs;
        }
        return null;
      };

      const getImageSrcFromElement = (el, base) => {
        // Element is <img>
        let src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-lazy-src') ||
          el.getAttribute('data-url') || el.getAttribute('data-original') || el.getAttribute('data-srcset');
        if (src) {
          // data-srcset may be "url 1x, url2 2x"
          const firstUrl = src.split(',')[0].trim().split(/\s+/)[0];
          return toAbsoluteUrl(firstUrl, base);
        }
        // Descendant <img>
        const img = el.querySelector('img');
        if (img) {
          src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') ||
            img.getAttribute('data-url') || img.getAttribute('data-original');
          if (src) return toAbsoluteUrl(src, base);
          const srcset = img.getAttribute('srcset');
          if (srcset) {
            const firstUrl = srcset.split(',')[0].trim().split(/\s+/)[0];
            return toAbsoluteUrl(firstUrl, base);
          }
        }
        return null;
      };

      const base = window.location.origin;

      // Extract data for each row
      for (let i = 0; i < maxCount; i++) {
        const row = {};

        fieldConfigs.forEach(({ label, selector, type }) => {
          try {
            const sel = normalizeSelector(selector);
            const elements = document.querySelectorAll(sel);
            const element = elements[i];

            if (!element) {
              row[label] = 'N/A';
              return;
            }

            const typeLower = type.toLowerCase();

            if (typeLower === 'text') {
              const text = element.textContent?.trim() || '';
              row[label] = text || 'N/A';
            } else if (typeLower === 'link') {
              const href = getLinkFromElement(element, base);
              row[label] = href || 'N/A';
            } else if (typeLower === 'image') {
              const src = getImageSrcFromElement(element, base);
              row[label] = src || 'N/A';
            } else if (typeLower === 'api') {
              // Data attributes: data-json, data-data, data-api, data-url
              const dataAttr = element.getAttribute('data-json') ||
                element.getAttribute('data-data') ||
                element.getAttribute('data-api') ||
                element.getAttribute('data-url');
              if (dataAttr) {
                try {
                  const parsed = JSON.parse(dataAttr);
                  row[label] = typeof parsed === 'string' ? dataAttr : JSON.stringify(parsed);
                } catch (e) {
                  row[label] = dataAttr;
                }
              } else {
                const scriptTag = element.querySelector('script[type="application/json"]');
                if (scriptTag) {
                  try {
                    const jsonData = JSON.parse(scriptTag.textContent);
                    row[label] = JSON.stringify(jsonData);
                  } catch (e) {
                    row[label] = scriptTag.textContent;
                  }
                } else {
                  row[label] = 'N/A';
                }
              }
            } else {
              row[label] = 'N/A';
            }
          } catch (error) {
            console.error(`Error extracting data for "${label}":`, error);
            row[label] = 'N/A';
          }
        });

        rows.push(row);
      }

      return rows;
    }, normalizedConfig);
    }

    if (onLog) onLog(`[Hoàn thành] Đã hoàn tất trích xuất dữ liệu. Lấy được tổng cộng ${results.length} dòng.`);
    console.log(`Successfully scraped ${results.length} rows from ${url}`);
    return results;

  } catch (error) {
    console.error('Error during dynamic scraping:', error);
    throw new Error(`Dynamic scraping failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Scrape SPA: click từng list item, đợi sidebar cập nhật, lấy nội dung từ sidebar.
 * Dùng data-id (hoặc attribute tùy chọn) làm khóa để tránh trùng lặp.
 *
 * @param {string} url - URL trang SPA
 * @param {Object} options - Cấu hình
 * @param {string} [options.listSelector] - Selector phần tử đại diện nhân sự (vd: '[data-id]', '.list-item'). Mặc định: '[data-id]'
 * @param {string} [options.idAttribute] - Attribute dùng làm khóa (vd: 'data-id'). Mặc định: 'data-id'
 * @param {string} [options.sidebarSelector] - Selector sidebar chứa nội dung chi tiết. Mặc định: '.sidebar_right'
 * @param {string} [options.detailSelector] - Selector block nội dung trong sidebar (vd: '.detail1'). Mặc định: '.detail1'
 * @param {number} [options.waitAfterClick] - Ms đợi sau mỗi click. Mặc định: 800
 * @param {number} [options.timeout] - Timeout navigate. Mặc định: 30000
 * @returns {Promise<Array<{id: string, content: string, [key: string]: any}>>} Mảng đã loại trùng theo id
 */
export async function scrapeSPASidebarContent(url, options = {}) {
  const {
    listSelector = '[data-id]',
    idAttribute = 'data-id',
    sidebarSelector = '.sidebar_right',
    detailSelector = '.detail1',
    waitAfterClick = 800,
    timeout = 30000
  } = options;

  let browser;

  try {
    try {
      new URL(url);
    } catch (e) {
      throw new Error(`Invalid URL: ${url}`);
    }

    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log(`Scraping SPA sidebar at ${url}...`);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Bước 1: Xác định số lượng phần tử (re-query mỗi vòng để tránh stale element sau khi SPA cập nhật DOM)
    const getCount = async () => {
      return await page.$$eval(listSelector, (els) => els.length);
    };
    const initialCount = await getCount();
    console.log(`Found ${initialCount} elements matching "${listSelector}"`);

    if (initialCount === 0) {
      return [];
    }

    const dataByKey = new Map();
    const seenKeys = new Set();

    for (let i = 0; i < initialCount; i++) {
      const { id: rawId, key } = await page.evaluate((sel, attr, index) => {
        const els = document.querySelectorAll(sel);
        const el = els[index];
        if (!el) return { id: null, key: `index_${index}` };
        const id = el.getAttribute(attr) || el.getAttribute('data-id') || null;
        return { id, key: id != null ? String(id) : `index_${index}` };
      }, listSelector, idAttribute, i);

      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      await page.evaluate((sel, index) => {
        const els = document.querySelectorAll(sel);
        const el = els[index];
        if (el) el.click();
      }, listSelector, i);

      await new Promise(resolve => setTimeout(resolve, waitAfterClick));

      const content = await page.evaluate((sideSel, detailSel) => {
        const sidebar = document.querySelector(sideSel);
        if (!sidebar) return '';
        const detail = detailSel ? sidebar.querySelector(detailSel) : sidebar;
        if (!detail) return (sidebar.innerText || sidebar.textContent || '').trim();
        return (detail.innerText || detail.textContent || '').trim();
      }, sidebarSelector, detailSelector);

      dataByKey.set(key, {
        id: key,
        content: content || '',
        ...(rawId != null && { [idAttribute]: rawId })
      });

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const results = Array.from(dataByKey.values());
    console.log(`Scraped ${results.length} unique items (key: ${idAttribute})`);
    return results;
  } catch (error) {
    console.error('Error scraping SPA sidebar:', error);
    throw new Error(`SPA sidebar scrape failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

}

/**
 * Test a single selector on a URL and return a preview of the extracted data
 * @param {string} url - Target URL
 * @param {string} selector - CSS Selector
 * @param {string} type - 'text', 'link', 'image', etc.
 * @returns {Promise<Object>} Object containing preview result
 */
export async function testSelector(url, selector, type = 'text') {
  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Quick load
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Auto-show chords on thophuong.vn or similar chord sites
    try {
      const chordBtn = await page.$('button[data-action="hidden-chord"]');
      if (chordBtn) {
        await chordBtn.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (chordErr) {
      console.log('No chords button found or click failed in testSelector:', chordErr.message);
    }

    // Normalize selector
    const normalizeSelector = (sel) => {
      const s = (sel || '').trim();
      if (!s) return s;
      if (s.startsWith('.') || s.startsWith('#') || s.startsWith('[') || s.includes(' ') || s.includes('>') || s.includes('+') || s.includes('~')) {
        return s;
      }
      return '.' + s;
    };
    
    const normalizedSel = normalizeSelector(selector);
    
    // Wait up to 3s
    await page.waitForSelector(normalizedSel, { timeout: 3000 });

    const result = await page.evaluate((sel, selType) => {
      const element = document.querySelector(sel);
      if (!element) return { found: false, value: 'Không tìm thấy phần tử' };

      const base = window.location.origin;
      const toAbsoluteUrl = (url, base) => {
        if (!url || !base) return null;
        const cleanUrl = String(url).trim();
        if (['undefined', 'null', '', '#', 'javascript:void(0)', 'javascript:;'].includes(cleanUrl.toLowerCase())) {
          return null;
        }
        try { return new URL(cleanUrl, base).href; } catch (e) { return cleanUrl; }
      };

      const typeLower = selType.toLowerCase();
      if (typeLower === 'text') {
        return { found: true, value: element.textContent?.trim() || 'N/A' };
      } else if (typeLower === 'link') {
        let href = element.getAttribute('href');
        if (!href) {
          const a = element.querySelector('a');
          if (a) href = a.getAttribute('href');
        }
        if (!href) {
          href = element.getAttribute('data-href') || element.getAttribute('data-url') || element.getAttribute('data-link');
        }
        const abs = toAbsoluteUrl(href, base);
        return { found: true, value: abs || 'N/A' };
      } else if (typeLower === 'image') {
        let src = element.getAttribute('src') || element.getAttribute('data-src') || element.getAttribute('data-lazy-src') || element.getAttribute('data-url');
        if (!src) {
          const img = element.querySelector('img') || (element.tagName === 'IMG' ? element : null);
          if (img) src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-url');
        }
        if (src) {
          const firstUrl = src.split(',')[0].trim().split(/\s+/)[0];
          const abs = toAbsoluteUrl(firstUrl, base);
          return { found: true, value: abs || 'N/A' };
        }
        return { found: true, value: 'N/A' };
      }
      
      return { found: true, value: element.textContent?.trim() || 'N/A' };
    }, normalizedSel, type);

    return result;
  } catch (err) {
    return { found: false, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Executes recursive dynamic scraping based on user configuration and depth options
 * @param {string} startUrl - The target starting URL to scrape
 * @param {Array<{label: string, selector: string, type: string}>} config - Array of field configs
 * @param {Object} options - Scraping options
 * @param {number} [options.maxDepth] - Maximum depth levels (1 to 10)
 * @param {number} [options.maxLinks] - Maximum total links to crawl
 * @param {string} [options.urlFilter] - Substring keyword that URLs must contain to be crawled
 * @returns {Promise<Array<Object>>} Array of crawled data rows across multiple pages
 */
export async function executeRecursiveScrape(startUrl, config, options = {}, onLog) {
  const { maxDepth = 3, maxLinks = 20, urlFilter = '' } = options;
  let browser;
  
  try {
    if (onLog) onLog(`[Khởi tạo] Bắt đầu cào đệ quy (Tối đa ${maxDepth} cấp, Giới hạn ${maxLinks} trang)...`);
    // Validate URL
    try {
      new URL(startUrl);
    } catch (e) {
      throw new Error(`Invalid URL: ${startUrl}`);
    }

    // Launch browser
    if (onLog) onLog(`[Trình duyệt] Đang khởi chạy trình duyệt Puppeteer...`);
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    const navTimeout = Number(process.env.SCRAPE_NAV_TIMEOUT) || 60000;

    const startOrigin = new URL(startUrl).origin;
    
    // BFS Queue: each item is { url, depth }
    const queue = [{ url: startUrl, depth: 1 }];
    const visited = new Set();
    const allResults = [];

    // Helper to normalize selectors
    const normalizeSelector = (sel) => {
      const s = (sel || '').trim();
      if (!s) return s;
      if (s.startsWith('.') || s.startsWith('#') || s.startsWith('[') || s.includes(' ') || s.includes('>') || s.includes('+') || s.includes('~')) {
        return s;
      }
      return '.' + s;
    };
    
    const normalizedConfig = config.map(c => ({ ...c, selector: normalizeSelector(c.selector) }));

    while (queue.length > 0 && visited.size < maxLinks) {
      const { url, depth } = queue.shift();
      
      let normalizedUrl;
      try {
        const uObj = new URL(url);
        uObj.hash = '';
        normalizedUrl = uObj.href;
      } catch (e) {
        continue;
      }

      if (visited.has(normalizedUrl)) {
        continue;
      }

      if (depth > maxDepth) {
        continue;
      }

      visited.add(normalizedUrl);
      if (onLog) onLog(`[Cào Đệ Quy - Cấp ${depth}/${maxDepth}] Đang cào trang (${visited.size}/${maxLinks}): ${normalizedUrl}`);
      console.log(`[Crawl Level ${depth}/${maxDepth}] [Pages visited: ${visited.size}/${maxLinks}] Visiting: ${normalizedUrl}`);

      try {
        // Go to URL
        await page.goto(normalizedUrl, {
          waitUntil: 'load',
          timeout: navTimeout
        });
        
        // Wait for dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Wait for selectors to appear on the page (safely)
        const selectors = normalizedConfig.map(c => c.selector);
        await Promise.allSettled(
          selectors.map(selector =>
            page.waitForSelector(selector, { timeout: 3000 }).catch(() => {})
          )
        );

        // Evaluate the page to extract data and find links
        const pageData = await page.evaluate((fieldConfigs, depthVal, maxDepthVal) => {
          const rows = [];
          
          const normalizeSelector = (sel) => {
            const s = (sel || '').trim();
            if (!s) return s;
            if (s.startsWith('.') || s.startsWith('#') || s.startsWith('[') || s.includes(' ') || s.includes('>') || s.includes('+') || s.includes('~')) return s;
            return '.' + s;
          };

          const toAbsoluteUrl = (url, base) => {
            if (!url || !base) return null;
            const cleanUrl = String(url).trim();
            if (['undefined', 'null', '', '#', 'javascript:void(0)', 'javascript:;'].includes(cleanUrl.toLowerCase())) {
              return null;
            }
            try { return new URL(cleanUrl, base).href; } catch (e) { return cleanUrl; }
          };

          const getLinkFromElement = (el, base) => {
            let href = el.getAttribute('href');
            if (href) {
              const abs = toAbsoluteUrl(href, base);
              if (abs) return abs;
            }
            const a = el.querySelector('a');
            if (a) {
              href = a.getAttribute('href');
              if (href) {
                const abs = toAbsoluteUrl(href, base);
                if (abs) return abs;
              }
            }
            const dataHref = el.getAttribute('data-href') || el.getAttribute('data-url') || el.getAttribute('data-link');
            if (dataHref) {
              const abs = toAbsoluteUrl(dataHref, base);
              if (abs) return abs;
            }
            return null;
          };

          const getImageSrcFromElement = (el, base) => {
            let src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-lazy-src') || el.getAttribute('data-url');
            if (src) {
              const firstUrl = src.split(',')[0].trim().split(/\s+/)[0];
              return toAbsoluteUrl(firstUrl, base);
            }
            const img = el.querySelector('img');
            if (img) {
              src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-url');
              if (src) return toAbsoluteUrl(src, base);
              const srcset = img.getAttribute('srcset');
              if (srcset) {
                const firstUrl = srcset.split(',')[0].trim().split(/\s+/)[0];
                return toAbsoluteUrl(firstUrl, base);
              }
            }
            return null;
          };

          const base = window.location.origin;

          // 1. Extract data based on selectors
          let maxCount = 0;
          fieldConfigs.forEach(({ selector }) => {
            try {
              const count = document.querySelectorAll(normalizeSelector(selector)).length;
              maxCount = Math.max(maxCount, count);
            } catch (e) {}
          });

          if (maxCount > 0) {
            for (let i = 0; i < maxCount; i++) {
              const row = { 'Nguồn URL': window.location.href, 'Cấp cào': depthVal };
              fieldConfigs.forEach(({ label, selector, type }) => {
                try {
                  const elements = document.querySelectorAll(normalizeSelector(selector));
                  const element = elements[i];
                  if (!element) {
                    row[label] = 'N/A';
                    return;
                  }

                  const typeLower = type.toLowerCase();
                  if (typeLower === 'text') {
                    row[label] = element.textContent?.trim() || 'N/A';
                  } else if (typeLower === 'link') {
                    row[label] = getLinkFromElement(element, base) || 'N/A';
                  } else if (typeLower === 'image') {
                    row[label] = getImageSrcFromElement(element, base) || 'N/A';
                  } else if (typeLower === 'api') {
                    const dataAttr = element.getAttribute('data-json') || element.getAttribute('data-data') || element.getAttribute('data-api') || element.getAttribute('data-url');
                    if (dataAttr) {
                      try {
                        const parsed = JSON.parse(dataAttr);
                        row[label] = typeof parsed === 'string' ? dataAttr : JSON.stringify(parsed);
                      } catch (e) { row[label] = dataAttr; }
                    } else {
                      const scriptTag = element.querySelector('script[type="application/json"]');
                      if (scriptTag) {
                        try {
                          const jsonData = JSON.parse(scriptTag.textContent);
                          row[label] = JSON.stringify(jsonData);
                        } catch (e) { row[label] = scriptTag.textContent; }
                      } else {
                        row[label] = 'N/A';
                      }
                    }
                  } else {
                    row[label] = 'N/A';
                  }
                } catch (e) {
                  row[label] = 'N/A';
                }
              });
              rows.push(row);
            }
          }

          // 2. Extract links for next depth if depth < maxDepth
          const foundLinks = [];
          if (depthVal < maxDepthVal) {
            const anchors = document.querySelectorAll('a[href]');
            anchors.forEach(a => {
              const href = a.getAttribute('href');
              if (href) {
                const abs = toAbsoluteUrl(href, base);
                if (abs && !abs.startsWith('javascript:')) {
                  foundLinks.push(abs);
                }
              }
            });
          }

          return { rows, foundLinks };
        }, normalizedConfig, depth, maxDepth);

        // Add rows to global results
        if (pageData.rows && pageData.rows.length > 0) {
          allResults.push(...pageData.rows);
          if (onLog) onLog(`  ↳ Trích xuất thành công ${pageData.rows.length} dòng dữ liệu từ trang này.`);
        } else {
          if (onLog) onLog(`  ↳ Không tìm thấy dữ liệu phù hợp với Selector trên trang này.`);
        }

        // Add found links to queue for next level
        let newLinksCount = 0;
        if (pageData.foundLinks && pageData.foundLinks.length > 0) {
          for (const rawLink of pageData.foundLinks) {
            try {
              const linkUrl = new URL(rawLink);
              
              if (linkUrl.origin !== startOrigin) {
                continue;
              }
              
              linkUrl.hash = '';
              const cleanLink = linkUrl.href;

              if (urlFilter && urlFilter.trim()) {
                const filterLower = urlFilter.trim().toLowerCase();
                if (!cleanLink.toLowerCase().includes(filterLower)) {
                  continue;
                }
              }

              if (!visited.has(cleanLink) && !queue.some(item => item.url === cleanLink)) {
                queue.push({ url: cleanLink, depth: depth + 1 });
                newLinksCount++;
              }
            } catch (e) {
              // Ignore
            }
          }
        }
        if (onLog && depth < maxDepth) {
          onLog(`  ↳ Phát hiện thêm ${newLinksCount} liên kết cùng domain hợp lệ (chờ duyệt ở cấp ${depth + 1}).`);
        }

      } catch (err) {
        if (onLog) onLog(`  ⚠️ Lỗi tải trang web: ${err.message}`);
        console.error(`Error loading or scraping page: ${normalizedUrl}`, err.message);
      }
    }

    if (onLog) onLog(`[Hoàn thành] Đã cào xong đệ quy! Đã duyệt tổng cộng ${visited.size} trang, trích xuất được ${allResults.length} dòng.`);
    console.log(`Successfully completed recursive crawl. Pages crawled: ${visited.size}. Rows extracted: ${allResults.length}`);
    return allResults;

  } catch (error) {
    console.error('Error during recursive scraping:', error);
    throw new Error(`Recursive scraping failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Executes scraping on detail pages by looping through incremental IDs
 * @param {string} urlPattern - The base URL with ID query parameter (e.g. http://chinhsachquandoi.gov.vn/chi-tiet-liet-si.htm?id=)
 * @param {number} startId - Start ID
 * @param {number} endId - End ID
 * @param {Array<{label: string, selector: string, type: string}>} config - Array of field configs
 * @param {Function} onLog - Optional callback for streaming logs
 * @returns {Promise<Array<Object>>} Array of crawled data rows
 */
/**
 * Executes scraping on detail pages by looping through incremental IDs
 * Supports concurrency, Fast HTTP (Cheerio) mode, and concurrent Puppeteer pages.
 * 
 * @param {string} urlPattern - The base URL with ID query parameter (e.g. http://chinhsachquandoi.gov.vn/chi-tiet-liet-si.htm?id=)
 * @param {number} startId - Start ID
 * @param {number} endId - End ID
 * @param {Array<{label: string, selector: string, type: string}>} config - Array of field configs
 * @param {Function} onLog - Optional callback for streaming logs
 * @param {Object} options - Concurrency and scraping method configuration
 * @returns {Promise<Array<Object>>} Array of crawled data rows
 */
export async function executeIdLoopScrape(urlPattern, startId, endId, config, onLog, options = {}) {
  const {
    concurrency = 10,
    scrapeMethod = 'http',
    delayMs = 0
  } = options;

  let browser;
  const start = Number(startId);
  const end = Number(endId);
  const totalCount = end - start + 1;
  const concurrencyLimit = Math.max(1, Number(concurrency) || (scrapeMethod === 'http' ? 10 : 3));
  
  try {
    if (onLog) {
      onLog(`[Khởi tạo] Bắt đầu cào vòng lặp ID từ ${start} đến ${end}.`);
      onLog(`[Cấu hình] Phương thức: ${scrapeMethod === 'http' ? 'HTTP siêu tốc (Cheerio)' : 'Trình duyệt (Puppeteer)'} | Số luồng đồng thời: ${concurrencyLimit} | Độ trễ: ${delayMs}ms.`);
    }

    if (isNaN(start) || isNaN(end) || start > end) {
      throw new Error(`Khoảng ID không hợp lệ: ${startId} - ${endId}`);
    }
    
    if (!Array.isArray(config) || config.length === 0) {
      throw new Error('Cấu hình Selector không được để trống.');
    }

    // Helper to normalize selectors
    const normalizeSelector = (sel) => {
      const s = (sel || '').trim();
      if (!s) return s;
      if (s.startsWith('.') || s.startsWith('#') || s.startsWith('[') || s.includes(' ') || s.includes('>') || s.includes('+') || s.includes('~')) {
        return s;
      }
      return '.' + s;
    };
    
    const normalizedConfig = config.map(c => ({ ...c, selector: normalizeSelector(c.selector) }));

    // If browser mode, launch a single browser instance to share among concurrent pages
    if (scrapeMethod === 'browser') {
      if (onLog) onLog(`[Trình duyệt] Đang khởi chạy trình duyệt Puppeteer...`);
      browser = await puppeteer.launch({
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    const results = [];
    const ids = [];
    for (let id = start; id <= end; id++) {
      ids.push(id);
    }

    const navTimeout = Number(process.env.SCRAPE_NAV_TIMEOUT) || 30000;

    // Define single item worker
    const processId = async (id, currentStep) => {
      const targetUrl = `${urlPattern}${id}`;
      let base;
      try {
        base = new URL(targetUrl).origin;
      } catch (e) {
        base = '';
      }

      if (onLog) onLog(`[Cào ID] Trang (${currentStep}/${totalCount}) - Đang tải ID: ${id}`);
      console.log(`[ID Loop Scrape ${currentStep}/${totalCount}] Starting ID: ${id} at ${targetUrl}`);

      if (scrapeMethod === 'http') {
        try {
          if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }

          const response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8'
            },
            signal: AbortSignal.timeout(20000)
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
          }

          const html = await response.text();
          const $ = cheerio.load(html);
          const row = { 'ID': id, 'Nguồn URL': targetUrl };

          const toAbsoluteUrl = (urlVal, baseVal) => {
            if (!urlVal || !baseVal) return null;
            const cleanUrl = String(urlVal).trim();
            if (['undefined', 'null', '', '#', 'javascript:void(0)', 'javascript:;'].includes(cleanUrl.toLowerCase())) {
              return null;
            }
            try { return new URL(cleanUrl, baseVal).href; } catch (e) { return cleanUrl; }
          };

          const getLinkFromElement = (el, baseVal) => {
            let href = el.attr('href');
            if (href) {
              const abs = toAbsoluteUrl(href, baseVal);
              if (abs) return abs;
            }
            const a = el.find('a').first();
            if (a && a.length > 0) {
              href = a.attr('href');
              if (href) {
                const abs = toAbsoluteUrl(href, baseVal);
                if (abs) return abs;
              }
            }
            const dataHref = el.attr('data-href') || el.attr('data-url') || el.attr('data-link');
            if (dataHref) {
              const abs = toAbsoluteUrl(dataHref, baseVal);
              if (abs) return abs;
            }
            return null;
          };

          const getImageSrcFromElement = (el, baseVal) => {
            let src = el.attr('src') || el.attr('data-src') || el.attr('data-lazy-src') || el.attr('data-url');
            if (src) {
              const firstUrl = src.split(',')[0].trim().split(/\s+/)[0];
              return toAbsoluteUrl(firstUrl, baseVal);
            }
            const img = el.find('img').first();
            if (img && img.length > 0) {
              src = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src') || img.attr('data-url');
              if (src) return toAbsoluteUrl(src, baseVal);
              const srcset = img.attr('srcset');
              if (srcset) {
                const firstUrl = srcset.split(',')[0].trim().split(/\s+/)[0];
                return toAbsoluteUrl(firstUrl, baseVal);
              }
            }
            return null;
          };

          normalizedConfig.forEach(({ label, selector, type }) => {
            try {
              const el = $(selector).first();
              if (!el || el.length === 0) {
                row[label] = 'N/A';
                return;
              }

              const typeLower = type.toLowerCase();
              if (typeLower === 'text') {
                row[label] = el.text().trim() || 'N/A';
              } else if (typeLower === 'link') {
                row[label] = getLinkFromElement(el, base) || 'N/A';
              } else if (typeLower === 'image') {
                row[label] = getImageSrcFromElement(el, base) || 'N/A';
              } else if (typeLower === 'api') {
                const dataAttr = el.attr('data-json') || el.attr('data-data') || el.attr('data-api') || el.attr('data-url');
                row[label] = dataAttr || 'N/A';
              } else {
                row[label] = 'N/A';
              }
            } catch (e) {
              row[label] = 'N/A';
            }
          });

          const allNA = config.every(({ label }) => row[label] === 'N/A');
          if (allNA) {
            if (onLog) onLog(`  ⚠️ [ID ${id}] Không tìm thấy dữ liệu Selector phù hợp.`);
            return null;
          }

          if (onLog) onLog(`  ↳ [ID ${id}] Trích xuất thành công.`);
          return row;

        } catch (err) {
          if (onLog) onLog(`  ❌ [ID ${id}] Lỗi tải trang: ${err.message}`);
          console.error(`Error HTTP scraping ID ${id}:`, err.message);
          return null;
        }
      } else {
        // Puppeteer Mode
        let page;
        try {
          if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }

          page = await browser.newPage();
          await page.setViewport({ width: 1920, height: 1080 });

          // Block stylesheets, images, and fonts to speed up and save memory
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
              req.abort();
            } else {
              req.continue();
            }
          });

          await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: navTimeout
          });

          // Wait a brief moment for page stabilization
          await new Promise(resolve => setTimeout(resolve, 500));

          const rowData = await page.evaluate((fieldConfigs, currentId) => {
            const row = { 'ID': currentId, 'Nguồn URL': window.location.href };

            const normalizeSelector = (sel) => {
              const s = (sel || '').trim();
              if (!s) return s;
              if (s.startsWith('.') || s.startsWith('#') || s.startsWith('[') || s.includes(' ') || s.includes('>') || s.includes('+') || s.includes('~')) return s;
              return '.' + s;
            };

            const toAbsoluteUrl = (urlVal, baseVal) => {
              if (!urlVal || !baseVal) return null;
              const cleanUrl = String(urlVal).trim();
              if (['undefined', 'null', '', '#', 'javascript:void(0)', 'javascript:;'].includes(cleanUrl.toLowerCase())) {
                return null;
              }
              try { return new URL(cleanUrl, baseVal).href; } catch (e) { return cleanUrl; }
            };

            const getLinkFromElement = (el, baseVal) => {
              let href = el.getAttribute('href');
              if (href) {
                const abs = toAbsoluteUrl(href, baseVal);
                if (abs) return abs;
              }
              const a = el.querySelector('a');
              if (a) {
                href = a.getAttribute('href');
                if (href) {
                  const abs = toAbsoluteUrl(href, baseVal);
                  if (abs) return abs;
                }
              }
              return null;
            };

            const getImageSrcFromElement = (el, baseVal) => {
              let src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-lazy-src');
              if (src) return toAbsoluteUrl(src, baseVal);
              const img = el.querySelector('img');
              if (img) {
                src = img.getAttribute('src') || img.getAttribute('data-src');
                if (src) return toAbsoluteUrl(src, baseVal);
              }
              return null;
            };

            const baseVal = window.location.origin;

            fieldConfigs.forEach(({ label, selector, type }) => {
              try {
                const element = document.querySelector(normalizeSelector(selector));
                if (!element) {
                  row[label] = 'N/A';
                  return;
                }

                const typeLower = type.toLowerCase();
                if (typeLower === 'text') {
                  row[label] = element.textContent?.trim() || 'N/A';
                } else if (typeLower === 'link') {
                  row[label] = getLinkFromElement(element, baseVal) || 'N/A';
                } else if (typeLower === 'image') {
                  row[label] = getImageSrcFromElement(element, baseVal) || 'N/A';
                } else if (typeLower === 'api') {
                  const dataAttr = element.getAttribute('data-json') || element.getAttribute('data-data');
                  row[label] = dataAttr || 'N/A';
                } else {
                  row[label] = 'N/A';
                }
              } catch (e) {
                row[label] = 'N/A';
              }
            });

            const allNA = fieldConfigs.every(({ label }) => row[label] === 'N/A');
            return allNA ? null : row;
          }, normalizedConfig, id);

          if (rowData) {
            if (onLog) onLog(`  ↳ [ID ${id}] Trích xuất thành công.`);
            return rowData;
          } else {
            if (onLog) onLog(`  ⚠️ [ID ${id}] Không tìm thấy dữ liệu Selector phù hợp.`);
            return null;
          }
        } catch (err) {
          if (onLog) onLog(`  ❌ [ID ${id}] Lỗi tải trang: ${err.message}`);
          console.error(`Error Puppeteer scraping ID ${id}:`, err.message);
          return null;
        } finally {
          if (page) {
            await page.close();
          }
        }
      }
    };

    // Execute tasks in parallel using a simple concurrent worker pool
    const activePromises = new Set();
    let processedCount = 0;

    for (const id of ids) {
      processedCount++;
      const step = processedCount;

      if (activePromises.size >= concurrencyLimit) {
        await Promise.race(activePromises);
      }

      const p = (async () => {
        const row = await processId(id, step);
        if (row) {
          results.push(row);
        }
      })();

      activePromises.add(p);
      p.finally(() => activePromises.delete(p));
    }

    // Wait for all remaining active requests/pages to complete
    await Promise.all(activePromises);

    if (onLog) onLog(`[Hoàn thành] Đã cào xong theo ID! Thành công ${results.length}/${totalCount} trang.`);
    return results;

  } catch (error) {
    console.error('Error during ID loop scraping:', error);
    throw new Error(`ID loop scraping failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Fetches and parses a sitemap URL (resolving nested sitemaps recursively if needed)
 * @param {string} sitemapUrl - The sitemap XML URL
 * @param {Set<string>} visited - To prevent infinite recursion
 * @returns {Promise<Array<{url: string, lastmod: string|null, changefreq: string|null, priority: string|null}>>}
 */
export async function parseSitemap(sitemapUrl, visited = new Set()) {
  if (visited.has(sitemapUrl)) return [];
  visited.add(sitemapUrl);
  
  console.log(`Parsing sitemap: ${sitemapUrl}`);
  const response = await fetch(sitemapUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
  }
  const xmlText = await response.text();
  const $ = cheerio.load(xmlText, { xmlMode: true });
  
  const urls = [];
  
  // Check if it's a sitemap index (contains nested sitemaps)
  const sitemaps = $('sitemap > loc');
  if (sitemaps.length > 0) {
    const sitemapLinks = [];
    sitemaps.each((i, el) => {
      sitemapLinks.push($(el).text().trim());
    });
    
    // Recursively parse all nested sitemaps in parallel
    const nestedResults = await Promise.all(
      sitemapLinks.map(link => parseSitemap(link, visited).catch(err => {
        console.error(`Error parsing nested sitemap ${link}:`, err);
        return [];
      }))
    );
    
    return nestedResults.flat();
  }
  
  // Parse standard url tags
  $('url').each((i, el) => {
    const loc = $(el).find('loc').text().trim();
    const lastmod = $(el).find('lastmod').text().trim();
    const changefreq = $(el).find('changefreq').text().trim();
    const priority = $(el).find('priority').text().trim();
    
    if (loc) {
      urls.push({
        url: loc,
        lastmod: lastmod || null,
        changefreq: changefreq || null,
        priority: priority || null
      });
    }
  });
  
  return urls;
}

/**
 * Scrapes a specific list of URLs concurrently using custom selectors
 * @param {Array<string>} urls - Array of URLs to crawl
 * @param {Array<{label: string, selector: string, type: string}>} config - Selector configuration
 * @param {Function} onLog - Optional streaming log callback
 * @param {Object} options - Concurrency and delay settings
 * @returns {Promise<Array<Object>>} Scraped rows
 */
export async function executeListScrape(urls, config, onLog, options = {}) {
  const concurrencyLimit = Math.min(Number(options.concurrency) || 5, 20);
  const delayMs = Number(options.delayMs) || 0;
  let browser;

  try {
    if (onLog) onLog(`[Khởi tạo] Bắt đầu cào danh sách ${urls.length} URLs (Độ song song: ${concurrencyLimit}, Trễ: ${delayMs}ms)...`);
    
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const results = [];
    const totalCount = urls.length;
    
    // Helper to normalize selectors
    const normalizeSelector = (sel) => {
      const s = (sel || '').trim();
      if (!s) return s;
      if (s.startsWith('.') || s.startsWith('#') || s.startsWith('[') || s.includes(' ') || s.includes('>') || s.includes('+') || s.includes('~')) {
        return s;
      }
      return '.' + s;
    };
    
    const normalizedConfig = config.map(c => ({ ...c, selector: normalizeSelector(c.selector) }));
    const navTimeout = Number(process.env.SCRAPE_NAV_TIMEOUT) || 30000;

    const processUrl = async (url, step) => {
      let page;
      try {
        if (onLog) onLog(`[Cào trang ${step}/${totalCount}] Đang kết nối: ${url}`);
        
        page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Block heavy resources
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          if (['image', 'font'].includes(request.resourceType())) {
            request.abort();
          } else {
            request.continue();
          }
        });

        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: navTimeout
        });

        // Delay to prevent rate limiting or load heavy pages
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Auto-show chords on thophuong.vn or similar chord sites
        try {
          const chordBtn = await page.$('button[data-action="hidden-chord"]');
          if (chordBtn) {
            if (onLog) onLog(`  ↳ [Hợp âm] Phát hiện nút hiển thị hợp âm, đang click hiển thị hợp âm...`);
            await chordBtn.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (chordErr) {
          console.log('No chords button found or click failed in executeListScrape:', chordErr.message);
        }

        const rowData = await page.evaluate((fieldConfigs, currentUrl) => {
          const row = { 'Nguồn URL': currentUrl };

          const normalizeSelector = (sel) => {
            const s = (sel || '').trim();
            if (!s) return s;
            if (s.startsWith('.') || s.startsWith('#') || s.startsWith('[') || s.includes(' ') || s.includes('>') || s.includes('+') || s.includes('~')) return s;
            return '.' + s;
          };

          const toAbsoluteUrl = (urlVal, baseVal) => {
            if (!urlVal || !baseVal) return null;
            const cleanUrl = String(urlVal).trim();
            if (['undefined', 'null', '', '#', 'javascript:void(0)', 'javascript:;'].includes(cleanUrl.toLowerCase())) {
              return null;
            }
            try { return new URL(cleanUrl, baseVal).href; } catch (e) { return cleanUrl; }
          };

          const getLinkFromElement = (el, baseVal) => {
            let href = el.getAttribute('href');
            if (href) {
              const abs = toAbsoluteUrl(href, baseVal);
              if (abs) return abs;
            }
            const a = el.querySelector('a');
            if (a) {
              href = a.getAttribute('href');
              if (href) {
                const abs = toAbsoluteUrl(href, baseVal);
                if (abs) return abs;
              }
            }
            return null;
          };

          const getImageSrcFromElement = (el, baseVal) => {
            let src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-lazy-src');
            if (src) return toAbsoluteUrl(src, baseVal);
            const img = el.querySelector('img');
            if (img) {
              src = img.getAttribute('src') || img.getAttribute('data-src');
              if (src) return toAbsoluteUrl(src, baseVal);
            }
            return null;
          };

          const baseVal = window.location.origin;

          fieldConfigs.forEach(({ label, selector, type }) => {
            try {
              const element = document.querySelector(normalizeSelector(selector));
              if (!element) {
                row[label] = 'N/A';
                return;
              }

              const typeLower = type.toLowerCase();
              if (typeLower === 'text') {
                row[label] = element.textContent?.trim() || 'N/A';
              } else if (typeLower === 'link') {
                row[label] = getLinkFromElement(element, baseVal) || 'N/A';
              } else if (typeLower === 'image') {
                row[label] = getImageSrcFromElement(element, baseVal) || 'N/A';
              } else if (typeLower === 'api') {
                const dataAttr = element.getAttribute('data-json') || element.getAttribute('data-data');
                row[label] = dataAttr || 'N/A';
              } else {
                row[label] = 'N/A';
              }
            } catch (e) {
              row[label] = 'N/A';
            }
          });

          return row;
        }, normalizedConfig, url);

        if (onLog) onLog(`  ↳ [Thành công] [${step}/${totalCount}] Đã cào xong URL.`);
        return rowData;
      } catch (err) {
        if (onLog) onLog(`  ❌ [Lỗi] [${step}/${totalCount}] Lỗi khi cào ${url}: ${err.message}`);
        console.error(`Error Puppeteer scraping sitemap URL ${url}:`, err.message);
        return { 'Nguồn URL': url, 'Trạng thái': 'Lỗi: ' + err.message };
      } finally {
        if (page) {
          await page.close().catch(() => {});
        }
      }
    };

    // Run using simple concurrency pool
    const activePromises = new Set();
    let processedCount = 0;

    for (const url of urls) {
      processedCount++;
      const step = processedCount;

      if (activePromises.size >= concurrencyLimit) {
        await Promise.race(activePromises);
      }

      const p = (async () => {
        const row = await processUrl(url, step);
        if (row) {
          results.push(row);
        }
      })();

      activePromises.add(p);
      p.finally(() => activePromises.delete(p));
    }

    await Promise.all(activePromises);

    if (onLog) onLog(`[Hoàn thành] Đã cào xong tất cả. Thành công ${results.length}/${totalCount} trang.`);
    return results;

  } catch (error) {
    console.error('Error in executeListScrape:', error);
    throw new Error(`Sitemap list scraping failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Returns structured hierarchy of NSO 5 main categories
 */
export function getNsoCategories() {
  return [
    {
      id: 'dan-so-lao-dong',
      title: 'DÂN SỐ VÀ LAO ĐỘNG',
      pxdb: 'Dân số và lao động',
      subcategories: [
        { name: 'Dân số', url: 'https://www.nso.gov.vn/dan-so/' },
        { name: 'Lao động việc làm', url: 'https://www.nso.gov.vn/lao-dong/' }
      ]
    },
    {
      id: 'tai-khoan-quoc-gia-tai-chinh',
      title: 'TÀI KHOẢN QUỐC GIA VÀ TÀI CHÍNH',
      pxdb: 'Tài khoản quốc gia',
      subcategories: [
        { name: 'Tài khoản quốc gia', url: 'https://www.nso.gov.vn/tai-khoan-quoc-gia/' },
        { name: 'Ngân hàng, bảo hiểm và thu chi ngân sách', url: 'https://www.nso.gov.vn/ngan-hang-bao-hiem-va-thu-chi-ngan-sach/' }
      ]
    },
    {
      id: 'kinh-te',
      title: 'KINH TẾ',
      pxdb: 'Công nghiệp',
      subcategories: [
        { name: 'Nông, Lâm nghiệp và Thủy sản', url: 'https://www.nso.gov.vn/nong-lam-nghiep-va-thuy-san/' },
        { name: 'Đầu tư và Xây dựng', url: 'https://www.nso.gov.vn/dau-tu-va-xay-dung/', pxdb: 'Đầu tư' },
        { name: 'Công nghiệp', url: 'https://www.nso.gov.vn/cong-nghiep/', pxdb: 'Công nghiệp' },
        { name: 'Doanh nghiệp', url: 'https://www.nso.gov.vn/doanh-nghiep/', pxdb: 'Doanh nghiệp' },
        { name: 'Thương mại và Du lịch', url: 'https://www.nso.gov.vn/thuong-mai-dich-vu/' },
        { name: 'Thống kê Giá', url: 'https://www.nso.gov.vn/gia/' }
      ]
    },
    {
      id: 'xa-hoi-moi-truong-hanh-chinh',
      title: 'XÃ HỘI MÔI TRƯỜNG VÀ ĐƠN VỊ HÀNH CHÍNH',
      pxdb: 'Giáo dục',
      subcategories: [
        { name: 'Khoa học công nghệ, giáo dục', url: 'https://www.nso.gov.vn/giao-duc/' },
        { name: 'Y tế, mức sống dân cư, văn hóa & môi trường', url: 'https://www.nso.gov.vn/y-te-muc-song-dan-cu-van-hoa-the-thao-trat-tu-an-toan-xa-hoi-va-moi-truong/' },
        { name: 'Đơn vị hành chính, Đất đai và Khí hậu', url: 'https://www.nso.gov.vn/don-vi-hanh-chinh-dat-dai-va-khi-hau/' }
      ]
    },
    {
      id: 'tong-dieu-tra',
      title: 'TỔNG ĐIỀU TRA',
      pxdb: 'Dân số và lao động',
      subcategories: [
        { name: 'Tổng điều tra dân số và nhà ở', url: 'https://www.nso.gov.vn/tong-dieu-tra-dan-so-va-nha-o/' },
        { name: 'Tổng điều tra nông thôn, nông nghiệp và thủy sản', url: 'https://www.nso.gov.vn/tong-dieu-tra-nong-thon-nong-nghiep-va-thuy-san/' },
        { name: 'Tổng điều tra kinh tế', url: 'https://www.nso.gov.vn/tong-dieu-tra-kinh-te/' }
      ]
    }
  ];
}

/**
 * Get PX-Web statistical tables for a specific category URL by scraping nso.gov.vn page
 */
export async function getNsoCategoryTables(categoryUrl) {
  try {
    console.log(`Fetching category statistical tables from ${categoryUrl}...`);
    const res = await fetch(categoryUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) {
      throw new Error(`nso.gov.vn error HTTP ${res.status}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    const pxTables = [];
    const seenIds = new Set();

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (!href || !text || text.length < 5) return;

      if (href.includes('pxid=')) {
        // Extract pxid (e.g., pxid=V0201 or pxid=V02.01)
        const match = href.match(/pxid=([A-Za-z0-9\.\-]+)/);
        const pxid = match ? match[1] : `PX_${pxTables.length + 1}`;

        if (!seenIds.has(pxid)) {
          seenIds.add(pxid);
          const fullUrl = href.startsWith('http') ? href : `https://www.nso.gov.vn${href.startsWith('/') ? '' : '/'}${href}`;
          pxTables.push({
            id: `${pxid}.px`,
            text,
            pxUrl: fullUrl,
            categoryUrl
          });
        }
      }
    });

    console.log(`Found ${pxTables.length} statistical tables for ${categoryUrl}`);
    return pxTables;
  } catch (error) {
    console.error('Error fetching NSO category tables:', error);
    throw new Error(`Failed to fetch statistical tables for ${categoryUrl}: ${error.message}`);
  }
}

/**
 * Scrapes a PX-Web statistical data table using Puppeteer (handles px-web-2 iframe and direct pxweb)
 */
export async function scrapeNsoPxWebTable(pxUrl, options = {}) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log(`Scraping PX-Web table from ${pxUrl}...`);
    await page.goto(pxUrl, { waitUntil: 'networkidle2', timeout: 35000 });

    // Check if current page is px-web-2 container containing iframe
    let targetUrl = pxUrl;
    if (pxUrl.includes('px-web-2') || page.url().includes('px-web-2')) {
      const iframeSrc = await page.evaluate(() => {
        const frame = document.querySelector('iframe');
        return frame ? frame.src : null;
      });

      if (iframeSrc) {
        console.log(`Found PX-Web iframe: ${iframeSrc}`);
        targetUrl = iframeSrc;
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });
      }
    }

    // Select options in each listbox
    await page.evaluate((maxPerSelect) => {
      const selects = document.querySelectorAll('select[multiple]');
      selects.forEach(select => {
        const limit = maxPerSelect && maxPerSelect > 0 ? Math.min(maxPerSelect, select.options.length) : select.options.length;
        for (let i = 0; i < limit; i++) {
          select.options[i].selected = true;
        }
      });
    }, options.maxItemsPerVariable || 0);

    // Submit form to generate table
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 35000 }).catch(() => {}),
      page.click('input[type=submit][id*=ButtonViewTable], input[type=submit][value*=Tiếp]')
    ]);

    // Extract statistical data table
    const tableData = await page.evaluate(() => {
      const mainTable = document.querySelector('table[id*="DataTable"], table.table-class') || document.querySelector('table');
      if (!mainTable) return null;

      const rows = Array.from(mainTable.querySelectorAll('tr'));
      const matrix = rows.map(r => Array.from(r.querySelectorAll('th, td')).map(c => c.innerText.trim()));

      const maxCols = Math.max(...matrix.map(r => r.length), 1);
      const title = document.querySelector('.px_setting_tabletitle, h1, .tabletitle')?.innerText?.trim() || document.title;

      return {
        title,
        rowCount: matrix.length,
        colCount: maxCols,
        headers: matrix.slice(0, 3),
        rows: matrix
      };
    });

    if (!tableData || !tableData.rows || tableData.rows.length === 0) {
      throw new Error('No tabular data found on PX-Web result page.');
    }

    return tableData;
  } catch (error) {
    console.error('Error scraping PX-Web table:', error);
    throw new Error(`Failed to scrape PX-Web table: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}


/**
 * Scrapes articles, press releases, reports from an nso.gov.vn category page
 */
export async function scrapeNsoCategoryArticles(categoryUrl, maxArticles = 20) {
  try {
    const res = await fetch(categoryUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const $ = cheerio.load(html);

    const articles = [];
    const seenUrls = new Set();

    $('a').each((_, el) => {
      if (articles.length >= maxArticles) return;

      const href = $(el).attr('href');
      const text = $(el).text().trim().replace(/\s+/g, ' ');

      if (
        href &&
        text.length > 15 &&
        (href.includes('nso.gov.vn/') || href.startsWith('/')) &&
        !href.includes('#') &&
        !href.includes('javascript:')
      ) {
        const fullUrl = href.startsWith('http') ? href : `https://www.nso.gov.vn${href}`;

        if (
          !seenUrls.has(fullUrl) &&
          (fullUrl.includes('/tin-tuc-thong-ke/') ||
            fullUrl.includes('/du-lieu-va-so-lieu-thong-ke/') ||
            fullUrl.includes('/bai-top/') ||
            fullUrl.includes('/su-kien/') ||
            fullUrl.includes('/default/') ||
            fullUrl.includes('pxid=') ||
            fullUrl.includes('px-web'))
        ) {
          seenUrls.add(fullUrl);
          articles.push({
            title: text,
            url: fullUrl,
            type: fullUrl.includes('pxid=') ? 'pxweb_table' : 'article',
            sourceCategory: categoryUrl
          });
        }
      }
    });

    return articles;
  } catch (error) {
    console.error('Error scraping NSO category articles:', error);
    throw new Error(`Failed to scrape articles from ${categoryUrl}: ${error.message}`);
  }
}

/**
 * Scrapes a custom nso.gov.vn page and extracts title, text content, tables, and media links
 */
export async function scrapeNsoCustomUrl(targetUrl) {
  try {
    const res = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('h1').first().text().trim() || $('title').text().trim();
    const date = $('.post-date, .entry-date, time, .date').first().text().trim() || 'N/A';

    const paragraphs = [];
    $('article p, .entry-content p, .fusion-post-content p, p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) paragraphs.push(text);
    });

    const tables = [];
    $('table').each((i, tableEl) => {
      const rows = [];
      $(tableEl).find('tr').each((_, tr) => {
        const row = [];
        $(tr).find('th, td').each((_, cell) => {
          row.push($(cell).text().trim());
        });
        if (row.length > 0) rows.push(row);
      });
      if (rows.length > 0) {
        tables.push({ index: i + 1, rowsCount: rows.length, rows });
      }
    });

    const attachments = [];
    $('a[href$=".pdf"], a[href$=".xlsx"], a[href$=".docx"], a[href$=".zip"]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim() || 'Download File';
      if (href) {
        attachments.push({ text, url: href.startsWith('http') ? href : `https://www.nso.gov.vn${href}` });
      }
    });

    const images = [];
    $('article img, .entry-content img, img').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('logo') && !src.includes('icon')) {
        images.push(src.startsWith('http') ? src : `https://www.nso.gov.vn${src}`);
      }
    });

    return {
      title,
      date,
      url: targetUrl,
      paragraphsCount: paragraphs.length,
      paragraphs,
      tablesCount: tables.length,
      tables,
      attachmentsCount: attachments.length,
      attachments,
      imagesCount: images.length,
      images: images.slice(0, 10)
    };
  } catch (error) {
    console.error('Error scraping custom NSO URL:', error);
    throw new Error(`Failed to scrape URL ${targetUrl}: ${error.message}`);
  }
}




