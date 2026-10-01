import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const KEY_FILE = 'secret.key';

export interface EncryptedValue {
  iv: Buffer;
  tag: Buffer;
  data: Buffer;
}

/**
 * Resolves the 32-byte key used to encrypt secrets at rest.
 * Order: WMM_SECRET_KEY (hex, base64, or any passphrase) → <dataDir>/secret.key → newly generated.
 */
export function loadOrCreateKey(dataDir: string, configured?: string): Buffer {
  if (configured) return normaliseKey(configured);

  const file = path.join(dataDir, KEY_FILE);
  if (fs.existsSync(file)) return normaliseKey(fs.readFileSync(file, 'utf8').trim());

  const key = crypto.randomBytes(32);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, key.toString('hex'), { mode: 0o600 });
  return key;
}

function normaliseKey(value: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  const b64 = Buffer.from(value, 'base64');
  if (b64.length === 32 && /^[A-Za-z0-9+/=]+$/.test(value)) return b64;
  if (value.length < 16) throw new Error('WMM_SECRET_KEY must be at least 16 characters');
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

export function encrypt(key: Buffer, plaintext: string, aad: string): EncryptedValue {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), data };
}

export function decrypt(key: Buffer, value: EncryptedValue, aad: string): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, value.iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(value.tag);
  return Buffer.concat([decipher.update(value.data), decipher.final()]).toString('utf8');
}

/** A short, non-revealing hint for the UI ("••a1f2"). Only shown for long values. */
export function secretHint(value: string): string | undefined {
  return value.length >= 16 ? value.slice(-4) : undefined;
}
