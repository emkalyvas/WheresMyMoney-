import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthStatus } from '@wmm/shared';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/controls';
import { ApiError, api } from '@/lib/api';
import { keys } from '@/lib/queries';
import { AuthLayout } from './AuthLayout';

/** First-run: create the password (requires the one-time code printed in the server logs). */
export default function Setup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<{ field: 'code' | 'password' | 'confirm'; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 10) return setError({ field: 'password', message: t('setup.passwordHint') });
    if (password !== confirm) return setError({ field: 'confirm', message: t('setup.mismatch') });
    setPending(true);
    setError(null);
    try {
      await api.post('/api/setup', {
        setupCode: code,
        password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      // Update auth state and route in the same tick, so the setup route doesn't redirect to "/" first.
      qc.setQueryData<AuthStatus>(keys.auth, { required: true, authenticated: true, setupRequired: false });
      navigate('/welcome', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_SETUP_CODE') setError({ field: 'code', message: t('setup.invalidCode') });
      else if (err instanceof ApiError && err.status === 429) setError({ field: 'code', message: t('auth.rateLimited') });
      else setError({ field: 'password', message: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout title={t('setup.title')} subtitle={t('setup.subtitle')}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t('setup.setupCode')} hint={t('setup.setupCodeHint')} error={error?.field === 'code' ? error.message : undefined}>
          {(id) => (
            <Input
              id={id}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoComplete="one-time-code"
              autoFocus
              className="font-mono tracking-widest"
              aria-invalid={error?.field === 'code'}
            />
          )}
        </Field>
        <Field label={t('setup.password')} hint={t('setup.passwordHint')} error={error?.field === 'password' ? error.message : undefined}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error?.field === 'password'}
            />
          )}
        </Field>
        <Field label={t('setup.confirm')} error={error?.field === 'confirm' ? error.message : undefined}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={error?.field === 'confirm'}
            />
          )}
        </Field>
        <Button type="submit" size="lg" disabled={pending || !code || !password}>
          {pending ? t('common.saving') : t('setup.create')}
        </Button>
      </form>
    </AuthLayout>
  );
}
