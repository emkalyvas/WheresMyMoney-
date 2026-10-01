import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller } from 'react-hook-form';
import { Field, Input, Select, SwitchRow } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/misc';
import { AffixInput, SaveBar, SettingsCard, useSectionForm } from './common';

const LOCALES = ['en-GB', 'en-US', 'en-IE', 'el-GR', 'de-DE', 'fr-FR', 'es-ES', 'it-IT', 'nl-NL', 'pt-PT'];

export default function GeneralSettings() {
  const { t } = useTranslation();
  const { form, submit, saving, ready } = useSectionForm('general');
  const zones = useMemo(() => Intl.supportedValuesOf('timeZone'), []);
  const { register, control, formState } = form;
  if (!ready) return <Skeleton className="h-96" />;

  return (
    <form id="general-form" onSubmit={submit()}>
      <SettingsCard title={t('settings.general.title')}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('settings.general.startDate')} hint={t('settings.general.startDateHint')} error={formState.errors.startDate?.message}>
            {(id) => <Input id={id} type="date" {...register('startDate')} />}
          </Field>
          <Field label={t('settings.general.syncInterval')} hint={t('settings.general.syncIntervalHint')} error={formState.errors.syncIntervalMinutes?.message}>
            {(id) => (
              <AffixInput id={id} type="number" min={5} max={1440} suffix={t('settings.general.minutes')} {...register('syncIntervalMinutes', { valueAsNumber: true })} />
            )}
          </Field>
          <Field label={t('settings.general.timezone')} hint={t('settings.general.timezoneHint')}>
            {(id) => (
              <Select id={id} {...register('timezone')}>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z.replaceAll('_', ' ')}
                  </option>
                ))}
                {!zones.includes('UTC') && <option value="UTC">UTC</option>}
              </Select>
            )}
          </Field>
          <Field label={t('settings.general.locale')}>
            {(id) => (
              <Select id={id} {...register('locale')}>
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {new Intl.DisplayNames([l], { type: 'language' }).of(l)} — {new Intl.NumberFormat(l, { style: 'currency', currency: 'EUR' }).format(1234.5)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Controller
          control={control}
          name="excludeCurrentMonthFromAverages"
          render={({ field }) => (
            <SwitchRow
              label={t('settings.general.excludeCurrentMonth')}
              hint={t('settings.general.excludeCurrentMonthHint')}
              checked={!!field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </SettingsCard>
      <SaveBar dirty={formState.isDirty} saving={saving} onDiscard={() => form.reset()} form="general-form" />
    </form>
  );
}
