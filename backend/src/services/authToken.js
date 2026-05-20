'use strict';

const crypto = require('crypto');

// Generate a cryptographically secure token unique to this session/restart
const API_TOKEN = crypto.randomBytes(32).toString('hex');

module.exports = {
  API_TOKEN
};
