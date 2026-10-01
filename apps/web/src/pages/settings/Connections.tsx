import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConnectionTestResult } from '@wmm/shared';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { SaveBar, SecretField, SettingsCard, TestResult, useSectionForm } from './common';
import { BrokerEditor } from './BrokerEditor';

export default function ConnectionsSettings() {
  return (
    <div className="grid gap-4">
      <FireflyForm />
      <BrokerEditor broker="trading212" />
      <BrokerEditor broker="etoro" />
      <BrokerEditor broker="ibkr" />
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
