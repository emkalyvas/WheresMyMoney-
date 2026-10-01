import { useTranslation } from 'react-i18next';
import { PERIOD_KEYS } from '@wmm/shared';
import { Select, Segmented } from '@/components/ui/controls';
import { InfoTip } from '@/components/ui/overlay';
import { type Method, useView } from '@/lib/view';

/** Period picker (+ mean/median when "all time" is selected). State lives in the URL. */
export function PeriodControls({ showMethod = true }: { showMethod?: boolean }) {
  const { t } = useTranslation();
  const { period, setPeriod, method, setMethod } = useView();
  return (
    <>
      {showMethod && period === 'all' && (
        <div className="flex items-center gap-1.5">
          <Segmented<Method>
            label={t('period.method')}
            value={method}
            onChange={setMethod}
            options={[
              { value: 'mean', label: t('period.mean') },
              { value: 'median', label: t('period.median') },
            ]}
          />
          <InfoTip>{t('period.methodHint')}</InfoTip>
        </div>
      )}
      <Select
        aria-label={t('period.label')}
        value={period}
        onChange={(e) => setPeriod(e.target.value as (typeof PERIOD_KEYS)[number])}
        className="h-8 w-auto pr-8 text-xs font-medium"
      >
        {PERIOD_KEYS.map((p) => (
          <option key={p} value={p}>
            {t(`period.${p}`)}
          </option>
        ))}
      </Select>
    </>
  );
}
