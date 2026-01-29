import axios from 'axios';

const API_BASE_URL = '/api';

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
