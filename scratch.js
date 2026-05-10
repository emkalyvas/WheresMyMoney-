const axios = require('axios');
const config = require('./backend/src/config');
const client = axios.create({
  baseURL: `${config.firefly.apiUrl}/api/v1`,
  headers: { Authorization: `Bearer ${config.firefly.token}` }
});

client.get('/search/transactions', { params: { query: 'type:withdrawal', limit: 100 } })
  .then(res => {
    console.log(`Total withdrawal transactions in Firefly: ${res.data.meta.pagination.total}`);
  });
