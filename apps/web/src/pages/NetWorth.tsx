import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AccountKind, AccountStat, StatisticsPayload } from '@wmm/shared';
import { PageHeader } from '@/components/layout/AppShell';
import { DataGate } from '@/components/DataGate';
import { tooltipStyle } from '@/components/charts/CashflowChart';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Segmented } from '@/components/ui/controls';
import { Alert, Badge, Skeleton } from '@/components/ui/misc';
import { Money, Private } from '@/components/metric/Money';
import { byKind } from '@/lib/kpis';
import { useFormat } from '@/lib/format';
import { useHistory } from '@/lib/queries';
import { isoDate } from '@/lib/utils';

const KIND_COLOR: Record<AccountKind, string> = {
  cash: 'var(--chart-2)',
  investment: 'var(--chart-1)',
  crypto: 'var(--chart-3)',
};

export default function NetWorth() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('networth.title')} />
      <DataGate>{(data) => <NetWorthContent data={data} />}</DataGate>
    </>
  );
}

function NetWorthContent({ data }: { data: StatisticsPayload }) {
  const { t } = useTranslation();
  const kinds = byKind(data);
  const pie = (Object.keys(kinds) as AccountKind[])
    .map((k) => ({ key: k, name: t(`kinds.${k}`), value: Math.max(0, kinds[k]) }))
    .filter((d) => d.value > 0);

  const accounts = [...data.assets.accounts].sort((a, b) => b.balanceEur - a.balanceEur);
  const holdings = [...(data.assets.investedStocks ?? []), ...(data.assets.cryptoHoldings ?? [])].sort(
    (a, b) => b.balanceEur - a.balanceEur,
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <NetWorthHistory current={data.assets.netWorthEur} />
        <Card>
          <CardHeader title={t('networth.allocation')} />
          <CardContent>
            <div className="relative mx-auto h-48 max-w-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
                    {pie.map((d) => (
                      <Cell key={d.key} fill={KIND_COLOR[d.key]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="text-[11px] text-muted-foreground">{t('metric.totalAssets')}</div>
                  <Money value={data.assets.totalEur} compact className="text-lg font-semibold" />
                </div>
              </div>
            </div>
            <ul className="mt-4 grid gap-2 text-sm">
              {pie.map((d) => (
                <li key={d.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: KIND_COLOR[d.key] }} />
                    {d.name}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs tabular text-muted-foreground">
                      {((d.value / Math.max(1, data.assets.totalEur)) * 100).toFixed(1)}%
                    </span>
                    <Money value={d.value} className="font-medium" />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title={t('networth.accounts')} />
        <CardContent className="pt-3">
          <AccountsTable accounts={accounts} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('networth.holdings')} />
          <CardContent className="pt-3">
            {holdings.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('networth.noHoldings')}</p>
            ) : (
              <ul className="divide-y text-sm">
                {holdings.map((h) => (
                  <li key={h.ticker} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{h.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {h.ticker} · <span className="private tabular">{t('networth.units', { amount: h.balance.toLocaleString(undefined, { maximumFractionDigits: 6 }) })}</span>
                      </div>
                    </div>
                    <Money value={h.balanceEur} className="font-semibold" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title={t('networth.liabilities')}
            action={<Money value={-data.assets.totalLiabilitiesEur} className="text-sm font-semibold text-negative" />}
          />
          <CardContent className="pt-3">
            {data.assets.liabilities.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('networth.noLiabilities')}</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.assets.liabilities.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Private className="truncate font-medium">{l.name}</Private>
                    <Money value={-Math.abs(l.balanceEur)} className="font-semibold" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      {(data.meta.approximations?.length ?? 0) > 0 && <Alert tone="info">{t('networth.estimated')}</Alert>}
    </div>
  );
}

function AccountsTable({ accounts }: { accounts: AccountStat[] }) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full text-sm sm:min-w-[560px]">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-2 font-medium">{t('networth.account')}</th>
            <th className="hidden py-2 font-medium sm:table-cell">{t('networth.type')}</th>
            <th className="hidden py-2 text-right font-medium md:table-cell">{t('networth.balance')}</th>
            <th className="py-2 text-right font-medium">{t('networth.valueEur')}</th>
            <th className="hidden py-2 text-right font-medium sm:table-cell">{t('networth.share')}</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className="border-t">
              <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                <Private>{a.name}</Private>
              </th>
              <td className="hidden py-2.5 sm:table-cell">
                {a.kind && (
                  <Badge tone={a.kind === 'cash' ? 'info' : a.kind === 'investment' ? 'primary' : 'warning'}>{t(`kinds.${a.kind}`)}</Badge>
                )}
              </td>
              <td className="hidden py-2.5 text-right text-muted-foreground md:table-cell">
                {a.currency !== 'EUR' ? (
                  <span className="private tabular" title={t('networth.rate', { currency: a.currency, rate: f.money(a.exchangeRate, { decimals: true }) })}>
                    {f.number(a.balance, 6)} {a.currency}
                  </span>
                ) : null}
              </td>
              <td className="py-2.5 text-right">
                <Money value={a.balanceEur} decimals className="font-semibold" />
              </td>
              <td className="hidden py-2.5 text-right tabular text-muted-foreground sm:table-cell">{f.percent(a.allocationPct ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Range = '1y' | '3y' | 'all';

function NetWorthHistory({ current }: { current: number }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [range, setRange] = useState<Range>('1y');
  const from = useMemo(() => {
    if (range === 'all') return '2000-01-01';
    const d = new Date();
    d.setFullYear(d.getFullYear() - (range === '1y' ? 1 : 3));
    return isoDate(d);
  }, [range]);
  const q = useHistory('netWorth', from, isoDate(new Date()));
  const points = (q.data?.points ?? []).filter((p) => p.value != null);

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title={t('networth.history')}
        description={<Money value={current} className="text-base font-semibold text-foreground" />}
        action={
          <Segmented<Range>
            label={t('networth.history')}
            value={range}
            onChange={setRange}
            options={[
              { value: '1y', label: '1Y' },
              { value: '3y', label: '3Y' },
              { value: 'all', label: t('metric.ranges.all') },
            ]}
          />
        }
      />
      <CardContent className="pt-3">
        {q.isLoading ? (
          <Skeleton className="h-64" />
        ) : points.length < 2 ? (
          <p className="grid h-64 place-items-center text-sm text-muted-foreground">{t('metric.historyEmpty')}</p>
        ) : (
          <div className="private-axis h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="nw-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => new Date(d).toLocaleDateString(f.locale, { month: 'short', year: '2-digit' })}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                />
                <YAxis
                  width={64}
                  tickFormatter={(v: number) => f.money(v, { compact: true })}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(d) => f.date(String(d))}
                  formatter={(v) => [f.money(Number(v)), t('metric.netWorth')]}
                />
                <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} fill="url(#nw-fill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
