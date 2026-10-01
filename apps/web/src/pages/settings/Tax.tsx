import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller } from 'react-hook-form';
import { TAX_MODULES } from '@wmm/shared';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/misc';
import { useFireflyTags, useSyncStatus } from '@/lib/queries';
import { AffixInput, ChipsInput, PercentInput, SaveBar, SettingsCard, useSectionForm } from './common';

export default function TaxSettings() {
  return <TaxForm />;
}

export function TaxForm({ compact, onSaved }: { compact?: boolean; onSaved?: () => void }) {
  const { t } = useTranslation();
  const { form, submit, saving, ready } = useSectionForm('tax');
  const sync = useSyncStatus();
  const tags = useFireflyTags(!!sync.data?.configured);
  const listId = useId();
  if (!ready) return <Skeleton className="h-96" />;

  const { register, control, watch, formState } = form;
  const module = watch('module');
  const pattern = watch('grOe.advanceTaxAccountPattern') ?? '';
  const keyword = watch('grOe.advanceTaxNotesKeyword') ?? '';
  const prefix = watch('grOe.vatTagPrefix') ?? '';
  const tagList = tags.data?.tags ?? [];
  const errors = formState.errors.grOe;

  return (
    <form id="tax-form" onSubmit={submit(undefined, onSaved)}>
      <SettingsCard title={t('settings.tax.title')} description={t('settings.tax.moduleHint')}>
        <Field label={t('settings.tax.module')}>
          {(id) => (
            <Select id={id} {...register('module')}>
              {TAX_MODULES.map((m) => (
                <option key={m} value={m}>
                  {t(`settings.tax.modules.${m}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {module === 'gr_oe' && (
          <>
            <datalist id={listId}>
              {tagList.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('settings.tax.companyTag')} hint={tags.isLoading ? t('settings.tax.tagsLoading') : t('settings.tax.companyTagHint')} error={errors?.companyTag?.message}>
                {(id) => <Input id={id} list={listId} autoComplete="off" {...register('grOe.companyTag')} />}
              </Field>
              <Field label={t('settings.tax.vatTagPrefix')} hint={t('settings.tax.vatTagPrefixHint', { example: `${prefix || 'VAT'} 13` })}>
                {(id) => <Input id={id} autoComplete="off" {...register('grOe.vatTagPrefix')} />}
              </Field>
              <Field label={t('settings.tax.noVatTag')}>
                {(id) => <Input id={id} list={listId} autoComplete="off" {...register('grOe.noVatTag')} />}
              </Field>
              <Field label={t('settings.tax.defaultVat')} error={errors?.defaultVat?.message}>
                {(id) => <AffixInput id={id} type="number" min={0} max={100} step={1} suffix="%" {...register('grOe.defaultVat', { valueAsNumber: true })} />}
              </Field>
            </div>
            <Field label={t('settings.tax.vatPaidTags')} hint={t('settings.tax.vatPaidTagsHint')}>
              {(id) => (
                <Controller
                  control={control}
                  name="grOe.vatPaidTags"
                  render={({ field }) => (
                    <ChipsInput id={id} value={field.value ?? []} onChange={field.onChange} suggestions={tagList} placeholder={t('settings.tax.addTag')} />
                  )}
                />
              )}
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label={t('settings.tax.incomeTaxRate')}>
                {(id) => (
                  <Controller control={control} name="grOe.incomeTaxRate" render={({ field }) => <PercentInput id={id} value={field.value} onChange={field.onChange} />} />
                )}
              </Field>
              <Field label={t('settings.tax.advanceTaxRate')}>
                {(id) => (
                  <Controller control={control} name="grOe.advanceTaxRate" render={({ field }) => <PercentInput id={id} value={field.value} onChange={field.onChange} />} />
                )}
              </Field>
              <Field label={t('settings.tax.businessTax')} error={errors?.businessTax?.message}>
                {(id) => <AffixInput id={id} type="number" min={0} step={10} prefix="€" {...register('grOe.businessTax', { valueAsNumber: true })} />}
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={t('settings.tax.advanceTaxAccountPattern')}
                hint={t('settings.tax.advanceTaxAccountPatternHint', { example: pattern.replaceAll('{year}', String(new Date().getFullYear() - 1)) })}
              >
                {(id) => <Input id={id} autoComplete="off" {...register('grOe.advanceTaxAccountPattern')} />}
              </Field>
              <Field label={t('settings.tax.advanceTaxNotesKeyword')} hint={t('settings.tax.advanceTaxNotesKeywordHint', { keyword })}>
                {(id) => <Input id={id} autoComplete="off" {...register('grOe.advanceTaxNotesKeyword')} />}
              </Field>
            </div>
          </>
        )}
        {compact && (
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        )}
      </SettingsCard>
      {!compact && <SaveBar dirty={formState.isDirty} saving={saving} onDiscard={() => form.reset()} form="tax-form" />}
    </form>
  );
}
