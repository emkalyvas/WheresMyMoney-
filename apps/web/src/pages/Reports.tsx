import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge, Skeleton } from '@/components/ui/misc';
import { api, download } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { keys, useReports, useSettings } from '@/lib/queries';

export default function Reports() {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const reports = useReports();
  const settings = useSettings();
  const [downloading, setDownloading] = useState(false);
  const r = settings.data?.settings.reports;

  const send = useMutation({
    mutationFn: () => api.post('/api/reports/send'),
    onSuccess: () => toast.success(t('reports.sent')),
    onError: (e) => toast.error(e.message),
    onSettled: () => void qc.invalidateQueries({ queryKey: keys.reports }),
  });

  const onDownload = async () => {
    setDownloading(true);
    try {
      await download('/api/reports/pdf', 'WheresMyMoney_Report.pdf');
      void qc.invalidateQueries({ queryKey: keys.reports });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHeader title={t('reports.title')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('reports.pdf')} description={t('reports.pdfBody')} />
          <CardContent>
            <Button onClick={onDownload} disabled={downloading}>
              <Download /> {downloading ? t('reports.generating') : t('reports.download')}
            </Button>
            {r?.redactAccountNames && <p className="mt-3 text-xs text-muted-foreground">{t('reports.redactNote')}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={t('reports.email')} />
          <CardContent className="grid gap-3 text-sm">
            {!reports.data ? (
              <Skeleton className="h-16" />
            ) : !reports.data.emailConfigured ? (
              <>
                <p className="text-muted-foreground">{t('reports.emailNotConfigured')}</p>
                <div>
                  <Button asChild variant="outline">
                    <Link to="/settings/reports">{t('reports.configure')}</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="font-medium">{t('reports.schedule')}</div>
                  <p className="text-muted-foreground">
                    {r?.scheduleEnabled
                      ? t('reports.scheduleOn', { day: r.dayOfMonth, time: r.time, count: r.recipients.length })
                      : t('reports.scheduleOff')}
                  </p>
                  {reports.data.nextRunAt && (
                    <p className="mt-1 text-xs text-muted-foreground">{t('reports.nextRun', { date: f.dateTime(reports.data.nextRunAt) })}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => send.mutate()} disabled={send.isPending}>
                    <Mail /> {send.isPending ? t('reports.sending') : t('reports.sendNow')}
                  </Button>
                  <Button asChild variant="ghost">
                    <Link to="/settings/reports">{t('reports.configure')}</Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title={t('reports.history')} />
          <CardContent className="pt-3">
            {!reports.data ? (
              <Skeleton className="h-24" />
            ) : reports.data.runs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('reports.noHistory')}</p>
            ) : (
              <ul className="divide-y text-sm">
                {reports.data.runs.map((run) => (
                  <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <div className="font-medium">{t(`reports.trigger.${run.trigger}`)}</div>
                      <div className="text-xs text-muted-foreground">{f.dateTime(run.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {run.error && <span className="text-xs text-muted-foreground">{run.error}</span>}
                      <Badge tone={run.status === 'failed' ? 'negative' : run.status === 'sent' ? 'positive' : 'neutral'}>
                        {t(`reports.status.${run.status}`)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
