import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  timeout: 60_000, // Firefly III may take time to paginate large datasets
  headers: { 'Content-Type': 'application/json' },
});

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
