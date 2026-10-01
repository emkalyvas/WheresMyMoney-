import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { InfoTip } from '@/components/ui/overlay';
import { cn } from '@/lib/utils';
import { type MetricRequest, useOpenHistory } from './History';
import { Sparkline } from './Sparkline';

/** A KPI: label, big value, optional delta/sub-line and sparkline. Opens the metric history on click. */
export function KpiTile({
  label,
  value,
  sub,
  delta,
  info,
  spark,
  sparkColor,
  history,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  delta?: ReactNode;
  info?: ReactNode;
  spark?: number[];
  sparkColor?: string;
  history?: MetricRequest;
  className?: string;
}) {
  const { t } = useTranslation();
  const openHistory = useOpenHistory();
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {label}
        {info && (
          <span className="relative z-10 inline-flex">
            <InfoTip>{info}</InfoTip>
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {delta}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      {spark && <Sparkline values={spark} color={sparkColor} className="mt-3" />}
    </>
  );

  const base = 'rounded-xl border bg-card p-4 text-left shadow-xs';
  if (!history) return <div className={cn(base, className)}>{body}</div>;
  return (
    <div className={cn(base, 'relative transition-colors hover:border-primary/40', className)}>
      {body}
      {/* Whole-card click target that stays keyboard accessible; the InfoTip above remains clickable. */}
      <button
        type="button"
        onClick={() => openHistory(history)}
        className="absolute inset-0 cursor-pointer rounded-xl"
        aria-label={t('metric.showHistory', { name: history.label })}
      />
    </div>
  );
}
