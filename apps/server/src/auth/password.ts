import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { DB } from '../db';

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 32;

/** Format: scrypt$N$r$p$<salt b64>$<hash b64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password.normalize('NFKC'), salt, KEYLEN, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export class PasswordStore {
  constructor(private readonly db: DB) {}

  isSet(): boolean {
    return !!this.db.prepare('SELECT 1 FROM auth WHERE id = 1').get();
  }

  async set(password: string) {
    const hash = await hashPassword(password);
    this.db
      .prepare(
        `INSERT INTO auth (id, password_hash, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at`,
      )
      .run(hash, new Date().toISOString());
  }

  async verify(password: string): Promise<boolean> {
    const row = this.db.prepare('SELECT password_hash FROM auth WHERE id = 1').get() as
      | { password_hash: string }
      | undefined;
    if (!row) {
      // Spend comparable time so the response doesn't reveal whether a password exists.
      await hashPassword(password);
      return false;
    }
    return verifyPassword(password, row.password_hash);
  }
}
