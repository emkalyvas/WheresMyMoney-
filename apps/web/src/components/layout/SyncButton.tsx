import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/overlay';
import { useFormat } from '@/lib/format';
import { useStartSync, useSyncStatus } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { useSyncErrorText } from './syncError';

/** Shows when data was last synced; click to sync now. Refreshes all data when a sync finishes. */
export function SyncButton() {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const status = useSyncStatus();
  const start = useStartSync();
  const errorText = useSyncErrorText();
  const running = status.data?.current;
  const wasRunning = useRef(false);

  useEffect(() => {
    if (wasRunning.current && !running) {
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'settings' && q.queryKey[0] !== 'auth' });
    }
    wasRunning.current = !!running;
  }, [running, qc]);

  if (!status.data) return null;
  const { last, lastSuccessAt, configured } = status.data;
  const failed = !running && last?.state === 'failed';

  const label = running
    ? running.kind === 'rebuild-history'
      ? t('sync.rebuilding', { percent: Math.round((running.progress ?? 0) * 100) })
      : t('sync.syncing')
    : !configured
      ? t('sync.notConfigured')
      : lastSuccessAt
        ? t('sync.syncedAgo', { ago: f.ago(lastSuccessAt) })
        : t('sync.neverSynced');

  const button = (
    <Button
      variant="ghost"
      size="sm"
      disabled={!!running || !configured || start.isPending}
      onClick={() =>
        start.mutate(
          {},
          {
            onSuccess: () => toast(t('sync.started')),
            onError: (e) => toast.error(e.message),
          },
        )
      }
      className={cn('text-muted-foreground', failed && 'text-warning')}
    >
      {failed ? <AlertTriangle /> : <RefreshCw className={cn(running && 'animate-spin')} />}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );

  return failed && last?.error ? (
    <Tooltip content={`${t('sync.failed')}: ${errorText(last.error)}`}>{button}</Tooltip>
  ) : (
    <Tooltip content={running ? label : t('sync.syncNow')}>{button}</Tooltip>
  );
}
