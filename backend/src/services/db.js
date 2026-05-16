'use strict';

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'cache.db');
const db = new sqlite3.Database(dbPath);

// Initialize tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS statistics_cache (
      id TEXT PRIMARY KEY,
      payload TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_statistics (
      date TEXT PRIMARY KEY,
      payload TEXT
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
 * Save daily statistics snapshot to the database
 * @param {Object} data 
 * @returns {Promise<void>}
 */
function saveDailySnapshot(data) {
  return new Promise((resolve, reject) => {
    const date = new Date().toISOString().split('T')[0];
    const payload = JSON.stringify(data);
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO daily_statistics (date, payload) 
      VALUES (?, ?)
    `);
    
    stmt.run([date, payload], function(err) {
      if (err) reject(err);
      else resolve();
    });
    stmt.finalize();
  });
}

/**
 * Check if the daily_statistics table has any entries
 * @returns {Promise<boolean>}
 */
function hasDailyData() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT count(*) as count FROM daily_statistics`, (err, row) => {
      if (err) reject(err);
      else resolve(row.count > 0);
    });
  });
}

/**
 * Get historical data for a specific metric
 * @param {string} metricPath e.g., '$.assets.netWorthEur' or 'categories.expenses[?(@.name=="Food")].monthlyMean'
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {Promise<Array<{date: string, value: any}>>}
 */
function getHistoricalData(metricPath, startDate, endDate) {
  return new Promise((resolve, reject) => {
    // If the path contains a complex filter, we need to fetch the full payload and parse in Node.js
    const isComplexPath = metricPath.includes('[?');
    
    if (isComplexPath) {
      const query = `
        SELECT date, payload 
        FROM daily_statistics 
        WHERE date >= ? AND date <= ? 
        ORDER BY date ASC
      `;
      db.all(query, [startDate, endDate], (err, rows) => {
        if (err) {
          return reject(err);
        }
        
        try {
          // Parse the path like 'categories.expenses[?(@.name=="Food")].monthlyMean'
          const match = metricPath.match(/(.*)\[\?\(@\.name=="(.*)"\)\]\.(.*)/);
          if (!match) throw new Error('Invalid complex path format');
          
          const [_, arrayPath, itemName, valueKey] = match;
          const arrayPathParts = arrayPath.replace(/^\$\./, '').split('.');
          
          const results = rows.map(row => {
            const data = JSON.parse(row.payload);
            let current = data;
            for (const part of arrayPathParts) {
              if (current) current = current[part];
            }
            
            let value = 0;
            if (Array.isArray(current)) {
              const item = current.find(i => i.name === itemName);
              if (item && item[valueKey] !== undefined) {
                value = item[valueKey];
              }
            }
            
            return { date: row.date, value };
          });
          
          resolve(results);
        } catch (e) {
          reject(e);
        }
      });
    } else {
      const query = `
        SELECT date, json_extract(payload, ?) as value 
        FROM daily_statistics 
        WHERE date >= ? AND date <= ? 
        ORDER BY date ASC
      `;
      db.all(query, [metricPath, startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    }
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

/**
 * Save daily statistics snapshot for a specific date
 * @param {Object} data 
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<void>}
 */
function saveSnapshotForDate(data, date) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO daily_statistics (date, payload) 
      VALUES (?, ?)
    `);
    
    stmt.run([date, payload], function(err) {
      if (err) reject(err);
      else resolve();
    });
    stmt.finalize();
  });
}

module.exports = {
  saveStatistics,
  saveDailySnapshot,
  saveSnapshotForDate,
  hasDailyData,
  getHistoricalData,
  getStatistics
};
