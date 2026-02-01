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
      headless: true,
      // Docker/Fly: use PUPPETEER_EXECUTABLE_PATH (Chromium). Local Mac: use system Chrome.
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),
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
      headless: true,
      // Docker/Fly: use PUPPETEER_EXECUTABLE_PATH (Chromium). Local Mac: use system Chrome.
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),
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
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
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
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
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
 * @returns {Promise<Object>} Analysis result with page type and potential data regions
 */
export async function analyzePageStructure(url) {
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
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
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
            id: id
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
            id: id
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
            id: id
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
              
              // Determine if it's item or profile
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
                id: id
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
              
              // Check if already added
              const alreadyAdded = regions.some(r => 
                r.id === id || (r.className === className && r.type === tagName)
              );
              
              if (!alreadyAdded) {
                // Determine category based on content
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
                  id: id
                });
              }
            }
          });
        } catch (e) {}
      });

      // Sort by text length and take top 10
      result.dataRegions = regions
        .sort((a, b) => b.textLength - a.textLength)
        .slice(0, 10)
        .map((r, idx) => ({
          ...r,
          index: idx + 1
        }));

      return result;
    });

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
export async function executeDynamicScrape(url, config) {
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

    // Validate each config item
    for (const item of config) {
      if (!item.label || !item.selector || !item.type) {
        throw new Error('Each config item must have label, selector, and type');
      }
      if (!['text', 'link', 'image', 'api'].includes(item.type.toLowerCase())) {
        throw new Error(`Invalid type: ${item.type}. Must be 'text', 'link', 'image', or 'api'`);
      }
    }

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set a reasonable viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the target URL
    console.log(`Executing dynamic scrape at ${url}...`);
    await page.goto(url, {
      waitUntil: ['networkidle2', 'domcontentloaded'],
      timeout: 30000
    });

    // Wait for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Wait for selectors to appear (with timeout for each)
    const selectors = config.map(c => c.selector);
    console.log(`Waiting for selectors: ${selectors.join(', ')}`);
    
    await Promise.allSettled(
      selectors.map(selector => 
        page.waitForSelector(selector, { timeout: 5000 }).catch(() => {
          console.log(`Selector "${selector}" not found, will return N/A`);
        })
      )
    );

    // Extract data based on config
    const results = await page.evaluate((fieldConfigs) => {
      const rows = [];
      
      // Find the maximum number of matching elements across all selectors
      let maxCount = 0;
      const elementCounts = {};
      
      fieldConfigs.forEach(({ selector }) => {
        try {
          const elements = document.querySelectorAll(selector);
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

      // Extract data for each row
      for (let i = 0; i < maxCount; i++) {
        const row = {};
        
        fieldConfigs.forEach(({ label, selector, type }) => {
          try {
            const elements = document.querySelectorAll(selector);
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
              const href = element.getAttribute('href') || '';
              if (href) {
                // Convert to absolute URL
                try {
                  const absoluteUrl = new URL(href, window.location.origin).href;
                  row[label] = absoluteUrl;
                } catch (e) {
                  row[label] = href;
                }
              } else {
                row[label] = 'N/A';
              }
            } else if (typeLower === 'image') {
              const src = element.getAttribute('src') || element.getAttribute('data-src') || '';
              if (src) {
                // Convert to absolute URL
                try {
                  const absoluteUrl = new URL(src, window.location.origin).href;
                  row[label] = absoluteUrl;
                } catch (e) {
                  row[label] = src;
                }
              } else {
                row[label] = 'N/A';
              }
            } else if (typeLower === 'api') {
              // Try to extract JSON data from data attributes or script tags
              const dataAttr = element.getAttribute('data-json') || 
                              element.getAttribute('data-data') ||
                              element.getAttribute('data-api');
              
              if (dataAttr) {
                try {
                  const jsonData = JSON.parse(dataAttr);
                  row[label] = JSON.stringify(jsonData);
                } catch (e) {
                  row[label] = dataAttr;
                }
              } else {
                // Try to find script tag with JSON
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
    }, config);

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
