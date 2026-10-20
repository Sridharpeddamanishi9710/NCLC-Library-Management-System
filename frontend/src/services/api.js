// Base API Client for NCLC-2 Library Management System

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Standard HTTP Request Wrapper
 * Handles JSON parsing, query parameter serialization, and standardized error extraction.
 */
async function request(endpoint, options = {}) {
  const { params, ...customConfig } = options;

  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value);
      }
    });
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(customConfig.headers || {}),
  };

  const config = {
    ...customConfig,
    headers,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);
    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { message: text } : null;
    }

    if (!response.ok) {
      const errorMsg =
        (data && (data.error || data.message)) ||
        `Request failed with status ${response.status}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.details = data && data.details;
      throw err;
    }

    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const connErr = new Error(
        'Unable to connect to backend server. Please verify backend is running on port 5000.'
      );
      connErr.status = 0;
      throw connErr;
    }
    throw error;
  }
}

export const api = {
  get: (endpoint, params = {}) => request(endpoint, { method: 'GET', params }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body }),
  delete: (endpoint, params = {}) => request(endpoint, { method: 'DELETE', params }),
  getBaseUrl: () => API_BASE_URL,
};

export default api;
