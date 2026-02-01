import puppeteer from 'puppeteer';

/**
 * Extracts structured content from a profile page
 * @param {string} url - The URL to scrape
 * @param {string} customSelector - Optional custom CSS selector to prioritize
 * @returns {Promise<Object>} Extracted content data
 */
export async function extractContent(url, customSelector = null) {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      // Use system Chrome instead of Puppeteer's managed binary to avoid "Could not find Chrome" errors
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Optimize performance: Block images, stylesheets, and fonts
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    console.log(`Extracting content from ${url}...`);
    await page.goto(url, {
      waitUntil: ['networkidle2', 'domcontentloaded'],
      timeout: 30000
    });

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Extract structured data from the page (PASSIVE - no clicking/navigation)
    const content = await page.evaluate((customSelectorValue) => {
      const data = {
        url: window.location.href,
        title: document.title || '',
        boxContent: null, // Content from box-content element
        headings: [],
        tables: [],
        lists: [],
        paragraphs: [],
        metadata: {},
        debug: {
          foundSelectors: [],
          allClasses: []
        }
      };

      // Custom selector from user (if provided) - prioritize this
      // customSelectorValue is already passed as parameter to page.evaluate
      
      // Expanded selectors array for Vietnamese CMS and government sites
      const selectors = customSelectorValue 
        ? [
            // Put custom selector first
            customSelectorValue,
            '.box-content',
            '#box-content',
            '[class*="box-content"]',
            '[id*="box-content"]',
            '.content',
            '.main-content',
            '[class*="content"]',
            '.profile-content',
            '.detail-content',
            '.article-content',        // Added for Vietnamese CMS
            '.content-detail',          // Added for Vietnamese CMS
            '.uy-vien-detail',          // Added for Vietnamese CMS (uy vien = member)
            '.detail',                  // Added for Vietnamese CMS
            '#ctl00_mainContent_divContent', // Common in .NET sites
            'article',                  // Added
            'main',
            '[class*="profile"]',
            '[class*="detail"]',
            '[class*="timeline"]',
            '[id*="timeline"]',
            'section',
            '.summary',
            '[class*="summary"]'
          ]
        : [
            '.box-content',
            '#box-content',
            '[class*="box-content"]',
            '[id*="box-content"]',
            '.content',
            '.main-content',
            '[class*="content"]',
            '.profile-content',
            '.detail-content',
            '.article-content',        // Added for Vietnamese CMS
            '.content-detail',          // Added for Vietnamese CMS
            '.uy-vien-detail',          // Added for Vietnamese CMS (uy vien = member)
            '.detail',                  // Added for Vietnamese CMS
            '#ctl00_mainContent_divContent', // Common in .NET sites
            'article',                  // Added
            'main',
            '[class*="profile"]',
            '[class*="detail"]',
            '[class*="timeline"]',
            '[id*="timeline"]',
            'section',
            '.summary',
            '[class*="summary"]'
          ];

      let targetElement = null;
      let foundSelector = null;

      // Try each selector
      for (const selector of selectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent?.trim() || '';
            // Only use if it has meaningful content (not just navigation)
            if (text.length > 100 && !text.includes('Tìm kiếm') && !text.includes('Đại hội Đảng các cấp')) {
              targetElement = element;
              foundSelector = selector;
              data.debug.foundSelectors.push({ selector, textLength: text.length });
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      // FALLBACK: Find content area by looking for h1 (person name) and profile content
      if (!targetElement) {
        // Strategy 1: Find h1 with person name, then get its parent container
        const h1 = document.querySelector('h1');
        if (h1) {
          const h1Text = h1.textContent?.trim() || '';
          // Check if h1 looks like a person name (not navigation)
          if (h1Text.length > 2 && h1Text.length < 100 && 
              !h1Text.includes('Đại hội') && !h1Text.includes('Thông tin')) {
            // Find parent container that has profile content
            let parent = h1.parentElement;
            let depth = 0;
            while (parent && depth < 5) {
              const parentText = parent.textContent?.trim() || '';
              // Check if parent contains profile indicators
              if (parentText.includes('Họ và tên') || 
                  parentText.includes('Ngày sinh') || 
                  parentText.includes('TÓM TẮT') ||
                  parentText.includes('quá trình công tác') ||
                  (parentText.length > 500 && parentText.match(/\d{4}(?:-\d{4})?/))) {
                // Make sure it's not navigation
                if (!parentText.includes('Tìm kiếm') && 
                    !parentText.match(/^(đhđ|Đại hội Đảng các cấp)/i)) {
                  targetElement = parent;
                  foundSelector = 'h1-parent-container';
                  data.debug.foundSelectors.push({ selector: 'h1-parent-container', textLength: parentText.length });
                  break;
                }
              }
              parent = parent.parentElement;
              depth++;
            }
          }
        }
        
        // Strategy 2: Find element containing "TÓM TẮT QUÁ TRÌNH CÔNG TÁC"
        if (!targetElement) {
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            const text = el.textContent?.trim() || '';
            if (text.includes('TÓM TẮT QUÁ TRÌNH CÔNG TÁC') || text.includes('Tóm tắt quá trình công tác')) {
              // Check if it has meaningful content
              if (text.length > 500 && 
                  (text.includes('Họ và tên') || text.match(/\d{4}(?:-\d{4})?/))) {
                // Make sure it's not navigation
                if (!text.includes('Tìm kiếm') && !text.match(/^(đhđ|Đại hội Đảng các cấp)/i)) {
                  targetElement = el;
                  foundSelector = 'timeline-container';
                  data.debug.foundSelectors.push({ selector: 'timeline-container', textLength: text.length });
                  break;
                }
              }
            }
          }
        }
        
        // Strategy 3: Find largest text block excluding nav/header/footer
        if (!targetElement) {
          const main = document.querySelector('main') || document.querySelector('body');
          if (main) {
            const clone = main.cloneNode(true);
            
            // Remove navigation elements
            clone.querySelectorAll('nav, header, footer, .nav, .navigation, .menu, .sidebar, .header, .footer').forEach(el => el.remove());
            
            // Find the largest text container with profile indicators
            const allDivs = clone.querySelectorAll('div, section, article');
            let maxScore = 0;
            let bestDiv = null;
            
            allDivs.forEach(div => {
              const text = div.textContent?.trim() || '';
              if (text.length < 200) return; // Too short
              
              // Skip navigation text
              if (text.includes('Tìm kiếm') || 
                  text.match(/^(đhđ|Đại hội Đảng các cấp|Lịch sử|Hồ sơ|Dành cho|Dữ liệu nhân sự)/i)) {
                return;
              }
              
              // Score based on profile indicators
              let score = text.length;
              if (text.includes('Họ và tên')) score += 1000;
              if (text.includes('Ngày sinh')) score += 1000;
              if (text.includes('TÓM TẮT')) score += 1000;
              if (text.includes('quá trình công tác')) score += 1000;
              if (text.match(/\d{4}(?:-\d{4})?/)) score += 500; // Has date ranges
              if (text.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) score += 300; // Has dates
              
              if (score > maxScore) {
                maxScore = score;
                bestDiv = div;
              }
            });
            
            if (bestDiv && maxScore > 1000) {
              // Find corresponding element in original DOM
              const bestText = bestDiv.textContent?.trim() || '';
              const bestId = bestDiv.id || '';
              const bestClass = bestDiv.className || '';
              
              if (bestId) {
                targetElement = document.getElementById(bestId);
              } else if (bestClass) {
                const classes = bestClass.split(' ').filter(c => c.trim());
                for (const cls of classes) {
                  const found = document.querySelector('.' + cls);
                  if (found) {
                    const foundText = found.textContent?.trim() || '';
                    if (foundText.substring(0, 200) === bestText.substring(0, 200)) {
                      targetElement = found;
                      break;
                    }
                  }
                }
              }
              
              // If still not found, search by text content similarity
              if (!targetElement) {
                const allDivsOriginal = document.querySelectorAll('div, section, article');
                for (const div of allDivsOriginal) {
                  const divText = div.textContent?.trim() || '';
                  if (divText.length > 200) {
                    // Check similarity by comparing first 200 chars
                    const similarity = bestText.substring(0, 200).split('').filter((char, idx) => 
                      divText[idx] === char
                    ).length;
                    if (similarity > 150) { // 75% similarity
                      targetElement = div;
                      break;
                    }
                  }
                }
              }
              
              if (targetElement) {
                foundSelector = 'auto-detected-fallback';
                data.debug.foundSelectors.push({ selector: 'auto-detected-fallback', textLength: bestText.length, score: maxScore });
              }
            }
          }
        }
      }
      
      // Final fallback BEFORE creating boxContent: Try to find by h1 parent
      if (!targetElement) {
        const h1 = document.querySelector('h1');
        if (h1) {
          const h1Text = h1.textContent?.trim() || '';
          // Check if h1 looks like a person name
          if (h1Text.length > 2 && h1Text.length < 100 && 
              !h1Text.includes('Đại hội') && !h1Text.includes('Thông tin')) {
            // Find parent container with profile content
            let current = h1.parentElement;
            let bestContainer = null;
            let bestScore = 0;
            
            for (let i = 0; i < 5 && current; i++) {
              const text = current.textContent?.trim() || '';
              if (text.length > 500) {
                let score = 0;
                if (text.includes('Họ và tên')) score += 2000;
                if (text.includes('Ngày sinh')) score += 2000;
                if (text.includes('TÓM TẮT')) score += 2000;
                if (text.includes('quá trình công tác')) score += 1500;
                if (text.match(/\d{4}(?:-\d{4})?/)) score += 1000; // Date ranges
                if (text.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) score += 500; // Dates
                score += text.length / 10; // Longer is better
                
                // Penalty for navigation
                if (text.includes('Tìm kiếm') || text.match(/^(đhđ|Đại hội Đảng các cấp)/i)) {
                  score -= 5000;
                }
                
                if (score > bestScore && score > 2000) {
                  bestScore = score;
                  bestContainer = current;
                }
              }
              current = current.parentElement;
            }
            
            if (bestContainer) {
              targetElement = bestContainer;
              foundSelector = 'h1-parent-fallback';
              data.debug.foundSelectors.push({ selector: 'h1-parent-fallback', score: bestScore });
            }
          }
        }
      }
      
      if (targetElement) {
        data.boxContent = {
          html: targetElement.innerHTML.trim(),
          text: targetElement.textContent?.trim() || '',
          elementClass: targetElement.className || '',
          elementId: targetElement.id || '',
          foundBy: foundSelector || 'unknown',
          // Extract structured data from box-content
          tables: [],
          lists: [],
          paragraphs: [],
          timeline: [], // Timeline entries (date + description)
          divs: [], // All div elements with content
          spans: [], // All span elements with content
          allItems: [], // All structured items
          personalInfo: {} // Personal information fields
        };
        
        console.log(`Found content element using selector: ${foundSelector}, text length: ${data.boxContent.text.length}`);

        // Extract timeline structure (common pattern: date + description)
        const timelinePattern = /(\d{4}(?:-\d{4})?|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{4})/g;
        
        // Extract all text content with structure
        const walkNodes = (node, parent = null) => {
          if (!node) return;
          
          if (node.nodeType === 3) { // Text node
            const text = node.textContent?.trim();
            if (text && text.length > 0) {
              // Text nodes are handled by parent elements
            }
          } else if (node.nodeType === 1) { // Element node
            const tagName = node.tagName?.toLowerCase();
            const text = node.textContent?.trim();
            
            // Skip navigation elements
            const isNav = node.closest('nav, .nav, .navigation, .menu, .sidebar, header, footer, [class*="nav"], [class*="menu"], [id*="nav"], [id*="menu"]');
            if (isNav) return;
            
            // Skip if text matches navigation patterns
            const navPatterns = [
              'Tìm kiếm', 'Đại hội Đảng các cấp', 'Lịch sử các kỳ', 
              'Hồ sơ Tư liệu', 'Dành cho Báo chí', 'Dữ liệu nhân sự',
              'Danh sách ủy viên', 'Thống kê', 'đhđ-14', 'đhđ'
            ];
            const isNavigationText = navPatterns.some(pattern => {
              const lowerText = text.toLowerCase();
              const lowerPattern = pattern.toLowerCase();
              return lowerText === lowerPattern || 
                     lowerText.startsWith(lowerPattern + ' ') ||
                     (text.length < 50 && lowerText.includes(lowerPattern));
            });
            
            if (text && text.length > 0 && !isNavigationText) {
              const hasDate = timelinePattern.test(text);
              const isShortNav = text.length < 10 || 
                                text.match(/^(đhđ|Đại hội Đảng các cấp|Lịch sử|Hồ sơ|Dành cho|Dữ liệu)/i);
              
              // Must be meaningful content with profile indicators
              const hasProfileIndicators = 
                text.includes('Họ và tên') || text.includes('Ngày sinh') || 
                text.includes('Ngày vào Đảng') || text.includes('Quê quán') ||
                text.includes('Chức vụ') || text.includes('Trình độ') ||
                text.includes('TÓM TẮT') || text.includes('quá trình công tác') ||
                text.includes('Học viên') || text.includes('Cán bộ') ||
                text.includes('Thứ trưởng') || text.includes('Bộ trưởng') ||
                text.includes('Chủ tịch') || text.includes('Tổng Bí thư') ||
                hasDate || 
                (text.length > 50 && text.match(/\d{4}/));
              
              if (!isShortNav && hasProfileIndicators && 
                  (hasDate || tagName === 'li' || tagName === 'div' || tagName === 'span' || 
                   tagName === 'p' || tagName === 'dt' || tagName === 'dd' || tagName === 'h1' || 
                   tagName === 'h2' || tagName === 'h3')) {
                data.boxContent.allItems.push({
                  tag: tagName,
                  text: text,
                  html: node.innerHTML?.trim() || '',
                  class: node.className || '',
                  id: node.id || ''
                });
              }
            }
            
            // Recursively process children
            try {
              Array.from(node.childNodes).forEach(child => walkNodes(child, node));
            } catch (e) {
              // Skip if error
            }
          }
        };
        
        if (targetElement) {
          walkNodes(targetElement);
        }

        // PRESERVE: Extract personal information using Regex (Họ tên, Ngày sinh, Quê quán)
        const personalInfoText = targetElement.textContent || '';
        const personalInfoPatterns = {
          'hoTen': /Họ và tên[:\s]*([^\n]+)/i,
          'ngaySinh': /Ngày sinh[:\s]*([^\n]+)/i,
          'ngayVaoDang': /Ngày vào Đảng[:\s]*([^\n]+)/i,
          'queQuan': /Quê quán[:\s]*([^\n]+)/i,
          'chucVu': /Chức vụ[:\s]*([\s\S]*?)(?=\*\*Trình độ|$)/i,
          'trinhDoLyLuan': /Trình độ\s*lý luận chính trị[:\s]*([^\n]+)/i,
          'trinhDoChuyenMon': /Trình độ\s*chuyên môn[:\s]*([^\n]+)/i
        };
        
        for (const [key, pattern] of Object.entries(personalInfoPatterns)) {
          const match = personalInfoText.match(pattern);
          if (match && match[1]) {
            data.boxContent.personalInfo[key] = match[1].trim();
          }
        }

        // Extract timeline entries - improved regex
        const allElements = targetElement.querySelectorAll('div, li, span, p, td, th, dt, dd');
        allElements.forEach((el) => {
          const text = el.textContent?.trim() || '';
          if (text && text.length > 5) {
            // Improved date pattern: includes "Trước", "Từ", date ranges
            const datePattern = /(Trước\s+)?(\d{1,2}\/\d{4}|\d{4}(?:-\d{4})?|\d{1,2}\/\d{1,2}\/\d{4})/i;
            const dateMatch = text.match(datePattern);
            
            if (dateMatch) {
              // Extract full date including "Trước" prefix if present
              const date = dateMatch[0].trim();
              let description = text.replace(datePattern, '').trim().replace(/^[:\-\s|]+/, '');
              
              if (!description || description.length < 5) {
                const nextSibling = el.nextElementSibling;
                if (nextSibling) {
                  description = nextSibling.textContent?.trim() || '';
                }
              }
              
              if (description && description.length > 3) {
                data.boxContent.timeline.push({
                  date: date,
                  description: description,
                  fullText: text,
                  tag: el.tagName.toLowerCase(),
                  class: el.className || '',
                  id: el.id || ''
                });
              }
            }
          }
        });
        
        // Extract timeline from structured lists - improved regex
        const timelineLists = targetElement.querySelectorAll('ul, ol, dl');
        timelineLists.forEach((list) => {
          const items = list.querySelectorAll('li, dt, dd');
          items.forEach((item) => {
            const text = item.textContent?.trim() || '';
            if (text && text.length > 5) {
              // Improved date pattern: includes "Trước", "Từ", date ranges
              const datePattern = /(Trước\s+)?(\d{1,2}\/\d{4}|\d{4}(?:-\d{4})?|\d{1,2}\/\d{1,2}\/\d{4})/i;
              const dateMatch = text.match(datePattern);
              if (dateMatch) {
                // Extract full date including "Trước" prefix if present
                const date = dateMatch[0].trim();
                let description = text.replace(datePattern, '').trim().replace(/^[:\-\s|]+/, '');
                
                const exists = data.boxContent.timeline.some(t => 
                  t.date === date && t.description === description
                );
                
                if (!exists && description.length > 3) {
                  data.boxContent.timeline.push({
                    date: date,
                    description: description,
                    fullText: text,
                    tag: item.tagName.toLowerCase(),
                    class: item.className || '',
                    source: 'list'
                  });
                }
              }
            }
          });
        });

        // Extract tables within box-content
        const boxTables = targetElement.querySelectorAll('table');
        boxTables.forEach((table, tableIndex) => {
          const tableData = {
            index: tableIndex,
            rows: []
          };

          const rows = table.querySelectorAll('tr');
          rows.forEach((row) => {
            const rowData = {
              cells: []
            };
            
            const cells = row.querySelectorAll('td, th');
            cells.forEach((cell) => {
              rowData.cells.push({
                text: cell.textContent?.trim() || '',
                isHeader: cell.tagName === 'TH'
              });
            });

            if (rowData.cells.length > 0) {
              tableData.rows.push(rowData);
            }
          });

          if (tableData.rows.length > 0) {
            data.boxContent.tables.push(tableData);
          }
        });

        // Extract lists within box-content
        const boxLists = targetElement.querySelectorAll('ul, ol');
        boxLists.forEach((list, listIndex) => {
          const listData = {
            index: listIndex,
            type: list.tagName.toLowerCase(),
            items: []
          };

          const items = list.querySelectorAll('li');
          items.forEach((item) => {
            const text = item.textContent?.trim();
            if (text) {
              listData.items.push({
                text: text,
                html: item.innerHTML?.trim() || ''
              });
            }
          });

          if (listData.items.length > 0) {
            data.boxContent.lists.push(listData);
          }
        });

        // Extract paragraphs within box-content
        const boxParagraphs = targetElement.querySelectorAll('p');
        boxParagraphs.forEach((p) => {
          const text = p.textContent?.trim();
          if (text && text.length > 0) {
            data.boxContent.paragraphs.push({
              text: text,
              html: p.innerHTML?.trim() || ''
            });
          }
        });

        // Extract all divs with meaningful content
        const boxDivs = targetElement.querySelectorAll('div');
        boxDivs.forEach((div) => {
          const text = div.textContent?.trim();
          if (text && text.length > 10) {
            const isInTable = div.closest('table');
            const isInList = div.closest('ul, ol');
            if (!isInTable && !isInList) {
              data.boxContent.divs.push({
                text: text,
                html: div.innerHTML?.trim() || '',
                class: div.className || '',
                id: div.id || ''
              });
            }
          }
        });

        // Extract all spans with meaningful content
        const boxSpans = targetElement.querySelectorAll('span');
        boxSpans.forEach((span) => {
          const text = span.textContent?.trim();
          if (text && text.length > 5) {
            const isInTable = span.closest('table');
            const isInList = span.closest('ul, ol');
            if (!isInTable && !isInList) {
              data.boxContent.spans.push({
                text: text,
                html: span.innerHTML?.trim() || '',
                class: span.className || '',
                id: span.id || ''
              });
            }
          }
        });
      }

      // Extract main heading (h1)
      const h1 = document.querySelector('h1');
      if (h1) {
        data.title = h1.textContent?.trim() || data.title;
      }

      // Extract all headings
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach((heading) => {
        data.headings.push({
          level: heading.tagName.toLowerCase(),
          text: heading.textContent?.trim() || ''
        });
      });

      // Extract tables
      const tables = document.querySelectorAll('table');
      tables.forEach((table, tableIndex) => {
        const tableData = {
          index: tableIndex,
          rows: []
        };

        const rows = table.querySelectorAll('tr');
        rows.forEach((row) => {
          const rowData = {
            cells: []
          };
          
          const cells = row.querySelectorAll('td, th');
          cells.forEach((cell) => {
            rowData.cells.push({
              text: cell.textContent?.trim() || '',
              isHeader: cell.tagName === 'TH'
            });
          });

          if (rowData.cells.length > 0) {
            tableData.rows.push(rowData);
          }
        });

        if (tableData.rows.length > 0) {
          data.tables.push(tableData);
        }
      });

      // Extract lists (ul, ol)
      const lists = document.querySelectorAll('ul, ol');
      lists.forEach((list, listIndex) => {
        const listData = {
          index: listIndex,
          type: list.tagName.toLowerCase(),
          items: []
        };

        const items = list.querySelectorAll('li');
        items.forEach((item) => {
          const text = item.textContent?.trim();
          if (text) {
            listData.items.push(text);
          }
        });

        if (listData.items.length > 0) {
          data.lists.push(listData);
        }
      });

      // Extract paragraphs
      const paragraphs = document.querySelectorAll('p');
      paragraphs.forEach((p) => {
        const text = p.textContent?.trim();
        if (text && text.length > 20) {
          data.paragraphs.push(text);
        }
      });

      // Extract metadata (meta tags, structured data)
      const metaTags = document.querySelectorAll('meta');
      metaTags.forEach((meta) => {
        const name = meta.getAttribute('name') || meta.getAttribute('property');
        const content = meta.getAttribute('content');
        if (name && content) {
          data.metadata[name] = content;
        }
      });

      // Final fallback: If still no targetElement found, create boxContent from body
      if (!targetElement && !data.boxContent) {
        const body = document.body;
        if (body) {
          // Strategy: Find the section containing h1 and profile info
          const h1 = document.querySelector('h1');
          if (h1) {
            // Get parent container of h1 that has profile content
            let current = h1.parentElement;
            let bestContainer = null;
            let bestScore = 0;
            
            // Check up to 5 levels of parents
            for (let i = 0; i < 5 && current; i++) {
              const text = current.textContent?.trim() || '';
              if (text.length > 500) {
                let score = 0;
                if (text.includes('Họ và tên')) score += 1000;
                if (text.includes('Ngày sinh')) score += 1000;
                if (text.includes('TÓM TẮT')) score += 1000;
                if (text.match(/\d{4}(?:-\d{4})?/)) score += 500;
                if (!text.includes('Tìm kiếm') && !text.match(/^(đhđ|Đại hội Đảng các cấp)/i)) {
                  score += text.length / 10;
                }
                
                if (score > bestScore) {
                  bestScore = score;
                  bestContainer = current;
                }
              }
              current = current.parentElement;
            }
            
            if (bestContainer && bestScore > 1000) {
              targetElement = bestContainer;
              foundSelector = 'h1-parent-fallback';
            }
          }
          
          // Last resort: use body but filter navigation
          if (!targetElement) {
            const bodyClone = body.cloneNode(true);
            bodyClone.querySelectorAll('nav, header, footer, .nav, .navigation, .menu, .sidebar, .header, .footer').forEach(el => el.remove());
            
            const bodyText = bodyClone.textContent?.trim() || '';
            if (bodyText.length > 200) {
              targetElement = bodyClone;
              foundSelector = 'body-final-fallback';
            }
          }
          
          // Create boxContent from targetElement
          if (targetElement) {
            data.boxContent = {
              html: targetElement.innerHTML?.trim() || '',
              text: targetElement.textContent?.trim() || '',
              elementClass: targetElement.className || '',
              elementId: targetElement.id || '',
              foundBy: foundSelector || 'unknown',
              tables: [],
              lists: [],
              paragraphs: [],
              timeline: [],
              divs: [],
              spans: [],
              allItems: [],
              personalInfo: {}
            };
            
            // Now extract from this targetElement
            // Extract personal information
            const personalInfoText = targetElement.textContent || '';
            const personalInfoPatterns = {
              'hoTen': /Họ và tên[:\s]*([^\n]+)/i,
              'ngaySinh': /Ngày sinh[:\s]*([^\n]+)/i,
              'ngayVaoDang': /Ngày vào Đảng[:\s]*([^\n]+)/i,
              'queQuan': /Quê quán[:\s]*([^\n]+)/i,
              'chucVu': /Chức vụ[:\s]*([\s\S]*?)(?=\*\*Trình độ|$)/i,
              'trinhDoLyLuan': /Trình độ\s*lý luận chính trị[:\s]*([^\n]+)/i,
              'trinhDoChuyenMon': /Trình độ\s*chuyên môn[:\s]*([^\n]+)/i
            };
            
            for (const [key, pattern] of Object.entries(personalInfoPatterns)) {
              const match = personalInfoText.match(pattern);
              if (match && match[1]) {
                data.boxContent.personalInfo[key] = match[1].trim();
              }
            }
            
            // Extract timeline - improved regex to match more date formats
            const timelinePattern = /(\d{4}(?:-\d{4})?|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{4})/g;
            const allElements = targetElement.querySelectorAll('div, li, span, p, td, th, dt, dd');
            allElements.forEach((el) => {
              const text = el.textContent?.trim() || '';
              if (text && text.length > 5) {
                // Improved date pattern: includes "Trước", "Từ", date ranges, etc.
                const datePattern = /(Trước\s+)?(\d{1,2}\/\d{4}|\d{4}(?:-\d{4})?|\d{1,2}\/\d{1,2}\/\d{4})/i;
                const dateMatch = text.match(datePattern);
                
                if (dateMatch) {
                  // Extract full date including "Trước" prefix if present
                  const date = dateMatch[0].trim();
                  let description = text.replace(datePattern, '').trim().replace(/^[:\-\s|]+/, '');
                  
                  if (!description || description.length < 5) {
                    const nextSibling = el.nextElementSibling;
                    if (nextSibling) {
                      description = nextSibling.textContent?.trim() || '';
                    }
                  }
                  
                  if (description && description.length > 3) {
                    data.boxContent.timeline.push({
                      date: date,
                      description: description,
                      fullText: text,
                      tag: el.tagName.toLowerCase(),
                      class: el.className || '',
                      id: el.id || ''
                    });
                  }
                }
              }
            });
          }
        }
      }

      // Try to extract common profile fields from content
      const contentText = data.boxContent?.text || document.body?.textContent || '';
      
      // Look for common patterns (email, phone, etc.)
      const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
      const emails = contentText.match(emailPattern);
      if (emails) {
        data.metadata.emails = [...new Set(emails)];
      }

      const phonePattern = /(\+84|0)[0-9]{9,10}/g;
      const phones = contentText.match(phonePattern);
      if (phones) {
        data.metadata.phones = [...new Set(phones)];
      }

      return data;
    }, customSelector);

    console.log(`Extracted content from ${url}`);
    return content;

  } catch (error) {
    console.error(`Error extracting content from ${url}:`, error);
    throw new Error(`Failed to extract content: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extracts content from multiple URLs
 * @param {Array<string>} urls - Array of URLs to scrape
 * @param {string} customSelector - Optional custom CSS selector to prioritize
 * @returns {Promise<Array<Object>>} Array of extracted content
 */
export async function extractMultipleContents(urls, customSelector = null) {
  const results = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      console.log(`Processing ${i + 1}/${urls.length}: ${url}`);
      const content = await extractContent(url, customSelector);
      results.push({
        success: true,
        url: url,
        data: content
      });
      
      // Small delay between requests to avoid overwhelming the server
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Failed to extract from ${url}:`, error);
      results.push({
        success: false,
        url: url,
        error: error.message
      });
    }
  }
  
  return results;
}
