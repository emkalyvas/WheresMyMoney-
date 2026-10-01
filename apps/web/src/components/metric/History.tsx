import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MetricFormat } from '@wmm/shared';
import { Dialog } from '@/components/ui/overlay';
import { Segmented } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/misc';
import { useFormat } from '@/lib/format';
import { useHistory } from '@/lib/queries';
import { isoDate } from '@/lib/utils';
import { Delta } from './Money';

export interface MetricRequest {
  metric: string;
  label: string;
  format: MetricFormat;
  invert?: boolean;
}

const Ctx = createContext<(m: MetricRequest) => void>(() => {});

/** Lets any number on the page open its history chart. */
export function MetricHistoryProvider({ children }: { children: ReactNode }) {
  const [metric, setMetric] = useState<MetricRequest | null>(null);
  const open = useCallback((m: MetricRequest) => setMetric(m), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      {metric && <HistoryDialog metric={metric} onClose={() => setMetric(null)} />}
    </Ctx.Provider>
  );
}

export const useOpenHistory = () => useContext(Ctx);

type Range = '3m' | '1y' | 'ytd' | 'all';

function rangeStart(r: Range): string {
  const d = new Date();
  if (r === '3m') d.setMonth(d.getMonth() - 3);
  else if (r === '1y') d.setFullYear(d.getFullYear() - 1);
  else if (r === 'ytd') return `${d.getFullYear()}-01-01`;
  else return '2000-01-01';
  return isoDate(d);
}

export function useMetricFormatter(format: MetricFormat) {
  const f = useFormat();
  const { t } = useTranslation();
  return (v: number | null | undefined) =>
    v == null
      ? '—'
      : format === 'currency'
        ? f.money(v)
        : format === 'percent'
          ? f.percent(v)
          : t('overview.kpi.runwayValue', { value: f.number(v, 1) });
}

function HistoryDialog({ metric, onClose }: { metric: MetricRequest; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [range, setRange] = useState<Range>('1y');
  const from = rangeStart(range);
  const to = isoDate(new Date());
  const q = useHistory(metric.metric, from, to);
  const fmt = useMetricFormatter(metric.format);

  const points = useMemo(
    () => (q.data?.points ?? []).filter((p) => p.value != null).map((p) => ({ date: p.date, value: p.value as number })),
    [q.data],
  );
  const first = points[0]?.value;
  const last = points.at(-1)?.value;
  const change = first != null && last != null && first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={metric.label} description={t('metric.history')}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented<Range>
          label={t('metric.history')}
          value={range}
          onChange={setRange}
          options={(['3m', '1y', 'ytd', 'all'] as const).map((r) => ({ value: r, label: t(`metric.ranges.${r}`) }))}
        />
        {points.length > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="private tabular text-muted-foreground">{fmt(first)}</span>
            <span aria-hidden="true">→</span>
            <span className="private tabular font-semibold">{fmt(last)}</span>
            <Delta value={change} invert={metric.invert} />
          </div>
        )}
      </div>

      {q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : points.length < 2 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t('metric.historyEmpty')}</p>
      ) : (
        <div className="private-axis h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="hist-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => f.date(d)}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                width={72}
                tickFormatter={(v: number) => (metric.format === 'currency' ? f.money(v, { compact: true }) : f.number(v, 1))}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip
                formatter={(v) => [fmt(Number(v)), metric.label]}
                labelFormatter={(d) => f.date(String(d))}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} fill="url(#hist-fill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Dialog>
  );
}
