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
