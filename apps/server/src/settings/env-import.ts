import crypto from 'node:crypto';
import { type SecretKey, type Settings, defaultSettings, settingsSchema } from '@wmm/shared';

/** Every environment variable understood by WheresMyMoney! v1. */
export const LEGACY_ENV_VARS = [
  'FIREFLY_API_URL',
  'FIREFLY_TOKEN',
  'APP_PASSWORD',
  'TAX_MODULE',
  'COMPANY_TAG',
  'START_DATE',
  'INCOME_TAX_RATE',
  'BUSINESS_TAX',
  'ADVANCE_TAX_RATE',
  'VAT_TAG',
  'NO_VAT_TAG',
  'DEFAULT_VAT',
  'VAT_EXPENSE_TAG',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'REPORT_EMAILS',
  'REPORT_SCHEDULE_DAY',
  'REPORT_SCHEDULE_TIME',
  'IGNORE_FIREFLY_ACCOUNTS',
  'TRADING212_API_KEY',
  'TRADING212_API_SECRET',
  'TRADING212_ENV',
  'TRADING212_ACCOUNT_NAME',
  'TRADING212_API_KEYS',
  'TRADING212_API_SECRETS',
  'TRADING212_ENVS',
  'TRADING212_ACCOUNT_NAMES',
  'STATISTICS_CACHE_TTL_MINUTES',
  'TARGET_ASSET_GOAL',
  'EXPECTED_INVESTMENT_GROWTH_RATE',
  'SAFE_WITHDRAWAL_RATE',
  'MONTHLY_INVESTMENT_AMOUNT',
  'PROJECTION_HORIZON_YEARS',
] as const;

export interface LegacyImport {
  settings: Settings;
  secrets: Partial<Record<SecretKey, string>>;
  password?: string;
  /** Names of the variables that were present (values are never logged). */
  found: string[];
}

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const num = (v: string | undefined, fallback: number) => {
  const n = v === undefined || v.trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function hasLegacyEnv(env: NodeJS.ProcessEnv): boolean {
  return LEGACY_ENV_VARS.some((k) => (env[k] ?? '').trim() !== '');
}

export function importLegacyEnv(env: NodeJS.ProcessEnv, timezone: string): LegacyImport {
  const d = defaultSettings();
  const found = LEGACY_ENV_VARS.filter((k) => (env[k] ?? '').trim() !== '');
  const secrets: Partial<Record<SecretKey, string>> = {};

  if (env.FIREFLY_TOKEN) secrets['firefly.token'] = env.FIREFLY_TOKEN.trim();
  if (env.SMTP_PASS) secrets['smtp.pass'] = env.SMTP_PASS;

  // Trading 212: single legacy account + comma-separated multi-account lists (same rules as v1)
  const t212: Settings['trading212']['accounts'] = [];
  const addT212 = (apiKey: string, apiSecret: string, tEnv: string, name: string) => {
    if (!apiKey) return;
    const id = crypto.randomBytes(6).toString('hex');
    t212.push({ id, name, env: tEnv.toLowerCase() === 'demo' ? 'demo' : 'live' });
    secrets[`trading212.${id}.apiKey` as SecretKey] = apiKey;
    if (apiSecret) secrets[`trading212.${id}.apiSecret` as SecretKey] = apiSecret;
  };
  if (env.TRADING212_API_KEY) {
    addT212(
      env.TRADING212_API_KEY.trim(),
      (env.TRADING212_API_SECRET ?? '').trim(),
      env.TRADING212_ENV ?? 'live',
      (env.TRADING212_ACCOUNT_NAME ?? '').trim(),
    );
  }
  if (env.TRADING212_API_KEYS) {
    const keys = (env.TRADING212_API_KEYS ?? '').split(',').map((s) => s.trim());
    const secretsList = (env.TRADING212_API_SECRETS ?? '').split(',').map((s) => s.trim());
    const envs = (env.TRADING212_ENVS ?? '').split(',').map((s) => s.trim());
    const names = (env.TRADING212_ACCOUNT_NAMES ?? '').split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
    keys.forEach((k, i) => addT212(k, secretsList[i] ?? '', envs[i] || 'live', names[i] ?? ''));
  }

  const rules: Settings['accounts']['rules'] = {};
  for (const name of list(env.IGNORE_FIREFLY_ACCOUNTS?.replace(/^"|"$/g, ''))) rules[name] = { include: false };

  const [hour, minute] = (env.REPORT_SCHEDULE_TIME ?? '08:00').split(':').map((s) => Number.parseInt(s, 10));
  const time =
    Number.isFinite(hour) && Number.isFinite(minute)
      ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      : '08:00';

  const recipients = list(env.REPORT_EMAILS);
  const taxModule = (env.TAX_MODULE ?? 'gr_oe').toLowerCase() === 'none' ? 'none' : 'gr_oe';

  const candidate = {
    ...d,
    general: {
      ...d.general,
      startDate: env.START_DATE || '2023-01-01', // v1 default
      timezone,
      syncIntervalMinutes: Math.min(1440, Math.max(5, num(env.STATISTICS_CACHE_TTL_MINUTES, 15))),
    },
    firefly: { url: (env.FIREFLY_API_URL ?? '').trim() },
    trading212: { accounts: t212 },
    accounts: { rules },
    tax: {
      module: taxModule,
      grOe: {
        ...d.tax.grOe,
        companyTag: env.COMPANY_TAG ?? 'MnApps', // v1 default, kept so imported numbers match exactly
        vatTagPrefix: env.VAT_TAG ?? d.tax.grOe.vatTagPrefix,
        noVatTag: env.NO_VAT_TAG ?? d.tax.grOe.noVatTag,
        defaultVat: num(env.DEFAULT_VAT, d.tax.grOe.defaultVat),
        vatPaidTags: list(env.VAT_EXPENSE_TAG),
        incomeTaxRate: num(env.INCOME_TAX_RATE, d.tax.grOe.incomeTaxRate),
        businessTax: num(env.BUSINESS_TAX, d.tax.grOe.businessTax),
        advanceTaxRate: num(env.ADVANCE_TAX_RATE, d.tax.grOe.advanceTaxRate),
      },
    },
    planning: {
      targetAssetGoal: num(env.TARGET_ASSET_GOAL, d.planning.targetAssetGoal),
      investmentGrowthRate: num(env.EXPECTED_INVESTMENT_GROWTH_RATE, d.planning.investmentGrowthRate),
      safeWithdrawalRate: num(env.SAFE_WITHDRAWAL_RATE, d.planning.safeWithdrawalRate),
      monthlyInvestmentAmount: num(env.MONTHLY_INVESTMENT_AMOUNT, d.planning.monthlyInvestmentAmount),
      horizonYears: Math.round(num(env.PROJECTION_HORIZON_YEARS, d.planning.horizonYears)),
    },
    reports: {
      ...d.reports,
      // v1 sent reports whenever SMTP_HOST and REPORT_EMAILS were set
      scheduleEnabled: !!env.SMTP_HOST && recipients.length > 0,
      dayOfMonth: Math.min(28, Math.max(1, Math.round(num(env.REPORT_SCHEDULE_DAY, 1)))),
      time,
      recipients,
      smtp: {
        host: (env.SMTP_HOST ?? '').trim(),
        port: Math.round(num(env.SMTP_PORT, 587)),
        secure: env.SMTP_SECURE === 'true',
        user: (env.SMTP_USER ?? '').trim(),
        from: (env.SMTP_FROM ?? '').trim(),
      },
    },
  };

  // Invalid individual values (e.g. a malformed e-mail) fall back to defaults rather than failing the import.
  const parsed = settingsSchema.safeParse(candidate);
  let settings: Settings;
  if (parsed.success) {
    settings = parsed.data;
  } else {
    const bad = new Set(parsed.error.issues.map((i) => i.path.slice(0, 2).join('.')));
    const pruned = structuredClone(candidate) as Record<string, Record<string, unknown>>;
    for (const p of bad) {
      const [section, field] = p.split('.');
      if (section && field && pruned[section]) delete pruned[section][field];
    }
    settings = settingsSchema.parse(pruned);
  }

  return { settings, secrets, password: env.APP_PASSWORD || undefined, found };
}
