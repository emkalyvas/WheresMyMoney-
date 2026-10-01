import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Loader2, PlugZap, TriangleAlert } from 'lucide-react';
import type { StatisticsPayload } from '@wmm/shared';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { useStats } from '@/lib/queries';
import { useView } from '@/lib/view';
import { useSyncErrorText } from './layout/syncError';

/**
 * Loads statistics for the current view and renders the right empty state
 * (not connected / first sync running / sync failed) before the page.
 */
export function DataGate({ children }: { children: (data: StatisticsPayload) => ReactNode }) {
  const { t } = useTranslation();
  const { at } = useView();
  const q = useStats(at);
  const errorText = useSyncErrorText();

  if (q.isLoading) return <PageSkeleton />;
  const data = q.data?.data;
  if (data) return <>{children(data)}</>;

  const sync = q.data?.sync;
  if (sync && !sync.configured) {
    return (
      <EmptyState
        icon={<PlugZap />}
        title={t('empty.notConfiguredTitle')}
        action={
          <Button asChild>
            <Link to="/settings/connections">{t('empty.notConfiguredAction')}</Link>
          </Button>
        }
      >
        {t('empty.notConfiguredBody')}
      </EmptyState>
    );
  }
  if (sync?.last?.state === 'failed' && !sync.current) {
    return (
      <EmptyState
        icon={<TriangleAlert />}
        title={t('empty.failedTitle')}
        action={
          <Button asChild variant="outline">
            <Link to="/settings/connections">{t('empty.notConfiguredAction')}</Link>
          </Button>
        }
      >
        {errorText(sync.last.error ?? '')}
      </EmptyState>
    );
  }
  return (
    <EmptyState icon={<Loader2 className="animate-spin" />} title={t('empty.syncingTitle')}>
      {t('empty.syncingBody')}
    </EmptyState>
  );
}

export function PageSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
