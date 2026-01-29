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
