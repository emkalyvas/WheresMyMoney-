import { useTranslation } from 'react-i18next';
import { Controller } from 'react-hook-form';
import { Field } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/misc';
import { AffixInput, PercentInput, SaveBar, SettingsCard, useSectionForm } from './common';

export default function PlanningSettings() {
  const { t } = useTranslation();
  const { form, submit, saving, ready } = useSectionForm('planning');
  if (!ready) return <Skeleton className="h-72" />;
  const { register, control, formState } = form;
  const e = formState.errors;

  return (
    <form id="planning-form" onSubmit={submit()}>
      <SettingsCard title={t('settings.planning.title')} description={t('settings.planning.intro')}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('planning.goal')} error={e.targetAssetGoal?.message}>
            {(id) => <AffixInput id={id} type="number" min={0} step={1000} prefix="€" {...register('targetAssetGoal', { valueAsNumber: true })} />}
          </Field>
          <Field label={t('planning.monthly')} error={e.monthlyInvestmentAmount?.message}>
            {(id) => <AffixInput id={id} type="number" min={0} step={50} prefix="€" {...register('monthlyInvestmentAmount', { valueAsNumber: true })} />}
          </Field>
          <Field label={t('planning.growth')}>
            {(id) => (
              <Controller control={control} name="investmentGrowthRate" render={({ field }) => <PercentInput id={id} value={field.value} onChange={field.onChange} />} />
            )}
          </Field>
          <Field label={t('planning.swr')}>
            {(id) => (
              <Controller control={control} name="safeWithdrawalRate" render={({ field }) => <PercentInput id={id} value={field.value} onChange={field.onChange} step={0.25} />} />
            )}
          </Field>
          <Field label={t('planning.horizon')} error={e.horizonYears?.message}>
            {(id) => <AffixInput id={id} type="number" min={1} max={80} suffix={t('planning.yearsUnit')} {...register('horizonYears', { valueAsNumber: true })} />}
          </Field>
        </div>
      </SettingsCard>
      <SaveBar dirty={formState.isDirty} saving={saving} onDiscard={() => form.reset()} form="planning-form" />
    </form>
  );
}
