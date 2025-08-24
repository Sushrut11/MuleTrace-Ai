import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5001', // Must match your Flask port
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false, // Must match Flask's CORS config
  timeout: 300000 // 5 minutes
});

// Request logging for debugging
api.interceptors.request.use(config => {
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `➡️ ${config.method?.toUpperCase()} ${config.url}`,
      config.method !== 'get' ? config.data : ''
    );
  }
  return config;
});

// Enhanced error handling
api.interceptors.response.use(
  response => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ ${response.status} ${response.config.url}`);
    }
    return response;
  },
  error => {
    if (error.code === 'ECONNABORTED') {
      console.error('⏱️ Request timeout');
      error.message = 'Request took too long. Please try again.';
    } else if (!error.response) {
      console.error('🌐 Network error');
      error.message = 'Network connection failed. Please check your internet.';
    } else {
      console.error(`❌ ${error.response.status} Error`);
      error.message = error.response.data?.error || 'Request failed';
    }
    return Promise.reject(error);
  }
);

export default api;