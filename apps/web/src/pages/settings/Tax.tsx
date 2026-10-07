import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller } from 'react-hook-form';
import { CASHFLOW_VAT_SCOPES, TAX_MODULES } from '@wmm/shared';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/misc';
import { useFireflyTags, useStats, useSyncStatus } from '@/lib/queries';
import { AffixInput, ChipsInput, PercentInput, SaveBar, SettingsCard, useSectionForm } from './common';

export default function TaxSettings() {
  return <TaxForm />;
}

export function TaxForm({ compact, onSaved }: { compact?: boolean; onSaved?: () => void }) {
  const { t } = useTranslation();
  const { form, submit, saving, ready } = useSectionForm('tax');
  const sync = useSyncStatus();
  const tags = useFireflyTags(!!sync.data?.configured);
  const stats = useStats();
  const listId = useId();
  if (!ready) return <Skeleton className="h-96" />;

  const { register, control, watch, formState } = form;
  const module = watch('module');
  const pattern = watch('grOe.advanceTaxAccountPattern') ?? '';
  const keyword = watch('grOe.advanceTaxNotesKeyword') ?? '';
  const prefix = watch('grOe.vatTagPrefix') ?? '';
  const scope = watch('cashflowVat.scope') ?? 'off';
  const tagList = tags.data?.tags ?? [];
  const errors = formState.errors.grOe;
  const showVatRules = module === 'gr_oe' || scope !== 'off';
  const categoryNames = [
    ...new Set([...(stats.data?.data?.categories.expenses ?? []), ...(stats.data?.data?.categories.income ?? [])].map((c) => c.name)),
  ].sort((a, b) => a.localeCompare(b));

  const companyTagField = (
    <Field label={t('settings.tax.companyTag')} hint={tags.isLoading ? t('settings.tax.tagsLoading') : t('settings.tax.companyTagHint')} error={errors?.companyTag?.message}>
      {(id) => <Input id={id} list={listId} autoComplete="off" {...register('grOe.companyTag')} />}
    </Field>
  );

  return (
    <form id="tax-form" className="grid gap-4" onSubmit={submit(undefined, onSaved)}>
      <datalist id={listId}>
        {tagList.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
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
            {companyTagField}
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
      </SettingsCard>

      {showVatRules && (
        <SettingsCard title={t('settings.tax.vatRules')} description={t('settings.tax.vatRulesHint')}>
          <div className="grid gap-5 sm:grid-cols-3">
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
        </SettingsCard>
      )}

      {!compact && (
        <SettingsCard title={t('settings.tax.cashflowVat')} description={t('settings.tax.cashflowVatHint')}>
          <Field label={t('settings.tax.cashflowVatScope')} hint={scope !== 'off' ? t(`settings.tax.scopeHints.${scope}`) : undefined}>
            {(id) => (
              <Select id={id} {...register('cashflowVat.scope')}>
                {CASHFLOW_VAT_SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {t(`settings.tax.scopes.${s}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {scope === 'company' && module !== 'gr_oe' && companyTagField}
          {scope === 'all' && (
            <Field label={t('settings.tax.excludedCategories')} hint={t('settings.tax.excludedCategoriesHint')}>
              {(id) => (
                <Controller
                  control={control}
                  name="cashflowVat.excludedCategories"
                  render={({ field }) => (
                    <ChipsInput
                      id={id}
                      value={field.value ?? []}
                      onChange={field.onChange}
                      suggestions={categoryNames}
                      placeholder={t('settings.tax.addCategory')}
                    />
                  )}
                />
              )}
            </Field>
          )}
        </SettingsCard>
      )}

      {compact && (
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      )}
      {!compact && <SaveBar dirty={formState.isDirty} saving={saving} onDiscard={() => form.reset()} form="tax-form" />}
    </form>
  );
}
