import { type FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthStatus } from '@wmm/shared';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/controls';
import { ApiError, api } from '@/lib/api';
import { keys } from '@/lib/queries';
import { AuthLayout } from './AuthLayout';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setPending(true);
    setError(null);
    try {
      await api.post('/api/auth/session', { password });
      // Update auth state and route in the same tick so the login route can't redirect to "/" first.
      const next = params.get('next');
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
      qc.setQueryData<AuthStatus>(keys.auth, { required: true, authenticated: true, setupRequired: false });
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t('auth.rateLimited') : t('auth.invalidPassword'));
      setPassword('');
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t('auth.password')} error={error ?? undefined}>
          {(id) => (
            <div className="relative">
              <Input
                id={id}
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute inset-y-0 right-0 grid w-10 cursor-pointer place-items-center text-muted-foreground"
                aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>
        <Button type="submit" size="lg" disabled={pending || !password}>
          {pending ? t('auth.loggingIn') : t('auth.login')}
        </Button>
      </form>
    </AuthLayout>
  );
}
