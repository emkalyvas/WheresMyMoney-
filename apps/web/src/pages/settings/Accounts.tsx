import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ACCOUNT_KINDS, type AccountKind, type KnownAccount, type Settings } from '@wmm/shared';
import { Button } from '@/components/ui/button';
import { Select, Switch } from '@/components/ui/controls';
import { Badge, Skeleton } from '@/components/ui/misc';
import { Money, Private } from '@/components/metric/Money';
import { useAccounts, useUpdateSettings } from '@/lib/queries';
import { SaveBar, SettingsCard } from './common';

type Rules = Settings['accounts']['rules'];

export default function AccountsSettings() {
  return <AccountsEditor />;
}

/** Include/exclude accounts and set their type. Rules are keyed by account name. */
export function AccountsEditor({ inline, onSaved }: { inline?: boolean; onSaved?: () => void }) {
  const { t } = useTranslation();
  const q = useAccounts();
  const update = useUpdateSettings();
  const [rules, setRules] = useState<Rules>({});
  useEffect(() => {
    if (q.data) setRules(q.data.rules);
  }, [q.data]);

  const accounts = useMemo(() => q.data?.accounts ?? [], [q.data]);
  const known = useMemo(() => new Set(accounts.map((a) => a.name.toLowerCase())), [accounts]);
  const orphanRules = Object.keys(rules).filter((n) => !known.has(n.toLowerCase()));
  const dirty = q.data ? JSON.stringify(normalise(rules)) !== JSON.stringify(normalise(q.data.rules)) : false;

  if (q.isLoading) return <Skeleton className="h-72" />;

  const ruleFor = (name: string) => rules[Object.keys(rules).find((k) => k.toLowerCase() === name.toLowerCase()) ?? name];
  const setRule = (name: string, patch: Partial<Rules[string]>) => {
    setRules((r) => {
      const key = Object.keys(r).find((k) => k.toLowerCase() === name.toLowerCase()) ?? name;
      const next = { ...(r[key] ?? { include: true }), ...patch };
      const copy = { ...r };
      if (next.include && !next.kind) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  };

  const save = async () => {
    try {
      await update.mutateAsync({ section: 'accounts', value: { rules } });
      await q.refetch();
      toast.success(t('settings.savedToast'));
      onSaved?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const assets = accounts.filter((a) => a.type === 'asset');
  const liabilities = accounts.filter((a) => a.type === 'liability');

  const body = (
    <>
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('settings.accounts.empty')}</p>
      ) : (
        <>
          <AccountGroup title={t('settings.accounts.assets')} accounts={assets} ruleFor={ruleFor} setRule={setRule} withKind />
          {liabilities.length > 0 && <AccountGroup title={t('settings.accounts.liabilities')} accounts={liabilities} ruleFor={ruleFor} setRule={setRule} />}
        </>
      )}
      {orphanRules.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">{t('settings.accounts.unknown')}</div>
          <ul className="flex flex-wrap gap-2">
            {orphanRules.map((n) => (
              <li key={n}>
                <Badge className="gap-2">
                  <Private>{n}</Private>
                  <button
                    type="button"
                    className="cursor-pointer"
                    onClick={() =>
                      setRules((r) => {
                        const c = { ...r };
                        delete c[n];
                        return c;
                      })
                    }
                    aria-label={t('common.remove')}
                  >
                    ×
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  if (inline) {
    return (
      <div className="grid gap-5">
        {body}
        <div>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SettingsCard title={t('settings.accounts.title')} description={t('settings.accounts.intro')}>
        {body}
      </SettingsCard>
      <SaveBar dirty={dirty} saving={update.isPending} onDiscard={() => setRules(q.data?.rules ?? {})} onSave={() => void save()} />
    </div>
  );
}

function normalise(r: Rules) {
  return Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)));
}

function AccountGroup({
  title,
  accounts,
  ruleFor,
  setRule,
  withKind,
}: {
  title: string;
  accounts: KnownAccount[];
  ruleFor: (name: string) => Rules[string] | undefined;
  setRule: (name: string, patch: Partial<Rules[string]>) => void;
  withKind?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="divide-y rounded-xl border">
        {accounts.map((a) => {
          const rule = ruleFor(a.name);
          const included = !a.excludedInFirefly && rule?.include !== false;
          return (
            <li key={`${a.source}:${a.name}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <Switch
                checked={included}
                disabled={a.excludedInFirefly}
                onCheckedChange={(v) => setRule(a.name, { include: v })}
                label={`${t('settings.accounts.include')}: ${a.name}`}
              />
              <div className="min-w-0 flex-1">
                <Private className={included ? 'font-medium' : 'font-medium text-muted-foreground line-through'}>{a.name}</Private>
                <div className="text-xs text-muted-foreground">
                  {a.source === 'trading212' ? 'Trading 212' : 'Firefly III'} · {a.currency}
                  {a.excludedInFirefly && <> · {t('settings.accounts.excludedInFirefly')}</>}
                </div>
              </div>
              <Money value={a.balanceEur} className="text-sm" />
              {withKind && (
                <Select
                  aria-label={t('settings.accounts.type')}
                  value={rule?.kind ?? ''}
                  disabled={!included}
                  onChange={(e) => setRule(a.name, { kind: (e.target.value || undefined) as AccountKind | undefined })}
                  className="h-8 w-auto text-xs"
                >
                  <option value="">{t('settings.accounts.auto', { kind: t(`kinds.${a.suggestedKind}`) })}</option>
                  {ACCOUNT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`kinds.${k}`)}
                    </option>
                  ))}
                </Select>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
