import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function AuthLayout({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-accent/60 to-background px-4 py-10">
      <div className={wide ? 'w-full max-w-2xl' : 'w-full max-w-sm'}>
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/icon.svg" alt="" className="size-12" />
          <div className="text-sm font-semibold text-muted-foreground">{t('app.name')}</div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
