import axios from 'axios';

// Production: use VITE_API_URL (set on Render). Development: use proxy /api
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

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


