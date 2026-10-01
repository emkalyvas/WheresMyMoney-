import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuthStatus,
  HealthReport,
  HistoryPoint,
  KnownAccount,
  ReportsOverview,
  SessionInfo,
  Settings,
  SettingsPatch,
  SettingsResponse,
  StatisticsPayload,
  SyncJob,
  SyncStatus,
  ConnectionTestResult,
} from '@wmm/shared';
import { api } from './api';

export const keys = {
  auth: ['auth'] as const,
  stats: (at?: string) => ['stats', at ?? 'live'] as const,
  history: (metric: string, from: string, to: string) => ['history', metric, from, to] as const,
  settings: ['settings'] as const,
  sync: ['sync'] as const,
  health: ['health'] as const,
  reports: ['reports'] as const,
  accounts: ['accounts'] as const,
  tags: ['firefly-tags'] as const,
  sessions: ['sessions'] as const,
};

export interface StatsResponse {
  data: StatisticsPayload | null;
  years: number[];
  sync: SyncStatus;
}

export function useAuthStatus() {
  return useQuery({
    queryKey: keys.auth,
    queryFn: () => api.get<AuthStatus>('/api/auth/status'),
    staleTime: Infinity,
    retry: 1,
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: keys.sync,
    queryFn: () => api.get<SyncStatus>('/api/sync'),
    refetchInterval: (q) => (q.state.data?.current ? 2_000 : 60_000),
  });
}

/** Statistics for "live" or a past snapshot (`at` = YYYY-MM-DD). Polls quickly while a sync runs. */
export function useStats(at?: string) {
  const sync = useSyncStatus();
  const running = !!sync.data?.current;
  return useQuery({
    queryKey: keys.stats(at),
    queryFn: () => api.get<StatsResponse>(`/api/stats${at ? `?at=${at}` : ''}`),
    refetchInterval: at ? false : running ? 4_000 : 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useHistory(metric: string | null, from: string, to: string) {
  return useQuery({
    queryKey: keys.history(metric ?? '', from, to),
    queryFn: () =>
      api.get<{ points: HistoryPoint[] }>(
        `/api/stats/history?metric=${encodeURIComponent(metric ?? '')}&from=${from}&to=${to}`,
      ),
    enabled: !!metric,
    staleTime: 5 * 60_000,
  });
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: () => api.get<SettingsResponse>('/api/settings') });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => api.patch<SettingsResponse>('/api/settings', patch),
    onSuccess: (data) => {
      qc.setQueryData(keys.settings, data);
      // The server starts a (debounced) recalculation after most changes; pick it up promptly.
      setTimeout(() => void qc.invalidateQueries({ queryKey: keys.sync }), 2_500);
    },
  });
}

/** Convenience: save one settings section. */
export function useSaveSection<K extends keyof Settings>(section: K) {
  const m = useUpdateSettings();
  return {
    ...m,
    save: (value: Settings[K], secrets?: SettingsPatch['secrets']) => m.mutateAsync({ section, value, secrets }),
  };
}

export function useStartSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind?: 'refresh' | 'rebuild-history'; overwrite?: boolean } = {}) =>
      api.post<{ job: SyncJob }>('/api/sync', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.sync }),
  });
}

export function useHealth() {
  return useQuery({ queryKey: keys.health, queryFn: () => api.get<HealthReport>('/api/health/data'), refetchInterval: 120_000 });
}

export function useReports() {
  return useQuery({ queryKey: keys.reports, queryFn: () => api.get<ReportsOverview>('/api/reports') });
}

/** `waitForFirstSync` polls until the first sync has discovered accounts (onboarding). */
export function useAccounts(opts: { waitForFirstSync?: boolean } = {}) {
  return useQuery({
    queryKey: keys.accounts,
    queryFn: () => api.get<{ accounts: KnownAccount[]; rules: Settings['accounts']['rules'] }>('/api/accounts'),
    refetchInterval: (q) => (opts.waitForFirstSync && !q.state.data?.accounts.length ? 2_000 : false),
  });
}

export function useFireflyTags(enabled: boolean) {
  return useQuery({
    queryKey: keys.tags,
    queryFn: () => api.get<{ tags: string[] }>('/api/firefly/tags'),
    enabled,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function useSessions() {
  return useQuery({ queryKey: keys.sessions, queryFn: () => api.get<SessionInfo[]>('/api/auth/sessions') });
}

export function useConnectionTest(path: string) {
  return useMutation({ mutationFn: (body: unknown) => api.post<ConnectionTestResult>(path, body) });
}
