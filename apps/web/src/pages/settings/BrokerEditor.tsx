import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Broker, ConnectionTestResult, Settings } from '@wmm/shared';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useSettings, useUpdateSettings } from '@/lib/queries';
import { SaveBar, SecretField, SettingsCard, TestResult } from './common';

type AccountOf<B extends Broker> = Settings[B]['accounts'][number];
type AnyAccount = AccountOf<Broker> & Record<string, unknown>;

interface FieldDef {
  key: string;
  kind: 'select' | 'text' | 'number';
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  label: string;
  min?: number;
  max?: number;
}

interface BrokerConfig {
  title: string;
  description: string;
  guide: string[];
  links: { label: string; url: string }[];
  newAccount: (id: string) => AnyAccount;
  fields: FieldDef[];
  secrets: { key: string; label: string }[];
  /** Fields (besides id and name) persisted in settings. */
  persisted: string[];
  okText: (r: ConnectionTestResult) => string | undefined;
  testNote?: string;
}

function useBrokerConfig(broker: Broker): BrokerConfig {
  const { t } = useTranslation();
  const c = 'settings.connections';
  switch (broker) {
    case 'trading212':
      return {
        title: t(`${c}.trading212`),
        description: t(`${c}.trading212Hint`),
        guide: [t(`${c}.guides.trading212.1`), t(`${c}.guides.trading212.2`)],
        links: [],
        newAccount: (id) => ({ id, name: '', env: 'live' }),
        fields: [
          {
            key: 'env',
            kind: 'select',
            label: t(`${c}.environment`),
            options: [
              { value: 'live', label: t(`${c}.live`) },
              { value: 'demo', label: t(`${c}.demo`) },
            ],
          },
        ],
        secrets: [
          { key: 'apiKey', label: t(`${c}.apiKey`) },
          { key: 'apiSecret', label: t(`${c}.apiSecret`) },
        ],
        persisted: ['env'],
        okText: () => undefined,
      };
    case 'etoro':
      return {
        title: 'eToro',
        description: t(`${c}.etoroHint`),
        guide: [t(`${c}.guides.etoro.1`), t(`${c}.guides.etoro.2`), t(`${c}.guides.etoro.3`)],
        links: [
          { label: t(`${c}.guides.etoro.link`), url: 'https://builders.etoro.com/get-started' },
          { label: t(`${c}.guides.etoro.settings`), url: 'https://www.etoro.com/settings/trade' },
        ],
        newAccount: (id) => ({ id, name: '', env: 'real' }),
        fields: [
          {
            key: 'env',
            kind: 'select',
            label: t(`${c}.account`),
            options: [
              { value: 'real', label: t(`${c}.real`) },
              { value: 'demo', label: t(`${c}.virtual`) },
            ],
          },
        ],
        secrets: [
          { key: 'apiKey', label: t(`${c}.etoroApiKey`) },
          { key: 'userKey', label: t(`${c}.etoroUserKey`) },
        ],
        persisted: ['env'],
        okText: (r) => t(`${c}.etoroOk`, { positions: r.details?.positions ?? 0 }),
      };
    case 'ibkr':
      return {
        title: 'Interactive Brokers',
        description: t(`${c}.ibkrHint`),
        guide: [t(`${c}.guides.ibkr.1`), t(`${c}.guides.ibkr.2`), t(`${c}.guides.ibkr.3`)],
        links: [
          { label: t(`${c}.guides.ibkr.link`), url: 'https://www.interactivebrokers.com/campus/ibkr-api-page/flex-web-service/' },
          { label: t(`${c}.guides.ibkr.queries`), url: 'https://www.ibkrguides.com/clientportal/performanceandstatements/flex.htm' },
        ],
        newAccount: (id) => ({ id, name: '', queryId: '', refreshHours: 6 }),
        fields: [
          { key: 'queryId', kind: 'text', label: t(`${c}.queryId`), placeholder: '987654', hint: t(`${c}.queryIdHint`) },
          { key: 'refreshHours', kind: 'number', label: t(`${c}.refreshHours`), min: 1, max: 24, hint: t(`${c}.refreshHoursHint`) },
        ],
        secrets: [{ key: 'token', label: t(`${c}.flexToken`) }],
        persisted: ['queryId', 'refreshHours'],
        okText: (r) =>
          r.details?.missing
            ? t(`${c}.ibkrOkMissing`, { positions: r.details.positions, missing: r.details.missing })
            : t(`${c}.ibkrOk`, { positions: r.details?.positions ?? 0, accounts: r.details?.accounts ?? 1 }),
        testNote: t(`${c}.ibkrTestNote`),
      };
  }
}

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Add, edit, test and remove accounts of one broker. Credentials are write-only secrets. */
export function BrokerEditor({ broker }: { broker: Broker }) {
  const { t } = useTranslation();
  const cfg = useBrokerConfig(broker);
  const settings = useSettings();
  const update = useUpdateSettings();
  const saved = settings.data?.settings[broker].accounts as AnyAccount[] | undefined;
  const [accounts, setAccounts] = useState<AnyAccount[]>([]);
  const [pending, setPending] = useState<Record<string, Record<string, string | undefined>>>({});
  const [tests, setTests] = useState<Record<string, ConnectionTestResult | 'pending'>>({});

  useEffect(() => {
    if (saved) {
      setAccounts(saved.map((a) => ({ ...a })));
      setPending({});
    }
  }, [saved]);
  if (!settings.data) return <Skeleton className="h-40" />;

  const secrets = settings.data.secrets;
  const strip = (a: AnyAccount) => Object.fromEntries(['id', 'name', ...cfg.persisted].map((k) => [k, a[k]]));
  const dirty =
    JSON.stringify(accounts.map(strip)) !== JSON.stringify((saved ?? []).map(strip)) ||
    Object.values(pending).some((p) => Object.values(p).some((v) => v !== undefined));

  const patch = (id: string, p: Record<string, unknown>) => setAccounts((xs) => xs.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const setSecret = (id: string, key: string, v: string | undefined) =>
    setPending((p) => ({ ...p, [id]: { ...p[id], [key]: v } }));

  const add = () => {
    const a = cfg.newAccount(newId());
    setAccounts((xs) => [...xs, a]);
    setPending((p) => ({ ...p, [a.id]: Object.fromEntries(cfg.secrets.map((s) => [s.key, ''])) }));
  };

  const save = async () => {
    const secretPatch: Record<string, string | null> = {};
    for (const [id, values] of Object.entries(pending)) {
      if (!accounts.some((a) => a.id === id)) continue;
      for (const [key, v] of Object.entries(values)) if (v !== undefined) secretPatch[`${broker}.${id}.${key}`] = v || null;
    }
    try {
      await update.mutateAsync({ section: broker, value: { accounts: accounts.map(strip) }, secrets: secretPatch });
      toast.success(t('settings.savedToast'));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const test = async (a: AnyAccount) => {
    setTests((x) => ({ ...x, [a.id]: 'pending' }));
    const body: Record<string, unknown> = Object.fromEntries(cfg.persisted.map((k) => [k, a[k] || undefined]));
    for (const s of cfg.secrets) body[s.key] = pending[a.id]?.[s.key] || undefined;
    try {
      const r = await api.post<ConnectionTestResult>(`/api/settings/test/${broker}/${a.id}`, body);
      setTests((x) => ({ ...x, [a.id]: r }));
    } catch (e) {
      setTests((x) => ({ ...x, [a.id]: { ok: false, message: (e as Error).message } }));
    }
  };

  return (
    <div>
      <SettingsCard
        title={cfg.title}
        description={cfg.description}
        action={
          <Button variant="outline" size="sm" onClick={add}>
            <Plus /> {t('settings.connections.addAccount')}
          </Button>
        }
      >
        <details className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">{t('settings.connections.howTo')}</summary>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
            {cfg.guide.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ol>
          {cfg.links.length > 0 && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {cfg.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                {l.label} <ExternalLink className="size-3" />
              </a>
            ))}
          </div>}
        </details>

        {accounts.length === 0 && <p className="text-sm text-muted-foreground">{t('settings.connections.noBrokerAccounts')}</p>}
        {accounts.map((a) => {
          const result = tests[a.id];
          return (
            <div key={a.id} className="grid gap-4 rounded-xl border p-4">
              <div className="grid items-start gap-4 sm:grid-cols-[1fr_1fr_auto]">
                <Field label={t('settings.connections.accountName')}>
                  {(id) => (
                    <Input
                      id={id}
                      value={String(a.name ?? '')}
                      placeholder={t('settings.connections.accountNamePlaceholder')}
                      onChange={(e) => patch(a.id, { name: e.target.value })}
                    />
                  )}
                </Field>
                {cfg.fields.slice(0, 1).map((f) => (
                  <BrokerField key={f.key} field={f} value={a[f.key]} onChange={(v) => patch(a.id, { [f.key]: v })} />
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:mt-6"
                  onClick={() => setAccounts((xs) => xs.filter((x) => x.id !== a.id))}
                  aria-label={t('settings.connections.removeAccount')}
                >
                  <Trash2 />
                </Button>
              </div>
              {cfg.fields.length > 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {cfg.fields.slice(1).map((f) => (
                    <BrokerField key={f.key} field={f} value={a[f.key]} onChange={(v) => patch(a.id, { [f.key]: v })} />
                  ))}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {cfg.secrets.map((s) => (
                  <SecretField
                    key={s.key}
                    label={s.label}
                    status={secrets[`${broker}.${a.id}.${s.key}`]}
                    value={pending[a.id]?.[s.key]}
                    onChange={(v) => setSecret(a.id, s.key, v)}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => void test(a)} disabled={result === 'pending'}>
                  {result === 'pending' ? t('common.testing') : t('common.test')}
                </Button>
                {result === 'pending' && cfg.testNote && <span className="text-xs text-muted-foreground">{cfg.testNote}</span>}
                {result && result !== 'pending' && <TestResult result={result} okText={result.ok ? cfg.okText(result) : undefined} />}
              </div>
            </div>
          );
        })}
      </SettingsCard>
      <SaveBar dirty={dirty} saving={update.isPending} onDiscard={() => { setAccounts((saved ?? []).map((a) => ({ ...a }))); setPending({}); }} onSave={() => void save()} />
    </div>
  );
}

function BrokerField({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <Field label={field.label} hint={field.hint}>
      {(id) =>
        field.kind === 'select' ? (
          <Select id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ) : field.kind === 'number' ? (
          <Input
            id={id}
            type="number"
            min={field.min}
            max={field.max}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          />
        ) : (
          <Input
            id={id}
            inputMode="numeric"
            autoComplete="off"
            placeholder={field.placeholder}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value.trim())}
          />
        )
      }
    </Field>
  );
}
