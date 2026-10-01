import { useTranslation } from 'react-i18next';

const REASONS = ['unreachable', 'unauthorized', 'not_found', 'rate_limited', 'bad_response', 'timeout', 'not_configured'] as const;

/** Turns a server error code like "firefly: unauthorized (HTTP 401)" into a sentence. */
export function useSyncErrorText() {
  const { t } = useTranslation();
  return (error: string) => {
    const m = /^(\w+): (\w+)/.exec(error);
    const reason = m?.[2] as (typeof REASONS)[number] | undefined;
    if (!m || !reason || !REASONS.includes(reason)) return t('sync.errors.internal_error');
    const service = { firefly: 'Firefly III', trading212: 'Trading 212', fx: 'FX', smtp: 'SMTP' }[m[1]] ?? m[1];
    return `${service} ${t(`sync.errors.${reason}`)}`;
  };
}

export function syncReason(error: string | undefined): string {
  return /^\w+: (\w+)/.exec(error ?? '')?.[1] ?? 'internal_error';
}
