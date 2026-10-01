import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/misc';
import { useSettings } from '@/lib/queries';
import { cn } from '@/lib/utils';

const SECTIONS = ['general', 'connections', 'accounts', 'tax', 'planning', 'reports', 'security', 'appearance', 'data'] as const;

const BANNER_KEY = 'wmm.importBannerDismissed';

function readDismissed() {
  try {
    return localStorage.getItem(BANNER_KEY) === '1';
  } catch {
    return false;
  }
}

export default function SettingsLayout() {
  const { t } = useTranslation();
  const settings = useSettings();
  const [dismissed, setDismissed] = useState(readDismissed);
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(BANNER_KEY, '1');
    } catch {
      /* ignore */
    }
  };
  return (
    <>
      <PageHeader title={t('settings.title')} />
      {settings.data?.importedFromEnv && !dismissed && (
        <Alert
          tone="info"
          className="mb-4"
          action={
            <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label={t('common.close')}>
              <X />
            </Button>
          }
        >
          {t('settings.importedBanner')}
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav aria-label={t('settings.title')} className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
          {SECTIONS.map((s) => (
            <NavLink
              key={s}
              to={`/settings/${s}`}
              className={({ isActive }) =>
                cn(
                  'shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
                  isActive && 'bg-accent text-accent-foreground hover:bg-accent',
                )
              }
            >
              {t(`settings.nav.${s}`)}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </>
  );
}
