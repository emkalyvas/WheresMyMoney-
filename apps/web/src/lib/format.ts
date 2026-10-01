import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from './queries';
import { monthDate } from './utils';

/** Locale-aware formatters; the locale comes from Settings → General. */
export function useFormat() {
  const locale = useSettings().data?.settings.general.locale ?? navigator.language ?? 'en-GB';
  const { t } = useTranslation();

  return useMemo(() => {
    const eur0 = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    const eur2 = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const eurCompact = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });
    const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    return {
      locale,
      money: (v: number | null | undefined, opts: { decimals?: boolean; compact?: boolean } = {}) => {
        if (v == null || Number.isNaN(v)) return '—';
        if (opts.compact && Math.abs(v) >= 10_000) return eurCompact.format(v);
        return (opts.decimals ? eur2 : eur0).format(v);
      },
      number: (v: number | null | undefined, maxDigits = 2) =>
        v == null ? '—' : new Intl.NumberFormat(locale, { maximumFractionDigits: maxDigits }).format(v),
      plain: (v: number) => num.format(v),
      percent: (v: number | null | undefined, digits = 1) =>
        v == null || !Number.isFinite(v) ? '—' : `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)}%`,
      signedPercent: (v: number | null | undefined, digits = 1) =>
        v == null || !Number.isFinite(v)
          ? '—'
          : `${v > 0 ? '+' : v < 0 ? '−' : ''}${new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Math.abs(v))}%`,
      date: (d: string | Date) => new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
      dateTime: (d: string | Date) =>
        new Date(d).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      month: (key: string, style: 'short' | 'long' = 'short') =>
        monthDate(key).toLocaleDateString(locale, { month: style, year: style === 'long' ? 'numeric' : '2-digit' }),
      monthShort: (key: string) => monthDate(key).toLocaleDateString(locale, { month: 'short' }),
      ago: (d: string | Date | null | undefined) => {
        if (!d) return '';
        const diff = (new Date(d).getTime() - Date.now()) / 1000;
        const abs = Math.abs(diff);
        if (abs < 45) return t('time.justNow');
        if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
        if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour');
        return rtf.format(Math.round(diff / 86_400), 'day');
      },
    };
  }, [locale, t]);
}

export type Formatters = ReturnType<typeof useFormat>;

export function pctChange(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
