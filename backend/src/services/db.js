'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../cache.db');
const db = new sqlite3.Database(dbPath);

// Initialize table
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS statistics_cache (
      id TEXT PRIMARY KEY,
      payload TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

/**
 * Save statistics to the database
 * @param {Object} data 
 * @returns {Promise<void>}
 */
function saveStatistics(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const stmt = db.prepare(`
      INSERT INTO statistics_cache (id, payload, updated_at) 
      VALUES ('main', ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET 
        payload = excluded.payload, 
        updated_at = datetime('now')
    `);
    
    stmt.run([payload], function(err) {
      if (err) reject(err);
      else resolve();
    });
    stmt.finalize();
  });
}

/**
 * Get statistics from the database
 * @returns {Promise<Object|null>}
 */
function getStatistics() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT payload, updated_at FROM statistics_cache WHERE id = 'main'`, (err, row) => {
      if (err) {
        reject(err);
      } else if (row) {
        try {
          const data = JSON.parse(row.payload);
          data._cachedAt = row.updated_at;
          resolve(data);
        } catch (e) {
          reject(e);
        }
      } else {
        resolve(null);
      }
    });
  });
}

module.exports = {
  saveStatistics,
  getStatistics
};
