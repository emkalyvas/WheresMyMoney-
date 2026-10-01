import { type ChangeEvent, useRef } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { SettingsResponse } from '@wmm/shared';
import { Button } from '@/components/ui/button';
import { api, download } from '@/lib/api';
import { keys } from '@/lib/queries';
import { SettingsCard } from './common';

export default function DataSettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const file = useRef<HTMLInputElement>(null);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      if (json?.app !== 'WheresMyMoney!' || !json.settings) throw new Error('invalid');
      const res = await api.post<SettingsResponse>('/api/settings/import', { settings: json.settings });
      qc.setQueryData(keys.settings, res);
      toast.success(t('settings.data.imported'));
    } catch {
      toast.error(t('settings.data.invalidFile'));
    }
  };

  return (
    <div className="grid gap-4">
      <SettingsCard title={t('settings.data.sync')} description={t('health.rebuildHint')}>
        <div>
          <Button asChild variant="outline">
            <Link to="/health">{t('nav.health')}</Link>
          </Button>
        </div>
      </SettingsCard>
      <SettingsCard title={t('settings.data.exportSettings')} description={t('settings.data.exportHint')}>
        <div>
          <Button variant="outline" onClick={() => void download('/api/settings/export', 'wheresmymoney-settings.json')}>
            <Download /> {t('settings.data.exportSettings')}
          </Button>
        </div>
      </SettingsCard>
      <SettingsCard title={t('settings.data.importSettings')} description={t('settings.data.importHint')}>
        <div>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
          <Button variant="outline" onClick={() => file.current?.click()}>
            <Upload /> {t('settings.data.importSettings')}
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}
