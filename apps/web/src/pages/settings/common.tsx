import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type DefaultValues, type FieldValues, type Resolver, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, KeyRound, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { type ConnectionTestResult, type SecretStatus, type Settings, type SettingsPatch, sectionSchemas } from '@wmm/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/controls';
import { ApiError } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useSaveSection, useSettings } from '@/lib/queries';
import { cn } from '@/lib/utils';

export function SettingsCard({ title, description, children, action }: { title: ReactNode; description?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} action={action} />
      <CardContent className="grid gap-5">{children}</CardContent>
    </Card>
  );
}

/**
 * A react-hook-form bound to one settings section, validated by the shared zod
 * schema (the same one the server uses). `secrets` are sent alongside.
 */
export function useSectionForm<K extends keyof Settings>(section: K) {
  const { t } = useTranslation();
  const settings = useSettings();
  const save = useSaveSection(section);
  const values = settings.data?.settings[section];
  const form = useForm<Settings[K] & FieldValues>({
    resolver: zodResolver(sectionSchemas[section] as never) as unknown as Resolver<Settings[K] & FieldValues>,
    values: values as Settings[K] & FieldValues,
    resetOptions: { keepDirtyValues: false },
    mode: 'onBlur',
  });

  const submit = (secrets?: () => SettingsPatch['secrets'], after?: () => void) =>
    form.handleSubmit(async (value) => {
      try {
        await save.save(value as Settings[K], secrets?.());
        form.reset(value as DefaultValues<Settings[K] & FieldValues>);
        toast.success(t('settings.savedToast'));
        after?.();
      } catch (err) {
        toast.error(err instanceof ApiError && err.issues?.length ? err.issues.map((i) => `${i.path}: ${i.message}`).join('\n') : (err as Error).message);
      }
    });

  return { form, submit, saving: save.isPending, ready: !!values, secrets: settings.data?.secrets ?? {} };
}

/** Sticky bar shown while a form has unsaved changes. */
export function SaveBar({
  dirty,
  saving,
  onDiscard,
  form,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  /** id of the form to submit… */
  form?: string;
  /** …or a callback, for editors that are not a single form */
  onSave?: () => void;
}) {
  const { t } = useTranslation();
  if (!dirty) return null;
  return (
    <div className="sticky bottom-20 z-20 mt-4 flex items-center justify-between gap-3 rounded-xl border bg-card/95 p-3 pl-4 shadow-lg backdrop-blur lg:bottom-4">
      <span className="text-sm font-medium">{t('common.unsavedChanges')}</span>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onDiscard} disabled={saving}>
          {t('common.discard')}
        </Button>
        <Button type={onSave ? 'button' : 'submit'} form={onSave ? undefined : form} onClick={onSave} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </div>
  );
}

/**
 * Write-only secret. Shows whether a value is stored (and its last 4 characters
 * for long values) but never the value itself. `value` is the pending new value:
 * undefined = unchanged, '' = remove, string = replace.
 */
export function SecretField({
  label,
  hint,
  status,
  value,
  onChange,
  autoComplete = 'off',
}: {
  label: string;
  hint?: ReactNode;
  status?: SecretStatus;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  autoComplete?: string;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const id = useId();
  const editing = value !== undefined || !status?.set;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {editing ? (
        <div className="flex gap-2">
          <Input
            id={id}
            type="password"
            autoComplete={autoComplete}
            spellCheck={false}
            placeholder={t('settings.secret.placeholder')}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="font-mono"
          />
          {status?.set && (
            <Button variant="ghost" size="icon" onClick={() => onChange(undefined)} aria-label={t('common.cancel')}>
              <X />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-1.5">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <KeyRound className="size-4 shrink-0 text-positive" />
            <span className="truncate">
              {status.hint ? t('settings.secret.savedHint', { hint: status.hint }) : t('settings.secret.saved')}
              {status.updatedAt && <span className="text-muted-foreground"> · {f.date(status.updatedAt)}</span>}
            </span>
          </span>
          <Button variant="outline" size="sm" onClick={() => onChange('')} id={id}>
            {t('settings.secret.replace')}
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{hint ?? t('settings.secret.writeOnly')}</p>
    </div>
  );
}

/** Edits a 0..1 rate as a percentage. */
export function PercentInput({ value, onChange, id, max = 100, step = 0.1 }: { value: number; onChange: (v: number) => void; id?: string; max?: number; step?: number }) {
  const [text, setText] = useState(() => fmtPct(value));
  useEffect(() => setText(fmtPct(value)), [value]);
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="decimal"
        type="number"
        min={0}
        max={max}
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number.parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(Math.round(n * 1000) / 100000);
        }}
        className="pr-8"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted-foreground">%</span>
    </div>
  );
}
const fmtPct = (v: number) => String(Math.round(v * 100000) / 1000);

export function AffixInput({ suffix, prefix, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { suffix?: string; prefix?: string }) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm text-muted-foreground">{prefix}</span>}
      <Input {...props} className={cn(prefix && 'pl-7', suffix && 'pr-16')} />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted-foreground">{suffix}</span>}
    </div>
  );
}

/** A list of short strings (tags, e-mail addresses) edited as chips. */
export function ChipsInput({
  value,
  onChange,
  suggestions,
  placeholder,
  id,
  validate,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  id?: string;
  validate?: (v: string) => string | null;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const add = () => {
    const v = draft.trim().replace(/,$/, '');
    if (!v) return;
    const problem = validate?.(v) ?? null;
    if (problem) return setError(problem);
    if (!value.includes(v)) onChange([...value, v]);
    setDraft('');
    setError(null);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1.5 shadow-xs focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="cursor-pointer text-muted-foreground hover:text-foreground" aria-label={`${t('common.remove')} ${v}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          list={suggestions ? listId : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={value.length ? undefined : placeholder}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none"
        />
        {suggestions && (
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-negative">{error}</p>}
    </div>
  );
}

export function TestResult({ result, okText }: { result?: ConnectionTestResult; okText?: string }) {
  const { t } = useTranslation();
  if (!result) return null;
  const reason = result.message as keyof ReturnType<typeof errorKeys>;
  return (
    <p className={cn('flex items-center gap-1.5 text-sm', result.ok ? 'text-positive' : 'text-negative')} role="status">
      {result.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
      {result.ok
        ? (okText ?? t('settings.connections.ok'))
        : t('settings.connections.failed', { reason: errorKeys()[reason] ? t(errorKeys()[reason]) : result.message })}
    </p>
  );
}

const errorKeys = () =>
  ({
    unreachable: 'settings.connections.errors.unreachable',
    unauthorized: 'settings.connections.errors.unauthorized',
    not_found: 'settings.connections.errors.not_found',
    rate_limited: 'settings.connections.errors.rate_limited',
    bad_response: 'settings.connections.errors.bad_response',
    timeout: 'settings.connections.errors.timeout',
    not_configured: 'settings.connections.errors.not_configured',
  }) as const;
