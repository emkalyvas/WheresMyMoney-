import { type Settings, settingsSchema } from '@wmm/shared';
import { SYNTHETIC_SETTINGS, buildSyntheticFirefly } from './fixtures/synthetic.mjs';

export { buildSyntheticFirefly };

/** Settings equivalent to the v1 env used to produce the golden files. */
export function syntheticSettings(overrides: Partial<Settings['general']> = {}): Settings {
  return settingsSchema.parse({
    general: { startDate: SYNTHETIC_SETTINGS.startDate, excludeCurrentMonthFromAverages: false, ...overrides },
    accounts: { rules: { 'Old Wallet': { include: false } } },
    tax: {
      module: 'gr_oe',
      grOe: { companyTag: 'Acme', vatPaidTags: SYNTHETIC_SETTINGS.vatExpenseTags },
    },
  });
}

/**
 * Asserts that every value in `expected` is present in `actual` (extra keys in
 * `actual` are allowed — v2 only adds fields) and numbers match closely.
 */
export function expectSuperset(actual: unknown, expected: unknown, path = '$'): string[] {
  const diffs: string[] = [];
  const walk = (a: unknown, e: unknown, p: string) => {
    if (typeof e === 'number' && typeof a === 'number') {
      const tol = Math.max(1e-6, Math.abs(e) * 1e-9);
      if (Math.abs(a - e) > tol) diffs.push(`${p}: expected ${e}, got ${a}`);
      return;
    }
    if (Array.isArray(e)) {
      if (!Array.isArray(a)) return void diffs.push(`${p}: expected array`);
      if (a.length !== e.length) diffs.push(`${p}: length ${a.length} != ${e.length}`);
      e.forEach((v, i) => walk(a[i], v, `${p}[${i}]`));
      return;
    }
    if (e && typeof e === 'object') {
      if (!a || typeof a !== 'object') return void diffs.push(`${p}: expected object`);
      for (const [k, v] of Object.entries(e)) walk((a as Record<string, unknown>)[k], v, `${p}.${k}`);
      return;
    }
    if (a !== e) diffs.push(`${p}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
  };
  walk(actual, expected, path);
  return diffs;
}
