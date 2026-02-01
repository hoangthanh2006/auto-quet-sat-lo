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
        'Không thể kết nối đến server. Vui lòng đảm bảo backend server đang chạy trên port 3001.'
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
        'Không thể kết nối đến server. Vui lòng đảm bảo backend server đang chạy trên port 3001.'
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
        'Không thể kết nối đến server. Vui lòng đảm bảo backend server đang chạy trên port 3001.'
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
        'Không thể kết nối đến server. Vui lòng đảm bảo backend server đang chạy trên port 3001.'
      );
    } else {
      throw new Error(error.message || 'Failed to analyze page');
    }
  }
};

export const executeScrape = async (url, config) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/execute-scrape`, {
      url,
      config
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
        'Không thể kết nối đến server. Vui lòng đảm bảo backend server đang chạy trên port 3001.'
      );
    } else {
      throw new Error(error.message || 'Failed to execute scrape');
    }
  }
};
