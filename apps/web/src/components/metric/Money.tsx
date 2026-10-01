import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';

/** An amount in EUR. Marked private so privacy mode blurs it. */
export function Money({
  value,
  decimals,
  compact,
  tone = 'none',
  className,
}: {
  value: number | null | undefined;
  decimals?: boolean;
  compact?: boolean;
  /** auto: green when ≥ 0, red when < 0 */
  tone?: 'none' | 'auto' | 'positive' | 'negative';
  className?: string;
}) {
  const f = useFormat();
  const toneClass =
    tone === 'auto'
      ? (value ?? 0) >= 0
        ? 'text-positive'
        : 'text-negative'
      : tone === 'positive'
        ? 'text-positive'
        : tone === 'negative'
          ? 'text-negative'
          : '';
  return (
    <span className={cn('private tabular', toneClass, className)} title={compact ? f.money(value, { decimals: true }) : undefined}>
      {f.money(value, { decimals, compact })}
    </span>
  );
}

/** Wraps personal text (account names) so privacy mode blurs it. */
export function Private({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('private', className)}>{children}</span>;
}

/**
 * A percentage change with direction icon and sign, so meaning never depends on
 * colour alone. `invert` for metrics where a decrease is good (spending).
 */
export function Delta({
  value,
  invert,
  className,
  suffix,
}: {
  value: number | null | undefined;
  invert?: boolean;
  className?: string;
  suffix?: ReactNode;
}) {
  const f = useFormat();
  if (value == null || !Number.isFinite(value)) return null;
  const flat = Math.abs(value) < 0.05;
  const good = flat ? null : invert ? value < 0 : value > 0;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular',
        good === null ? 'bg-muted text-muted-foreground' : good ? 'bg-positive/12 text-positive' : 'bg-negative/12 text-negative',
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {f.signedPercent(value)}
      {suffix && <span className="font-normal opacity-80">&nbsp;{suffix}</span>}
    </span>
  );
}
