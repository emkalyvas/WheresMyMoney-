import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller } from 'react-hook-form';
import type { ConnectionTestResult } from '@wmm/shared';
import { Button } from '@/components/ui/button';
import { Field, Input, SwitchRow } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { ChipsInput, SaveBar, SecretField, SettingsCard, TestResult, useSectionForm } from './common';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ReportsSettings() {
  const { t } = useTranslation();
  const { form, submit, saving, ready, secrets } = useSectionForm('reports');
  const [pass, setPass] = useState<string | undefined>(undefined);
  const [test, setTest] = useState<ConnectionTestResult>();
  const [testing, setTesting] = useState(false);
  if (!ready) return <Skeleton className="h-96" />;
  const { register, control, formState } = form;
  const dirty = formState.isDirty || pass !== undefined;

  const sendTest = async () => {
    setTesting(true);
    try {
      setTest(await api.post<ConnectionTestResult>('/api/settings/test/email'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <form
      id="reports-form"
      className="grid gap-4"
      onSubmit={submit(
        () => (pass !== undefined ? { 'smtp.pass': pass === '' ? null : pass } : undefined),
        () => setPass(undefined),
      )}
    >
      <SettingsCard title={t('settings.reports.schedule')}>
        <Controller
          control={control}
          name="scheduleEnabled"
          render={({ field }) => <SwitchRow label={t('settings.reports.scheduleEnabled')} checked={!!field.value} onCheckedChange={field.onChange} />}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('settings.reports.dayOfMonth')} error={formState.errors.dayOfMonth?.message}>
            {(id) => <Input id={id} type="number" min={1} max={28} {...register('dayOfMonth', { valueAsNumber: true })} />}
          </Field>
          <Field label={t('settings.reports.time')} error={formState.errors.time?.message}>
            {(id) => <Input id={id} type="time" {...register('time')} />}
          </Field>
        </div>
        <Field label={t('settings.reports.recipients')} hint={t('settings.reports.recipientsHint')}>
          {(id) => (
            <Controller
              control={control}
              name="recipients"
              render={({ field }) => (
                <ChipsInput
                  id={id}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  placeholder={t('settings.reports.addRecipient')}
                  validate={(v) => (EMAIL.test(v) ? null : t('settings.reports.invalidEmail'))}
                />
              )}
            />
          )}
        </Field>
        <Controller
          control={control}
          name="redactAccountNames"
          render={({ field }) => (
            <SwitchRow label={t('settings.reports.redact')} hint={t('settings.reports.redactHint')} checked={!!field.value} onCheckedChange={field.onChange} />
          )}
        />
      </SettingsCard>

      <SettingsCard title={t('settings.reports.smtp')}>
        <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
          <Field label={t('settings.reports.host')}>{(id) => <Input id={id} autoComplete="off" spellCheck={false} {...register('smtp.host')} />}</Field>
          <Field label={t('settings.reports.port')}>{(id) => <Input id={id} type="number" {...register('smtp.port', { valueAsNumber: true })} />}</Field>
        </div>
        <Controller
          control={control}
          name="smtp.secure"
          render={({ field }) => <SwitchRow label={t('settings.reports.secure')} checked={!!field.value} onCheckedChange={field.onChange} />}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('settings.reports.user')}>{(id) => <Input id={id} autoComplete="off" {...register('smtp.user')} />}</Field>
          <SecretField label={t('settings.reports.password')} status={secrets['smtp.pass']} value={pass} onChange={setPass} autoComplete="new-password" />
        </div>
        <Field label={t('settings.reports.from')} hint={t('settings.reports.fromHint')}>
          {(id) => <Input id={id} autoComplete="off" {...register('smtp.from')} />}
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={sendTest} disabled={testing || dirty}>
            {testing ? t('common.testing') : t('settings.reports.sendTest')}
          </Button>
          <TestResult result={test} okText={t('settings.connections.sent')} />
        </div>
      </SettingsCard>
      <SaveBar dirty={dirty} saving={saving} onDiscard={() => { form.reset(); setPass(undefined); }} form="reports-form" />
    </form>
  );
}
