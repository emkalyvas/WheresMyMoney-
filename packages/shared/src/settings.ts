import { z } from 'zod';

/**
 * Application settings. Everything that used to live in `.env` lives here,
 * except secrets (tokens, API keys, passwords) which are stored encrypted in a
 * separate table and never returned by the API — see SECRET_KEYS below.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');
const rate = z.number().min(0).max(1);

export const ACCOUNT_KINDS = ['cash', 'investment', 'crypto'] as const;
export const accountKindSchema = z.enum(ACCOUNT_KINDS);
export type AccountKind = z.infer<typeof accountKindSchema>;

export const generalSettingsSchema = z.object({
  startDate: isoDate.default('2024-01-01'),
  timezone: z.string().min(1).default('UTC'),
  locale: z.string().min(2).default('en-GB'),
  syncIntervalMinutes: z.number().int().min(5).max(1440).default(15),
  /** Exclude the current (incomplete) month from monthly means and medians. */
  excludeCurrentMonthFromAverages: z.boolean().default(true),
});

export const fireflySettingsSchema = z.object({
  url: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Must start with http:// or https://')
    .transform((v) => v.replace(/\/+$/, ''))
    .default(''),
});

export const trading212AccountSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{6,32}$/),
  name: z.string().trim().max(60).default(''),
  env: z.enum(['live', 'demo']).default('live'),
});
export type Trading212Account = z.infer<typeof trading212AccountSchema>;

export const trading212SettingsSchema = z.object({
  accounts: z.array(trading212AccountSchema).max(10).default([]),
});

export const accountRuleSchema = z.object({
  include: z.boolean().default(true),
  kind: accountKindSchema.optional(),
});
export type AccountRule = z.infer<typeof accountRuleSchema>;

export const accountsSettingsSchema = z.object({
  /** Keyed by account name (Firefly transactions reference accounts by name). */
  rules: z.record(z.string(), accountRuleSchema).default({}),
});

export const fxSettingsSchema = z.object({
  fiatProvider: z.enum(['open-er-api', 'none']).default('open-er-api'),
  cryptoProvider: z.enum(['binance', 'none']).default('binance'),
});

export const grOeSettingsSchema = z.object({
  companyTag: z.string().trim().default(''),
  vatTagPrefix: z.string().trim().default('ΦΠΑ'),
  noVatTag: z.string().trim().default('No VAT'),
  defaultVat: z.number().min(0).max(100).default(24),
  vatPaidTags: z.array(z.string().trim().min(1)).default([]),
  incomeTaxRate: rate.default(0.22),
  businessTax: z.number().min(0).default(800),
  advanceTaxRate: rate.default(0.4),
  /** Name of the liability account holding the previous year's advance tax; `{year}` is replaced. */
  advanceTaxAccountPattern: z.string().trim().default('Φόρος Εισοδήματος {year}'),
  /** Keyword in that account's notes, followed by `: <amount>`. */
  advanceTaxNotesKeyword: z.string().trim().default('Προκαταβολή'),
});
export type GrOeSettings = z.infer<typeof grOeSettingsSchema>;

export const TAX_MODULES = ['none', 'gr_oe'] as const;
export const taxSettingsSchema = z.object({
  module: z.enum(TAX_MODULES).default('none'),
  grOe: grOeSettingsSchema.prefault({}),
});

export const planningSettingsSchema = z.object({
  targetAssetGoal: z.number().min(0).default(1_000_000),
  investmentGrowthRate: z.number().min(-0.5).max(1).default(0.07),
  safeWithdrawalRate: z.number().min(0.001).max(0.2).default(0.04),
  monthlyInvestmentAmount: z.number().min(0).default(500),
  horizonYears: z.number().int().min(1).max(80).default(30),
});

export const reportsSettingsSchema = z.object({
  scheduleEnabled: z.boolean().default(false),
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  time: hhmm.default('08:00'),
  recipients: z.array(z.email()).max(20).default([]),
  redactAccountNames: z.boolean().default(false),
  smtp: z
    .object({
      host: z.string().trim().default(''),
      port: z.number().int().min(1).max(65535).default(587),
      secure: z.boolean().default(false),
      user: z.string().trim().default(''),
      from: z.string().trim().default(''),
    })
    .prefault({}),
});

export const securitySettingsSchema = z.object({
  sessionDays: z.number().int().min(1).max(365).default(30),
  privacyModeDefault: z.boolean().default(false),
});

export const appearanceSettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  language: z.enum(['en']).default('en'),
});

export const settingsSchema = z.object({
  general: generalSettingsSchema.prefault({}),
  firefly: fireflySettingsSchema.prefault({}),
  trading212: trading212SettingsSchema.prefault({}),
  accounts: accountsSettingsSchema.prefault({}),
  fx: fxSettingsSchema.prefault({}),
  tax: taxSettingsSchema.prefault({}),
  planning: planningSettingsSchema.prefault({}),
  reports: reportsSettingsSchema.prefault({}),
  security: securitySettingsSchema.prefault({}),
  appearance: appearanceSettingsSchema.prefault({}),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsSection = keyof Settings;
export const SETTINGS_SECTIONS = Object.keys(settingsSchema.shape) as SettingsSection[];

export const sectionSchemas: { [K in SettingsSection]: z.ZodType<Settings[K]> } = settingsSchema.shape as never;

export function defaultSettings(): Settings {
  return settingsSchema.parse({});
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

/** Secret keys are flat strings. Trading 212 secrets are per account id. */
export const secretKeySchema = z
  .string()
  .regex(/^(firefly\.token|smtp\.pass|trading212\.[a-z0-9]{6,32}\.(apiKey|apiSecret))$/);
export type SecretKey = z.infer<typeof secretKeySchema>;

export interface SecretStatus {
  set: boolean;
  /** Last 4 characters, only for values long enough not to give the secret away. */
  hint?: string;
  updatedAt?: string;
}

export interface SettingsResponse {
  settings: Settings;
  secrets: Record<string, SecretStatus>;
  importedFromEnv: boolean;
}

export const settingsPatchSchema = z.object({
  section: z.enum(SETTINGS_SECTIONS as [SettingsSection, ...SettingsSection[]]).optional(),
  value: z.unknown().optional(),
  /** New secret values; `null` clears a secret; omitted keys are left untouched. */
  secrets: z.record(secretKeySchema, z.string().max(4096).nullable()).optional(),
});
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export const passwordSchema = z.string().min(10, 'Use at least 10 characters').max(256);
