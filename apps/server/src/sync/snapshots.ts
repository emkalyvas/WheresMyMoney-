import { type HistoryPoint, METRICS, type MetricId, parseCategoryMetric, type StatisticsPayload } from '@wmm/shared';
import type { DB } from '../db';

/**
 * Storage for computed statistics. Table shapes are identical to v1 so a v1
 * database keeps working and old snapshots stay readable.
 */
export class SnapshotStore {
  constructor(private readonly db: DB) {}

  saveCurrent(payload: StatisticsPayload) {
    this.db
      .prepare(
        `INSERT INTO statistics_cache (id, payload, updated_at) VALUES ('main', ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = datetime('now')`,
      )
      .run(JSON.stringify(payload));
  }

  getCurrent(): StatisticsPayload | null {
    const row = this.db.prepare(`SELECT payload, updated_at FROM statistics_cache WHERE id = 'main'`).get() as
      | { payload: string; updated_at: string }
      | undefined;
    if (!row) return null;
    const data = JSON.parse(row.payload) as StatisticsPayload;
    data._cachedAt = row.updated_at;
    return data;
  }

  /** Upserts the snapshot for a local date (YYYY-MM-DD); the latest calculation of a day wins. */
  saveDaily(date: string, payload: StatisticsPayload, opts: { overwrite: boolean } = { overwrite: true }) {
    this.db
      .prepare(`INSERT ${opts.overwrite ? 'OR REPLACE' : 'OR IGNORE'} INTO daily_statistics (date, payload) VALUES (?, ?)`)
      .run(date, JSON.stringify(payload));
  }

  hasDaily(date?: string): boolean {
    return date
      ? !!this.db.prepare('SELECT 1 FROM daily_statistics WHERE date = ?').get(date)
      : !!this.db.prepare('SELECT 1 FROM daily_statistics LIMIT 1').get();
  }

  /** Final snapshot recorded in the given year (v1 `?year=` semantics). */
  getByYear(year: string): StatisticsPayload | null {
    const row = this.db
      .prepare('SELECT payload, date FROM daily_statistics WHERE date LIKE ? ORDER BY date DESC LIMIT 1')
      .get(`${year}-%`) as { payload: string; date: string } | undefined;
    if (!row) return null;
    const data = JSON.parse(row.payload) as StatisticsPayload;
    data._cachedAt = row.date;
    return data;
  }

  /** Latest snapshot on or before a date. */
  getAt(date: string): StatisticsPayload | null {
    const row = this.db
      .prepare('SELECT payload, date FROM daily_statistics WHERE date <= ? ORDER BY date DESC LIMIT 1')
      .get(date) as { payload: string; date: string } | undefined;
    if (!row) return null;
    const data = JSON.parse(row.payload) as StatisticsPayload;
    data._cachedAt = row.date;
    return data;
  }

  availableYears(): number[] {
    return (
      this.db.prepare(`SELECT DISTINCT substr(date, 1, 4) AS y FROM daily_statistics ORDER BY y`).all() as {
        y: string;
      }[]
    ).map((r) => Number(r.y));
  }

  /** History for an allow-listed metric id or a `category:<kind>:<name>` metric. */
  history(metric: string, from: string, to: string): HistoryPoint[] | null {
    const cat = parseCategoryMetric(metric);
    if (cat) return this.categoryHistory(cat.kind, cat.name, 'monthlyMean', from, to);
    if (!Object.prototype.hasOwnProperty.call(METRICS, metric)) return null;
    return this.jsonPathHistory(METRICS[metric as MetricId].path, from, to);
  }

  /**
   * v1 `/api/statistics/history?metricPath=` support. Accepts plain JSON paths
   * (`assets.netWorthEur`, `tax.breakdown[0].value`) and the v1 category filter
   * form `categories.expenses[?(@.name=="Food")].monthlyMean`.
   */
  legacyHistory(metricPath: string, from: string, to: string): HistoryPoint[] | null {
    const complex = /^\$?\.?categories\.(expenses|income|expenses90d|income90d)\[\?\(@\.name=="(.{1,120})"\)\]\.(\w+)$/.exec(
      metricPath,
    );
    if (complex) return this.categoryHistory(complex[1], complex[2], complex[3], from, to);
    const path = metricPath.startsWith('$') ? metricPath : `$.${metricPath}`;
    if (!/^\$(\.[A-Za-z_]\w*|\[\d{1,3}\])+$/.test(path)) return null;
    return this.jsonPathHistory(path, from, to);
  }

  private jsonPathHistory(path: string, from: string, to: string): HistoryPoint[] {
    return this.db
      .prepare(
        `SELECT date, json_extract(payload, ?) AS value FROM daily_statistics
         WHERE date >= ? AND date <= ? ORDER BY date ASC`,
      )
      .all(path, from, to) as HistoryPoint[];
  }

  private categoryHistory(list: string, name: string, field: string, from: string, to: string): HistoryPoint[] {
    const rows = this.db
      .prepare(
        `SELECT date, json_extract(payload, ?) AS list FROM daily_statistics
         WHERE date >= ? AND date <= ? ORDER BY date ASC`,
      )
      .all(`$.categories.${list}`, from, to) as { date: string; list: string | null }[];
    return rows.map((r) => {
      const items = r.list ? (JSON.parse(r.list) as Record<string, unknown>[]) : [];
      const item = items.find((i) => i.name === name);
      const v = item?.[field];
      return { date: r.date, value: typeof v === 'number' ? v : 0 };
    });
  }
}
