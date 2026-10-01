import { useTranslation } from 'react-i18next';
import { Monitor, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { Field, Select } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/misc';
import { LANGUAGES } from '@/i18n';
import { applyTheme, type ThemePref } from '@/lib/preferences';
import { useSaveSection, useSettings } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { SettingsCard } from './common';

const THEMES: { value: ThemePref; icon: typeof Sun }[] = [
  { value: 'system', icon: Monitor },
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
];

export default function AppearanceSettings() {
  const { t } = useTranslation();
  const settings = useSettings();
  const save = useSaveSection('appearance');
  const current = settings.data?.settings.appearance;
  if (!current) return <Skeleton className="h-48" />;

  const setTheme = async (theme: ThemePref) => {
    applyTheme(theme);
    await save.save({ ...current, theme });
    toast.success(t('settings.savedToast'));
  };

  return (
    <SettingsCard title={t('settings.appearance.title')}>
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">{t('settings.appearance.theme')}</span>
        <div role="radiogroup" aria-label={t('settings.appearance.theme')} className="grid max-w-md grid-cols-3 gap-2">
          {THEMES.map(({ value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={current.theme === value}
              onClick={() => void setTheme(value)}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors hover:bg-muted',
                current.theme === value && 'border-primary bg-accent text-accent-foreground',
              )}
            >
              <Icon className="size-5" />
              {t(`settings.appearance.themes.${value}`)}
            </button>
          ))}
        </div>
      </div>
      <Field label={t('settings.appearance.language')} hint={t('settings.appearance.languageHint')} className="max-w-xs">
        {(id) => (
          <Select id={id} value={current.language} disabled={LANGUAGES.length < 2} onChange={(e) => void save.save({ ...current, language: e.target.value as 'en' })}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {t(`settings.appearance.languages.${l}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </SettingsCard>
  );
}
