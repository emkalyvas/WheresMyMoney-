import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, ExternalLink, Info, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { HealthCheck, HealthSeverity } from '@wmm/shared';
import { PageHeader } from '@/components/layout/AppShell';
import { useSyncErrorText } from '@/components/layout/syncError';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SwitchRow } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/misc';
import { Money, Private } from '@/components/metric/Money';
import { useFormat } from '@/lib/format';
import { useHealth, useStartSync, useSyncStatus } from '@/lib/queries';
import { cn } from '@/lib/utils';

const ICON: Record<HealthSeverity, typeof Info> = { ok: CheckCircle2, info: Info, warning: AlertTriangle, error: XCircle };
const COLOR: Record<HealthSeverity, string> = {
  ok: 'text-positive',
  info: 'text-info',
  warning: 'text-warning',
  error: 'text-negative',
};
const ORDER: HealthSeverity[] = ['error', 'warning', 'info', 'ok'];

/** i18n text for a check: "<id>.ok" when fine, otherwise "<id>.problem" (pluralised by count). */
function useCheckText() {
  const { t, i18n } = useTranslation();
  const errorText = useSyncErrorText();
  return (c: HealthCheck) => {
    const base = `health.checks.${c.id}`;
    const params: Record<string, unknown> = { ...c.params, count: c.count ?? 0 };
    if (c.id === 'firefly_sync' && c.severity === 'error') params.error = errorText(String(c.params?.error ?? ''));
    const variant = c.severity === 'ok' ? 'ok' : c.id === 'firefly_sync' ? 'error' : 'problem';
    const key = `${base}.${variant}`;
    const title = i18n.exists(key) || i18n.exists(`${key}_other`) ? t(key as never, params as never) : c.id;
    const hint = c.severity !== 'ok' && i18n.exists(`${base}.hint`) ? t(`${base}.hint` as never) : null;
    return { title: String(title), hint: hint ? String(hint) : null };
  };
}

export default function Health() {
  const { t } = useTranslation();
  const f = useFormat();
  const health = useHealth();
  const sync = useSyncStatus();
  const start = useStartSync();
  const text = useCheckText();
  const [overwrite, setOverwrite] = useState(false);

  const checks = [...(health.data?.checks ?? [])].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
  const issues = checks.filter((c) => c.severity === 'warning' || c.severity === 'error').length;
  const running = !!sync.data?.current;

  return (
    <>
      <PageHeader
        title={t('health.title')}
        description={t('health.intro')}
        actions={
          <Button
            variant="outline"
            disabled={running || !sync.data?.configured}
            onClick={() => start.mutate({}, { onSuccess: () => toast(t('sync.started')) })}
          >
            <RefreshCw className={cn(running && 'animate-spin')} /> {running ? t('sync.syncing') : t('sync.syncNow')}
          </Button>
        }
      />
      <div className="grid gap-4">
        <Card>
          <CardHeader
            title={issues ? t('health.issues', { count: issues }) : t('health.allGood')}
            description={health.data?.generatedAt ? t('health.lastChecked', { ago: f.ago(health.data.generatedAt) }) : t('health.neverChecked')}
          />
          <CardContent className="pt-3">
            {health.isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <ul className="divide-y">
                {checks.map((c) => {
                  const Icon = ICON[c.severity];
                  const { title, hint } = text(c);
                  return (
                    <li key={c.id} className="flex gap-3 py-3.5">
                      <Icon className={cn('mt-0.5 size-4 shrink-0', COLOR[c.severity])} aria-label={t(`health.severity.${c.severity}`)} />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium">{title}</p>
                        {hint && <p className="mt-0.5 text-muted-foreground">{hint}</p>}
                        {c.samples && c.samples.length > 0 && c.severity !== 'ok' && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{t('health.examples')}</summary>
                            <ul className="mt-2 grid gap-1.5 text-xs">
                              {c.samples.map((s, i) => (
                                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                  <span className="tabular text-muted-foreground">{f.date(s.date)}</span>
                                  <Private className="min-w-0 flex-1 truncate">{s.description}</Private>
                                  <Money value={s.amount} decimals />
                                  {s.url && (
                                    <a
                                      href={s.url}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className="inline-flex items-center gap-1 text-primary hover:underline"
                                    >
                                      {t('common.openInFirefly')} <ExternalLink className="size-3" />
                                    </a>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={t('health.rebuild')} description={t('health.rebuildHint')} />
          <CardContent className="grid gap-4">
            <SwitchRow label={t('health.overwrite')} checked={overwrite} onCheckedChange={setOverwrite} />
            <div>
              <Button
                variant="outline"
                disabled={running || !sync.data?.configured}
                onClick={() =>
                  start.mutate({ kind: 'rebuild-history', overwrite }, { onSuccess: () => toast(t('sync.rebuildStarted')) })
                }
              >
                {t('health.rebuild')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
