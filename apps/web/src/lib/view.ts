import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { PERIOD_KEYS, type PeriodKey } from '@wmm/shared';

export type Method = 'mean' | 'median';

/**
 * View state shared across pages, kept in the URL so views can be bookmarked:
 * ?period=12m&method=median&at=2025-12-31
 */
export function useView() {
  const [params, setParams] = useSearchParams();
  const p = params.get('period');
  const period: PeriodKey = (PERIOD_KEYS as readonly string[]).includes(p ?? '') ? (p as PeriodKey) : 'all';
  const method: Method = params.get('method') === 'median' ? 'median' : 'mean';
  const atRaw = params.get('at');
  const at = atRaw && /^\d{4}-\d{2}-\d{2}$/.test(atRaw) ? atRaw : undefined;

  const set = useCallback(
    (key: string, value: string | undefined, defaultValue?: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!value || value === defaultValue) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  return {
    period,
    method,
    at,
    setPeriod: (v: PeriodKey) => set('period', v, 'all'),
    setMethod: (v: Method) => set('method', v, 'mean'),
    setAt: (v: string | undefined) => set('at', v),
  };
}
