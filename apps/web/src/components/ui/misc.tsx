import type { HTMLAttributes, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden="true" />;
}

type Tone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info' | 'primary';
const toneClass: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  positive: 'bg-positive/12 text-positive',
  negative: 'bg-negative/12 text-negative',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/12 text-info',
  primary: 'bg-accent text-accent-foreground',
};

export function Badge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', toneClass[tone], className)}
      {...props}
    />
  );
}

const alertIcon = { info: Info, warning: AlertTriangle, error: XCircle, success: CheckCircle2 };

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: 'info' | 'warning' | 'error' | 'success';
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = alertIcon[tone];
  const color = { info: 'text-info', warning: 'text-warning', error: 'text-negative', success: 'text-positive' }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border bg-card p-4 text-sm', className)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', color)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn('text-muted-foreground', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Progress({ value, className, tone = 'primary' }: { value: number; className?: string; tone?: 'primary' | 'positive' }) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn('h-full rounded-full transition-[width]', tone === 'positive' ? 'bg-positive' : 'bg-primary')}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
      {icon && <div className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground [&_svg]:size-6">{icon}</div>}
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
