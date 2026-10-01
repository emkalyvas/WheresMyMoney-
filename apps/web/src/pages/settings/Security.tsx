import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { Monitor, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, SwitchRow } from '@/components/ui/controls';
import { Badge, Skeleton } from '@/components/ui/misc';
import { ApiError, api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { keys, useSessions } from '@/lib/queries';
import { usePrivacy } from '@/lib/preferences';
import { AffixInput, SaveBar, SettingsCard, useSectionForm } from './common';

export default function SecuritySettings() {
  return (
    <div className="grid gap-4">
      <PasswordCard />
      <SessionsCard />
      <SecurityPrefs />
    </div>
  );
}

function PasswordCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: () => api.post('/api/auth/password', { currentPassword: current, newPassword: next }),
    onSuccess: () => {
      toast.success(t('settings.security.passwordChanged'));
      setCurrent('');
      setNext('');
      setConfirm('');
      void qc.invalidateQueries({ queryKey: keys.sessions });
    },
    onError: (e) => setError(e instanceof ApiError && e.code === 'INVALID_PASSWORD' ? t('settings.security.wrongPassword') : e.message),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 10) return setError(t('setup.passwordHint'));
    if (next !== confirm) return setError(t('setup.mismatch'));
    change.mutate();
  };
  return (
    <form onSubmit={submit}>
      <SettingsCard title={t('settings.security.changePassword')} description={t('settings.security.integrationsNote')}>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={t('settings.security.currentPassword')}>
            {(id) => <Input id={id} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
          </Field>
          <Field label={t('settings.security.newPassword')}>
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
          </Field>
          <Field label={t('settings.security.confirmPassword')}>
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>
        </div>
        {error && (
          <p className="text-sm text-negative" role="alert">
            {error}
          </p>
        )}
        <div>
          <Button type="submit" disabled={change.isPending || !current || !next}>
            {change.isPending ? t('common.saving') : t('settings.security.changePassword')}
          </Button>
        </div>
      </SettingsCard>
    </form>
  );
}

function SessionsCard() {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const sessions = useSessions();
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/api/auth/sessions/${encodeURIComponent(id)}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.sessions }),
  });
  const revokeOthers = useMutation({
    mutationFn: () => api.post('/api/auth/sessions/revoke-others'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.sessions }),
  });
  return (
    <SettingsCard
      title={t('settings.security.sessions')}
      description={t('settings.security.sessionsHint')}
      action={
        <Button variant="outline" size="sm" onClick={() => revokeOthers.mutate()} disabled={revokeOthers.isPending}>
          {t('settings.security.revokeOthers')}
        </Button>
      }
    >
      {sessions.isLoading ? (
        <Skeleton className="h-24" />
      ) : (
        <ul className="divide-y rounded-xl border">
          {(sessions.data ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              {s.kind === 'web' ? <Monitor className="size-4 text-muted-foreground" /> : <Plug className="size-4 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {s.kind === 'web' ? t('settings.security.web') : t('settings.security.apiKind')}
                  {s.current && <Badge tone="positive">{t('settings.security.thisDevice')}</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {t('settings.security.lastSeen', { ago: f.ago(s.lastSeenAt) })}
                  {s.userAgent && <> · {summariseAgent(s.userAgent)}</>}
                </div>
              </div>
              {!s.current && (
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(s.id)}>
                  {t('settings.security.revoke')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  );
}

/** "Firefox on Linux" style summary; never shows the full user agent. */
function summariseAgent(ua: string) {
  const browser = /Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ua.split('/')[0];
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}

function SecurityPrefs() {
  const { t } = useTranslation();
  const privacy = usePrivacy();
  const { form, submit, saving, ready } = useSectionForm('security');
  if (!ready) return null;
  const { control, register, formState } = form;
  return (
    <form id="security-form" onSubmit={submit(undefined, () => privacy.setDefault(form.getValues('privacyModeDefault')))}>
      <SettingsCard title={t('settings.security.title')}>
        <Controller
          control={control}
          name="privacyModeDefault"
          render={({ field }) => (
            <SwitchRow label={t('settings.security.privacyDefault')} hint={t('settings.security.privacyDefaultHint')} checked={!!field.value} onCheckedChange={field.onChange} />
          )}
        />
        <Field label={t('settings.security.sessionDays')} className="max-w-48" error={formState.errors.sessionDays?.message}>
          {(id) => <AffixInput id={id} type="number" min={1} max={365} suffix={t('settings.security.days')} {...register('sessionDays', { valueAsNumber: true })} />}
        </Field>
      </SettingsCard>
      <SaveBar dirty={formState.isDirty} saving={saving} onDiscard={() => form.reset()} form="security-form" />
    </form>
  );
}
