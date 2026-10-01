import crypto from 'node:crypto';
import type { SessionInfo } from '@wmm/shared';
import type { DB } from '../db';

const DAY = 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
/** Integrations log in repeatedly; keep only the most recent API sessions. */
const MAX_API_SESSIONS = 25;

interface SessionRow {
  id: string;
  public_id: string;
  kind: 'web' | 'api';
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  user_agent: string | null;
}

export interface ResolvedSession {
  id: string;
  publicId: string;
  kind: 'web' | 'api';
}

const sha256 = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export class SessionStore {
  constructor(private readonly db: DB) {}

  /** Returns the raw token. Only its hash is stored. */
  create(kind: 'web' | 'api', days: number, userAgent: string | undefined): string {
    const token = `wmm_${crypto.randomBytes(32).toString('base64url')}`;
    const now = new Date();
    this.db
      .prepare(
        `INSERT INTO sessions (id, public_id, kind, created_at, last_seen_at, expires_at, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        sha256(token),
        crypto.randomBytes(9).toString('base64url'),
        kind,
        now.toISOString(),
        now.toISOString(),
        new Date(now.getTime() + days * DAY).toISOString(),
        userAgent?.slice(0, 200) ?? null,
      );
    if (kind === 'api') this.pruneApiSessions();
    return token;
  }

  /** Validates a token; extends web sessions (sliding expiry). */
  resolve(token: string | undefined, days: number): ResolvedSession | null {
    if (!token || token.length > 200) return null;
    const id = sha256(token);
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
    if (!row) return null;
    const now = Date.now();
    if (Date.parse(row.expires_at) <= now) {
      this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
      return null;
    }
    if (now - Date.parse(row.last_seen_at) > TOUCH_INTERVAL_MS) {
      const expires = row.kind === 'web' ? new Date(now + days * DAY).toISOString() : row.expires_at;
      this.db
        .prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
        .run(new Date(now).toISOString(), expires, id);
    }
    return { id, publicId: row.public_id, kind: row.kind };
  }

  revoke(token: string) {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sha256(token));
  }

  revokeByPublicId(publicId: string) {
    this.db.prepare('DELETE FROM sessions WHERE public_id = ?').run(publicId);
  }

  revokeAllExcept(sessionId: string | null) {
    this.db.prepare('DELETE FROM sessions WHERE id != ?').run(sessionId ?? '');
  }

  list(currentId: string | null): SessionInfo[] {
    const rows = this.db
      .prepare('SELECT * FROM sessions WHERE expires_at > ? ORDER BY last_seen_at DESC')
      .all(new Date().toISOString()) as SessionRow[];
    return rows.map((r) => ({
      id: r.public_id,
      kind: r.kind,
      createdAt: r.created_at,
      lastSeenAt: r.last_seen_at,
      expiresAt: r.expires_at,
      userAgent: r.user_agent,
      current: r.id === currentId,
    }));
  }

  purgeExpired() {
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
  }

  private pruneApiSessions() {
    this.db
      .prepare(
        `DELETE FROM sessions WHERE kind = 'api' AND id NOT IN
           (SELECT id FROM sessions WHERE kind = 'api' ORDER BY created_at DESC LIMIT ?)`,
      )
      .run(MAX_API_SESSIONS);
  }
}
