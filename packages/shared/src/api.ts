import { z } from 'zod';
import { type Broker, passwordSchema } from './settings';

// ---------------------------------------------------------------------------
// Auth & setup
// ---------------------------------------------------------------------------

export interface AuthStatus {
  /** v1-compatible: always true in v2 once setup is done. */
  required: boolean;
  authenticated: boolean;
  setupRequired: boolean;
}

export const loginSchema = z.object({ password: z.string().min(1).max(256) });

export const setupSchema = z.object({
  setupCode: z.string().trim().min(1).max(32),
  password: passwordSchema,
  /** The browser's IANA timezone, used as the initial setting. */
  timezone: z.string().max(64).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export interface SessionInfo {
  id: string;
  kind: 'web' | 'api';
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
  current: boolean;
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export type SyncKind = 'refresh' | 'rebuild-history';
export type SyncState = 'idle' | 'running' | 'succeeded' | 'failed';

export interface SyncJob {
  id: string;
  kind: SyncKind;
  state: SyncState;
  startedAt: string;
  finishedAt?: string;
  /** 0..1 for history rebuilds */
  progress?: number;
  error?: string;
}

export interface SyncStatus {
  current: SyncJob | null;
  last: SyncJob | null;
  nextRunAt: string | null;
  lastSuccessAt: string | null;
  configured: boolean;
}

// ---------------------------------------------------------------------------
// Connection tests & Firefly pickers
// ---------------------------------------------------------------------------

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  details?: Record<string, string | number>;
}

export interface KnownAccount {
  name: string;
  source: 'firefly' | Broker;
  type: 'asset' | 'liability';
  currency: string;
  balance: number;
  balanceEur: number;
  /** Excluded in Firefly via "include in net worth" (cannot be overridden). */
  excludedInFirefly: boolean;
  suggestedKind: 'cash' | 'investment' | 'crypto';
}

// ---------------------------------------------------------------------------
// Data health
// ---------------------------------------------------------------------------

export type HealthSeverity = 'ok' | 'info' | 'warning' | 'error';

export interface HealthCheck {
  id: string;
  severity: HealthSeverity;
  /** i18n key under health.checks.<id> */
  count?: number;
  params?: Record<string, string | number>;
  samples?: { date: string; description: string; amount: number; url?: string }[];
}

export interface HealthReport {
  generatedAt: string | null;
  checks: HealthCheck[];
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface ReportRun {
  id: string;
  createdAt: string;
  trigger: 'manual' | 'schedule' | 'test';
  status: 'sent' | 'generated' | 'failed';
  recipients: number;
  error?: string;
}

export interface ReportsOverview {
  runs: ReportRun[];
  nextRunAt: string | null;
  emailConfigured: boolean;
}

// ---------------------------------------------------------------------------
// Generic
// ---------------------------------------------------------------------------

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  requestId?: string;
}

export interface HistoryPoint {
  date: string;
  value: number | null;
}
