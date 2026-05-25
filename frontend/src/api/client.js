import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  timeout: 60_000, // Firefly III may take time to paginate large datasets
  headers: { 'Content-Type': 'application/json' },
});

// Automatically inject Authorization header if a token exists in localStorage
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('wmm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Checks if the backend requires password protection.
 * @returns {Promise<boolean>} True if protection is enabled
 */
export async function checkAuthStatus() {
  const response = await client.get('/auth/status');
  return response.data.required;
}

/**
 * Attempts to log in with the provided password.
 * @param {string} password 
 * @returns {Promise<{success: boolean, token: string}>}
 */
export async function login(password) {
  const response = await client.post('/auth/login', { password });
  if (response.data.success && response.data.token) {
    localStorage.setItem('wmm_token', response.data.token);
  }
  return response.data;
}

/**
 * Fetches the full statistics payload from the backend.
 * @returns {Promise<object>} The statistics data object
 */
export async function fetchStatistics() {
  const response = await client.get('/statistics');
  if (!response.data.success) {
    throw new Error(response.data.error ?? 'Unknown API error');
  }
  return response.data.data;
}

/**
 * Force recalculates the statistics and overwrites daily history.
 * @returns {Promise<object>} The updated statistics data object
 */
export async function recalculateStatistics() {
  const response = await client.post('/statistics/recalculate');
  if (!response.data.success) {
    throw new Error(response.data.error ?? 'Unknown API error');
  }
  return response.data.data;
}

/**
 * Fetches the historical data for a specific metric.
 * @param {string} metricPath 
 * @param {string} start YYYY-MM-DD
 * @param {string} end YYYY-MM-DD
 * @returns {Promise<Array<{date: string, value: number}>>}
 */
export async function fetchHistory(metricPath, start, end) {
  const response = await client.get('/statistics/history', {
    params: { metricPath, start, end }
  });
  if (!response.data.success) {
    throw new Error(response.data.error ?? 'Unknown API error');
  }
  return response.data.data;
}
