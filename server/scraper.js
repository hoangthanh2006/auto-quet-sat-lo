import puppeteer from 'puppeteer';

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
    console.log(`Page analysis complete: Type=${analysis.pageType}, Confidence=${analysis.confidence}%`);
    return analysis;

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
export async function executeIdLoopScrape(urlPattern, startId, endId, config, onLog) {
  let browser;
  
  try {
    if (onLog) onLog(`[Khởi tạo] Bắt đầu cào theo vòng lặp ID (Từ ${startId} đến ${endId})...`);
    
    // Validate inputs
    const start = Number(startId);
    const end = Number(endId);
    if (isNaN(start) || isNaN(end) || start > end) {
      throw new Error(`Khoảng ID không hợp lệ: ${startId} - ${endId}`);
    }
    
    if (!Array.isArray(config) || config.length === 0) {
      throw new Error('Config must be a non-empty array');
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
    const navTimeout = Number(process.env.SCRAPE_NAV_TIMEOUT) || 30000;

    const results = [];
    const totalCount = end - start + 1;
    let successCount = 0;

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

    for (let id = start; id <= end; id++) {
      const targetUrl = `${urlPattern}${id}`;
      const currentStep = id - start + 1;
      
      if (onLog) onLog(`[Cào ID ${currentStep}/${totalCount}] Đang cào trang: ${targetUrl}`);
      console.log(`[ID Loop Scrape ${currentStep}/${totalCount}] Visiting: ${targetUrl}`);

      try {
        await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: navTimeout
        });
        
        // Wait for dynamic content
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Evaluate the page to extract detail fields (single-row)
        const rowData = await page.evaluate((fieldConfigs, currentId) => {
          const row = { 'ID': currentId, 'Nguồn URL': window.location.href };
          
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
            return null;
          };

          const getImageSrcFromElement = (el, base) => {
            let src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-lazy-src');
            if (src) return toAbsoluteUrl(src, base);
            const img = el.querySelector('img');
            if (img) {
              src = img.getAttribute('src') || img.getAttribute('data-src');
              if (src) return toAbsoluteUrl(src, base);
            }
            return null;
          };

          const base = window.location.origin;

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
                row[label] = getLinkFromElement(element, base) || 'N/A';
              } else if (typeLower === 'image') {
                row[label] = getImageSrcFromElement(element, base) || 'N/A';
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

          // Check if at least one field was found (not all N/A)
          const allNA = fieldConfigs.every(({ label }) => row[label] === 'N/A');
          return allNA ? null : row;
        }, normalizedConfig, id);

        if (rowData) {
          results.push(rowData);
          successCount++;
          if (onLog) onLog(`  ↳ Trích xuất thành công dữ liệu cho ID ${id}.`);
        } else {
          if (onLog) onLog(`  ⚠️ Không tìm thấy dữ liệu hoặc trang trống cho ID ${id}.`);
        }

      } catch (err) {
        if (onLog) onLog(`  ❌ Lỗi cào ID ${id}: ${err.message}`);
        console.error(`Error scraping ID ${id}:`, err.message);
      }
    }

    if (onLog) onLog(`[Hoàn thành] Đã cào xong theo ID! Thành công ${successCount}/${totalCount} trang, lấy được ${results.length} dòng.`);
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


