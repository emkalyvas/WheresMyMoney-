import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ConnectionTestResult, Settings, Trading212Account } from '@wmm/shared';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useSettings, useUpdateSettings } from '@/lib/queries';
import { SaveBar, SecretField, SettingsCard, TestResult, useSectionForm } from './common';

export default function ConnectionsSettings() {
  return (
    <div className="grid gap-4">
      <FireflyForm />
      <Trading212Editor />
      <FxForm />
    </div>
  );
}

/** Firefly III URL + token, with a connection test. Reused by the onboarding wizard. */
export function FireflyForm({ onSaved, compact }: { onSaved?: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  const { form, submit, saving, ready, secrets } = useSectionForm('firefly');
  const [token, setToken] = useState<string | undefined>(undefined);
  const [test, setTest] = useState<ConnectionTestResult>();
  const [testing, setTesting] = useState(false);
  if (!ready) return <Skeleton className="h-64" />;

  const runTest = async () => {
    setTesting(true);
    try {
      setTest(await api.post<ConnectionTestResult>('/api/settings/test/firefly', { url: form.getValues('url') || undefined, token: token || undefined }));
    } finally {
      setTesting(false);
    }
  };
  const dirty = form.formState.isDirty || token !== undefined;

  return (
    <form
      id="firefly-form"
      onSubmit={submit(
        () => (token !== undefined ? { 'firefly.token': token === '' ? null : token } : undefined),
        () => {
          setToken(undefined);
          onSaved?.();
        },
      )}
    >
      <SettingsCard title={t('settings.connections.firefly')}>
        <Field label={t('settings.connections.fireflyUrl')} hint={t('settings.connections.fireflyUrlHint')} error={form.formState.errors.url?.message}>
          {(id) => <Input id={id} type="url" inputMode="url" placeholder="https://" autoComplete="off" spellCheck={false} {...form.register('url')} />}
        </Field>
        <SecretField
          label={t('settings.connections.fireflyToken')}
          hint={t('settings.connections.fireflyTokenHint')}
          status={secrets['firefly.token']}
          value={token}
          onChange={setToken}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={runTest} disabled={testing}>
            {testing ? t('common.testing') : t('common.test')}
          </Button>
          <TestResult
            result={test}
            okText={test?.details ? t('settings.connections.connected', { version: test.details.version, accounts: test.details.accounts }) : undefined}
          />
        </div>
        {compact && (
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        )}
      </SettingsCard>
      {!compact && <SaveBar dirty={dirty} saving={saving} onDiscard={() => { form.reset(); setToken(undefined); }} form="firefly-form" />}
    </form>
  );
}

type DraftAccount = Trading212Account & { apiKey?: string; apiSecret?: string };

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function Trading212Editor() {
  const { t } = useTranslation();
  const settings = useSettings();
  const update = useUpdateSettings();
  const saved = settings.data?.settings.trading212.accounts;
  const [accounts, setAccounts] = useState<DraftAccount[]>([]);
  const [tests, setTests] = useState<Record<string, ConnectionTestResult | 'pending'>>({});

  useEffect(() => {
    if (saved) setAccounts(saved.map((a) => ({ ...a })));
  }, [saved]);
  if (!settings.data) return <Skeleton className="h-40" />;

  const secrets = settings.data.secrets;
  const dirty =
    JSON.stringify(accounts.map(({ id, name, env }) => ({ id, name, env }))) !== JSON.stringify(saved) ||
    accounts.some((a) => a.apiKey !== undefined || a.apiSecret !== undefined);

  const patch = (id: string, p: Partial<DraftAccount>) => setAccounts((xs) => xs.map((a) => (a.id === id ? { ...a, ...p } : a)));

  const save = async () => {
    const secretPatch: Record<string, string | null> = {};
    for (const a of accounts) {
      if (a.apiKey !== undefined) secretPatch[`trading212.${a.id}.apiKey`] = a.apiKey || null;
      if (a.apiSecret !== undefined) secretPatch[`trading212.${a.id}.apiSecret`] = a.apiSecret || null;
    }
    try {
      await update.mutateAsync({
        section: 'trading212',
        value: { accounts: accounts.map(({ id, name, env }) => ({ id, name, env })) } satisfies Settings['trading212'],
        secrets: secretPatch,
      });
      toast.success(t('settings.savedToast'));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const test = async (a: DraftAccount) => {
    setTests((x) => ({ ...x, [a.id]: 'pending' }));
    const r = await api.post<ConnectionTestResult>(`/api/settings/test/trading212/${a.id}`, {
      apiKey: a.apiKey || undefined,
      apiSecret: a.apiSecret || undefined,
      env: a.env,
    });
    setTests((x) => ({ ...x, [a.id]: r }));
  };

  return (
    <div>
      <SettingsCard
        title={t('settings.connections.trading212')}
        description={t('settings.connections.trading212Hint')}
        action={
          <Button variant="outline" size="sm" onClick={() => setAccounts((xs) => [...xs, { id: newId(), name: '', env: 'live', apiKey: '', apiSecret: '' }])}>
            <Plus /> {t('settings.connections.addAccount')}
          </Button>
        }
      >
        {accounts.length === 0 && <p className="text-sm text-muted-foreground">{t('settings.connections.noAccounts')}</p>}
        {accounts.map((a) => {
          const result = tests[a.id];
          return (
            <div key={a.id} className="grid gap-4 rounded-xl border p-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_160px_auto] sm:items-end">
                <Field label={t('settings.connections.accountName')}>
                  {(id) => <Input id={id} value={a.name} placeholder={t('settings.connections.accountNamePlaceholder')} onChange={(e) => patch(a.id, { name: e.target.value })} />}
                </Field>
                <Field label={t('settings.connections.environment')}>
                  {(id) => (
                    <Select id={id} value={a.env} onChange={(e) => patch(a.id, { env: e.target.value as 'live' | 'demo' })}>
                      <option value="live">{t('settings.connections.live')}</option>
                      <option value="demo">{t('settings.connections.demo')}</option>
                    </Select>
                  )}
                </Field>
                <Button variant="ghost" size="icon" onClick={() => setAccounts((xs) => xs.filter((x) => x.id !== a.id))} aria-label={t('settings.connections.removeAccount')}>
                  <Trash2 />
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SecretField label={t('settings.connections.apiKey')} status={secrets[`trading212.${a.id}.apiKey`]} value={a.apiKey} onChange={(v) => patch(a.id, { apiKey: v })} />
                <SecretField label={t('settings.connections.apiSecret')} status={secrets[`trading212.${a.id}.apiSecret`]} value={a.apiSecret} onChange={(v) => patch(a.id, { apiSecret: v })} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => void test(a)} disabled={result === 'pending'}>
                  {result === 'pending' ? t('common.testing') : t('common.test')}
                </Button>
                {result && result !== 'pending' && <TestResult result={result} />}
              </div>
            </div>
          );
        })}
      </SettingsCard>
      <SaveBar
        dirty={dirty}
        saving={update.isPending}
        onDiscard={() => setAccounts((saved ?? []).map((a) => ({ ...a })))}
        onSave={() => void save()}
      />
    </div>
  );
}

function FxForm() {
  const { t } = useTranslation();
  const { form, submit, saving, ready } = useSectionForm('fx');
  if (!ready) return null;
  return (
    <form id="fx-form" onSubmit={submit()}>
      <SettingsCard title={t('settings.connections.fx')} description={t('settings.connections.fxHint')}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('settings.connections.fiatProvider')}>
            {(id) => (
              <Select id={id} {...form.register('fiatProvider')}>
                <option value="open-er-api">open.er-api.com</option>
                <option value="none">{t('settings.connections.providerNone')}</option>
              </Select>
            )}
          </Field>
          <Field label={t('settings.connections.cryptoProvider')}>
            {(id) => (
              <Select id={id} {...form.register('cryptoProvider')}>
                <option value="binance">Binance</option>
                <option value="none">{t('settings.connections.providerNone')}</option>
              </Select>
            )}
          </Field>
        </div>
      </SettingsCard>
      <SaveBar dirty={form.formState.isDirty} saving={saving} onDiscard={() => form.reset()} form="fx-form" />
    </form>
  );
}
